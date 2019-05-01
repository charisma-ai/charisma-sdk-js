export type MediaType =
  | "image"
  | "video"
  | "audio"
  | "youtube"
  | "vimeo"
  | "unknown";

export interface IMood {
  happiness: number;
  anger: number;
  trust: number;
  patience: number;
  fearlessness: number;
}

interface IMessagePathItem {
  id: number;
  type: "node" | "edge";
}
type MessagePath = IMessagePathItem[];

export interface IMessageCharacter {
  text: string;
  character: {
    id: number;
    name: string;
    avatar: string | null;
  } | null;
  metadata: {
    [key: string]: string;
  };
  speech: {
    audio: { data: number[]; type: "Buffer" } | string;
    duration: number;
  } | null;
  media: {
    imageLayers: (string | null)[];
    soundBackground: string | null;
    soundEffect: string | null;
  };
}

export interface IMessageMedia {
  url: string;
  mediaType: MediaType;
}

interface IMessage<T extends string, S> {
  type: T;
  message: S;
  endStory: boolean;
  tapToContinue: boolean;
  path: MessagePath;
  characterMoods: {
    id: number;
    name: string;
    mood: IMood;
  }[];
}

export type Message =
  | IMessage<"character", IMessageCharacter>
  | IMessage<"media", IMessageMedia>;

export type SynthesisEncoding = "mp3" | "ogg" | "pcm";
export type SynthesisOutput = "url" | "buffer";
export interface SynthesisConfig {
  audioEncoding?: SynthesisEncoding;
  output?: SynthesisOutput;
}

export interface StartEvent {
  sceneIndex?: number;
  startNodeId?: number;
}

export interface ReplyEvent {
  text: string;
}

export interface StartTypingEvent {
  conversationId: string;
}

export interface StopTypingEvent {
  conversationId: string;
}

export interface MessageEvent {
  conversationId: string;
}

export interface SceneCompletedEvent {
  conversationId: string;
  impacts: string[];
}
