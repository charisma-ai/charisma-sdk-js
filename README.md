# Charisma.ai SDK for JavaScript

## Usage

```
yarn add @charisma-ai/sdk
```

```js
import { Charisma, Microphone, Speaker } from '@charisma.ai/sdk';

async function run() {
  const token = await Charisma.createPlaythroughToken({ storyId: 4 });
  const conversationId = await Charisma.createConversation(token);

  const charisma = new Charisma(token);
  const speaker = new Speaker();
  const microphone = new Microphone();

  const conversation = charisma.joinConversation(conversationId);
  conversation.on('start-typing', () =>
    console.log('Character started typing...'),
  );
  conversation.on('stop-typing', () =>
    console.log('Character stopped typing...'),
  );
  conversation.on('message', message => {
    console.log(message);
    if (message.message.speech) {
      microphone.stopListening();
      speaker.play(message.message.speech.audio.data);
      microphone.startListening();
    }
  });
  conversation.setSpeechConfig({
    encoding: 'mp3',
    output: 'buffer',
  });

  charisma.connect();
  conversation.start();

  microphone.startListening();
  microphone.on('recognise', text => conversation.reply({ text }));
}
```

## API Reference

Create a new `Charisma` instance to connect to a playthrough and interact with the chat engine.

- `playthroughToken` (`number`): The `token` generated in `Charisma.createPlaythroughToken`.

#### (static) Charisma.createPlaythroughToken

Use this to set up a new playthrough.

- `storyId` (`number`): The `id` of the story that you want to create a new playthrough for. The story must be published, unless a Charisma.ai user token has been passed and the user matches the owner of the story.
- `version` (`number`, optional): The `version` of the story that you want to create a new playthrough for. If omitted, it will default to the most recent version. To get the debug story, pass `-1`.
- `userToken` (`string`, optional): If the story is unpublished, pass a `userToken` to be able to access your story.

Returns a promise that resolves with the token.

```js
const token = await Charisma.createPlaythroughToken({
  storyId: 12,
  version: 4,
  userToken: '...',
});
```

#### (static) Charisma.createConversation

A playthrough can have many simultaneous conversations. In order to start interacting, a conversation needs to be created, which can then be joined.

- `playthroughToken` (`string`): The token generated with `Charisma.createPlaythroughToken`.

```js
const conversationId = await Charisma.createConversation(token);
```

#### Charisma.joinConversation

This makes the `Charisma` instance listen out for events for a particular conversation, and returns a `Conversation` that events can be called on and event listeners attached.

- `conversationId` (`string`): The conversation id generated with `Charisma.createConversation`.

Returns a `Conversation`, which can.

```js
await Charisma.joinConversation(conversationId);
```

#### Charisma.connect

This is what kicks off the connection to the chat engine. Call this once you're ready to start sending and receiving events.

```js
await Charisma.connect();
```

## Events

To interact with the story, events are sent to and from the server that the WebSocket is connected to.

### Events sent from client

#### conversation.start({ ... })

```js
{
  "startNodeId": 12, // Optional, default undefined
  "speech": true // Optional, default false
}
```

#### conversation.reply({ ... })

```js
{
  "text": "Please reply to this!",
  "speech": true // Optional, default false
}
```

### Events received by client

#### conversation.on('reply', (data) => { ... })

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

### Conversation helpers

#### conversation.setSpeechConfig(config)

This sets the speech configuration to use for all events in the conversation until set otherwise:

```json
{
  "encoding": "mp3",
  "output": "buffer"
}
```

`encoding` is the file format of the resulting speech: `mp3`, `ogg` or `pcm`.

`output` determines whether the speech received back is a `buffer` (a byte array) or whether it should instead be a `url` pointing to the audio file.

#### conversation.setStopOnSceneEnd(stopOnSceneEnd)

This sets whether the conversation should stop on scene end, or automatically continue to the next scene. By default, it is `false`, so automatically continues.

## Microphone

The microphone can be used to provide speech-to-text functionality.

```js
const microphone = new Microphone();
```

#### microphone.on('recognise', (text) => { ... })

To be used in conjunction with speech recognition (see below).

#### microphone.on('recognise-interim', (text) => { ... })

To be used in conjunction with speech recognition (see below).

#### microphone.startListening()

Starts browser speech recognition (Google Chrome only). The microphone will then emit `recognise-interim` (player hasn't finished speaking, this is the current best guess) and `recognise` (player has finished speaking and we're confident about the result) events.

The speech recognition will _NOT_ automatically pause when a character is speaking via `charisma.speak`.

#### microphone.stopListening()

Stops browser speech recognition (Google Chrome only).

## Speaker

The speaker can be used to provide text-to-speech functionality.

```js
const speaker = new Speaker();
```

#### speaker.play(data)

Typically, you would want to use this in combination with a `message` conversation handler. You may also wish to pause the microphone while this happens.

Returns a Promise that resolves once the speech has ended.

```js
conversation.on('message', async data => {
  if (data.message.speech) {
    microphone.stopListening();
    await speaker.play(data.message.speech.audio.data);
    microphone.startListening();
  }
});
```

### Questions

For further details or any questions, feel free to get in touch with [ben@charisma.ai](mailto:ben@charisma.ai)
