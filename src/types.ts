// Message field types

export type MediaType =
  | "image"
  | "video"
  | "audio"
  | "youtube"
  | "vimeo"
  | "unknown";

export type ActiveFeelingEffect = {
  feeling: string;
  intensity: number;
  duration: number;
  durationRemaining: number;
};

export type Emotion = {
  id: number;
  name: string;
  avatar: string | null;
  moodPositivity: number;
  moodEnergy: number;
  playerRelationship: number;
  activeEffects: ActiveFeelingEffect[];
};

export type Memory = {
  id: number;
  recallValue: string;
  saveValue: string | null;
};

export type MessagePathItem = {
  id: number;
  type: "node" | "edge";
};
export type MessagePath = MessagePathItem[];

export type Impact = {
  id: number;
  impact: string;
  isImpactShareable: boolean;
  impactImageUrl: string | null;
};

export type Metadata = {
  [key: string]: string | undefined;
};

export type Character = {
  id: number;
  name: string;
  avatar: string | null;
};

export type Speech = {
  audio: ArrayBuffer | string;
  duration: number;
};

export type BubblePoints = [number, number, number];
export type BubbleTailPosition = string;
export type BubbleStyle = string;

export type ImageLayerPoints = [[number, number], [number, number]];
export enum ImageLayerResizeMode {
  Contain = "contain",
  Cover = "cover",
}
export type ImageLayer = {
  url: string | null;
  points: ImageLayerPoints;
  resizeMode: ImageLayerResizeMode;
};

export enum AudioTrackBehaviour {
  Continue = "continue",
  Restart = "restart",
}
export type AudioTrack = {
  url: string | null;
  behaviour: AudioTrackBehaviour;
  loop: boolean;
  volume: number;
  stopPlaying: boolean;
};

export type Media = {
  animationIn: string | null;
  animationOut: string | null;
  bubblePoints: BubblePoints | null;
  bubbleTailPosition: BubbleTailPosition | null;
  bubbleStyle: BubbleStyle | null;
  imageLayers: ImageLayer[];
  audioTracks: AudioTrack[];
  stopAllAudio: boolean;
};

// Message types

export type MessageCharacter = {
  text: string;
  character: Character | null;
  metadata: Metadata;
  speech: Speech | null;
  media: Media;
  impact: Impact | null;
};

export type MessagePanel = {
  metadata: Metadata;
  media: Media;
  impact: Impact | null;
};

export type MessageMedia = {
  url: string;
  mediaType: MediaType;
};

type GenericMessage<T extends string, S> = {
  type: T;
  message: S;
  eventId: string;
  timestamp: number;
  endStory: boolean;
  tapToContinue: boolean;
  path: MessagePath;
  emotions: Emotion[];
  memories: Memory[];
};

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
  startGraphId?: number;
  startGraphReferenceId?: string;
  startNodeId?: number;
}

export interface ReplyEvent {
  text: string;
}

export interface ActionEvent {
  action: string;
}

// Events sent to client

export interface StartTypingEvent {
  conversationId: number;
}

export interface StopTypingEvent {
  conversationId: number;
}

export type MessageEvent = {
  conversationId: number;
} & Message;

export type CharacterMoodChange = {
  characterId: number;
  characterName: string | null;
  characterAvatar: string | null;
  // moodChange: Partial<Mood>;
};
export type CharacterMoodChanges = CharacterMoodChange[];

export interface EpisodeCompleteEvent {
  conversationId: number;
  impacts: Impact[];
  completedEpisodeId: number;
  nextEpisodeId: number | null;
  characterMoodChanges: CharacterMoodChanges;
}
