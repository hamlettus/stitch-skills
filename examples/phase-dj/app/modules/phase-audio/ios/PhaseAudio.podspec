Pod::Spec.new do |s|
  s.name           = 'PhaseAudio'
  s.version        = '1.0.0'
  s.summary        = 'AVAudioEngine mixing graph for the PHASE DJ app'
  s.description    = 'Two-deck AVAudioEngine graph with crossfader gain, a sampler voice pool, and an internal mix tap for recording.'
  s.author         = ''
  s.homepage       = 'https://github.com/hamlettus/stitch-skills'
  s.platforms      = { :ios => '13.4' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
