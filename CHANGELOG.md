# Changelog

### v1.6.1

- GET requests no longer try to add a body to the request.

### v1.6.0

- Add `start` and `stop` events to `Speaker`.

### v1.5.0

- Adds support for use in Node.js.

### v1.4.0

- `Microphone.startListening(timeout)` now has a timeout parameter to automatically stop the microphone after `timeout` milliseconds.
  - `Microphone.resetTimeout(timeout)` will reset the timeout to `timeout` milliseconds.
- Microphone now emits `start` and `stop` events, particularly useful in conjuction with timeout.

### v1.3.0

- Add an `interrupt` option to `Speaker` to ensure replies don't overlap.
- **Breaking**: Target ES2018; drop support for pre-ES2018 environments.

### v1.2.0

- Add `restartFromScene` method to SDK. This can be used to reset the playthrough to the state it was in at the beginning of a particular scene.
- Exports more types and adjusts message types to include `eventId`, `timestamp` and `memories`.

### v1.1.0

- Add `resume` event to SDK. This can be used to resume a conversation from where it left off.

### v1.0.5

- Use `webkitAudioContext` for `Speaker` on Safari.

### v1.0.4

- Export the `Impact` type.

### v1.0.3

- `impacts` are now objects containing their ID as well as the `impact` string.

### v1.0.2

- Rename `setStopOnSceneEnd` to `setStopOnSceneComplete` to ensure consistency with the event name.

### v1.0.1

- Fix `createPlaythroughToken` throwing an error when both `version` and `userToken` are not provided.

### v1.0.0

- Initial stable release.
- Completely overhauls the SDK API, please see the [README](./README.md) for more details on how to use the newer, conversation-based API.

## Past major versions

### v0.9.2

- Pass data (containing `impacts`) through on scene complete event.

### v0.9.1

- Pass `stopOnSceneComplete` through to the `CharismaInstance`.

### v0.9.0

- Add `stopOnSceneComplete` option to prevent automatically continuing between scenes.

### v0.8.3

- Add `media` field onto the character message type.

### v0.8.2

- Add `tapToContinue` to message history type.

### v0.8.1

- Add `timestamp` to messages returned from `getMessageHistory`.
- Improved type for `getMessageHistory`.

### v0.8.0

- Can now specify `playthroughToken` to re-use a playthrough instead of creating a new one when connecting.
- Can now fetch message history of the playthrough using `charisma.getMessageHistory`.

### v0.7.3

- Fix `IMessageCharacter.speech` type.

### v0.7.2

- `ISynthesisConfig` and some additional types are now exported.

### v0.7.1

- `speech` now takes a config object as well as a boolean. It can specify the audio encoding to use and whether it returns the raw audio data, or a link to an audio file.

### v0.7.0

- BREAKING: The `reply` event has been renamed to `message`, and now has a `type` field on the payload to distinguish between `character` and `media` events. Other fields have been refactored, such as `character` and `speech`. Please consult [src/types.ts](src/types.ts) to find the new message format.
- A new `tap` event is available for the client to send.

### v0.6.0

- Accidentally published version, but never tagged as `latest`.

### v0.5.1

- Fix broken 0.5.0 publish.

### v0.5.0

- Removed `browser` field from `package.json`. Consumers can use the UMD directly from unpkg.
- Removed `actIndex` as it is no longer supported.

### v0.4.2

- Buffer `set-memory` events until `status: 'ready'` is received.

### v0.4.1

- `actIndex` and `sceneIndex` can now be set on the `start` event to start from a specific story scene.

### v0.4.0

- **BREAKING**: UMD name changed from `Charisma` to `CharismaSDK`. The ES/CJS builds now don't bundle their dependencies.
- Added `setMemory` method to directly set a memory.
- Fixed all ID types to be `number`, not `string`.

### v0.3.1

- Passing no `version` to the `connect` method now results in using the latest published version, rather than the draft version.

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
