/* eslint-disable @typescript-eslint/no-unsafe-call */

import "./style.css";
import {
  Playthrough,
  AudioManager,
  createPlaythroughToken,
  createConversation,
  Conversation,
  Message,
} from "@charisma-ai/sdk";

// In this demo, we'll extend the global "window" with the functions we need so we can call them from the HTML.
declare global {
  interface Window {
    start: () => Promise<void>;
    reply: () => void;
    onKeyPress: (event: KeyboardEvent) => void;
    toggleMuteBackgroundAudio: () => void;
    toggleMicrophone: (event: Event) => void;
  }
}

// Keep track of the recording statuses of the microphone so we can update the UI accordingly.
let recordingStatus: "recording" | "off" | "starting" = "off";

const messagesDiv = document.getElementById("messages");
const recordButton = document.getElementById("record-button");

const handleStartSTT = () => {
  recordingStatus = "recording";
  if (recordButton) recordButton.innerHTML = "Stop";
};

const handleStopSTT = () => {
  recordingStatus = "off";
  if (recordButton) recordButton.innerHTML = "Record";
};

const handleTranscript = (transcript: string) => {
  const replyInput = <HTMLInputElement>document.getElementById("reply-input");
  if (replyInput) {
    replyInput.value = transcript;
  }
};

// Setup the audio manager.
const audio = new AudioManager({
  duckVolumeLevel: 0.1,
  normalVolumeLevel: 1,
  sttService: "charisma/deepgram",
  streamTimeslice: 100,
  handleTranscript,
  handleStartSTT,
  handleStopSTT,
});

let playthrough: Playthrough;
let conversation: Conversation;

window.start = async function start() {
  const { token } = await createPlaythroughToken({
    storyId: Number(import.meta.env.VITE_STORY_ID),
    apiKey: import.meta.env.VITE_STORY_API_KEY as string,
    version: -1, // -1 refers to the current draft version
  });

  const { conversationUuid } = await createConversation(token);
  playthrough = new Playthrough(token);
  conversation = playthrough.joinConversation(conversationUuid);

  conversation.setSpeechConfig({
    encoding: ["ogg", "mp3"],
    output: "buffer",
  });

  conversation.on("message", (message: Message) => {
    const characterMessage =
      message.type === "character" ? message.message : null;

    // For this demo, we only care about character messages.
    if (!characterMessage) return;

    // Put the character message on the page.
    const div = document.createElement("div");
    div.classList.add("message", "character");
    div.innerHTML = `<b>${characterMessage.character?.name || "???"}</b>: ${
      characterMessage.text
    }`;
    messagesDiv?.appendChild(div);

    // Play character speech.
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

  // Listen for the playthrough to connect and start the conversation when it does.
  let started = false;
  playthrough.on("connection-status", (status) => {
    if (status === "connected" && !started) {
      conversation.start();
      started = true;
    }
  });

  await playthrough.connect();
  audio.connect(token);
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

// Handle the Enter key press.
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
    audio.startListening();
    recordingStatus = "starting";
    recordButton.innerHTML = "...";
  } else if (recordingStatus === "recording") {
    audio.stopListening();
    recordingStatus = "off";
    recordButton.innerHTML = "Record";
  }
};

window.toggleMuteBackgroundAudio = () => {
  audio.mediaMuted = !audio.mediaMuted;
};
