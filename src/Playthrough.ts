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
} from "./types.js";
// eslint-disable-next-line import/no-named-as-default
import Conversation, { ConversationOptions } from "./Conversation.js";

export type ConnectionStatus = "disconnected" | "connecting" | "connected";

const sdkInfo = {
  sdkId: "js",
  sdkVersion: "7.0.0",
  protocolVersion: 2,
};

type PlaythroughEvents = {
  "connection-status": [ConnectionStatus];
  error: [any];
  problem: [{ code: string; error: string }];
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

  public playerSessionId?: string;

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

  public async getPlayerSessionId(): Promise<string> {
    const DELAY = 100;
    const MAX_ATTEMPTS = 100;

    for (let attempts = 0; attempts < MAX_ATTEMPTS; attempts += 1) {
      if (this.playerSessionId !== undefined) {
        return this.playerSessionId;
      }

      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => {
        setTimeout(resolve, DELAY);
      });
    }

    throw new Error(
      `Could not get player session id after ${MAX_ATTEMPTS} attempts.`,
    );
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

  public connect = async (): Promise<{ playerSessionId: string }> => {
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

    const playerSessionId = await this.getPlayerSessionId();

    return { playerSessionId };
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
    room.onMessage("player-session-id", (playerSessionId: string) => {
      this.playerSessionId = playerSessionId;
    });

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
}

export default Playthrough;
