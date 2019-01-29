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
    audio: Buffer;
    duration: number;
  } | null;
}

export interface IMessageMedia {
  url: string;
  mediaType: MediaType;
}

export interface IMessageTap {
  text: string;
}

interface IMessage<T extends string, S> {
  type: T;
  message: S;
  endStory: boolean;
  path: MessagePath;
  characterMoods: Array<{
    id: number;
    name: string;
    mood: IMood;
  }>;
}

export type Message =
  | IMessage<"character", IMessageCharacter>
  | IMessage<"media", IMessageMedia>
  | IMessage<"tap", IMessageTap>;
