export type MediaType =
  | "image"
  | "video"
  | "audio"
  | "youtube"
  | "vimeo"
  | "unknown";

export interface Mood {
  happiness: number;
  anger: number;
  trust: number;
  patience: number;
  fearlessness: number;
}

interface MessagePathItem {
  id: number;
  type: "node" | "edge";
}
type MessagePath = MessagePathItem[];

export interface MessageCharacter {
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

export interface MessageMedia {
  url: string;
  mediaType: MediaType;
}

export interface CharacterMood {
  id: number;
  name: string;
  mood: Mood;
}

interface GenericMessage<T extends string, S> {
  type: T;
  message: S;
  endStory: boolean;
  tapToContinue: boolean;
  path: MessagePath;
  characterMoods: CharacterMood[];
}

export type Message =
  | GenericMessage<"character", MessageCharacter>
  | GenericMessage<"media", MessageMedia>;

export type SpeechEncoding = "mp3" | "ogg" | "pcm";
export type SpeechOutput = "url" | "buffer";
export interface SpeechConfig {
  encoding?: SpeechEncoding;
  output?: SpeechOutput;
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

export type MessageEvent = {
  conversationId: string;
} & Message;

export interface SceneCompletedEvent {
  conversationId: string;
  impacts: string[];
}
