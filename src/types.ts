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

export interface MessagePathItem {
  id: number;
  type: "node" | "edge";
}
export type MessagePath = MessagePathItem[];

export interface Impact {
  id: number;
  impact: string;
}

export interface Metadata {
  [key: string]: string | undefined;
}

export interface Character {
  id: number;
  name: string;
  avatar: string | null;
}

export interface Speech {
  audio: { data: number[]; type: "Buffer" } | string;
  duration: number;
}

export interface Media {
  imageLayers: (string | null)[];
  soundBackground: string | null;
  soundEffect: string | null;
}

export interface MessageCharacter {
  text: string;
  character: Character | null;
  metadata: Metadata;
  speech: Speech | null;
  media: Media;
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

export interface Memory {
  id: number;
  recallValue: string;
  saveValue: string | null;
}

interface GenericMessage<T extends string, S> {
  type: T;
  message: S;
  eventId: number;
  timestamp: number;
  endStory: boolean;
  tapToContinue: boolean;
  path: MessagePath;
  characterMoods: CharacterMood[];
  memories: Memory[];
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

export interface EpisodeCompleteEvent {
  conversationId: ConversationId;
  impacts: Impact[];
  completedEpisodeId: number;
  nextEpisodeId: number | null;
}
