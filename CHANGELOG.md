# Changelog

### v0.3.0

- Package renamed (rescoped) to `@charisma-ai/sdk`.

### v0.2.0

- The `debug` option has been replaced with the `version` option, which defaults to `undefined` (the latest published story version).

### v0.1.2

- The microphone now stops listening when a reply with `endStory` set to `true` is emitted.

### v0.1.1

- `AudioContext` is now created on-demand rather than on initialisation.

### v0.1.0

- Socket.io now forces websockets, skipping the long-polling check.

### v0.0.4

- Fixed issue where audio was not working on Safari.

### v0.0.3

- Microphone keeps better track of whether to resume speech recognition after speaking.

### v0.0.2

- Support for recording speech-to-text via Chrome SpeechRecognition.
  - New events `recognise-interim` and `recognise`.
  - Speech recognition is paused while the audio is played.

### v0.0.1

- Initial release.
- Support for `reply` and `start` client events, and `reply`, `start-typing` and `stop-typing` server events.
- Support for playing text-to-speech audio.
