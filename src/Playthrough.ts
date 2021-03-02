import EventEmitter from "eventemitter3";
import * as Colyseus from "colyseus.js";
import jwtDecode from "jwt-decode";

import * as api from "./api";

import {
  StartTypingEvent,
  StopTypingEvent,
  MessageEvent,
  EpisodeCompleteEvent,
  Mood,
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

  private baseUrl?: string;

  private client: Colyseus.Client | undefined;

  private room: Colyseus.Room | undefined;

  private connectionStatus: ConnectionStatus = "disconnected";

  private activeConversations = new Map<number, Conversation>();

  public constructor(token: string, baseUrl?: string) {
    super();
    this.token = token;
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

  public setMood(
    characterIdOrName: number | string,
    modifier: Mood,
  ): ReturnType<typeof api.setMood> {
    return api.setMood(this.token, characterIdOrName, modifier, {
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

  public addOutgoingEvent = (eventName: string, eventData: unknown): void => {
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

    // eslint-disable-next-line camelcase
    const { playthrough_id } = jwtDecode<{ playthrough_id: number }>(
      this.token,
    );

    this.room = await this.client.joinOrCreate("chat", {
      playthroughId: playthrough_id,
      token: this.token,
    });

    // // Fired upon a successful reconnection.
    // this.socket.on("reconnect", this.onReconnect);
    // // Fired upon an attempt to reconnect.
    // this.socket.on("reconnecting", this.onReconnecting);
    // // Fired upon a disconnection.
    // this.socket.on("disconnect", this.onDisconnect);
    // // Fired when an error occurs.
    // this.socket.on("error", this.onError);

    this.room.onMessage("status", this.onStatus);
    this.room.onMessage("problem", this.onProblem);
    this.room.onMessage("start-typing", this.onStartTyping);
    this.room.onMessage("stop-typing", this.onStopTyping);
    this.room.onMessage("message", this.onMessage);
    this.room.onMessage("episode-complete", this.onEpisodeComplete);
  };

  public cleanup = (): void => {
    if (this.room) {
      this.room.leave();
      this.room = undefined;
    }
  };

  private changeConnectionStatus = (newStatus: ConnectionStatus): void => {
    if (newStatus !== this.connectionStatus) {
      this.connectionStatus = newStatus;
      this.emit("connection-status", newStatus);
    }
  };

  // private onReconnect = (): void => {
  //   this.activeConversations.forEach((conversation) => {
  //     conversation.reconnect().catch((err) => {
  //       console.error(
  //         `Something went wrong reconnecting to conversation:`,
  //         err,
  //       );
  //     });
  //   });
  // };

  // private onReconnecting = (): void => {
  //   this.changeConnectionStatus("connecting");
  // };

  // private onDisconnect = (): void => {
  //   this.changeConnectionStatus("disconnected");
  // };

  private onStatus = (): void => {
    this.changeConnectionStatus("connected");
  };

  // private onError = (error: unknown): void => {
  //   this.emit("error", error);
  // };

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
