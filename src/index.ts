import EventEmitter from "eventemitter3";
import io from "socket.io-client";

const BASE_URL = "https://api.charisma.ai";

let context: AudioContext | null = null;

declare global {
  // tslint:disable-next-line
  interface Window {
    AudioContext: typeof AudioContext;
    webkitAudioContext: typeof AudioContext;
  }
}

if (typeof window !== "undefined") {
  window.AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!context && window.AudioContext) {
    context = new window.AudioContext();
  }
}

type ID = string;

interface IReply {
  reply: {
    message: string;
    character: string;
    avatar?: string;
    speech?: string; // Stringified buffer
    metadata: {
      [key: string]: string;
    };
  };
  endStory: boolean;
  path: Array<{
    id: ID;
    type: "node" | "edge";
  }>;
}

export class CharismaInstance extends EventEmitter {
  private buffered: Array<{ type: string }> = [];
  private ready: boolean = false;
  private socket: SocketIOClient.Socket;

  constructor(socket: SocketIOClient.Socket) {
    super();

    // Events emitted by the server
    socket.on("status", this.onStatusChange);
    socket.on("reply", this.onReply);
    socket.on("start-typing", this.onStartTyping);
    socket.on("stop-typing", this.onStopTyping);

    // Generic socket events
    socket.on("error", (error: object) => {
      console.error("Websocket error occured: ", error);
    });

    this.socket = socket;
  }

  public start = ({
    startNodeId,
    speech = false,
    characterId
  }: {
    startNodeId?: ID;
    speech: boolean;
    characterId?: ID;
  }) => {
    const payload = {
      characterId,
      speech,
      startNodeId,
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
    speech: boolean;
    characterId?: ID;
  }) => {
    const payload = {
      characterId,
      message,
      speech,
      type: "reply"
    };

    if (this.ready === false) {
      this.buffered.push(payload);
    } else {
      this.socket.emit("reply", payload);
    }
  };

  public speak = async (audio: number[]) => {
    if (context) {
      const arrayBuffer = new Uint8Array(audio).buffer;
      const source = context.createBufferSource();
      source.connect(context.destination);
      source.buffer = await context.decodeAudioData(arrayBuffer);
      return new Promise(resolve => {
        source.onended = () => resolve();
        source.start();
      });
    }
    return Promise.resolve();
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

  private onReply = (reply: IReply) => {
    this.emit("reply", reply);
  };

  private onStartTyping = () => {
    this.emit("start-typing");
  };

  private onStopTyping = () => {
    this.emit("stop-typing");
  };
}

export const connect = async ({
  userToken,
  storyId,
  debug = false
}: {
  storyId: ID;
  userToken?: string;
  debug: boolean;
}) => {
  const headers: HeadersInit = {
    Accept: "application/json",
    "Content-Type": "application/json"
  };

  if (typeof userToken === "string") {
    headers.Authorization = `Bearer ${userToken}`;
  }

  let token;

  try {
    const response = await fetch(`${BASE_URL}/play/token`, {
      body: JSON.stringify({
        storyId,
        version: debug ? -1 : undefined
      }),
      headers,
      method: "POST",
      mode: "cors"
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error);
    }
    token = data.token;
  } catch (err) {
    console.error(err);
    return;
  }

  const socket = io(`${BASE_URL}/play`, {
    query: {
      token
    }
  });

  return new CharismaInstance(socket);
};

export default { connect };
