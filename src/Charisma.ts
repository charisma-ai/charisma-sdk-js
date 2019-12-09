import EventEmitter from "eventemitter3";
import PQueue from "p-queue";
import io from "socket.io-client";
import fetch from "isomorphic-unfetch";
import querystring from "query-string";

import {
  SpeechConfig,
  StartTypingEvent,
  StopTypingEvent,
  MessageEvent,
  EpisodeCompleteEvent,
  Mood,
  ConversationId,
  Message,
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
    saveValue: string | null;
  }[];
  impacts: {
    id: number;
    impact: string;
  }[];
}

interface GetMessageHistoryResult {
  messages: Message[];
}

interface CreateConversationResult {
  conversationId: ConversationId;
}

const fetchHelper = async <T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> => {
  // Always default to `Accept: application/json`
  let headers: Record<string, string> = {
    Accept: "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (
    typeof options.method === "string" &&
    options.method.toLowerCase() === "post"
  ) {
    // If it's a POST method, default to `Content-Type: application/json` for the body
    headers = { "Content-Type": "application/json", ...headers };
  }

  const response = await fetch(endpoint, { mode: "cors", ...options, headers });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: any = {};
  try {
    data = await response.json();
  } catch (err) {
    // Some endpoints just return a status code and no JSON body data.
  }

  if (!response.ok) {
    throw new Error(data.error);
  }

  return data;
};

interface CharismaEvents {
  connect: [];
  reconnect: [];
  reconnecting: [];
  disconnect: [];
  error: [any];
  ready: [];
  problem: [{ type: string; error: string }];
}

class Charisma extends EventEmitter<CharismaEvents> {
  public static charismaUrl = "https://api.charisma.ai";

  public static async createPlaythroughToken(
    options: PlaythroughTokenOptions,
  ): Promise<string> {
    if (options.version === -1 && options.userToken === undefined) {
      throw new Error(
        "To play the draft version (-1) of a story, a `userToken` must also be passed.",
      );
    }
    try {
      const { token } = await fetchHelper<{ token: string }>(
        `${Charisma.charismaUrl}/play/token`,
        {
          body: JSON.stringify({
            storyId: options.storyId,
            version: options.version,
          }),
          headers:
            options.userToken !== undefined
              ? { Authorization: `Bearer ${options.userToken}` }
              : undefined,
          method: "POST",
        },
      );
      return token;
    } catch (err) {
      throw new Error(`A playthrough token could not be generated: ${err}`);
    }
  }

  public static async createConversation(
    token: string,
  ): Promise<ConversationId> {
    const { conversationId } = await fetchHelper<CreateConversationResult>(
      `${Charisma.charismaUrl}/play/conversation`,
      {
        body: JSON.stringify({}),
        headers: { Authorization: `Bearer ${token}` },
        method: "POST",
      },
    );
    return conversationId;
  }

  public static async createCharacterConversation(
    token: string,
    characterId: number,
  ): Promise<ConversationId> {
    const { conversationId } = await fetchHelper<CreateConversationResult>(
      `${Charisma.charismaUrl}/play/conversation/character`,
      {
        body: JSON.stringify({ characterId }),
        headers: { Authorization: `Bearer ${token}` },
        method: "POST",
      },
    );
    return conversationId;
  }

  public static async getMessageHistory(
    token: string,
    conversationId?: number | undefined,
    minEventId?: number | undefined,
  ): Promise<GetMessageHistoryResult> {
    const query = querystring.stringify({ conversationId, minEventId });
    const result = await fetchHelper<GetMessageHistoryResult>(
      `${Charisma.charismaUrl}/play/message-history?${query}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        method: "GET",
      },
    );
    return result;
  }

  public static async getPlaythroughInfo(
    token: string,
  ): Promise<GetPlaythroughInfoResult> {
    const result = await fetchHelper<GetPlaythroughInfoResult>(
      `${Charisma.charismaUrl}/play/playthrough-info`,
      {
        headers: { Authorization: `Bearer ${token}` },
        method: "GET",
      },
    );
    return result;
  }

  public static async setMood(
    token: string,
    characterIdOrName: number | string,
    modifier: Partial<Mood>,
  ): Promise<SetMoodResult> {
    const result = await fetchHelper<SetMoodResult>(
      `${Charisma.charismaUrl}/play/set-mood`,
      {
        body: JSON.stringify({
          ...(typeof characterIdOrName === "number"
            ? { characterId: characterIdOrName }
            : { characterName: characterIdOrName }),
          modifier,
        }),
        headers: { Authorization: `Bearer ${token}` },
        method: "POST",
      },
    );
    return result;
  }

  public static async setMemory(
    token: string,
    memoryIdOrRecallValue: number | string,
    saveValue: string | null,
  ): Promise<void> {
    await fetchHelper<void>(`${Charisma.charismaUrl}/play/set-memory`, {
      body: JSON.stringify({
        ...(typeof memoryIdOrRecallValue === "number"
          ? { memoryId: memoryIdOrRecallValue }
          : { memoryRecallValue: memoryIdOrRecallValue }),
        saveValue,
      }),
      headers: { Authorization: `Bearer ${token}` },
      method: "POST",
    });
  }

  public static async restartFromEpisodeId(
    token: string,
    episodeId: number,
  ): Promise<void> {
    await fetchHelper<void>(
      `${Charisma.charismaUrl}/play/restart-from-episode`,
      {
        body: JSON.stringify({ episodeId }),
        headers: { Authorization: `Bearer ${token}` },
        method: "POST",
      },
    );
  }

  public static async restartFromEpisodeIndex(
    token: string,
    episodeIndex: number,
  ): Promise<void> {
    await fetchHelper<void>(
      `${Charisma.charismaUrl}/play/restart-from-episode`,
      {
        body: JSON.stringify({ episodeIndex }),
        headers: { Authorization: `Bearer ${token}` },
        method: "POST",
      },
    );
  }

  private eventQueue: PQueue = new PQueue({ autoStart: false });

  private token: string;

  private charismaUrl = "https://api.charisma.ai";

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
    characterId: number,
  ): Promise<ConversationId> {
    return Charisma.createCharacterConversation(this.token, characterId);
  }

  public getMessageHistory(
    conversationId?: number | undefined,
    minEventId?: number | undefined,
  ): Promise<GetMessageHistoryResult> {
    return Charisma.getMessageHistory(this.token, conversationId, minEventId);
  }

  public getPlaythroughInfo(): Promise<GetPlaythroughInfoResult> {
    return Charisma.getPlaythroughInfo(this.token);
  }

  public setMemory(
    memoryIdOrRecallValue: number | string,
    saveValue: string | null,
  ): Promise<void> {
    return Charisma.setMemory(this.token, memoryIdOrRecallValue, saveValue);
  }

  public setMood(
    characterIdOrName: number | string,
    modifier: Mood,
  ): Promise<SetMoodResult> {
    return Charisma.setMood(this.token, characterIdOrName, modifier);
  }

  public restartFromEpisodeId(episodeId: number): Promise<void> {
    return Charisma.restartFromEpisodeId(this.token, episodeId);
  }

  public restartFromEpisodeIndex(episodeIndex: number): Promise<void> {
    return Charisma.restartFromEpisodeIndex(this.token, episodeIndex);
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
    this.activeConversations.forEach(conversation => {
      conversation.reconnect().catch(err => {
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
