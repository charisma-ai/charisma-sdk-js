import { EventEmitter } from "eventemitter3";
import { io, type Socket } from "socket.io-client";
import type { SpeechRecognitionEvent } from "./speech-types.js";

type AudioInputsServiceEvents = {
  result: [SpeechRecognitionEvent];
  transcript: [string];
  error: [string];
  timeout: [];
  start: [];
  stop: [];
  disconnect: [string];
  connect: [string];
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

  private reconnectAttemptsTimeout: number;

  private ready = false;

  private playthroughToken?: string;

  private playerSessionId?: string;

  private sttUrl: string;

  constructor(
    streamTimeslice: number | undefined,
    reconnectAttemptsTimeout: number | undefined,
    sttUrl: string | undefined,
  ) {
    super();

    this.streamTimeslice = streamTimeslice ?? 100;
    this.reconnectAttemptsTimeout = reconnectAttemptsTimeout ?? 60 * 1000;
    this.sttUrl = sttUrl ?? "https://stt.charisma.ai";
  }

  private isReconnecting = false;

  private attemptReconnect = (): void => {
    if (this.playthroughToken === undefined || this.isReconnecting) return;

    const reconnectIntervalBase = 2000;
    const maxAttempts = 5;

    const reconnectAttempts = 0;
    let shouldTryAgain = true;

    this.isReconnecting = true;

    const endReconnect = () => {
      shouldTryAgain = false;
      this.isReconnecting = false;
    };

    const tryReconnect = (attempt: number) => {
      if (!shouldTryAgain) return;

      if (attempt >= maxAttempts) {
        this.emit("error", "Maximum reconnect attempts reached.");
        endReconnect();
        return;
      }

      this.connect(
        this.playthroughToken as string,
        this.playerSessionId as string,
      )
        .then(() => {
          console.log("Reconnected successfully!");
          endReconnect();
        })
        .catch(() => {
          // Exponentially back off the next reconnection attempt
          const nextInterval = reconnectIntervalBase * 2 ** attempt;
          console.log(
            `Reconnect attempt failed. Trying again in ${
              nextInterval / 1000
            } seconds...`,
          );

          if (shouldTryAgain) {
            setTimeout(() => tryReconnect(attempt + 1), nextInterval);
          }
        });
    };

    tryReconnect(reconnectAttempts);

    setTimeout(() => {
      this.emit("error", "Reconnect attempts timed out.");
      endReconnect();
    }, this.reconnectAttemptsTimeout);
  };

  public connect = (token: string, playerSessionId: string): Promise<void> => {
    this.playthroughToken = token;
    this.playerSessionId = playerSessionId;

    return new Promise((resolve, reject) => {
      if (this.socket) {
        console.log("Socket already connected");
        resolve();
      }

      this.socket = io(this.sttUrl, {
        transports: ["websocket"],
        query: {
          token,
          playerSessionId,
        },
        reconnection: false,
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

      // Attempts to reconnect to the stt server if the connection is lost and we DO have internet.
      this.socket.on("disconnect", (reason) => {
        console.log("Socket disconnected. Reason:", reason);

        this.emit("disconnect", "Disconnected from speech-to-text server.");
        this.ready = false;

        if (this.socket) {
          this.socket.close();
          this.socket = undefined;
        }

        this.microphone = undefined;

        this.attemptReconnect();
      });

      this.socket.on("connect", () => {
        this.emit("connect", "Connected to speech-to-text service.");

        // Deepgram requires a short interval before data is sent.
        setTimeout(() => {
          this.ready = true;
          resolve();
        }, 2000);
      });
    });
  };

  public disconnect = () => {
    this.ready = false;

    if (this.socket) {
      this.socket.close();
      this.socket = undefined;
    }

    this.microphone = undefined;
    this.emit("disconnect", "Disconnected from speech-to-text server.");
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

    if (!this.microphone) {
      this.emit("stop");
      return;
    }

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
