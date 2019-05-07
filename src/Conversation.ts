import EventEmitter from "eventemitter3";

import Charisma from "./Charisma";
import {
  StartEvent,
  ReplyEvent,
  SpeechConfig,
  MessageEvent,
  StartTypingEvent,
  StopTypingEvent,
  SceneCompletedEvent
} from "./types";

export interface ConversationOptions {
  speechConfig?: SpeechConfig;
  stopOnSceneEnd?: boolean;
}

export type ConversationEvents =
  | "message"
  | "start-typing"
  | "stop-typing"
  | "scene-completed";

// eslint-disable-next-line import/export
export declare interface Conversation {
  on(event: "message", listener: (event: MessageEvent) => void): this;
  on(event: "start-typing", listener: (event: StartTypingEvent) => void): this;
  on(event: "stop-typing", listener: (event: StopTypingEvent) => void): this;
  on(
    event: "scene-completed",
    listener: (event: SceneCompletedEvent) => void
  ): this;
  on(event: string, listener: (...args: any[]) => void): this;
}

// eslint-disable-next-line import/export
export class Conversation extends EventEmitter<ConversationEvents> {
  private id: string;

  private charismaInstance: Charisma;

  private options: ConversationOptions = {};

  public constructor(
    conversationId: string,
    charismaInstance: Charisma,
    options?: ConversationOptions
  ) {
    super();

    this.id = conversationId;
    this.charismaInstance = charismaInstance;

    if (options) {
      this.options = options;
    }
  }

  public start = (event: StartEvent): void => {
    return this.charismaInstance.addOutgoingEvent("start", {
      ...this.options,
      ...event,
      conversationId: this.id
    });
  };

  public reply = (event: ReplyEvent): void => {
    return this.charismaInstance.addOutgoingEvent("reply", {
      ...this.options,
      ...event,
      conversationId: this.id
    });
  };

  public tap = (): void => {
    return this.charismaInstance.addOutgoingEvent("tap", {
      ...this.options,
      conversationId: this.id
    });
  };

  public setSpeechConfig = (speechConfig: SpeechConfig | undefined): void => {
    this.options.speechConfig = speechConfig;
  };

  public setStopOnSceneEnd = (stopOnSceneEnd: boolean): void => {
    this.options.stopOnSceneEnd = stopOnSceneEnd;
  };
}

export default Conversation;
