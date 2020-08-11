export type ConversationId = number;

// Message field types

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
  isImpactShareable: boolean;
  impactImageUrl: string | null;
}

export interface CharacterMoodChange {
  characterId: number;
  characterName: string | null;
  characterAvatar: string | null;
  moodChange: Partial<Mood>;
}
export type CharacterMoodChanges = CharacterMoodChange[];

export interface Metadata {
  [key: string]: string | undefined;
}

export interface Character {
  id: number;
  name: string;
  avatar: string | null;
}

export interface SpeechAudio {
  data: number[];
  type: "Buffer";
}

export interface Speech {
  audio: SpeechAudio | string;
  duration: number;
}

export type BubblePoints = [number, number, number];
export type BubbleTailPosition = string;
export type BubbleStyle = string;

export type ImageLayerPoints = [[number, number], [number, number]];
export enum ImageLayerResizeMode {
  Contain = "contain",
  Cover = "cover",
}
export interface ImageLayer {
  url: string | null;
  points: ImageLayerPoints;
  resizeMode: ImageLayerResizeMode;
}

export interface Media {
  bubblePoints: BubblePoints | null;
  bubbleTailPosition: BubbleTailPosition | null;
  bubbleStyle: BubbleStyle | null;
  imageLayers: ImageLayer[];
  soundBackground: string | null;
  soundEffect: string | null;
}

// Message types

export interface MessageCharacter {
  text: string;
  character: Character | null;
  metadata: Metadata;
  speech: Speech | null;
  media: Media;
  impact: Impact | null;
}

export interface MessagePanel {
  metadata: Metadata;
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
  eventId: string;
  timestamp: number;
  endStory: boolean;
  tapToContinue: boolean;
  path: MessagePath;
  characterMoods: CharacterMood[];
  memories: Memory[];
}

export type Message =
  | GenericMessage<"character", MessageCharacter>
  | GenericMessage<"panel", MessagePanel>
  | GenericMessage<"media", MessageMedia>;

// Speech config (set on Conversation)

export type SpeechEncoding = "mp3" | "ogg" | "pcm";
export type SpeechOutput = "url" | "buffer";
export interface SpeechConfig {
  encoding?: SpeechEncoding;
  output?: SpeechOutput;
}

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
  characterMoodChanges: CharacterMoodChanges;
}
