/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import "./style.css";
import {
  Playthrough,
  BrowserMicrophone,
  Speaker,
  createPlaythroughToken,
  createConversation,
  Conversation,
  MessageCharacter,
} from "@charisma-ai/sdk";

declare global {
  interface Window {
    start: () => Promise<void>;
    reply: () => void;
    onKeyPress: (event: KeyboardEvent) => void;
    toggleMuteBackgroundAudio: () => void;
    toggleMicrophone: (event: Event) => void;
  }
}

const STORY_ID = 17221;

const speaker = new Speaker(); // For character speech
const backgroundAudio = new Audio(); // For background audio
const microphone = new BrowserMicrophone(); // For player speech

let playthrough: Playthrough;
let conversation: Conversation;

const messagesDiv = document.getElementById("messages");

window.start = async function start() {
  const { token } = await createPlaythroughToken({
    storyId: STORY_ID,
    apiKey: import.meta.env.VITE_STORY_API_KEY as string,
    version: -1, // -1 refers to the current draft version
  });

  const { conversationUuid } = await createConversation(token);
  playthrough = new Playthrough(token);
  conversation = playthrough.joinConversation(conversationUuid);

  conversation.on("message", (message) => {
    const characterMessage: MessageCharacter = message.message;

    // Put character message on the page.
    const div = document.createElement("div");
    div.classList.add("message", "character");
    div.innerHTML = `<b>${characterMessage.character?.name || "???"}</b>: ${
      characterMessage.text
    }`;
    messagesDiv?.appendChild(div);

    if (characterMessage.speech) {
      speaker.play(characterMessage.speech.audio as ArrayBuffer, {
        trackId: String(characterMessage.character?.id),
        interrupt: "track",
      });
    }

    // Play background audio.
    if (characterMessage.media.audioTracks.length > 0) {
      backgroundAudio.src = characterMessage.media.audioTracks[0].url;
      backgroundAudio.fastSeek(0);
      backgroundAudio.play();
    }
  });

  conversation.on("problem", console.warn);
  conversation.setSpeechConfig({
    encoding: ["ogg", "mp3"],
    output: "buffer",
  });

  conversation.start();

  let started = false;
  playthrough.on("connection-status", (status) => {
    console.log("connection status", status);
    if (status === "connected" && !started) {
      conversation.start();
      started = true;
    }
  });

  await playthrough.connect();
};

const reply = () => {
  if (!playthrough || !conversation) return;

  const replyInput = <HTMLInputElement>document.getElementById("reply-input");
  const text = replyInput.value;
  conversation.reply({ text });
  replyInput.value = "";

  // Put player message on the page.
  const div = document.createElement("div");
  div.classList.add("message", "player");
  div.innerHTML = `<b>You</b>: ${text}`;
  messagesDiv?.appendChild(div);
};

window.onKeyPress = function onKeyPress(event) {
  if (!event || !event.currentTarget) return;
  if (event.key === "Enter") {
    reply();
  }
};

window.reply = reply;

window.toggleMicrophone = (event) => {
  if ((<HTMLInputElement>event.currentTarget).checked) {
    microphone.startListening();
  } else {
    microphone.stopListening();
  }
};

window.toggleMuteBackgroundAudio = () => {
  backgroundAudio.muted = !backgroundAudio.muted;
};

// Gets the transcript.
microphone.on("transcript", (transcript) => {
  console.log("Recognised Transcript:", transcript);
  const replyInput = <HTMLInputElement>document.getElementById("reply-input");
  if (replyInput) {
    replyInput.value = transcript;
  }
});
