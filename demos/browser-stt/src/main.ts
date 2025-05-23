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
    toggleBackgroundAudio: () => void;
    toggleMicrophone: (event: Event) => void;
  }
}

const messagesDiv = document.getElementById("messages");
const recordButton = document.getElementById("record-button");

const appendMessage = (message: string, className: string, name?: string) => {
  const div = document.createElement("div");
  div.classList.add(className, "message");
  div.innerHTML = `${name ? `<b>${name}</b>:` : ""} ${message}`;
  messagesDiv?.appendChild(div);
};

// Keep track of the recording statuses of the microphone so we can update the UI accordingly.
let recordingStatus: "recording" | "off" | "starting" = "off";

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
const audioManager = new AudioManager({
  duckVolumeLevel: 0.1,
  normalVolumeLevel: 1,
  sttService: "browser",
  streamTimeslice: 100,
  handleTranscript,
  handleStartSTT,
  handleStopSTT,
});

if (!audioManager.browserIsSupported()) {
  appendMessage(
    "Your browser does not support the browser STT service.",
    "error-message",
  );
}

let playthrough: Playthrough;
let conversation: Conversation;

window.start = async function start() {
  // In order to play audio, this method must be called by a user interaction.
  // This is due to a security restriction in some browsers.
  audioManager.initialise();

  const storyIdInput = document.getElementById("story-id");
  const storyId = Number(storyIdInput.value);
  const storyApiKeyInput = document.getElementById("story-api-key");
  const storyApiKey = storyApiKeyInput.value;
  const storyVersionInput = document.getElementById("version");
  const storyVersion = Number(storyVersionInput.value) || undefined;
  const StartGraphReferenceIdInput = document.getElementById(
    "startGraphReferenceId",
  );
  const startGraphReferenceId = StartGraphReferenceIdInput.value;

  const { token } = await createPlaythroughToken({
    storyId,
    apiKey: storyApiKey,
    version: storyVersion,
  });

  const { conversationUuid } = await createConversation(token);
  playthrough = new Playthrough(token);
  conversation = playthrough.joinConversation(conversationUuid);

  conversation.setSpeechConfig({
    encoding: ["mp3", "wav"],
    output: "buffer",
  });

  conversation.on("message", (message: Message) => {
    const characterMessage =
      message.type === "character" ? message.message : null;

    // For this demo, we only care about character messages.
    if (!characterMessage) return;

    // Put the character message on the page.
    appendMessage(
      characterMessage.text,
      "character-message",
      characterMessage.character?.name,
    );

    // Play character speech.
    if (characterMessage.speech) {
      audioManager.playCharacterSpeech(
        characterMessage.speech.audio as ArrayBuffer,
        {
          trackId: String(characterMessage.character?.id),
          interrupt: "track",
        },
      );
    }

    if (characterMessage.media) {
      if (characterMessage.media.stopAllAudio) {
        audioManager.mediaAudioStopAll();
      }

      // Play media audio if it exists in the node.
      audioManager.mediaAudioPlay(characterMessage.media.audioTracks);
    }
  });

  conversation.on("problem", console.warn);

  // Listen for the playthrough to connect and start the conversation when it does.
  let started = false;
  playthrough.on("connection-status", (status) => {
    appendMessage(
      status,
      status === "disconnected" ? "disconnected-message" : "connected-message",
    );

    if (status === "connected" && !started) {
      const conversationParameters = startGraphReferenceId
        ? { startGraphReferenceId }
        : undefined;
      conversation.start(conversationParameters);
      started = true;
    }
  });

  await playthrough.connect();
};

const reply = () => {
  if (!playthrough || !conversation) return;

  // Stop listening when you send a message.
  audioManager.stopListening();

  const replyInput = <HTMLInputElement>document.getElementById("reply-input");
  const text = replyInput.value;

  if (text.trim() === "") return;

  conversation.reply({ text });
  replyInput.value = "";

  // Put player message on the page.
  appendMessage(text, "player-message", "You");
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
    audioManager.startListening();
    recordingStatus = "starting";
    recordButton.innerHTML = "...";
  } else if (recordingStatus === "recording") {
    audioManager.stopListening();
    recordingStatus = "off";
    recordButton.innerHTML = "Record";
  }
};

window.toggleBackgroundAudio = () => {
  audioManager.mediaAudioToggleMute();
};
