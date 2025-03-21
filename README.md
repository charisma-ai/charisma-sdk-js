# Charisma.ai SDK for JavaScript

```
pnpm i @charisma-ai/sdk
```

## Usage

```js
// main.js
import {
  Playthrough,
  createPlaythroughToken,
  createConversation,
} from "@charisma-ai/sdk";

let conversation;

async function start() {
  // Get a unique token for the playthrough.
  const { token } = await createPlaythroughToken({ storyId: 4 });

  // Create a new conversation.
  const { conversationUuid } = await createConversation(token);

  // Create a new playthrough.
  const playthrough = new Playthrough(token);

  // Join the conversation.
  conversation = playthrough.joinConversation(conversationUuid);

  // Handle messages in the conversation.
  conversation.on("message", (message) => {
    console.log(message.message.text);
  });

  conversation.on("problem", console.warn);

  // Prepare the listener to start the conversation when the playthrough is connected.
  playthrough.on("connection-status", (status) => {
    if (status === "connected") {
      conversation.start();
    }
  });

  await playthrough.connect();
}

// Send the reply to charisma.
function reply(message) {
  conversation.reply({ text: message });
}
```

## API Reference

There are two ways to use the API directly, either by importing `api`, which includes all the API methods, or you can import API methods individually, like `createPlaythroughToken`.

```js
import { api, createPlaythroughToken } from "@charisma-ai/sdk";

api.createPlaythroughToken();
createPlaythroughToken();
```

Most API methods are also callable using an instance of the `Playthrough` class, which automatically scopes the API calls to the playthrough `token` passed when creating the instance:

```js
const playthrough = new Playthrough(token);
// No need to pass `token` here!
playthrough.createConversation();
```

#### createPlaythroughToken

Use this to set up a new playthrough.

- `storyId` (`number`): The `id` of the story that you want to create a new playthrough for. The story must be published, unless a Charisma.ai user token has been passed and the user matches the owner of the story.
- `version` (`number`, optional): The `version` of the story that you want to create a new playthrough for. If omitted, it will default to the most recent published version. To get the draft version of a story, pass `-1` and an `apiKey`.
- `apiKey` (`string`, optional): To access draft, test or unpublished versions of your story, pass an `apiKey`. The API key can be found on the story overview page.
- `languageCode` (`string`, optional): To play a story in a language other than English (`en`, the default), pass a BCP-47 `languageCode`. For example, to play in Italian, use `it`.

Returns a promise that resolves with the token.

```js
const { token } = await createPlaythroughToken({
  storyId: 12,
  version: 4,
  apiKey: "...",
  languageCode: "en",
});
```

#### createConversation

A playthrough can have many simultaneous conversations. In order to start interacting, a conversation needs to be created, which can then be joined.

- `playthroughToken` (`string`): The token generated with `createPlaythroughToken`.

```js
const { conversationUuid } = await createConversation(token);
```

## Playthrough

Create a new `Playthrough` instance to connect to a playthrough and interact with the chat engine.

- `playthroughToken` (`string`): The `token` generated in `createPlaythroughToken`.

#### Playthrough.joinConversation

This makes the `Playthrough` instance listen out for events for a particular conversation, and returns a `Conversation` that events can be called on and event listeners attached.

- `conversationUuid` (`string`): The conversation UUID generated with `createConversation`.

Returns a `Conversation`, which can be used to send and receive events bound to that conversation.

```js
playthrough.joinConversation(conversationUuid);
```

#### Playthrough.connect

This is what kicks off the connection to the chat engine. Call this once you're ready to start sending and receiving events.

Returns an object with a `playerSessionId` property.

```js
await playthrough.connect();
```

#### Playthrough.disconnect

If you want to end the connection to the playthrough, you can call `playthrough.disconnect()`.

```js
playthrough.disconnect();
```

## Events

To interact with the story, events are sent to and from the server that the WebSocket is connected to.

### Events sent from client

#### conversation.start({ ... })

```js
{
  // For Pro stories, start the story at a particular subplot with the `startGraphReferenceId`.
  // It can be found by clicking '...' next to the subplot in the sidebar, and clicking 'Edit details'.
  // For Web Comic stories do not provide `startGraphReferenceId`, the story will start automatically from the first scene
  "startGraphReferenceId": "my-id", // Optional, default undefined
}
```

#### conversation.reply({ ... })

```js
{
  "text": "Please reply to this!"
}
```

#### conversation.tap({ ... })

This event has no fields.

#### conversation.action({ ... })

```js
{
  "action": "pick-up-book"
}
```

#### conversation.resume({ ... })

This event has no fields.

### Events received by client

#### conversation.on('message', (event) => { ... })

```js
{
  "message": {
    "text": "Greetings and good day.",
    "character": {
      "id": 20,
      "name": "Ted Baker",
      "avatar": "https://s3.charisma.ai/..."
    },
    "speech": {
      "duration": 203,
      "audio": /* either a buffer, or a URL */,
    }
    "metadata": {
      "myMetadata": "someValue"
    },
    "media": null
  },
  "endStory": false,
  "path": [{ "id": 1, "type": "edge" }, { "id": 2, "type": "node" }]
}
```

#### conversation.on('start-typing', () => { ... })

This event has no additional data.

#### conversation.on('stop-typing', () => { ... })

This event has no additional data.

#### conversation.on('action', (event) => { ... })

#### conversation.on('reply', (event) => { ... })

#### conversation.on('resume', (event) => { ... })

#### conversation.on('start', (event) => { ... })

#### conversation.on('tap', (event) => { ... })

When another player sends specific events to a Charisma playthrough, they are sent back to all other connected players, so that other players can perform actions based on the events, such as displaying their messages in UI.

The events that are currently echoed to all clients are `action`, `reply`, `resume`, `start` and `tap`.

**Important:** These events are **not** emitted for the player that sent the original corresponding event!

Each event includes its committed `eventId` and `timestamp` as well as the original payload (excluding the `speechConfig`).

#### conversation.on('problem', (event) => { ... })

If a problem occurs during a conversation, such as a pathway not being found after submitting a player message, `problem` will be emitted.

### Conversation helpers

#### conversation.setSpeechConfig(config)

This sets the speech configuration to use for all events in the conversation until set otherwise:

```json
{
  "encoding": ["ogg", "mp3"],
  "output": "buffer"
}
```

`encoding` is the file format of the resulting speech: `mp3`, `ogg`, `wav` or `pcm`. If an array, Charisma will use the first encoding that the voice supports, useful for cases where a voice synthesis service of a particular voice does not support the "default" encoding you wish to use.

`output` determines whether the speech received back is a `buffer` (a byte array) or whether it should instead be a `url` pointing to the audio file.

## AudioManager

The audio manager will handle the audio from characters, media and speech-to-text functionality.

```js
import { AudioManager } from "@charisma-ai/sdk";

const audio = new AudioManager({
  // AudioManager options
  handleTranscript: (transcript: string) => {
    console.log(transcript);
  },
});
```

#### AudioManager Options

| Option              | Type                               | Default                     | Description                                                                                                                             |
| ------------------- | ---------------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `duckVolumeLevel`   | `number`                           | 0                           | Volume level when ducking (0 to 1)                                                                                                      |
| `normalVolumeLevel` | `number`                           | 1                           | Regular volume level (0 to 1)                                                                                                           |
| `sttService`        | `"charisma/deepgram" \| "browser"` | `"charisma/deepgram"`       | Speech-to-text service to use (see below).                                                                                              |
| `sttUrl`            | `string`                           | `"https://stt.charisma.ai"` | Speech-to-text service URL.                                                                                                             |
| `streamTimeslice`   | `number`                           | 100                         | The number of milliseconds to record into each Blob. See https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/start#timeslice |
| `handleTranscript`  | `(transcript: string) => void`     |                             | Callback to handle transcripts.                                                                                                         |
| `handleStartSTT`    | `() => void`                       |                             | Callback to handle when speech-to-text starts. Can be used to update the UI.                                                            |
| `handleStopSTT`     | `() => void`                       |                             | Callback to handle when speech-to-text stops.                                                                                           |
| `handleError`       | `(error: string) => void`          | `console.error(error)`      | Callback to handle errors.                                                                                                              |
| `handleDisconnect`  | `(message: string) => void`        | `console.error(message)`    | Callback to handle when the transcription service disconnects.                                                                          |
| `handleConnect`     | `(message: string) => void`        | `console.log(message)`      | Callback to handle when the transcription service connects.                                                                             |
| `debugLogFunction`  | `(message: string) => void`        | `() => {}`                  | Callback to handle log messages for debugging.                                                                                          |

There are currently two speech-to-text services available:

- `charisma/deepgram`: Deepgram is a neural network based speech-to-text service that that can be accessed through Charsima.ai.
- `browser`: Some browsers have built-in speech recognition, which can be used to provide speech-to-text functionality. **This is only available in browsers that support `SpeechRecognition`. Please refer to [this browser compatibility table](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition#browser_compatibility) for more details.**

### Speech-to-text

#### audio.startListening(timeout?: number)

Starts listening for speech. This will call handleStartSTT() when the speech-to-text service starts.
Takes a `timeout` argument in milliseconds, which will automatically stop the speech-to-text service after the timeout. Defaults to 10000 (ten seconds) if not provided.

#### audio.stopListening()

Stops listening for speech. This will call handleStopSTT() when the speech-to-text service stops.

#### audio.connect(token: string, playerSessionId: string)

Connects the to the speech-to-text service using the playthrough token and player session id to validate. This is only needed when using the `charisma/deepgram` speech-to-text service.

The `playerSessionId` is returned from `playthrough.connect()`. See the `deepgram-stt` demo for an example.

#### audio.disconnect()

Disconnects from the speech-to-text service.

#### audio.resetTimeout(timeout: number)

Resets the timeout for the speech-to-text service to `timeout` in milliseconds. If this is not run, the speech-to-text service will default to a timeout of 10 seconds.
After the timeout, the speech-to-text service will automatically stop listening.

#### audio.browserIsSupported(): boolean

Returns `true` if the browser supports the `browser` speech recognition service.

### Audio Outputs Service

#### audio.initialise()

Initialises the audio for characters and media. This method _must_ be called before attempting to play audio from media nodes or character speech.

This method _must_ also be called from a user interaction event, such as a click or a keypress. This is due to a security restriction in some browsers. We recommend adding it to the "start" button the sets up your playthrough. See the demos for an example.

#### audio.playCharacterSpeech(audio: ArrayBuffer, options: AudioOutputsServicePlayOptions): Promise<void>

This plays the generated speech in the message event. Typically, you would want to use this in combination with a `message` conversation handler.

Returns a Promise that resolves once the speech has ended.

`options` is an object with two properties:

```ts
type SpeakerPlayOptions = {
  /**
   * Whether to interrupt the same track as the `trackId` passed (`track`), all currently playing audio (`all`), or not to interrupt anything (`none`). Default is `none`.
   */
  interrupt?: "track" | "all" | "none";
  /**
   * If you want to prevent a particular character to speak over themselves, a `trackId` can be set to a unique string. When playing another speech clip, if the same `trackId` is passed and `interrupt` is set to `true`, then the previous clip will stop playing. Default is unset.
   */
  trackId?: string;
};
```

#### audio.characterSpeechVolume

Get or set the volume of the character speech. Must be a number between 0 and 1.

### Media Track Audio

#### audio.mediaAudioPlay(audioTracks: AudioTrack[]): void

Will play the audio tracks in a message event. An empty array can also be passed here so it can be called on every message event.

#### audio.mediaAudioSetVolume(volume: number): void

Sets the volume of all media audio tracks. Must be a number between 0 and 1.

The volume set here will be multiplied by the volume set in the graph editor for each track. For example, if you set the graph editor volume to 0.5 and the SDK volume to 1, the final volume will be 0.5. If you set the graph editor volume to 0.5 and the SDK volume to 0.5, the final volume will be 0.25.

#### audio.mediaAudioToggleMute()

Will mute and unmute all media audio tracks.

#### audio.mediaAudioStopAll()

Will stop all media audio tracks.

## Questions

For further details or any questions, feel free to get in touch at [hello@charisma.ai](mailto:hello@charisma.ai), or head to the [Charisma docs](https://charisma.ai/docs)!
