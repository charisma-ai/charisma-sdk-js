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
  characterMoods: Array<{
    id: number;
    name: string;
    mood: IMood;
  }>;
}

export type Message =
  | IMessage<"character", IMessageCharacter>
  | IMessage<"media", IMessageMedia>;

export type SynthesisEncoding = "mp3" | "ogg" | "pcm";
export type SynthesisOutput = "url" | "buffer";
export interface ISynthesisConfig {
  audioEncoding?: SynthesisEncoding;
  output?: SynthesisOutput;
}

export interface IGraphQLRequest<Result = unknown> {
  data?: Result;
  errors?: { message: string };
}

export interface IMessageHistoryQueryResult {
  playthrough: {
    eventsByPlaythroughId: {
      nodes: Array<{
        timestamp: Date;
        eventMessageCharacter: {
          text: string;
          character: {
            id: number;
            name: string;
            avatar: string | null;
          } | null;
          metadata: { [key: string]: string };
          media: string | null;
          endStory: boolean;
          tapToContinue: boolean;
        } | null;
        eventMessagePlayer: {
          text: string;
        } | null;
      }>;
    };
  };
}
