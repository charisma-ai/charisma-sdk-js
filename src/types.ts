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

export interface Impact {
  id: number;
  impact: string;
}

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
  impact: Impact | null;
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

export type ConversationId = number;

// Events sent to server

export interface StartEvent {
  sceneIndex?: number;
  startNodeId?: number;
}

export interface ReplyEvent {
  text: string;
}

// Events sent to client

export interface StartTypingEvent {
  conversationId: ConversationId;
}

export interface StopTypingEvent {
  conversationId: ConversationId;
}

export type MessageEvent = {
  conversationId: ConversationId;
} & Message;

export interface SceneCompleteEvent {
  conversationId: ConversationId;
  impacts: Impact[];
}
