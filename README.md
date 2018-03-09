# Charisma.ai SDK for JavaScript

### Usage

The script can be pulled straight into the browser.

```html
<script src="./charisma-sdk.js"></script>
<script>
  (async function () {
    const charisma = await Charisma.connect({ storyId: 13 });
    charisma.on('start-typing', () => { ... });
    charisma.on('stop-typing', () => { ... });

    charisma.on('reply', (data) => {
      if (data.reply.speech) {
        charisma.speak(data.reply.speech.data);
      }
    });

    charisma.start({ ... });
    charisma.reply({ ... });
  }){}
</script>
```

#### Charisma.connect

Use this to connect to Charisma and set up a new playthrough.

* `storyId` (`number`): The `id` of the story that you want to create a new playthrough for. The story must be published, unless a Charisma.ai user token has been passed and the user matches the owner of the story.
* `version` (`number`, optional): The `version` of the story that you want to create a new playthrough for. If omitted, it will default to the most recent version. To get the debug story, pass `-1`.
* `userToken` (`string`, optional): If the story is unpublished, pass a `userToken` to be able to access your story.

Returns a promise that resolves once the socket has connected.

```js
const charisma = await Charisma.connect({
  "storyId": 12,
  "version": 4,
  "userToken": "..."
})
```

## Events

To interact with the story, events are sent backwards and forwards along the websocket.

### Events sent from client

#### charisma.start({ ... })

```js
{
  "startNodeId": 12, // Optional, default undefined
  "speech": true // Optional, default false
}
```

#### charisma.reply({ ... })

```js
{
  "message": "Please reply to this!",
  "speech": true // Optional, default false
}
```

### Events received by client

#### charisma.on('reply', (data) => { ... })

```js
{
  "reply": {
    "message": "Greetings and good day.",
    "character": "Ted Baker",
    "avatar": "https://s3.charisma.ai/...",
    "speech": "...", // Stringified buffer
    "metadata": {
      "myMetadata": "someValue"
    }
  },
  "endStory": false,
  "path": [{ "id": 1, "type": "edge" }, { "id": 2, "type": "node" }]
}
```

#### charisma.on('start-typing', () => { ... })

This event has no additional data.

#### charisma.on('stop-typing', () => { ... })

This event has no additional data.

### Questions

For further details or any questions, feel free to get in touch with [ben@charisma.ai](mailto:ben@charisma.ai)
