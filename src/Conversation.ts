import EventEmitter from "eventemitter3";
import PQueue from "p-queue";

import Playthrough from "./Playthrough.js";
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
  ProblemEvent,
  Message,
} from "./types.js";

export interface ConversationOptions {
  speechConfig?: SpeechConfig;
}

export type ConversationEvents = {
  // Events sent from server
  message: [MessageEvent];
  "start-typing": [StartTypingEvent];
  "stop-typing": [StopTypingEvent];
  "episode-complete": [EpisodeCompleteEvent];
  problem: [ProblemEvent];
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
  private uuid: string;

  private eventQueue: PQueue = new PQueue();

  private lastEventId?: string;

  private playthroughInstance: Playthrough;

  private options: ConversationOptions = {};

  public constructor(
    conversationUuid: string,
    playthroughInstance: Playthrough,
    options?: ConversationOptions,
  ) {
    super();

    this.uuid = conversationUuid;
    this.playthroughInstance = playthroughInstance;

    if (options) {
      this.options = options;
    }

    // Whenever we emit a message, store the last event id so we know where to
    // restore from if a disconnection occurs.
    this.on("message", (message) => {
      this.lastEventId = message.eventId;
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
      conversationUuid: this.uuid,
    });
  };

  public reply = (event: ReplyEvent): void => {
    return this.playthroughInstance.addOutgoingEvent("reply", {
      ...this.options,
      ...event,
      conversationUuid: this.uuid,
    });
  };

  public replyIntermediate = (event: ReplyIntermediateEvent): void => {
    return this.playthroughInstance.addOutgoingEvent("reply-intermediate", {
      ...this.options,
      ...event,
      conversationUuid: this.uuid,
    });
  };

  public tap = (): void => {
    return this.playthroughInstance.addOutgoingEvent("tap", {
      ...this.options,
      conversationUuid: this.uuid,
    });
  };

  public action = (event: ActionEvent): void => {
    return this.playthroughInstance.addOutgoingEvent("action", {
      ...this.options,
      ...event,
      conversationUuid: this.uuid,
    });
  };

  public resume = (): void => {
    return this.playthroughInstance.addOutgoingEvent("resume", {
      ...this.options,
      conversationUuid: this.uuid,
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
        const { events } = await this.playthroughInstance.getEventHistory({
          conversationUuid: this.uuid,
          minEventId: this.lastEventId,
          limit: 1000,
          eventTypes: ["message_character"],
        });
        if (events.length > 0) {
          this.emit("playback-start");
          events.forEach((event) => {
            // If we've emitted a new message since playback started, let's ignore playback ones.
            if (BigInt(event.id) > BigInt(this.lastEventId as string)) {
              this.emit("message", {
                ...(event.payload as Message),
                conversationUuid: this.uuid,
              });
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
