import EventEmitter from "eventemitter3";

import Charisma from "./Charisma";
import {
  StartEvent,
  ReplyEvent,
  SpeechConfig,
  MessageEvent,
  StartTypingEvent,
  StopTypingEvent,
  EpisodeCompleteEvent,
} from "./types";

export interface ConversationOptions {
  speechConfig?: SpeechConfig;
}

export interface ConversationEvents {
  message: [MessageEvent];
  "start-typing": [StartTypingEvent];
  "stop-typing": [StopTypingEvent];
  "episode-complete": [EpisodeCompleteEvent];
}

export class Conversation extends EventEmitter<ConversationEvents> {
  private id: number;

  private lastEventId?: number;

  private charismaInstance: Charisma;

  private options: ConversationOptions = {};

  public constructor(
    conversationId: number,
    charismaInstance: Charisma,
    options?: ConversationOptions,
  ) {
    super();

    this.id = conversationId;
    this.charismaInstance = charismaInstance;

    if (options) {
      this.options = options;
    }

    // Whenever we receive a message, store the last event id so we know where to
    // restore from if a disconnection occurs.
    this.on("message", message => {
      this.lastEventId = message.eventId;
    });
  }

  public start = (event: StartEvent = {}): void => {
    return this.charismaInstance.addOutgoingEvent("start", {
      ...this.options,
      ...event,
      conversationId: this.id,
    });
  };

  public reply = (event: ReplyEvent): void => {
    return this.charismaInstance.addOutgoingEvent("reply", {
      ...this.options,
      ...event,
      conversationId: this.id,
    });
  };

  public tap = (): void => {
    return this.charismaInstance.addOutgoingEvent("tap", {
      ...this.options,
      conversationId: this.id,
    });
  };

  public resume = (): void => {
    return this.charismaInstance.addOutgoingEvent("resume", {
      ...this.options,
      conversationId: this.id,
    });
  };

  public setSpeechConfig = (speechConfig: SpeechConfig | undefined): void => {
    this.options.speechConfig = speechConfig;
  };

  public reconnect = async (): Promise<void> => {
    // If we haven't received any messages so far, there's nowhere to playback from.
    if (typeof this.lastEventId === "number") {
      const { messages } = await this.charismaInstance.getMessageHistory(
        this.id,
        this.lastEventId + 1,
      );
      messages.forEach(message => {
        this.emit("message", { ...message, conversationId: this.id });
      });
    }
  };
}

export default Conversation;
