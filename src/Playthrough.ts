import { EventEmitter } from "eventemitter3";
import * as Colyseus from "colyseus.js";
import jwtDecode from "jwt-decode";

import * as api from "./api.js";

import {
  StartTypingEvent,
  StopTypingEvent,
  MessageEvent,
  EpisodeCompleteEvent,
  ConfirmActionEvent,
  ConfirmReplyEvent,
  ConfirmResumeEvent,
  ConfirmStartEvent,
  ConfirmTapEvent,
  ProblemEvent,
  JSONValue,
  SpeechRecognitionStartEvent,
  SpeechRecognitionResponse,
  SpeechRecognitionStarted,
  SpeechRecognitionStopped,
} from "./types.js";
// eslint-disable-next-line import/no-named-as-default
import Conversation, { ConversationOptions } from "./Conversation.js";
import MicrophoneRecorder from "./MicrophoneRecorder.js";

export type ConnectionStatus = "disconnected" | "connecting" | "connected";

const sdkInfo = {
  sdkId: "js",
  sdkVersion: "4.0.0-alpha.12",
  protocolVersion: 2,
};

type PlaythroughEvents = {
  "connection-status": [ConnectionStatus];
  error: [any];
  problem: [{ code: string; error: string }];
  "speech-recognition-result": SpeechRecognitionResponse;
  "speech-recognition-error": any;
  "speech-recognition-started": SpeechRecognitionStarted;
  "speech-recognition-stopped": SpeechRecognitionStopped;
};

class Playthrough extends EventEmitter<PlaythroughEvents> {
  private token: string;

  private uuid: string;

  private baseUrl?: string;

  private client: Colyseus.Client | undefined;

  private room: Colyseus.Room | undefined;

  private connectionStatus: ConnectionStatus = "disconnected";

  private shouldReconnect = true;

  private activeConversations = new Map<string, Conversation>();

  public constructor(token: string, baseUrl?: string) {
    super();

    this.token = token;

    const { playthrough_uuid: playthroughUuid } = jwtDecode<{
      // eslint-disable-next-line camelcase
      playthrough_uuid: string;
    }>(this.token);

    this.uuid = playthroughUuid;

    this.baseUrl = baseUrl;
  }

  public createConversation(): ReturnType<typeof api.createConversation> {
    return api.createConversation(this.token, { baseUrl: this.baseUrl });
  }

  public createCharacterConversation(
    characterId: number,
  ): ReturnType<typeof api.createCharacterConversation> {
    return api.createCharacterConversation(this.token, characterId, {
      baseUrl: this.baseUrl,
    });
  }

  public getEventHistory(
    options: api.GetEventHistoryOptions,
  ): ReturnType<typeof api.getEventHistory> {
    return api.getEventHistory(this.token, options, {
      baseUrl: this.baseUrl,
    });
  }

  public getPlaythroughInfo(): ReturnType<typeof api.getPlaythroughInfo> {
    return api.getPlaythroughInfo(this.token, { baseUrl: this.baseUrl });
  }

  public setMemory(
    recallValue: string,
    saveValue: JSONValue | null,
  ): ReturnType<typeof api.setMemory>;

  public setMemory(
    memories: api.MemoryToSet[],
  ): ReturnType<typeof api.setMemory>;

  public setMemory(
    memoryRecallValueOrMemories: string | api.MemoryToSet[],
    saveValue?: JSONValue | null,
  ): ReturnType<typeof api.setMemory> {
    let memories: api.MemoryToSet[] = [];
    if (Array.isArray(memoryRecallValueOrMemories)) {
      memories = memoryRecallValueOrMemories;
    } else {
      memories = [
        {
          recallValue: memoryRecallValueOrMemories,
          saveValue: saveValue as JSONValue | null,
        },
      ];
    }

    return api.setMemory(this.token, memories, {
      baseUrl: this.baseUrl,
    });
  }

  public restartFromEpisodeId(
    episodeId: number,
  ): ReturnType<typeof api.restartFromEpisodeId> {
    return api.restartFromEpisodeId(this.token, episodeId, {
      baseUrl: this.baseUrl,
    });
  }

  public restartFromEpisodeIndex(
    episodeIndex: number,
  ): ReturnType<typeof api.restartFromEpisodeIndex> {
    return api.restartFromEpisodeIndex(this.token, episodeIndex, {
      baseUrl: this.baseUrl,
    });
  }

  public restartFromEventId(
    eventId: string,
  ): ReturnType<typeof api.restartFromEventId> {
    return api.restartFromEventId(this.token, eventId, {
      baseUrl: this.baseUrl,
    });
  }

  public joinConversation = (
    conversationUuid: string,
    options?: ConversationOptions,
  ): Conversation => {
    const conversation = new Conversation(conversationUuid, this, options);
    if (this.activeConversations.has(conversationUuid)) {
      return this.activeConversations.get(conversationUuid) as Conversation;
    }
    this.activeConversations.set(conversationUuid, conversation);
    return conversation;
  };

  public leaveConversation = (conversationUuid: string): void => {
    if (!this.activeConversations.has(conversationUuid)) {
      throw new Error(
        `The conversation with id \`${conversationUuid}\` has not been joined, so cannot be left.`,
      );
    }
    this.activeConversations.delete(conversationUuid);
  };

  public getConversation = (
    conversationUuid: string,
  ): Conversation | undefined => {
    return this.activeConversations.get(conversationUuid);
  };

  public addOutgoingEvent = (eventName: string, eventData?: unknown): void => {
    if (this.room) {
      if (this.connectionStatus === "connected") {
        this.room.send(eventName, eventData);
      } else {
        console.warn(
          `Event \`${eventName}\` was not sent as the socket was not ready. Wait for the \`connection-status\` event to be called with \`connected\` before sending events.`,
        );
      }
    } else {
      console.log(
        `Event \`${eventName}\` was not sent as the socket was not initialised. Call \`playthrough.connect()\` to connect the socket.`,
      );
    }
  };

  public connect = async (): Promise<void> => {
    const baseUrl = this.baseUrl || api.getGlobalBaseUrl();

    if (!this.client) {
      this.client = new Colyseus.Client(baseUrl.replace(/^http/, "ws"));
    }

    this.room = await this.client.joinOrCreate("chat", {
      playthroughId: this.uuid,
      token: this.token,
      sdkInfo,
    });

    this.attachRoomHandlers(this.room);

    this.shouldReconnect = true;
  };

  public pause = (): void => {
    this.addOutgoingEvent("pause");
  };

  public play = (): void => {
    this.addOutgoingEvent("play");
  };

  private attachRoomHandlers = (room: Colyseus.Room) => {
    room.onMessage("status", this.onConnected);
    room.onMessage("problem", this.onProblem);
    room.onMessage("start-typing", this.onStartTyping);
    room.onMessage("stop-typing", this.onStopTyping);
    room.onMessage("message", this.onMessage);
    room.onMessage("episode-complete", this.onEpisodeComplete);

    room.onMessage("action", this.onAction);
    room.onMessage("reply", this.onReply);
    room.onMessage("resume", this.onResume);
    room.onMessage("start", this.onStart);
    room.onMessage("tap", this.onTap);

    room.onMessage(
      "speech-recognition-started",
      this.onSpeechRecognitionStarted,
    );
    room.onMessage(
      "speech-recognition-stopped",
      this.onSpeechRecognitionStopped,
    );
    room.onMessage("speech-recognition-result", this.onSpeechRecognitionResult);
    room.onMessage("speech-recognition-error", this.onSpeechRecognitionError);

    room.onError(this.onError);

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    room.onLeave(async (code) => {
      room.removeAllListeners();
      this.room = undefined;

      // Normal disconnection codes (i.e. user chose to disconnect explicitly)
      if (code === 4000 || !this.shouldReconnect) {
        this.onDisconnect();
        return;
      }

      let roomExpired = false;

      for (let attempts = 0; attempts < 20; attempts += 1) {
        if (!roomExpired) {
          try {
            // Try to reconnect into the same room.
            this.onReconnecting();
            // eslint-disable-next-line no-await-in-loop
            const newRoom = await this.client?.reconnect(
              room.id,
              room.sessionId,
            );
            if (newRoom) {
              this.attachRoomHandlers(newRoom);
              this.room = newRoom;
              this.onReconnect();
              this.onConnected();
              return;
            }
          } catch (err) {
            if (/room ".*" not found/.test((err as Error).message)) {
              roomExpired = true;
            }
          }
        }

        // If we could reconnect (network is up), but the exact room no longer exists (it expired), try and create a new room.
        if (roomExpired) {
          try {
            // eslint-disable-next-line no-await-in-loop
            const newRoom = await this.client?.joinOrCreate("chat", {
              playthroughId: this.uuid,
              token: this.token,
              sdkInfo,
            });
            if (newRoom) {
              this.attachRoomHandlers(newRoom);
              this.room = newRoom;
              this.onReconnect();
              this.onConnected();
              return;
            }
          } catch (err2) {
            console.error(
              "Could not reconnect to a Charisma playthrough.",
              err2,
            );
          }
        }

        // eslint-disable-next-line no-await-in-loop
        await new Promise<void>((resolve) => {
          setTimeout(() => resolve(), 5000 + Math.floor(Math.random() * 1000));
        });
      }

      // We failed to both reconnect into the same room, and a new room, so disconnect.
      this.onDisconnect();
    });
  };

  public disconnect = (): void => {
    this.shouldReconnect = false;

    if (this.room) {
      this.room.leave();
    }
  };

  private changeConnectionStatus = (newStatus: ConnectionStatus): void => {
    if (newStatus !== this.connectionStatus) {
      this.connectionStatus = newStatus;
      this.emit("connection-status", newStatus);
    }
  };

  private onReconnect = (): void => {
    this.activeConversations.forEach((conversation) => {
      conversation.reconnect().catch((err) => {
        console.error(
          `Something went wrong reconnecting to conversation:`,
          err,
        );
      });
    });
  };

  private onReconnecting = (): void => {
    this.changeConnectionStatus("connecting");
  };

  private onDisconnect = (): void => {
    this.changeConnectionStatus("disconnected");
  };

  private onConnected = (): void => {
    this.changeConnectionStatus("connected");
  };

  private onError = (code: number, message?: string): void => {
    this.emit("error", { message, code });
  };

  private onProblem = (event: ProblemEvent): void => {
    this.emit("problem", event);
    if (event.conversationUuid) {
      const conversation = this.activeConversations.get(event.conversationUuid);
      if (conversation) {
        conversation.addIncomingEvent("problem", event);
      }
    }
  };

  private onStartTyping = (event: StartTypingEvent): void => {
    const conversation = this.activeConversations.get(event.conversationUuid);
    if (conversation) {
      conversation.addIncomingEvent("start-typing", event);
    }
  };

  private onStopTyping = (event: StopTypingEvent): void => {
    const conversation = this.activeConversations.get(event.conversationUuid);
    if (conversation) {
      conversation.addIncomingEvent("stop-typing", event);
    }
  };

  private onMessage = (event: MessageEvent): void => {
    const conversation = this.activeConversations.get(event.conversationUuid);
    if (conversation) {
      conversation.addIncomingEvent("message", event);
    }
  };

  private onEpisodeComplete = (event: EpisodeCompleteEvent): void => {
    const conversation = this.activeConversations.get(event.conversationUuid);
    if (conversation) {
      conversation.addIncomingEvent("episode-complete", event);
    }
  };

  private onAction = (event: ConfirmActionEvent): void => {
    const conversation = this.activeConversations.get(event.conversationUuid);
    if (conversation) {
      conversation.addIncomingEvent("action", event);
    }
  };

  private onResume = (event: ConfirmResumeEvent): void => {
    const conversation = this.activeConversations.get(event.conversationUuid);
    if (conversation) {
      conversation.addIncomingEvent("resume", event);
    }
  };

  private onReply = (event: ConfirmReplyEvent): void => {
    const conversation = this.activeConversations.get(event.conversationUuid);
    if (conversation) {
      conversation.addIncomingEvent("reply", event);
    }
  };

  private onStart = (event: ConfirmStartEvent): void => {
    const conversation = this.activeConversations.get(event.conversationUuid);
    if (conversation) {
      conversation.addIncomingEvent("start", event);
    }
  };

  private onTap = (event: ConfirmTapEvent): void => {
    const conversation = this.activeConversations.get(event.conversationUuid);
    if (conversation) {
      conversation.addIncomingEvent("tap", event);
    }
  };

  private microphone?: MicrophoneRecorder;

  public async startSpeechRecognition(event?: SpeechRecognitionStartEvent) {
    if (!this.microphone) {
      // if the user supplied a `sampleRate`, try and create a recorder that matches it
      this.microphone = new MicrophoneRecorder({
        sampleRate: event?.sampleRate,
      });
      this.microphone.addListener("data", (data) => {
        this.addOutgoingEvent("speech-recognition-chunk", data);
      });
    }

    await this.microphone.start();

    this.addOutgoingEvent("speech-recognition-start", {
      ...event,
      // the recorder is NOT GUARANTEED to have the `sampleRate` the user specified.
      // override the event with the actual `sampleRate`.
      sampleRate: this.microphone.sampleRate,
    });
  }

  public stopSpeechRecognition(event?: any) {
    if (this.microphone) {
      this.microphone.stop();

      this.addOutgoingEvent("speech-recognition-stop", {
        ...event,
      });
    }
  }

  private onSpeechRecognitionResult = (
    event: SpeechRecognitionResponse,
  ): void => {
    this.emit("speech-recognition-result", event);
  };

  private onSpeechRecognitionError = (event: any): void => {
    this.emit("speech-recognition-error", event);
  };

  private onSpeechRecognitionStarted = (
    event: SpeechRecognitionStarted,
  ): void => {
    this.emit("speech-recognition-started", event);
  };

  private onSpeechRecognitionStopped = (
    event: SpeechRecognitionStopped,
  ): void => {
    this.emit("speech-recognition-stopped", event);
  };
}

export default Playthrough;
