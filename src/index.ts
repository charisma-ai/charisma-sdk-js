import EventEmitter from "eventemitter3";
import jwtDecode from "jwt-decode";
import io from "socket.io-client";

import Microphone from "./microphone";
import speak from "./speaker";
import {
  IGraphQLRequest,
  IMessageHistoryQueryResult,
  ISynthesisConfig,
  Message,
  SynthesisEncoding,
  SynthesisOutput
} from "./types";

export type CharismaEvents =
  | "message"
  | "start-typing"
  | "stop-typing"
  | "recognise-interim"
  | "recognise"
  | "scene-completed";

export {
  Message as CharismaMessage,
  ISynthesisConfig,
  SynthesisEncoding,
  SynthesisOutput
};

const notEmpty = <TValue>(value: TValue | null | undefined): value is TValue =>
  value !== null && value !== undefined;

export class CharismaInstance extends EventEmitter<CharismaEvents> {
  private options: {
    baseUrl: string;
    playthroughToken?: string;
    userToken?: string;
    stopOnSceneComplete?: boolean;
  } = { baseUrl: "https://api.charisma.ai" };

  private buffered: { type: string }[] = [];

  private ready: boolean = false;

  private listening: boolean = false;

  private speaking: boolean = false;

  private socket: SocketIOClient.Socket;

  private microphone: Microphone;

  public constructor(
    socket: SocketIOClient.Socket,
    options?: {
      baseUrl: string;
      playthroughToken?: string;
      userToken?: string;
      stopOnSceneComplete?: boolean;
    }
  ) {
    super();

    if (options) {
      this.options = options;
    }

    // Events emitted by the server
    socket.on("status", this.onStatusChange);
    socket.on("message", this.onMessage);
    socket.on("start-typing", this.onStartTyping);
    socket.on("stop-typing", this.onStopTyping);
    socket.on("scene-completed", this.onSceneCompleted);

    // Generic socket events
    socket.on("error", (error: object) => {
      console.error("Websocket error occured: ", error);
    });

    socket.on("problem", (error: { type: string; error: string }) => {
      console.warn(
        `Problem occured with \`${error.type}\` event:\n${error.error}`
      );
    });

    this.socket = socket;

    const microphone = new Microphone();
    microphone.on("recognise-interim", (...args) => {
      this.emit("recognise-interim", ...args);
    });
    microphone.on("recognise", (...args) => {
      this.emit("recognise", ...args);
    });
    this.microphone = microphone;
  }

  public start = ({
    characterId,
    sceneIndex,
    speech = false,
    startNodeId
  }: {
    characterId?: number;
    sceneIndex?: number;
    speech: boolean | ISynthesisConfig;
    startNodeId?: number;
  }) => {
    const payload = {
      characterId,
      sceneIndex,
      speech,
      startNodeId,
      stopOnSceneComplete: this.options.stopOnSceneComplete,
      type: "start"
    };

    if (this.ready === false) {
      this.buffered.push(payload);
    } else {
      this.socket.emit("start", payload);
    }
  };

  public reply = ({
    message,
    speech = false,
    characterId
  }: {
    message: string;
    speech: boolean | ISynthesisConfig;
    characterId?: number;
  }) => {
    const payload = {
      characterId,
      message,
      speech,
      stopOnSceneComplete: this.options.stopOnSceneComplete,
      type: "reply"
    };

    if (this.ready === false) {
      this.buffered.push(payload);
    } else {
      this.socket.emit("reply", payload);
    }
  };

  public tap = ({
    speech = false
  }: { speech?: boolean | ISynthesisConfig } = {}) => {
    const payload = {
      speech,
      stopOnSceneComplete: this.options.stopOnSceneComplete,
      type: "tap"
    };
    if (this.ready === false) {
      this.buffered.push(payload);
    } else {
      this.socket.emit("tap", payload);
    }
  };

  public speak = async (audio: number[]) => {
    if (this.listening) {
      this.microphone.stopListening();
    }
    this.speaking = true;
    await speak(audio);
    this.speaking = false;
    if (this.listening) {
      this.microphone.startListening();
    }
  };

  public startListening = () => {
    if (!this.speaking) {
      this.microphone.startListening();
    }
    this.listening = true;
  };

  public stopListening = () => {
    this.microphone.stopListening();
    this.listening = false;
  };

  public setMemory = ({
    memoryId,
    saveValue
  }: {
    memoryId: string;
    saveValue: string;
  }) => {
    const payload = { memoryId, saveValue };
    if (this.ready === false) {
      this.buffered.push({ ...payload, type: "set-memory" });
    } else {
      this.socket.emit("set-memory", payload);
    }
  };

  public getMessageHistory = async () => {
    const { baseUrl, playthroughToken, userToken } = this.options;
    if (!playthroughToken || !userToken) {
      throw new Error(
        "`playthroughToken` and `userToken` must be provided to get message history."
      );
    }

    const query = `
      query ($playthroughId: Int!) {
        playthrough: playthroughById(id: $playthroughId) {
          eventsByPlaythroughId {
            nodes {
              timestamp
              eventMessageCharacter: eventMessageCharacterByEventId {
                text
                character: characterByCharacterId {
                  id
                  name
                  avatar
                }
                metadata
                media
                endStory
                tapToContinue
              }
              eventMessagePlayer: eventMessagePlayerByEventId {
                text
              }
            }
          }
        }
      }
    `;

    const { playthrough_id: playthroughId } = jwtDecode<{
      playthrough_id: number;
    }>(playthroughToken);

    const response = await fetch(`${baseUrl}/graphql`, {
      body: JSON.stringify({
        query,
        variables: { playthroughId }
      }),
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${userToken}`,
        "Content-Type": "application/json"
      },
      method: "POST",
      mode: "cors"
    });

    const data: IGraphQLRequest<
      IMessageHistoryQueryResult
    > = await response.json();
    if (!response.ok || !data.data || data.errors) {
      throw new Error("Message history could not be fetched.");
    }

    return data.data.playthrough.eventsByPlaythroughId.nodes
      .map(event => {
        const timestamp = new Date(event.timestamp).getTime();
        if (event.eventMessageCharacter) {
          return {
            ...event.eventMessageCharacter,
            timestamp,
            type: "character" as "character"
          };
        }
        if (event.eventMessagePlayer) {
          return {
            ...event.eventMessagePlayer,
            timestamp,
            type: "player" as "player"
          };
        }
        return null;
      })
      .filter(notEmpty);
  };

  private onStatusChange = (status: string) => {
    if (status === "ready") {
      this.buffered.forEach(payload => {
        this.socket.emit(payload.type, payload);
      });
      this.buffered = [];
      this.ready = true;
    }
  };

  private onMessage = (message: Message) => {
    if (message.endStory && this.listening) {
      this.stopListening();
    }
    this.emit("message", message);
  };

  private onStartTyping = () => {
    this.emit("start-typing");
  };

  private onStopTyping = () => {
    this.emit("stop-typing");
  };

  private onSceneCompleted = (data: { impacts: string[] }) => {
    this.emit("scene-completed", data);
  };
}

export const connect = async ({
  userToken,
  playthroughToken,
  storyId,
  version,
  baseUrl = "https://api.charisma.ai",
  stopOnSceneComplete
}: {
  storyId: number;
  version?: number;
  playthroughToken?: string;
  userToken?: string;
  baseUrl: string;
  stopOnSceneComplete?: boolean;
}) => {
  let token = playthroughToken;

  if (!token) {
    const headers: HeadersInit = {
      Accept: "application/json",
      "Content-Type": "application/json"
    };

    if (typeof userToken === "string") {
      headers.Authorization = `Bearer ${userToken}`;
    }

    if (version === -1 && typeof userToken !== "string") {
      throw new Error(
        "To play the draft version of a story, a `userToken` must also be passed to `connect`."
      );
    }

    try {
      const response = await fetch(`${baseUrl}/play/token`, {
        body: JSON.stringify({
          storyId,
          version
        }),
        headers,
        method: "POST",
        mode: "cors"
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error);
      }
      if (typeof data.token === "string") {
        // eslint-disable-next-line prefer-destructuring
        token = data.token;
      }
    } catch (err) {
      throw new Error(`A playthrough token could not be generated: ${err}`);
    }
  }

  const socket = io(`${baseUrl}/play`, {
    query: {
      token
    },
    transports: ["websocket"],
    upgrade: false
  });

  return new CharismaInstance(socket, {
    baseUrl,
    playthroughToken,
    userToken,
    stopOnSceneComplete
  });
};

export default { connect };
