import { EventEmitter } from "eventemitter3";
import { io, type Socket } from "socket.io-client";
import type { SpeechRecognitionEvent } from "./speech-types.js";

// const  STT_URL = "https://stt-staging.charisma.ai";
const STT_URL = "http://127.0.0.1:5001"; // Running the STT server locally

export interface SpeechRecognitionOptions {
  timeout?: number;
}

type MicrophoneEvents = {
  result: [SpeechRecognitionEvent];
  transcript: [string];
  error: [string];
  timeout: [];
  start: [];
  stop: [];
};

class Microphone extends EventEmitter<MicrophoneEvents> {
  private timeoutId: number | undefined;

  private microphone: MediaRecorder | undefined;

  private socket: Socket | undefined;

  public startListening = async ({
    timeout = 10000,
  }: SpeechRecognitionOptions = {}): Promise<void> => {
    if (!this.microphone) {
      const userMedia = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      this.microphone = new MediaRecorder(userMedia);
    }

    this.microphone.start(500);

    if (this.timeoutId !== undefined) {
      clearTimeout(this.timeoutId);
    }

    this.microphone.onstart = () => {
      this.emit("start");
    };

    this.microphone.ondataavailable = (event) => {
      if (!this.socket) return;
      this.socket.emit("packet-sent", event.data);
    };

    if (timeout !== undefined) {
      this.timeoutId = window.setTimeout(this.onTimeout, timeout);
    }
  };

  public stopListening = (): void => {
    if (this.timeoutId !== undefined) {
      clearTimeout(this.timeoutId);
    }

    if (!this.microphone) return;

    this.microphone.onstop = () => {
      this.emit("stop");
    };

    this.microphone.stop();
  };

  public connect = (token: string) => {
    this.socket = io(STT_URL, {
      transports: ["websocket"],
      query: { token },
    });

    this.socket.on("connect", () => {
      console.log("Speech to Text Connected");
    });

    this.socket.on("transcript", (transcript: string) => {
      if (transcript !== "") {
        this.emit("transcript", transcript);
      }
    });

    this.socket.on("error", (error: string) => {
      console.error(error);
      this.emit("error", error);
    });
  };

  public resetTimeout = (timeout: number): void => {
    if (this.timeoutId !== undefined) {
      clearTimeout(this.timeoutId);
    }

    this.timeoutId = window.setTimeout(this.onTimeout, timeout);
  };

  private onTimeout = (): void => {
    this.timeoutId = undefined;
    this.emit("timeout");
    this.stopListening();
  };
}

export default Microphone;
