/* eslint-disable @typescript-eslint/no-unsafe-call */

import "./style.css";
import {
  Playthrough,
  AudioManager,
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

const audio = new AudioManager({
  duckVolumeLevel: 0.1,
  normalVolumeLevel: 1,
  sttService: "charisma/deepgram",
  streamTimeslice: 100,
});

let playthrough: Playthrough;
let conversation: Conversation;

let token: string;

let recordingStatus: "recording" | "off" | "starting" = "off";

const messagesDiv = document.getElementById("messages");
const recordButton = document.getElementById("record-button");

window.start = async function start() {
  ({ token } = await createPlaythroughToken({
    storyId: Number(import.meta.env.VITE_STORY_ID),
    apiKey: import.meta.env.VITE_STORY_API_KEY as string,
    version: -1, // -1 refers to the current draft version
  }));

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
      audio.outputServicePlay(characterMessage.speech.audio as ArrayBuffer, {
        trackId: String(characterMessage.character?.id),
        interrupt: "track",
      });
    }

    // Play background audio.
    if (characterMessage.media.audioTracks.length > 0) {
      audio.mediaSrc = characterMessage.media.audioTracks[0].url;
      audio.mediaAudioFastSeek(0);
      audio.mediaAudioPlay();
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

// Toggling the microphone will request the stt service to connect.
window.toggleMicrophone = () => {
  if (!recordButton) return;

  if (recordingStatus === "off") {
    audio.startListening(token);
    recordingStatus = "starting";
    recordButton.innerHTML = "...";
  } else if (recordingStatus === "recording") {
    audio.stopListening();
    recordingStatus = "off";
    recordButton.innerHTML = "Record";
  }
};

window.toggleMuteBackgroundAudio = () => {
  audio.muted = !audio.muted;
};

// Gets the transcript.
audio.on("transcript", (transcript: string) => {
  console.log("Recognised Transcript:", transcript);
  const replyInput = <HTMLInputElement>document.getElementById("reply-input");
  if (replyInput) {
    replyInput.value = transcript;
  }
});

audio.on("start-stt", () => {
  console.log("Listening Started");
  recordingStatus = "recording";
  if (recordButton) recordButton.innerHTML = "Stop";
});

audio.on("stop-stt", () => {
  recordingStatus = "off";
  if (recordButton) recordButton.innerHTML = "Record";
});

audio.on("error", (error) => {
  console.error("Error:", error);
});
