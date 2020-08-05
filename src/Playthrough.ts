import EventEmitter from "eventemitter3";
import io from "socket.io-client";

import * as api from "./api";

import {
  StartTypingEvent,
  StopTypingEvent,
  MessageEvent,
  EpisodeCompleteEvent,
  Mood,
  ConversationId,
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

  private socket: SocketIOClient.Socket | undefined;

  private connectionStatus: ConnectionStatus = "disconnected";

  private activeConversations = new Map<ConversationId, Conversation>();

  public constructor(token: string) {
    super();
    this.token = token;
  }

  public createConversation(): ReturnType<typeof api.createConversation> {
    return api.createConversation(this.token);
  }

  public createCharacterConversation(
    characterId: number,
  ): ReturnType<typeof api.createCharacterConversation> {
    return api.createCharacterConversation(this.token, characterId);
  }

  public getMessageHistory(
    conversationId?: number | undefined,
    minEventId?: string | undefined,
  ): ReturnType<typeof api.getMessageHistory> {
    return api.getMessageHistory(this.token, conversationId, minEventId);
  }

  public getPlaythroughInfo(): ReturnType<typeof api.getPlaythroughInfo> {
    return api.getPlaythroughInfo(this.token);
  }

  public setMemory(
    memoryIdOrRecallValue: number | string,
    saveValue: string | null,
  ): ReturnType<typeof api.setMemory> {
    return api.setMemory(this.token, memoryIdOrRecallValue, saveValue);
  }

  public setMood(
    characterIdOrName: number | string,
    modifier: Mood,
  ): ReturnType<typeof api.setMood> {
    return api.setMood(this.token, characterIdOrName, modifier);
  }

  public restartFromEpisodeId(
    episodeId: number,
  ): ReturnType<typeof api.restartFromEpisodeId> {
    return api.restartFromEpisodeId(this.token, episodeId);
  }

  public restartFromEpisodeIndex(
    episodeIndex: number,
  ): ReturnType<typeof api.restartFromEpisodeIndex> {
    return api.restartFromEpisodeIndex(this.token, episodeIndex);
  }

  public restartFromEventId(
    eventId: string,
  ): ReturnType<typeof api.restartFromEventId> {
    return api.restartFromEventId(this.token, eventId);
  }

  public joinConversation = (
    conversationId: ConversationId,
    options?: ConversationOptions,
  ): Conversation => {
    const conversation = new Conversation(conversationId, this, options);
    if (this.activeConversations.has(conversationId)) {
      return this.activeConversations.get(conversationId) as Conversation;
    }
    this.activeConversations.set(conversationId, conversation);
    return conversation;
  };

  public leaveConversation = (conversationId: ConversationId): void => {
    if (!this.activeConversations.has(conversationId)) {
      throw new Error(
        `The conversation with id \`${conversationId}\` has not been joined, so cannot be left.`,
      );
    }
    this.activeConversations.delete(conversationId);
  };

  public getConversation = (
    conversationId: ConversationId,
  ): Conversation | undefined => {
    return this.activeConversations.get(conversationId);
  };

  public addOutgoingEvent = (
    eventName: string,
    ...eventData: unknown[]
  ): void => {
    if (this.socket) {
      if (this.connectionStatus === "connected") {
        this.socket.emit(eventName, ...eventData);
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

  public connect = (): void => {
    const charismaUrl = api.getBaseUrl();
    this.socket = io(`${charismaUrl}/play`, {
      query: { token: this.token },
      transports: ["websocket"],
      upgrade: false,
    });

    // Fired upon a successful reconnection.
    this.socket.on("reconnect", this.onReconnect);
    // Fired upon an attempt to reconnect.
    this.socket.on("reconnecting", this.onReconnecting);
    // Fired upon a disconnection.
    this.socket.on("disconnect", this.onDisconnect);
    // Fired when an error occurs.
    this.socket.on("error", this.onError);

    this.socket.on("status", this.onStatus);
    this.socket.on("problem", this.onProblem);
    this.socket.on("start-typing", this.onStartTyping);
    this.socket.on("stop-typing", this.onStopTyping);
    this.socket.on("message", this.onMessage);
    this.socket.on("episode-complete", this.onEpisodeComplete);
  };

  public cleanup = (): void => {
    if (this.socket) {
      this.socket.close();
      this.socket = undefined;
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

  private onStatus = (): void => {
    this.changeConnectionStatus("connected");
  };

  private onError = (error: unknown): void => {
    this.emit("error", error);
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
}

export default Playthrough;
