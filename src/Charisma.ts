import EventEmitter from "eventemitter3";
import PQueue from "p-queue";
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

type ConversationToJoin =
  | ConversationId
  | {
      conversationId: ConversationId;
      options: ConversationOptions;
    };

type CharismaEvents = {
  connect: [];
  reconnect: [];
  reconnecting: [];
  disconnect: [];
  error: [any];
  ready: [];
  problem: [{ type: string; error: string }];
};

class Charisma extends EventEmitter<CharismaEvents> {
  private eventQueue: PQueue = new PQueue({ autoStart: false });

  private token: string;

  private charismaUrl = "https://api.charisma.ai";

  private socket: SocketIOClient.Socket | undefined;

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

  public joinConversation = (
    conversationId: ConversationId,
    options?: ConversationOptions,
  ): Conversation => {
    const conversation = new Conversation(conversationId, this, options);
    if (this.activeConversations.has(conversationId)) {
      throw new Error(
        `The conversation with id \`${conversationId}\` has already been joined.`,
      );
    }
    this.activeConversations.set(conversationId, conversation);
    return conversation;
  };

  public joinConversations = (
    conversations: ConversationToJoin[],
  ): Promise<Conversation[]> => {
    return Promise.all(
      conversations.map(
        (conversation): Conversation => {
          if (typeof conversation === "number") {
            return this.joinConversation(conversation);
          }
          return this.joinConversation(
            conversation.conversationId,
            conversation.options,
          );
        },
      ),
    );
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
    this.eventQueue.add((): void => {
      if (this.socket) {
        this.socket.emit(eventName, ...eventData);
      }
    });
  };

  public connect = (): void => {
    this.socket = io(`${this.charismaUrl}/play`, {
      query: { token: this.token },
      transports: ["websocket"],
      upgrade: false,
    });

    // Fired upon a connection including a successful reconnection.
    this.socket.on("connect", this.onConnect);
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

  private onConnect = (): void => {
    this.emit("connect");
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
    this.emit("reconnect");
  };

  private onReconnecting = (): void => {
    this.emit("reconnecting");
  };

  private onError = (error: unknown): void => {
    this.emit("error", error);
  };

  private onDisconnect = (): void => {
    this.eventQueue.pause();
    this.emit("disconnect");
  };

  private onStatus = (): void => {
    this.eventQueue.start();
    this.emit("ready");
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

export default Charisma;
