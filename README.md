# Charisma.ai SDK for JavaScript

```
pnpm i @charisma-ai/sdk
```

## Usage

```html
<!-- index.html -->
<html>
  <body>
    <button onclick="start()">Start</button>
    <div id="messages"></div>
    <button id="record-button" onclick="toggleMicrophone(event)">
      Record
    </button>
    <input
      type="text"
      id="reply-input"
    />
    <button onclick="reply()">Send</button>

    <script type="module" src="main.js"></script>
  </body>
</html>

```

```js
// main.js
import {
  Playthrough,
  AudioManager,
  createPlaythroughToken,
  createConversation,
} from "@charisma-ai/sdk";

// Keep track of the recording statuses of the microphone so we can update the UI accordingly.
let recordingStatus: "recording" | "off" | "starting" = "off";

function handleTranscript(transcript: string) {
  document.getElementById("reply-input").value = transcript;
};

const audio = new AudioManager({
  handleTranscript,
});

let playthrough;
let conversation;

async function start() {
  const { token } = await createPlaythroughToken({ storyId: 4 });
  const { conversationUuid } = await createConversation(token);
  playthrough = new Playthrough(token);
  conversation = playthrough.joinConversation(conversationUuid);

  conversation.setSpeechConfig({
    encoding: ["ogg", "mp3"],
    output: "buffer",
  });
  
  conversation.on("message", (message) => {
    // Handle character messages, ignore the rest for this demo.
    const characterMessage = message.type === "character" ? message.message : null;
    if (!characterMessage) return;

    // Display the character message on the page.
    const displayedMessage = document.createElement("div").innerHTML = `<b>${characterMessage.character?.name}</b>: ${characterMessage.text}`;
    document.getElementById("messages").appendChild(displayedMessage);

    // Play character speech.
    if (characterMessage.speech) {
      audio.outputServicePlay(characterMessage.speech.audio, {
        trackId: characterMessage.character?.id
      });
    }

    // Play background audio.
    if (characterMessage.media.audioTracks.length > 0) {
      audio.mediaSrc = characterMessage.media.audioTracks[0].url;
      audio.mediaAudioFastSeek(0);
      audio.mediaAudioPlay();
    }

    // Stop all audio
    if (characterMessage.media.stopAllAudio) {
      audio.mediaAudioPause();
    }
  });

  conversation.on("problem", console.warn);
  
  // Prepart the listener to start the conversation when the playthrough is connected.
  playthrough.on("connection-status", (status) => {
    if (status === "connected") {
      conversation.start();
    }
  });

  await playthrough.connect();
  audio.connect(token);
}

// Handle clicking the send button.
function reply() {
  const replyInput = document.getElementById("reply-input").value.trim();
  if (!playthrough || !conversation || replyInput.length === 0) return;

  // Send the reply to charisma.
  conversation.reply({ text: replyInput });

  // Put player message on the page.
  const displayedMessage = document.createElement("div").innerHTML = `<b>You</b>: ${replyInput}`;
  document.getElementById("messages").appendChild(displayedMessage);

  // Clear the input field.
  document.getElementById("reply-input").value = "";
}

function toggleMicrophone() {
  if (recordingStatus === "off") {
    audio.startListening();
    recordingStatus = "starting";
  } else if (recordingStatus === "recording") {
    audio.stopListening();
    recordingStatus = "off";
  }
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

- `playthroughToken` (`number`): The `token` generated in `createPlaythroughToken`.

#### Playthrough.joinConversation

This makes the `Playthrough` instance listen out for events for a particular conversation, and returns a `Conversation` that events can be called on and event listeners attached.

- `conversationUuid` (`string`): The conversation UUID generated with `createConversation`.

Returns a `Conversation`, which can be used to send and receive events bound to that conversation.

```js
playthrough.joinConversation(conversationUuid);
```

#### Playthrough.connect

This is what kicks off the connection to the chat engine. Call this once you're ready to start sending and receiving events.

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
  // Volume level when ducking (0 to 1). Optional.
  duckVolumeLevel: 0,
  // Regular volume level (0 to 1). Optional.
  normalVolumeLevel: 1,
  // Speech-to-text service to use (see below). Optional - defaults to "charisma/deepgram".
  sttService: "charisma/deepgram",
  // Callback to handle transcripts
  handleTranscript: (transcript: string) => {},
  // Callback to handle when speech-to-text starts. Can be used to update the UI.
  handleStartSTT: () => {},
  // Callback to handle when speech-to-text stops.
  handleStopSTT: () => {},
  // Callback to handle errors. Optional - defaults to console.error.
  handleError: (error: string) => {} 
})
```

There are currently two speech-to-text services available:
- `charisma/deepgram`: Deepgram is a neural network based speech-to-text service that that can be accessed through Charsima.ai.
- `browser`: Some browsers have built-in speech recognition, which can be used to provide speech-to-text functionality. **This is only available in browsers that support `SpeechRecognition`. Please refer to [this browser compatibility table](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition#browser_compatibility) for more details.**

### Speech-to-text

#### audio.startListening()

Starts listening for speech. This will call handleStartSTT() when the speech-to-text service starts.

#### audio.stopListening()

Stops listening for speech. This will call handleStopSTT() when the speech-to-text service stops.

#### audio.connect(token: string)

Connects the to the speech-to-text service using the playthrough token to validate. This is only needed when using the `charisma/deepgram` speech-to-text service.

#### audio.resetTimeout(timeout: number)

Resets the timeout for the speech-to-text service to `timeout` in milliseconds. If this is not run, the speech-to-text service will default to a timeout of 10 seconds.
After the timeout, the speech-to-text service will automatically stop listening.

#### audio.browserIsSupported(): boolean

Returns true if the browser supports the `browser` speech recognition service.

### Audio Outputs Service

#### outputServicePlay(audio: ArrayBuffer, options: AudioOutputsServicePlayOptions): Promise<void>

This plays the generated speech in the message event. Typically, you would want to use this in combination with a `message` conversation handler. You may also wish to pause the microphone while this happens.

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

This method can be used like this:

```js
conversation.on("message", async (data) => {
  if (data.message.speech) {
    audio.stopListening();
    await audio.outputServicePlay(data.message.speech.audio, {
      trackId: message.message.character?.id,
      interrupt: "track",
    });
    audio.startListening();
  }
});
```

### Media Audio

> Docs TBC

## Questions

For further details or any questions, feel free to get in touch at [hello@charisma.ai](mailto:hello@charisma.ai), or head to the [Charisma docs](https://charisma.ai/docs)!
