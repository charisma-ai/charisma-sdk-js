import EventEmitter from "eventemitter3";
import PQueue from "p-queue";

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

export type ConversationEvents = {
  message: [MessageEvent];
  "start-typing": [StartTypingEvent];
  "stop-typing": [StopTypingEvent];
  "episode-complete": [EpisodeCompleteEvent];
  "playback-start": [];
  "playback-stop": [];
};

export class Conversation extends EventEmitter<ConversationEvents> {
  private id: number;

  private eventQueue: PQueue = new PQueue();

  private lastEventId?: string;

  private lastTimestamp?: number;

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

    // Whenever we emit a message, store the last event id so we know where to
    // restore from if a disconnection occurs.
    this.on("message", (message) => {
      this.lastEventId = message.eventId;
      this.lastTimestamp = message.timestamp;
    });
  }

  public addIncomingEvent: Conversation["emit"] = (eventName, ...eventArgs) => {
    this.eventQueue.add(() => this.emit(eventName, ...eventArgs));
    return true;
  };

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
    if (typeof this.lastEventId === "string") {
      // Receiving new events when trying to playback is confusing, so pause the event queue.
      this.eventQueue.pause();
      try {
        const { messages } = await this.charismaInstance.getMessageHistory(
          this.id,
          this.lastEventId,
        );
        if (messages.length > 0) {
          this.emit("playback-start");
          messages.forEach((message) => {
            // If we've emitted a new message since playback started, let's ignore playback ones.
            // TODO: Remove this when Safari supports `bigint`s!
            if (typeof BigInt === "undefined") {
              if (message.timestamp > (this.lastTimestamp as number)) {
                this.emit("message", { ...message, conversationId: this.id });
              }
            } else if (
              BigInt(message.eventId) > BigInt(this.lastEventId as string)
            ) {
              this.emit("message", { ...message, conversationId: this.id });
            }
          });
          this.emit("playback-stop");
        }
      } finally {
        // We can restart the queue now playback is finished.
        this.eventQueue.start();
      }
    }
  };
}

export default Conversation;
