import EventEmitter from "eventemitter3";
import PQueue from "p-queue";
import io from "socket.io-client";

import {
  SpeechConfig,
  StartTypingEvent,
  StopTypingEvent,
  MessageEvent,
  SceneCompleteEvent,
  Mood,
  ConversationId
} from "./types";
import Conversation, { ConversationOptions } from "./Conversation";

interface GlobalOptions {
  charismaUrl?: string;
}

interface PlaythroughTokenOptions {
  storyId: number;
  version?: number;
  userToken?: string;
}

interface CharismaOptions extends GlobalOptions {
  speechConfig?: SpeechConfig;
}

type ConversationToJoin =
  | ConversationId
  | {
      conversationId: ConversationId;
      options: ConversationOptions;
    };

interface SetMoodResult {
  characterId: number;
  mood: Mood;
}

interface GetPlaythroughInfoResult {
  characterMoods: {
    id: number;
    name: string;
    mood: Mood;
  }[];
  memories: {
    id: number;
    recallValue: string;
    saveValue: string;
  }[];
}

interface CreateConversationResult {
  conversationId: ConversationId;
}

const fetchJson = async <T>(
  endpoint: string,
  bodyData: object = {},
  options: RequestInit = {}
): Promise<T> => {
  const headers = new Headers({
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(options.headers || {})
  });

  const response = await fetch(endpoint, {
    body: JSON.stringify(bodyData),
    method: "POST",
    mode: "cors",
    ...options,
    headers
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
    if (options.version === -1 && options.userToken === undefined) {
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

  public static async createConversation(
    token: string
  ): Promise<ConversationId> {
    const { conversationId } = await fetchJson<CreateConversationResult>(
      `${Charisma.charismaUrl}/play/conversation`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return conversationId;
  }

  public static async createCharacterConversation(
    token: string,
    characterId: number
  ): Promise<ConversationId> {
    const { conversationId } = await fetchJson<CreateConversationResult>(
      `${Charisma.charismaUrl}/play/conversation/character`,
      { characterId },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return conversationId;
  }

  public static async createImpactConversation(
    token: string,
    impactId: number
  ): Promise<ConversationId> {
    const { conversationId } = await fetchJson<CreateConversationResult>(
      `${Charisma.charismaUrl}/play/conversation/impact`,
      { impactId },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return conversationId;
  }

  public static async getPlaythroughInfo(
    token: string
  ): Promise<GetPlaythroughInfoResult> {
    const result = await fetchJson<GetPlaythroughInfoResult>(
      `${Charisma.charismaUrl}/play/playthrough-info`,
      {},
      { headers: { Authorization: `Bearer ${token}` }, method: "GET" }
    );
    return result;
  }

  public static async setMood(
    token: string,
    characterIdOrName: number | string,
    modifier: Partial<Mood>
  ): Promise<SetMoodResult> {
    const result = await fetchJson<SetMoodResult>(
      `${Charisma.charismaUrl}/play/set-mood`,
      {
        ...(typeof characterIdOrName === "number"
          ? { characterId: characterIdOrName }
          : { characterName: characterIdOrName }),
        modifier
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return result;
  }

  public static async setMemory(
    token: string,
    memoryIdOrRecallValue: number | string,
    saveValue: string
  ): Promise<void> {
    await fetchJson<void>(
      `${Charisma.charismaUrl}/play/set-memory`,
      {
        ...(typeof memoryIdOrRecallValue === "number"
          ? { memoryId: memoryIdOrRecallValue }
          : { memoryRecallValue: memoryIdOrRecallValue }),
        saveValue
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );
  }

  private eventQueue: PQueue = new PQueue({ autoStart: false });

  private token: string;

  private charismaUrl: string = "https://api.charisma.ai";

  private socket: SocketIOClient.Socket | undefined;

  private activeConversations: Map<ConversationId, Conversation> = new Map();

  public constructor(token: string, options?: CharismaOptions) {
    super();

    this.token = token;

    if (options && options.charismaUrl) {
      this.charismaUrl = options.charismaUrl;
    }
  }

  public createConversation(): Promise<ConversationId> {
    return Charisma.createConversation(this.token);
  }

  public createCharacterConversation(
    characterId: number
  ): Promise<ConversationId> {
    return Charisma.createCharacterConversation(this.token, characterId);
  }

  public createImpactConversation(impactId: number): Promise<ConversationId> {
    return Charisma.createImpactConversation(this.token, impactId);
  }

  public getPlaythroughInfo(): Promise<GetPlaythroughInfoResult> {
    return Charisma.getPlaythroughInfo(this.token);
  }

  public setMemory(
    memoryIdOrRecallValue: number | string,
    saveValue: string
  ): Promise<void> {
    return Charisma.setMemory(this.token, memoryIdOrRecallValue, saveValue);
  }

  public setMood(
    characterIdOrName: number | string,
    modifier: Mood
  ): Promise<SetMoodResult> {
    return Charisma.setMood(this.token, characterIdOrName, modifier);
  }

  public joinConversation = (
    conversationId: ConversationId,
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
          if (typeof conversation === "number") {
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

  public leaveConversation = (conversationId: ConversationId): void => {
    if (!this.activeConversations.has(conversationId)) {
      throw new Error(
        `The conversation with id \`${conversationId}\` has not been joined, so cannot be left.`
      );
    }
    this.activeConversations.delete(conversationId);
  };

  public getConversation = (
    conversationId: ConversationId
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
      upgrade: false
    });

    this.socket.on("connect", this.onConnect);
    this.socket.on("error", this.onError);
    this.socket.on("disconnect", this.onDisconnect);

    this.socket.on("status", this.onStatus);
    this.socket.on("start-typing", this.onStartTyping);
    this.socket.on("stop-typing", this.onStopTyping);
    this.socket.on("message", this.onMessage);
    this.socket.on("scene-complete", this.onSceneComplete);
  };

  public cleanup = (): void => {
    if (this.socket) {
      this.socket.close();
      this.socket = undefined;
    }
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

  private onSceneComplete = (event: SceneCompleteEvent): void => {
    const conversation = this.activeConversations.get(event.conversationId);
    if (conversation) {
      conversation.emit("scene-complete", event);
    }
  };
}

export default Charisma;
