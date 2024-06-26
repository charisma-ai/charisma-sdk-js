# Charisma.ai SDK for JavaScript

```
pnpm i @charisma-ai/sdk
```

## Usage

```js
import {
  Playthrough,
  Microphone,
  Speaker,
  createPlaythroughToken,
  createConversation,
} from "@charisma-ai/sdk";

async function run() {
  const { token } = await createPlaythroughToken({ storyId: 4 });
  const { conversationUuid } = await createConversation(token);

  const playthrough = new Playthrough(token);
  const speaker = new Speaker();
  const microphone = new Microphone();

  const conversation = playthrough.joinConversation(conversationUuid);
  conversation.on("start-typing", () =>
    console.log("Character started typing..."),
  );
  conversation.on("stop-typing", () =>
    console.log("Character stopped typing..."),
  );
  conversation.on("message", (message) => {
    console.log(message);
    if (message.message.speech) {
      microphone.stopListening();
      speaker.play(message.message.speech.audio, {
        trackId: message.message.character?.id,
        interrupt: "track",
      });
      microphone.startListening();
    }
  });
  conversation.on("problem", console.warn);
  conversation.setSpeechConfig({
    encoding: ["ogg", "mp3"],
    output: "buffer",
  });

  playthrough.connect();
  conversation.start({
    // required for pro stories so they know where to start. Find the uuid at '...' -> 'Edit details' next to the subplot in the sidebar.
    // do not provide it for web comic stories as they will start automatically from the first scene
    startGraphReferenceId: "my-id",
  });

  microphone.startListening();
  microphone.on("recognise", (text) => conversation.reply({ text }));
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

#### Playthrough.startSpeechRecognition({ ... })

Opens a stream of audio chunks from the user's microphone to the server. Charisma provides a single interface to make it easy to switch between Speech To Text (STT) providers, and returns results in a simplified format, assuming input from one speaker.
See [speech-recognition-start in the Charisma docs](https://charisma.ai/docs/sdk-integration/speech-recognition) for more details.
If the service is started successfully, a "speech-recognition-started" event will be returned from from the server, and [speech-recognition-result](https://charisma.ai/docs/sdk-integration/speech-recognition#speech-recognition-result) events.
Otherwise look for a [speech-recognition-error](https://charisma.ai/docs/sdk-integration/speech-recognition#speech-recognition-error) on the websockets stream.

```js
playthrough.startSpeechRecognition();
```

```js
playthrough.startSpeechRecognition({
  service: "unified:deepgram",
  language: "es",
  customServiceParameters: {
    endpointing: 1200,
    utterance_end_ms: 2000,
  },
  // Many further optional parameters,
  // see docs for speech-recognition-start
});
```

#### Playthrough.stopSpeechRecognition

Sends a request to stop a speech recognition stream, which will be confirmed by a speech-recognition-stopped event on the stream.

```js
playthrough.stopSpeechRecognition();
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

## Microphone

The microphone can be used to provide speech-to-text functionality. **This is only available in browsers that support `SpeechRecognition`. Please refer to [this browser compatibility table](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition#browser_compatibility) for more details.**

```js
import { Microphone } from "@charisma-ai/sdk";

const microphone = new Microphone();
```

#### microphone.on('recognise', (text) => { ... })

To be used in conjunction with speech recognition (see below).

#### microphone.on('recognise-interim', (text) => { ... })

To be used in conjunction with speech recognition (see below).

#### microphone.on('start', () => { ... })

Emitted when the microphone is manually started via `startListening`.

#### microphone.on('stop', () => { ... })

Emitted when the microphone is either manually stopped via `stopListening` or automatically stopped after a timeout.

#### microphone.on('timeout', () => { ... })

Emitted when the microphone is automatically stopped after a timeout.

#### microphone.startListening(listeningOptions?: SpeechRecognitionOptions)

Starts browser speech recognition. The built in browser [SpeechRecognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition) is free, but not available in every browser (such as Firefox). For premium results with better recognition and wider browser support, please use `playthrough.startSpeechRecognition()`.
The microphone will then emit `recognise-interim` (player hasn't finished speaking, this is the current best guess) and `recognise` (player has finished speaking and we're confident about the result) events.

The speech recognition will _NOT_ automatically pause when a character is speaking via `speaker.play`, but this could be set up by subscribing to the `start` and `stop` events on `speaker`, and calling `startListening` and `stopListening` on `microphone`.

A timeout can optionally be passed, which will automatically stop the microphone after `timeout` milliseconds.

The options for this method are:

```ts
interface SpeechRecognitionOptions {
  continuous?: boolean;
  interimResults?: boolean;
  lang?: string;
  timeout?: number;
}
```

#### microphone.stopListening()

Stops browser speech recognition.

#### microphone.resetTimeout(timeout: number)

Resets the microphone timeout to `timeout` milliseconds.

## Speaker

The speaker can be used to provide text-to-speech functionality.

```js
import { Speaker } from "@charisma-ai/sdk";

const speaker = new Speaker();
```

#### speaker.play(data, options)

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
    microphone.stopListening();
    await speaker.play(data.message.speech.audio, {
      trackId: message.message.character?.id,
      interrupt: "track",
    });
    microphone.startListening();
  }
});
```

#### speaker.on('start', () => { ... })

Emitted when the speaker starts playing any audio.

#### speaker.on('stop', () => { ... })

Emitted when the speaker finishes playing all audio.

### Questions

For further details or any questions, feel free to get in touch at [hello@charisma.ai](mailto:hello@charisma.ai), or head to the [Charisma docs](https://charisma.ai/docs)!
