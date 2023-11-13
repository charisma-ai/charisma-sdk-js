# Changelog

### v4.0.1

- Fixed an issue where speech recognition was using an incorrect sample rate.

### v4.0.0

- **BREAKING:** This packages now exports ES Module only.
- **BREAKING:** An implementation of `fetch` is no longer included with this library. Consumers of this library should ensure their environment supports `fetch`.
- **BREAKING:** This library now relies on having `URLSearchParams` available in the environment.
- **BREAKING:** This library now relies on having `BigInt` available in the environment.
- **BREAKING:** `playthroughId`s and `conversationId`s have been changed from `number` to `string` type everywhere in this SDK, and renamed to `playthroughUuid` and `conversationUuid`.
- **BREAKING:** `api.createPlaythroughToken`, `api.createConversation` and `api.createCharacterConversation` all now return an object instead of a scalar, to facilitate any future changes to these methods.
- **BREAKING:** `memories` in `getPlaythroughInfo` and in the `message` event now return `saveValue`s as JSON instead of only as strings. For example, counter memories are now actually `number`s and boolean memories are now actually `boolean`s.
- **BREAKING:** `getMessageHistory` has been removed, and `getEventHistory` added as a more fully-featured alternative with much greater support for filtering, and can return all event types.
- `setMemory` now accepts any JSON values instead of only strings.
- **BREAKING:** Speech recognition stream now uses common objects to start up, deliver results and stop, regardless of which downstream service is selected.
- Add start and stop events to the speech recognition stream.

### v3.9.0

- Added `result` event to `Microphone` so clients can subscribe to raw `SpeechRecognition` events.
- `recognise` and `recognise-interim` now emit the text of the _last_ result instead of the _first_ result in the `SpeechRecognition` event if `continuous` is `true`.

### v3.8.0

- Multiple memories can now be set at once using the `setMemory` call.

### v3.7.0

- Add support for `forkPlaythrough` API. This enables a player to upgrade to the latest published version from their old playthrough, copying across memories and emotions into the new playthrough, and returning the new token. Note that conversations are not carried across.

### v3.6.1

- `problem` events scoped to a conversation can now be listened to via `conversation.on("problem", ...)`

### v3.6.0

- It's now possible to specify multiple supported speech encodings in `speechConfig` by passing an array instead of a string. Charisma will use the first encoding that the voice synthesis service supports.
- Added experimental support for intermediate client events. These events can be sent to Charisma to prevent characters from talking if the player is still speaking or typing. This can only be enabled for a story by getting in touch at [hello@charisma.ai](mailto:hello@charisma.ai).

### v3.5.0

- Added support for Decentraland.

### v3.4.2

- SDK info is now also sent upon reconnection to the room.

### v3.4.1

- `package.json` now references correct emitted types location.

### v3.4.0

- Added `languageCode` option to `createPlaythroughToken`, to play Charisma stories in languages other than English.
- Added SDK info to joining a room, for Charisma to track which SDK versions are in use.

### v3.3.0

- It's now possible to subscribe to events that are sent from other players, such as other players' messages. This can be done by adding a subscriber to a conversation to listen for the corresponding event, e.g. `conversation.on("reply", () => { /* remote player's reply */ })`. These handlers will _not_ be fired for messages sent from the local connected client, only for remote clients.
- Add missing `graphId: number` to `MessagePathItem` type.
- Updated dependencies.

### v3.2.0

- Added `startGraphId` and `startGraphReferenceId` to `StartEvent` to start from a specific graph ID.
- Added experimental `pause` and `play` methods to `Playthrough`.

### v3.1.0

- Support for action node/event.
- `SpeechRecognitionStopOptions` is now exported.

### v3.0.0

There is a new emotion engine in Charisma! As a result...

- `message.characterMoods` has been removed and replaced with `message.emotions`. This contains each character's current mood and relationship with the player, and any active feeling effects.
- `setMood` has been removed. We may add an equivalent API for the new emotion engine in the future. Let us know about your use case if this interests you!

### v2.3.0

- `Microphone.stopListening()` now accepts an `options` parameter with a single option `waitForLastResult`. If set to `true`, then the `recognise` will be called a final time with the result of the audio captured so far. If `false`, the operation will be aborted, so no additional `recognise` event will occur.

### v2.2.0

- `Speaker.play()` now accepts an `options` parameter as its second parameter instead of a boolean value (which used to represent `interrupt`). This change is backwards compatible, but the old boolean way is deprecated and will be removed in the next major release.
  - `options` contains two parameters: `trackId` and `interrupt`. `trackId` can be used to interrupt only a particular track, for example, to prevent a character talking over themselves. `interrupt` can now be configured to `all` (interrupt all playing audio), `track` (interrupt the specified `trackId` if playing), or `none` (don't interrupt any audio).

### v2.1.0

- Adds the option to pass an `apiKey` to use for authentication for playthrough token creation. This is now the recommended way to authenticate as API keys do not expire (unless regenerated) and are more secure than the `userToken`. `userToken` should no longer be used.

### v2.0.0

This release makes **several breaking changes**. The main change is replacing `socket.io` with `colyseus.js`.

- Replaces `socket.io` with `colyseus.js`.
  - Due to how Colyseus serializes data, `audio` is now an `ArrayBuffer` instead of an object with the `data` property.
- API methods and the `Playthrough` constructor now accept a `baseUrl` option, which is used in preference to `globalBaseUrl`. `globalBaseUrl` is now set with `setGlobalBaseUrl` instead of `setBaseUrl`.
- API methods are now individually exported instead of being static methods on the Charisma class, as well as being exported under a bracket `api` object.
- Improved the implementation of `Microphone`.
- Replace multiple connection events from `Charisma` (`connect`, `disconnect` etc) with single `connection-status` event.
- The `Charisma` class has been renamed to `Playthrough`.
- The `cleanup` function has been renamed to `disconnect`.

### v1.10.0

- Change `imageLayers` field to an array of object, each including `url`, `resizeMode` and `points`.

### v1.9.1

- Add `isImpactShareable` and `impactImageUrl` fields to impacts, and fix the type of impact `id`s to be `string`s.

### v1.9.0

- **BREAKING CHANGE**: `eventId`s are now emitted as `string`s. Please upgrade to this version to continue using the reconnection "catch-up" logic (though everything else should work).

### v1.8.1

- `Speaker` will no longer try to play audio if the context's state is not `running`. This resolves an issue where the user has not granted permission for the audio context to play sound, and so the `play(...)` promise never resolves.

### v1.8.0

- Reconnecting will now fetch and emit messages that were emitted from the server after the last received message.
- Add `impacts` field to `GetPlaythroughResult` type.

### v1.7.0

- Pass through more events: `reconnect`, `reconnecting`, `disconnect` and `problem`.
- Added types for new `panel` message, and added bubble-related types onto the `media` key.
- Adjusted `setMemory` type to accept `null`.
- Removes `scene-complete` event and `stopOnSceneComplete` option.
- Adds `episode-complete` event. The chat engine automatically stops on episode end if the episode is started by an app user.
- Adds `restartFromEpisodeId` and `restartFromEpisodeIndex` methods and removes `restartFromScene` method.

### v1.6.1

- GET requests no longer try to add a body to the request.

### v1.6.0

- Add `start` and `stop` events to `Speaker`.

### v1.5.0

- Adds support for use in Node.js.

### v1.4.0

- `Microphone.startListening(timeout)` now has a timeout parameter to automatically stop the microphone after `timeout` milliseconds.
  - `Microphone.resetTimeout(timeout)` will reset the timeout to `timeout` milliseconds.
- Microphone now emits `start` and `stop` events, particularly useful in conjuction with timeout.

### v1.3.0

- Add an `interrupt` option to `Speaker` to ensure replies don't overlap.
- **Breaking**: Target ES2018; drop support for pre-ES2018 environments.

### v1.2.0

- Add `restartFromScene` method to SDK. This can be used to reset the playthrough to the state it was in at the beginning of a particular scene.
- Exports more types and adjusts message types to include `eventId`, `timestamp` and `memories`.

### v1.1.0

- Add `resume` event to SDK. This can be used to resume a conversation from where it left off.

### v1.0.5

- Use `webkitAudioContext` for `Speaker` on Safari.

### v1.0.4

- Export the `Impact` type.

### v1.0.3

- `impacts` are now objects containing their ID as well as the `impact` string.

### v1.0.2

- Rename `setStopOnSceneEnd` to `setStopOnSceneComplete` to ensure consistency with the event name.

### v1.0.1

- Fix `createPlaythroughToken` throwing an error when both `version` and `userToken` are not provided.

### v1.0.0

- Initial stable release.
- Completely overhauls the SDK API, please see the [README](./README.md) for more details on how to use the newer, conversation-based API.

## Past major versions

### v0.9.2

- Pass data (containing `impacts`) through on scene complete event.

### v0.9.1

- Pass `stopOnSceneComplete` through to the `CharismaInstance`.

### v0.9.0

- Add `stopOnSceneComplete` option to prevent automatically continuing between scenes.

### v0.8.3

- Add `media` field onto the character message type.

### v0.8.2

- Add `tapToContinue` to message history type.

### v0.8.1

- Add `timestamp` to messages returned from `getMessageHistory`.
- Improved type for `getMessageHistory`.

### v0.8.0

- Can now specify `playthroughToken` to re-use a playthrough instead of creating a new one when connecting.
- Can now fetch message history of the playthrough using `charisma.getMessageHistory`.

### v0.7.3

- Fix `IMessageCharacter.speech` type.

### v0.7.2

- `ISynthesisConfig` and some additional types are now exported.

### v0.7.1

- `speech` now takes a config object as well as a boolean. It can specify the audio encoding to use and whether it returns the raw audio data, or a link to an audio file.

### v0.7.0

- BREAKING: The `reply` event has been renamed to `message`, and now has a `type` field on the payload to distinguish between `character` and `media` events. Other fields have been refactored, such as `character` and `speech`. Please consult [src/types.ts](src/types.ts) to find the new message format.
- A new `tap` event is available for the client to send.

### v0.6.0

- Accidentally published version, but never tagged as `latest`.

### v0.5.1

- Fix broken 0.5.0 publish.

### v0.5.0

- Removed `browser` field from `package.json`. Consumers can use the UMD directly from unpkg.
- Removed `actIndex` as it is no longer supported.

### v0.4.2

- Buffer `set-memory` events until `status: 'ready'` is received.

### v0.4.1

- `actIndex` and `sceneIndex` can now be set on the `start` event to start from a specific story scene.

### v0.4.0

- **BREAKING**: UMD name changed from `Charisma` to `CharismaSDK`. The ES/CJS builds now don't bundle their dependencies.
- Added `setMemory` method to directly set a memory.
- Fixed all ID types to be `number`, not `string`.

### v0.3.1

- Passing no `version` to the `connect` method now results in using the latest published version, rather than the draft version.

### v0.3.0

- Package renamed (rescoped) to `@charisma-ai/sdk`.

### v0.2.0

- The `debug` option has been replaced with the `version` option, which defaults to `undefined` (the latest published story version).

### v0.1.2

- The microphone now stops listening when a reply with `endStory` set to `true` is emitted.

### v0.1.1

- `AudioContext` is now created on-demand rather than on initialisation.

### v0.1.0

- Socket.io now forces websockets, skipping the long-polling check.

### v0.0.4

- Fixed issue where audio was not working on Safari.

### v0.0.3

- Microphone keeps better track of whether to resume speech recognition after speaking.

### v0.0.2

- Support for recording speech-to-text via Chrome SpeechRecognition.
  - New events `recognise-interim` and `recognise`.
  - Speech recognition is paused while the audio is played.

### v0.0.1

- Initial release.
- Support for `reply` and `start` client events, and `reply`, `start-typing` and `stop-typing` server events.
- Support for playing text-to-speech audio.
