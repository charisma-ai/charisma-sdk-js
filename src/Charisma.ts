import EventEmitter from "eventemitter3";
import PQueue from "p-queue";
import io from "socket.io-client";

import {
  SynthesisConfig,
  StartTypingEvent,
  StopTypingEvent,
  MessageEvent,
  SceneCompletedEvent
} from "./types";
import Conversation from "./Conversation";

interface GlobalOptions {
  charismaUrl?: string;
}

interface PlaythroughTokenOptions {
  storyId: number;
  version?: number;
  userToken?: string;
}

interface CharismaOptions extends GlobalOptions {
  audioConfig?: SynthesisConfig;
}

interface ConversationOptions {
  audioConfig?: SynthesisConfig;
  stopOnSceneEnd?: boolean;
}

type ConversationToJoin =
  | string
  | {
      conversationId: string;
      options: ConversationOptions;
    };

const fetchJson = async <T>(
  endpoint: string,
  bodyData: object = {},
  options: RequestInit = {}
): Promise<T> => {
  const headers: HeadersInit = {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  const response = await fetch(endpoint, {
    body: JSON.stringify(bodyData),
    headers,
    method: "POST",
    mode: "cors",
    ...options
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error);
  }

  return data;
};

declare interface Charisma {
  on(event: "ready", listener: () => void): this;
  on(event: "connect", listener: () => void): this;
  on(event: "error", listener: (error: any) => void): this;
  on(event: string, listener: (...args: any[]) => void): this;
}

class Charisma extends EventEmitter<"ready" | "connect" | "error"> {
  public static charismaUrl = "https://api.charisma.ai";

  public static async createPlaythroughToken(
    options: PlaythroughTokenOptions
  ): Promise<string> {
    if (options.version === -1 && options.userToken) {
      throw new Error(
        "To play the draft version (-1) of a story, a `userToken` must also be passed."
      );
    }
    try {
      const { token } = await fetchJson<{ token: string }>(
        `${Charisma.charismaUrl}/play/token`,
        {
          storyId: options.storyId,
          version: options.version
        },
        options.userToken !== undefined
          ? {
              headers: { Authorization: `Bearer ${options.userToken}` }
            }
          : undefined
      );
      return token;
    } catch (err) {
      throw new Error(`A playthrough token could not be generated: ${err}`);
    }
  }

  public static async createConversation(token: string): Promise<string> {
    const { id } = await fetchJson<{ id: string }>(
      `${Charisma.charismaUrl}/play/conversation`,
      { playthroughToken: token }
    );
    return id;
  }

  public static async createEpilogueConversation(
    token: string,
    epilogueId: number
  ): Promise<string> {
    const { id } = await fetchJson<{ id: string }>(
      `${Charisma.charismaUrl}/play/conversation/epilogue`,
      { playthroughToken: token, epilogueId }
    );
    return id;
  }

  public static async createCharacterConversation(
    token: string,
    characterId: number
  ): Promise<string> {
    const { id } = await fetchJson<{ id: string }>(
      `${Charisma.charismaUrl}/play/conversation/character`,
      { playthroughToken: token, characterId }
    );
    return id;
  }

  private eventQueue: PQueue = new PQueue({ autoStart: false });

  private token: string;

  private charismaUrl: string = "https://api.charisma.ai";

  private socket: SocketIOClient.Socket | undefined;

  private activeConversations: Map<string, Conversation> = new Map();

  public constructor(token: string, options?: CharismaOptions) {
    super();

    this.token = token;

    if (options && options.charismaUrl) {
      this.charismaUrl = options.charismaUrl;
    }
  }

  public joinConversation = (
    conversationId: string,
    options?: ConversationOptions
  ): Conversation => {
    const conversation = new Conversation(conversationId, this, options);
    if (this.activeConversations.has(conversationId)) {
      throw new Error(
        `The conversation with id \`${conversationId}\` has already been joined.`
      );
    }
    this.activeConversations.set(conversationId, conversation);
    return conversation;
  };

  public joinConversations = (
    conversations: ConversationToJoin[]
  ): Promise<Conversation[]> => {
    return Promise.all(
      conversations.map(
        (conversation): Conversation => {
          if (typeof conversation === "string") {
            return this.joinConversation(conversation);
          }
          return this.joinConversation(
            conversation.conversationId,
            conversation.options
          );
        }
      )
    );
  };

  public getConversation = (
    conversationId: string
  ): Conversation | undefined => {
    return this.activeConversations.get(conversationId);
  };

  public addOutgoingEvent = (
    eventName: string,
    ...eventData: unknown[]
  ): void => {
    this.eventQueue.add(
      (): void => {
        if (this.socket) {
          this.socket.emit(eventName, ...eventData);
        }
      }
    );
  };

  public connect = (): void => {
    this.socket = io(`${this.charismaUrl}/play`, {
      query: { token: this.token },
      transports: ["websocket"],
      upgrade: false
    });

    this.socket.on("connect", this.onConnect);
    this.socket.on("error", this.onError);
    this.socket.on("disconnect", this.onDisconnect);

    this.socket.on("status", this.onStatus);
    this.socket.on("start-typing", this.onStartTyping);
    this.socket.on("stop-typing", this.onStopTyping);
    this.socket.on("message", this.onMessage);
    this.socket.on("scene-completed", this.onSceneCompleted);
  };

  private onStatus = (): void => {
    this.eventQueue.start();
    this.emit("ready");
  };

  private onConnect = (): void => {
    this.emit("connect");
  };

  private onError = (error: unknown): void => {
    this.emit("error", error);
  };

  private onDisconnect = (): void => {
    this.eventQueue.pause();
  };

  private onStartTyping = (event: StartTypingEvent): void => {
    const conversation = this.activeConversations.get(event.conversationId);
    if (conversation) {
      conversation.emit("start-typing", event);
    }
  };

  private onStopTyping = (event: StopTypingEvent): void => {
    const conversation = this.activeConversations.get(event.conversationId);
    if (conversation) {
      conversation.emit("stop-typing", event);
    }
  };

  private onMessage = (event: MessageEvent): void => {
    const conversation = this.activeConversations.get(event.conversationId);
    if (conversation) {
      conversation.emit("message", event);
    }
  };

  private onSceneCompleted = (event: SceneCompletedEvent): void => {
    const conversation = this.activeConversations.get(event.conversationId);
    if (conversation) {
      conversation.emit("scene-completed", event);
    }
  };
}

export default Charisma;
