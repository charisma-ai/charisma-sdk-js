import "./style.css";
import {
  Playthrough,
  AudioManager,
  createPlaythroughToken,
  createConversation,
} from "@charisma-ai/sdk";

const messagesDiv = document.getElementById("messages");

const appendMessage = (message, className, name) => {
  const div = document.createElement("div");
  div.classList.add(className, "message");
  div.innerHTML = `${name ? `<b>${name}</b>:` : ""} ${message}`;
  messagesDiv?.appendChild(div);
};

// Setup the audio manager.
const audio = new AudioManager({
  duckVolumeLevel: 0.1,
  normalVolumeLevel: 1,
  sttService: "browser",
  streamTimeslice: 100,
});

let playthrough;
let conversation;

window.start = async function start() {
  // In order to play audio, this method must be called by a user interaction.
  // This is due to a security restriction in some browsers.
  audio.initialise();

  const storyIdInput = document.getElementById("story-id");
  const storyId = storyIdInput.value;
  const storyApiKeyInput = document.getElementById("story-api-key");
  const storyApiKey = storyApiKeyInput.value;

  const { token } = await createPlaythroughToken({
    storyId: Number(storyId),
    apiKey: storyApiKey,
    version: -1,
  });

  const { conversationUuid } = await createConversation(token);
  playthrough = new Playthrough(token);
  conversation = playthrough.joinConversation(conversationUuid);

  conversation.setSpeechConfig({
    encoding: ["mp3", "wav"],
    output: "buffer",
  });

  conversation.on("message", (message) => {
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
      audio.outputServicePlay(characterMessage.speech.audio, {
        trackId: String(characterMessage.character?.id),
        interrupt: "track",
      });
    }

    if (characterMessage.media.stopAllAudio) {
      audio.mediaAudioStopAll();
    }

    // Play media audio if it exists in the node.
    audio.mediaAudioPlay(characterMessage.media.audioTracks);
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
      conversation.start();
      started = true;
    }
  });

  await playthrough.connect();
};

const reply = () => {
  if (!playthrough || !conversation) return;

  const replyInput = document.getElementById("reply-input");
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

window.toggleMuteBackgroundAudio = () => {
  audio.mediaAudioToggleMute();
};
