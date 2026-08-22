import ExpoModulesCore

/// JS-facing surface for the PHASE audio graph.
///
/// Every function is async so the audio graph is only touched off the JS thread.
public class PhaseAudioModule: Module {

  private let audio = PhaseAudioEngine()

  public func definition() -> ModuleDefinition {
    Name("PhaseAudio")

    OnDestroy {
      self.audio.teardown()
    }

    /// Must be called once before any other function.
    AsyncFunction("prepare") {
      try self.audio.prepare()
    }

    // MARK: Decks

    AsyncFunction("loadDeck") { (deck: String, uri: String) -> Double in
      try self.audio.loadDeck(deck, uri: uri)
    }

    AsyncFunction("play") { (deck: String) in
      try self.audio.play(deck)
    }

    AsyncFunction("pause") { (deck: String) in
      try self.audio.pause(deck)
    }

    AsyncFunction("seek") { (deck: String, positionMs: Double) in
      try self.audio.seek(deck, positionMs: positionMs)
    }

    AsyncFunction("setGain") { (deck: String, value: Double) in
      try self.audio.setGain(deck, value: Float(value))
    }

    /// Polled by the JS playhead — cheap enough to call a few times a second.
    AsyncFunction("getDeckState") { (deck: String) -> [String: Any] in
      try self.audio.state(deck)
    }

    // MARK: Sampler

    AsyncFunction("loadSample") { (name: String, uri: String) in
      try self.audio.loadSample(name: name, uri: uri)
    }

    AsyncFunction("triggerSample") { (name: String) in
      try self.audio.triggerSample(name: name)
    }

    // MARK: Recording

    AsyncFunction("startRecording") { () -> Bool in
      try self.audio.startRecording()
    }

    AsyncFunction("stopRecording") { () -> [String: Any]? in
      try self.audio.stopRecording()
    }

    Property("isRecording") {
      self.audio.recording
    }
  }
}
