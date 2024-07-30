import { EventEmitter } from "eventemitter3";
import { io, type Socket } from "socket.io-client";
import type { SpeechRecognitionEvent } from "./speech-types.js";

const STT_URL = "https://stt-staging.charisma.ai";

type AudioInputsServiceEvents = {
  result: [SpeechRecognitionEvent];
  transcript: [string];
  error: [string];
  timeout: [];
  start: [];
  stop: [];
};

class AudioInputsService extends EventEmitter<AudioInputsServiceEvents> {
  private timeoutId?: number;

  private microphone?: MediaRecorder;

  private socket?: Socket;

  private connect = (token: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (this.socket) {
        reject(new Error("Socket already connected"));
        return;
      }

      this.socket = io(STT_URL, {
        transports: ["websocket"],
        query: { token },
      });

      this.socket.on("connect", () => {
        console.log("Speech to Text Connected");
        resolve();
      });

      this.socket.on("error", (error: string) => {
        console.error(error);
        this.emit("error", error);
        reject(error);
      });

      this.socket.on("transcript", (transcript: string) => {
        if (transcript) {
          this.emit("transcript", transcript);
        }
      });
    });
  };

  public startListening = async (
    token: string,
    timeout = 10000,
  ): Promise<void> => {
    try {
      if (!this.microphone) {
        const userMedia = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });

        this.microphone = new MediaRecorder(userMedia);
      }
    } catch (error) {
      console.error("Failed to access microphone:", error);
      this.emit("error", "Failed to access microphone");
      return;
    }

    if (!this.socket) {
      try {
        await this.connect(token);
      } catch (error) {
        console.error("Failed to connect to socket:", error);
        this.emit("error", "Failed to connect to socket");
        return;
      }
    }

    this.microphone.start(100);

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

export default AudioInputsService;
