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
  disconnect: [];
};

const setupMicrophone = async (): Promise<MediaRecorder> => {
  const userMedia = await navigator.mediaDevices.getUserMedia({
    audio: true,
  });

  const mediaRecorder = new MediaRecorder(userMedia);
  return mediaRecorder;
};

class AudioInputsService extends EventEmitter<AudioInputsServiceEvents> {
  private timeoutId?: number;

  private microphone?: MediaRecorder;

  private socket?: Socket;

  private streamTimeslice: number;

  private ready = false;

  constructor(streamTimeslice: number | undefined) {
    super();

    this.streamTimeslice = streamTimeslice ?? 100;
  }

  public connect = (token: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (this.socket) {
        console.log("Socket already connected");
        resolve();
      }

      this.socket = io(STT_URL, {
        transports: ["websocket"],
        query: { token },
      });

      this.socket.on("error", (error: string) => {
        console.error(error);
        this.emit("error", error);
        reject(error);
      });

      this.socket.on("transcript", (transcript: string) => {
        console.log("Received transcript:", transcript);
        if (transcript) {
          this.emit("transcript", transcript);
        }
      });

      this.socket.on("disconnect", () => {
        this.emit("disconnect");
      });

      this.socket.on("connect", () => {
        // Deepgram requires a short interval before data is sent.
        setTimeout(() => {
          this.ready = true;
          resolve();
        }, 2000);
      });
    });
  };

  public startListening = async (timeout = 10000): Promise<void> => {
    if (!this.ready) {
      return;
    }

    try {
      if (!this.microphone) {
        this.microphone = await setupMicrophone();
      }
    } catch (error) {
      console.error("Failed to access microphone:", error);
      this.emit("error", "Failed to access microphone");
      return;
    }

    if (this.timeoutId !== undefined) {
      clearTimeout(this.timeoutId);
    }

    if (timeout !== undefined) {
      this.timeoutId = window.setTimeout(this.onTimeout, timeout);
    }

    if (this.microphone.state === "paused") {
      this.microphone.resume();
      return;
    }

    this.microphone.ondataavailable = (event) => {
      if (!this.socket || event.data.size === 0) return;

      this.socket.emit("packet-sent", event.data);
    };

    this.microphone.onstart = () => {
      this.emit("start");
    };

    this.microphone.onstop = () => {
      this.emit("stop");
    };

    this.microphone.onpause = () => {
      this.emit("stop");
    };

    this.microphone.onresume = () => {
      this.emit("start");
    };

    this.microphone.addEventListener("error", (error) => {
      this.emit("error", error.toString());
      this.stopListening();
    });

    this.microphone.start(this.streamTimeslice);
  };

  public stopListening = (): void => {
    if (this.timeoutId !== undefined) {
      clearTimeout(this.timeoutId);
    }

    if (!this.microphone) return;

    this.microphone.pause();
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
