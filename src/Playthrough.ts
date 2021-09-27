import EventEmitter from "eventemitter3";
import * as Colyseus from "colyseus.js";
import jwtDecode from "jwt-decode";

import * as api from "./api";

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
} from "./types";
// eslint-disable-next-line import/no-named-as-default
import Conversation, { ConversationOptions } from "./Conversation";

export type ConnectionStatus = "disconnected" | "connecting" | "connected";

type PlaythroughEvents = {
  "connection-status": [ConnectionStatus];
  error: [any];
  problem: [{ type: string; error: string }];
};

class Playthrough extends EventEmitter<PlaythroughEvents> {
  private token: string;

  private playthroughId: number;

  private baseUrl?: string;

  private client: Colyseus.Client | undefined;

  private room: Colyseus.Room | undefined;

  private connectionStatus: ConnectionStatus = "disconnected";

  private shouldReconnect = true;

  private activeConversations = new Map<number, Conversation>();

  public constructor(token: string, baseUrl?: string) {
    super();

    this.token = token;

    const { playthrough_id: playthroughId } = jwtDecode<{
      // eslint-disable-next-line camelcase
      playthrough_id: number;
    }>(this.token);

    this.playthroughId = playthroughId;

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

  public getMessageHistory(
    conversationId?: number | undefined,
    minEventId?: string | undefined,
  ): ReturnType<typeof api.getMessageHistory> {
    return api.getMessageHistory(this.token, conversationId, minEventId, {
      baseUrl: this.baseUrl,
    });
  }

  public getPlaythroughInfo(): ReturnType<typeof api.getPlaythroughInfo> {
    return api.getPlaythroughInfo(this.token, { baseUrl: this.baseUrl });
  }

  public setMemory(
    memoryIdOrRecallValue: number | string,
    saveValue: string | null,
  ): ReturnType<typeof api.setMemory> {
    return api.setMemory(this.token, memoryIdOrRecallValue, saveValue, {
      baseUrl: this.baseUrl,
    });
  }

  // public setMood(
  //   characterIdOrName: number | string,
  //   modifier: Mood,
  // ): ReturnType<typeof api.setMood> {
  //   return api.setMood(this.token, characterIdOrName, modifier, {
  //     baseUrl: this.baseUrl,
  //   });
  // }

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
    conversationId: number,
    options?: ConversationOptions,
  ): Conversation => {
    const conversation = new Conversation(conversationId, this, options);
    if (this.activeConversations.has(conversationId)) {
      return this.activeConversations.get(conversationId) as Conversation;
    }
    this.activeConversations.set(conversationId, conversation);
    return conversation;
  };

  public leaveConversation = (conversationId: number): void => {
    if (!this.activeConversations.has(conversationId)) {
      throw new Error(
        `The conversation with id \`${conversationId}\` has not been joined, so cannot be left.`,
      );
    }
    this.activeConversations.delete(conversationId);
  };

  public getConversation = (
    conversationId: number,
  ): Conversation | undefined => {
    return this.activeConversations.get(conversationId);
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
      playthroughId: this.playthroughId,
      token: this.token,
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
              playthroughId: this.playthroughId,
              token: this.token,
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
        await new Promise<void>((resolve) =>
          setTimeout(() => resolve(), 5000 + Math.floor(Math.random() * 1000)),
        );
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

  private onProblem = (problem: { type: string; error: string }): void => {
    this.emit("problem", problem);
  };

  private onStartTyping = (event: StartTypingEvent): void => {
    const conversation = this.activeConversations.get(event.conversationId);
    if (conversation) {
      conversation.addIncomingEvent("start-typing", event);
    }
  };

  private onStopTyping = (event: StopTypingEvent): void => {
    const conversation = this.activeConversations.get(event.conversationId);
    if (conversation) {
      conversation.addIncomingEvent("stop-typing", event);
    }
  };

  private onMessage = (event: MessageEvent): void => {
    const conversation = this.activeConversations.get(event.conversationId);
    if (conversation) {
      conversation.addIncomingEvent("message", event);
    }
  };

  private onEpisodeComplete = (event: EpisodeCompleteEvent): void => {
    const conversation = this.activeConversations.get(event.conversationId);
    if (conversation) {
      conversation.addIncomingEvent("episode-complete", event);
    }
  };

  private onAction = (event: ConfirmActionEvent): void => {
    const conversation = this.activeConversations.get(event.conversationId);
    if (conversation) {
      conversation.addIncomingEvent("action", event);
    }
  };

  private onResume = (event: ConfirmResumeEvent): void => {
    const conversation = this.activeConversations.get(event.conversationId);
    if (conversation) {
      conversation.addIncomingEvent("resume", event);
    }
  };

  private onReply = (event: ConfirmReplyEvent): void => {
    const conversation = this.activeConversations.get(event.conversationId);
    if (conversation) {
      conversation.addIncomingEvent("reply", event);
    }
  };

  private onStart = (event: ConfirmStartEvent): void => {
    const conversation = this.activeConversations.get(event.conversationId);
    if (conversation) {
      conversation.addIncomingEvent("start", event);
    }
  };

  private onTap = (event: ConfirmTapEvent): void => {
    const conversation = this.activeConversations.get(event.conversationId);
    if (conversation) {
      conversation.addIncomingEvent("tap", event);
    }
  };
}

export default Playthrough;
