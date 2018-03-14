# Changelog

### v0.0.3

* Microphone keeps better track of whether to resume speech recognition after speaking.

### v0.0.2

* Support for recording speech-to-text via Chrome SpeechRecognition.
  * New events `recognise-interim` and `recognise`.
  * Speech recognition is paused while the audio is played.

### v0.0.1

* Initial release.
* Support for `reply` and `start` client events, and `reply`, `start-typing` and `stop-typing` server events.
* Support for playing text-to-speech audio.
