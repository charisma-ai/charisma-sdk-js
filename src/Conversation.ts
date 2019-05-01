import EventEmitter from "eventemitter3";

import Charisma from "./Charisma";
import { StartEvent, ReplyEvent, SynthesisConfig } from "./types";

export interface ConversationOptions {
  audioConfig?: SynthesisConfig;
  stopOnSceneEnd?: boolean;
}

export type ConversationEvents =
  | "message"
  | "start-typing"
  | "stop-typing"
  | "scene-completed";

class Conversation extends EventEmitter<ConversationEvents> {
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

  public start(event: StartEvent): void {
    return this.charismaInstance.addOutgoingEvent("start", {
      ...this.options,
      ...event,
      conversationId: this.id
    });
  }

  public reply(event: ReplyEvent): void {
    return this.charismaInstance.addOutgoingEvent("reply", {
      ...this.options,
      ...event,
      conversationId: this.id
    });
  }

  public tap(): void {
    return this.charismaInstance.addOutgoingEvent("tap", {
      ...this.options,
      conversationId: this.id
    });
  }
}

export default Conversation;
