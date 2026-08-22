import AVFoundation

/// Errors surfaced to JS through the Expo module layer.
enum PhaseAudioError: Error, LocalizedError {
  case unknownDeck(String)
  case loadFailed(String)
  case notLoaded(String)
  case recordingFailed(String)

  var errorDescription: String? {
    switch self {
    case .unknownDeck(let d): return "Unknown deck '\(d)' (expected 'A' or 'B')"
    case .loadFailed(let m): return "Could not load audio: \(m)"
    case .notLoaded(let d): return "Deck \(d) has no track loaded"
    case .recordingFailed(let m): return "Recording failed: \(m)"
    }
  }
}

/// One playback deck: a player node feeding its own gain mixer.
private final class Deck {
  let id: String
  let player = AVAudioPlayerNode()
  let gain = AVAudioMixerNode()

  var file: AVAudioFile?
  var totalFrames: AVAudioFramePosition = 0
  var sampleRate: Double = 44_100

  /// Frame the current scheduled segment began at.
  var segmentStartFrame: AVAudioFramePosition = 0
  /// Frame to resume from when paused.
  var pausedFrame: AVAudioFramePosition = 0
  var isPlaying = false

  init(id: String) { self.id = id }
}

/// Two-deck mixing graph.
///
/// Layout:  deckA.player → deckA.gain ┐
///          deckB.player → deckB.gain ┼→ mainMixerNode → output
///          sampler voices ───────────┘
///
/// A tap on `mainMixerNode` captures exactly what the listener hears — decks,
/// crossfader position, and sampler hits — with no microphone involved.
final class PhaseAudioEngine {

  private let engine = AVAudioEngine()
  private let deckA = Deck(id: "A")
  private let deckB = Deck(id: "B")

  /// Fixed pool of voices so overlapping one-shots don't cut each other off.
  private var samplerVoices: [AVAudioPlayerNode] = []
  private let samplerGain = AVAudioMixerNode()
  private var samplerBuffers: [String: AVAudioPCMBuffer] = [:]
  private var nextVoice = 0
  private static let voiceCount = 8

  private var recordFile: AVAudioFile?
  private var isRecording = false
  private var recordStartedAt: Date?

  // MARK: - Lifecycle

  func prepare() throws {
    guard !engine.isRunning else { return }

    let session = AVAudioSession.sharedInstance()
    // .playback (not .playAndRecord): the mix tap reads our own graph, so
    // recording the mix never needs microphone access.
    try session.setCategory(.playback, mode: .default, options: [])
    try session.setActive(true)

    let standard = AVAudioFormat(standardFormatWithSampleRate: 44_100, channels: 2)!

    for deck in [deckA, deckB] {
      engine.attach(deck.player)
      engine.attach(deck.gain)
      engine.connect(deck.player, to: deck.gain, format: standard)
      engine.connect(deck.gain, to: engine.mainMixerNode, format: standard)
    }

    engine.attach(samplerGain)
    engine.connect(samplerGain, to: engine.mainMixerNode, format: standard)
    for _ in 0..<Self.voiceCount {
      let voice = AVAudioPlayerNode()
      engine.attach(voice)
      engine.connect(voice, to: samplerGain, format: standard)
      samplerVoices.append(voice)
    }

    engine.prepare()
    try engine.start()
  }

  func teardown() {
    if isRecording { _ = try? stopRecording() }
    engine.stop()
    try? AVAudioSession.sharedInstance().setActive(false)
  }

  private func deck(_ id: String) throws -> Deck {
    switch id.uppercased() {
    case "A": return deckA
    case "B": return deckB
    default: throw PhaseAudioError.unknownDeck(id)
    }
  }

  // MARK: - Deck loading

  /// Accepts both `file://` URIs and bare filesystem paths.
  private static func resolve(_ uri: String) -> URL {
    if let url = URL(string: uri), url.scheme != nil { return url }
    return URL(fileURLWithPath: uri)
  }

  /// Loads a file onto a deck. Returns duration in milliseconds.
  func loadDeck(_ id: String, uri: String) throws -> Double {
    let d = try deck(id)
    let url = Self.resolve(uri)

    let file: AVAudioFile
    do {
      file = try AVAudioFile(forReading: url)
    } catch {
      throw PhaseAudioError.loadFailed(error.localizedDescription)
    }

    if d.isPlaying { d.player.stop() }
    d.player.reset()

    // The player must output the file's own format; the gain mixer converts
    // downstream, so odd sample rates still land correctly in the main mix.
    let format = file.processingFormat
    engine.disconnectNodeOutput(d.player)
    engine.connect(d.player, to: d.gain, format: format)

    d.file = file
    d.totalFrames = file.length
    d.sampleRate = format.sampleRate
    d.segmentStartFrame = 0
    d.pausedFrame = 0
    d.isPlaying = false

    return Double(file.length) / format.sampleRate * 1000.0
  }

  // MARK: - Transport

  func play(_ id: String) throws {
    let d = try deck(id)
    guard let file = d.file else { throw PhaseAudioError.notLoaded(id) }
    guard !d.isPlaying else { return }

    if !engine.isRunning { try engine.start() }

    let from = min(d.pausedFrame, max(0, d.totalFrames - 1))
    let remaining = AVAudioFrameCount(max(0, d.totalFrames - from))
    guard remaining > 0 else { return }

    d.segmentStartFrame = from
    d.player.scheduleSegment(file, startingFrame: from, frameCount: remaining, at: nil)
    d.player.play()
    d.isPlaying = true
  }

  func pause(_ id: String) throws {
    let d = try deck(id)
    guard d.isPlaying else { return }
    d.pausedFrame = currentFrame(d)
    d.player.pause()
    d.isPlaying = false
  }

  func seek(_ id: String, positionMs: Double) throws {
    let d = try deck(id)
    guard d.file != nil else { throw PhaseAudioError.notLoaded(id) }
    let frame = AVAudioFramePosition(positionMs / 1000.0 * d.sampleRate)
    let clamped = max(0, min(frame, max(0, d.totalFrames - 1)))
    let wasPlaying = d.isPlaying

    d.player.stop()
    d.isPlaying = false
    d.pausedFrame = clamped
    if wasPlaying { try play(id) }
  }

  /// Linear gain, 0...1. Drives the crossfader.
  func setGain(_ id: String, value: Float) throws {
    let d = try deck(id)
    d.gain.outputVolume = max(0, min(1, value))
  }

  private func currentFrame(_ d: Deck) -> AVAudioFramePosition {
    guard d.isPlaying,
          let nodeTime = d.player.lastRenderTime,
          let playerTime = d.player.playerTime(forNodeTime: nodeTime) else {
      return d.pausedFrame
    }
    let frame = d.segmentStartFrame + playerTime.sampleTime
    return max(0, min(frame, d.totalFrames))
  }

  /// Snapshot of a deck for the JS playhead.
  func state(_ id: String) throws -> [String: Any] {
    let d = try deck(id)
    let frame = currentFrame(d)
    let positionMs = d.sampleRate > 0 ? Double(frame) / d.sampleRate * 1000.0 : 0
    let durationMs = d.sampleRate > 0 ? Double(d.totalFrames) / d.sampleRate * 1000.0 : 0
    // A segment that ran to the end leaves the node stopped but flagged playing.
    let finished = d.isPlaying && d.totalFrames > 0 && frame >= d.totalFrames - 1
    if finished {
      d.isPlaying = false
      d.pausedFrame = 0
      d.player.stop()
    }
    return [
      "loaded": d.file != nil,
      "playing": d.isPlaying,
      "positionMs": positionMs,
      "durationMs": durationMs,
      "finished": finished,
    ]
  }

  // MARK: - Sampler

  func loadSample(name: String, uri: String) throws {
    let url = Self.resolve(uri)
    let file: AVAudioFile
    do {
      file = try AVAudioFile(forReading: url)
    } catch {
      throw PhaseAudioError.loadFailed("\(name): \(error.localizedDescription)")
    }
    guard let buffer = AVAudioPCMBuffer(
      pcmFormat: file.processingFormat,
      frameCapacity: AVAudioFrameCount(file.length)
    ) else {
      throw PhaseAudioError.loadFailed("\(name): could not allocate buffer")
    }
    try file.read(into: buffer)
    samplerBuffers[name] = buffer
  }

  func triggerSample(name: String) throws {
    guard let buffer = samplerBuffers[name] else { return }
    if !engine.isRunning { try engine.start() }

    let voice = samplerVoices[nextVoice]
    nextVoice = (nextVoice + 1) % samplerVoices.count

    // Voices are connected at the standard format; reconnect if this buffer
    // differs so playback rate stays correct.
    if voice.outputFormat(forBus: 0).sampleRate != buffer.format.sampleRate {
      engine.disconnectNodeOutput(voice)
      engine.connect(voice, to: samplerGain, format: buffer.format)
    }

    voice.stop()
    voice.scheduleBuffer(buffer, at: nil, options: [.interrupts], completionHandler: nil)
    voice.play()
  }

  // MARK: - Recording the internal mix

  func startRecording() throws -> Bool {
    guard !isRecording else { return true }
    if !engine.isRunning { try engine.start() }

    let mixer = engine.mainMixerNode
    let tapFormat = mixer.outputFormat(forBus: 0)

    let dir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
    let url = dir.appendingPathComponent("phase-mix-\(Int(Date().timeIntervalSince1970)).m4a")

    let settings: [String: Any] = [
      AVFormatIDKey: kAudioFormatMPEG4AAC,
      AVSampleRateKey: tapFormat.sampleRate,
      AVNumberOfChannelsKey: tapFormat.channelCount,
      AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue,
    ]

    do {
      recordFile = try AVAudioFile(forWriting: url, settings: settings)
    } catch {
      throw PhaseAudioError.recordingFailed(error.localizedDescription)
    }

    mixer.installTap(onBus: 0, bufferSize: 4096, format: tapFormat) { [weak self] buffer, _ in
      guard let self, let file = self.recordFile else { return }
      // Runs on the audio thread: never trap here. `write` requires the buffer
      // format to match the file's processingFormat, which holds because the
      // file was created from this same tap format.
      try? file.write(from: buffer)
    }

    isRecording = true
    recordStartedAt = Date()
    return true
  }

  /// Stops the tap and returns the finished file's URI and duration.
  func stopRecording() throws -> [String: Any]? {
    guard isRecording else { return nil }
    engine.mainMixerNode.removeTap(onBus: 0)
    isRecording = false

    let url = recordFile?.url
    // Releasing the file closes and finalizes the container.
    recordFile = nil

    let elapsed = recordStartedAt.map { Date().timeIntervalSince($0) } ?? 0
    recordStartedAt = nil

    guard let url else { return nil }
    return ["uri": url.absoluteString, "durationMs": elapsed * 1000.0]
  }

  var recording: Bool { isRecording }
}
