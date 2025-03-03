import { EventEmitter } from "eventemitter3";
import { io, type Socket } from "socket.io-client";
import type { SpeechRecognitionEvent } from "./speech-types.js";

type AudioInputsServiceEvents = {
  result: [SpeechRecognitionEvent];
  transcript: [string];
  "transcript-interim": [string];
  error: [string];
  timeout: [];
  start: [];
  stop: [];
  disconnect: [string];
  connect: [string];
};

const setupMicrophone = async (): Promise<MediaRecorder> => {
  const userMedia = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
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

  private debugLogFunction: (message: string) => void;

  constructor(
    streamTimeslice: number | undefined,
    reconnectAttemptsTimeout: number | undefined,
    sttUrl: string | undefined,
    debugLogFunction: (message: string) => void,
  ) {
    super();

    this.debugLogFunction = debugLogFunction;
    this.debugLogFunction("AudioInputsService running constructor");

    this.streamTimeslice = streamTimeslice ?? 100;
    this.reconnectAttemptsTimeout = reconnectAttemptsTimeout ?? 60 * 1000;
    this.sttUrl = sttUrl ?? "https://stt.charisma.ai";
  }

  private isReconnecting = false;

  private attemptReconnect = (): void => {
    this.debugLogFunction("AudioInputsService attemptReconnect");
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
      this.debugLogFunction(
        `AudioInputsService tryReconnect attempt ${attempt}`,
      );
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
          this.debugLogFunction("Reconnected Successfully");
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
      this.debugLogFunction("Reconnect attempts timed out");
      this.emit("error", "Reconnect attempts timed out.");
      endReconnect();
    }, this.reconnectAttemptsTimeout);
  };

  public connect = (token: string, playerSessionId: string): Promise<void> => {
    this.debugLogFunction(`AudioInputService connect to ${this.sttUrl}`);

    this.playthroughToken = token;
    this.playerSessionId = playerSessionId;

    return new Promise((resolve, reject) => {
      if (this.socket) {
        this.debugLogFunction("Socket already connected");
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
        this.debugLogFunction(`AudioInputService error: ${error}`);
        console.error(error);
        this.emit("error", error);
        reject(error);
      });

      this.socket.on("transcript", (transcript: string) => {
        this.debugLogFunction(`AudioInputService transcript: ${transcript}`);
        if (transcript) {
          this.emit("transcript", transcript);
        }
      });

      this.socket.on("transcript-interim", (transcript: string) => {
        this.debugLogFunction(
          `AudioInputService interim transcript: ${transcript}`,
        );
        if (transcript) {
          this.emit("transcript-interim", transcript);
        }
      });

      // Attempts to reconnect to the stt server if the connection is lost and we DO have internet.
      this.socket.on("disconnect", (reason) => {
        this.debugLogFunction(`AudioInputService disconnect. ${reason}`);
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
        this.debugLogFunction(
          "AudioInputService connected to speech-to-text service.",
        );
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
    this.debugLogFunction("AudioInputService disconnect");
    this.ready = false;

    if (this.socket) {
      this.socket.close();
      this.socket = undefined;
    }

    this.microphone = undefined;
    this.debugLogFunction(
      "AudioInputService disconnected from speech-to-text server.",
    );
    this.emit("disconnect", "Disconnected from speech-to-text server.");
  };

  public startListening = async (timeout = 10000): Promise<void> => {
    this.debugLogFunction("AudioInputService startListening");
    if (!this.ready) {
      this.debugLogFunction("AudioInputService startListening not ready");
      return;
    }

    try {
      if (!this.microphone) {
        this.debugLogFunction(
          "AudioInputService startListening setting up microphone",
        );
        this.microphone = await setupMicrophone();
      }
    } catch (error) {
      this.debugLogFunction(
        "AudioInputService startListening failed to access microphone",
      );
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
    this.debugLogFunction("AudioInputService stopListening");
    if (this.timeoutId !== undefined) {
      clearTimeout(this.timeoutId);
    }

    if (!this.microphone) {
      this.debugLogFunction("AudioInputService stopListening !this.microphone");
      this.emit("stop");
      return;
    }

    this.microphone.stop();

    if (!this.socket) {
      return;
    }
    this.debugLogFunction("end-current-transcription");
    this.socket.emit("end-current-transcription");
  };

  public resetTimeout = (timeout: number): void => {
    this.debugLogFunction("AudioInputService resetTimeout");
    if (this.timeoutId !== undefined) {
      clearTimeout(this.timeoutId);
    }

    this.timeoutId = window.setTimeout(this.onTimeout, timeout);
  };

  private onTimeout = (): void => {
    this.debugLogFunction("AudioInputService onTimeout");
    this.timeoutId = undefined;
    this.emit("timeout");
    this.stopListening();
  };
}

export default AudioInputsService;
