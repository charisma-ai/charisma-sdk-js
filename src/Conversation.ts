import EventEmitter from "eventemitter3";
import PQueue from "p-queue";

import Playthrough from "./Playthrough";
import {
  StartEvent,
  ReplyEvent,
  ActionEvent,
  SpeechConfig,
  MessageEvent,
  StartTypingEvent,
  StopTypingEvent,
  EpisodeCompleteEvent,
  ConfirmActionEvent,
  ConfirmReplyEvent,
  ConfirmResumeEvent,
  ConfirmStartEvent,
  ConfirmTapEvent,
  ReplyIntermediateEvent,
} from "./types";

export interface ConversationOptions {
  speechConfig?: SpeechConfig;
}

export type ConversationEvents = {
  // Events sent from server
  message: [MessageEvent];
  "start-typing": [StartTypingEvent];
  "stop-typing": [StopTypingEvent];
  "episode-complete": [EpisodeCompleteEvent];
  // Confirmation events sent from server
  action: [ConfirmActionEvent];
  reply: [ConfirmReplyEvent];
  resume: [ConfirmResumeEvent];
  start: [ConfirmStartEvent];
  tap: [ConfirmTapEvent];
  // Local events
  "playback-start": [];
  "playback-stop": [];
};

export class Conversation extends EventEmitter<ConversationEvents> {
  private id: number;

  private eventQueue: PQueue = new PQueue();

  private lastEventId?: string;

  private lastTimestamp?: number;

  private playthroughInstance: Playthrough;

  private options: ConversationOptions = {};

  public constructor(
    conversationId: number,
    playthroughInstance: Playthrough,
    options?: ConversationOptions,
  ) {
    super();

    this.id = conversationId;
    this.playthroughInstance = playthroughInstance;

    if (options) {
      this.options = options;
    }

    // Whenever we emit a message, store the last event id so we know where to
    // restore from if a disconnection occurs.
    this.on("message", (message) => {
      this.lastEventId = message.eventId;
      this.lastTimestamp = message.timestamp;
    });

    // Please excuse this ghastly hack, but Babel complains about
    // transforming a function class property with an arrow function inside
    // (only on non-"modern" builds)
    this.addIncomingEvent = this.addIncomingEvent.bind(this);
  }

  public addIncomingEvent<
    T extends EventEmitter.EventNames<ConversationEvents>,
  >(
    eventName: T,
    ...eventArgs: EventEmitter.EventArgs<ConversationEvents, T>
  ): true {
    this.eventQueue.add(() => this.emit(eventName, ...eventArgs));
    return true;
  }

  public start = (event: StartEvent = {}): void => {
    return this.playthroughInstance.addOutgoingEvent("start", {
      ...this.options,
      ...event,
      conversationId: this.id,
    });
  };

  public reply = (event: ReplyEvent): void => {
    return this.playthroughInstance.addOutgoingEvent("reply", {
      ...this.options,
      ...event,
      conversationId: this.id,
    });
  };

  public replyIntermediate = (event: ReplyIntermediateEvent): void => {
    return this.playthroughInstance.addOutgoingEvent("reply-intermediate", {
      ...this.options,
      ...event,
      conversationId: this.id,
    });
  };

  public tap = (): void => {
    return this.playthroughInstance.addOutgoingEvent("tap", {
      ...this.options,
      conversationId: this.id,
    });
  };

  public action = (event: ActionEvent): void => {
    return this.playthroughInstance.addOutgoingEvent("action", {
      ...this.options,
      ...event,
      conversationId: this.id,
    });
  };

  public resume = (): void => {
    return this.playthroughInstance.addOutgoingEvent("resume", {
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
        const { messages } = await this.playthroughInstance.getMessageHistory(
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
