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
let confirmedText = "";
let volatileText = "";

const handleStartSTT = () => {
  recordingStatus = "recording";
  if (recordButton) recordButton.innerHTML = "Stop";
  const replyInput = <HTMLInputElement>document.getElementById("reply-input");

  if (replyInput) {
    replyInput.value = "";
  }
};

const handleStopSTT = () => {
  recordingStatus = "off";
  if (recordButton) recordButton.innerHTML = "Record";
};

const handleTranscript = (transcript: string) => {
  confirmedText = `${confirmedText} ${transcript}`;
  volatileText = "";
  const replyInput = <HTMLInputElement>document.getElementById("reply-input");
  if (replyInput) {
    replyInput.value = confirmedText;
  }
};

const handleInterimTranscript = (interimTranscript: string) => {
  volatileText = interimTranscript;
  const replyInput = <HTMLInputElement>document.getElementById("reply-input");
  if (replyInput) {
    replyInput.value = `${confirmedText} ${volatileText}`;
  }
};

// Setup the audio manager.
const audio = new AudioManager({
  duckVolumeLevel: 0.1,
  normalVolumeLevel: 1,
  sttService: "charisma/deepgram",
  streamTimeslice: 100,
  handleTranscript,
  handleInterimTranscript,
  handleStartSTT,
  handleStopSTT,
  handleDisconnect: (message: string) =>
    appendMessage(message, "disconnected-message"),
  handleConnect: (message: string) =>
    appendMessage(message, "connected-message"),
  debugLogFunction: (message: string) =>
    console.log(
      `${new Date().toISOString().split("T")[1].slice(0, 12)} ${message}`,
    ),
});

let playthrough: Playthrough;
let conversation: Conversation;

window.start = async function start() {
  // In order to play audio, this method must be called by a user interaction.
  // This is due to a security restriction in some browsers.
  audio.initialise();

  const storyIdInput = <HTMLInputElement>document.getElementById("story-id");
  const storyId = Number(storyIdInput.value);
  const storyApiKeyInput = <HTMLInputElement>(
    document.getElementById("story-api-key")
  );
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
      audio.playCharacterSpeech(characterMessage.speech.audio as ArrayBuffer, {
        trackId: String(characterMessage.character?.id),
        interrupt: "track",
      });
    }

    if (characterMessage.media) {
      if (characterMessage.media.stopAllAudio) {
        audio.mediaAudioStopAll();
      }

      // Play media audio if it exists in the node.
      audio.mediaAudioPlay(characterMessage.media.audioTracks);
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

  const { playerSessionId } = await playthrough.connect();
  audio.connect(token, playerSessionId);
};

const reply = () => {
  if (!playthrough || !conversation) return;

  // Stop listening when you send a message.
  audio.stopListening();

  const replyInput = <HTMLInputElement>document.getElementById("reply-input");
  const text = replyInput.value;

  if (text.trim() === "") return;

  conversation.reply({ text });

  // Put player message on the page.
  appendMessage(text, "player-message", "You");
  replyInput.value = "";
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
    confirmedText = "";
    volatileText = "";
    recordingStatus = "starting";
    recordButton.innerHTML = "...";
  } else if (recordingStatus === "recording") {
    audio.stopListening();
    recordingStatus = "off";
    recordButton.innerHTML = "Record";
  }
};

window.toggleMuteBackgroundAudio = () => {
  audio.mediaAudioToggleMute();
};
