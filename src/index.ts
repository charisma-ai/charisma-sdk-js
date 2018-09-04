import EventEmitter from "eventemitter3";
import io from "socket.io-client";

import Microphone from "./microphone";
import speak from "./speaker";

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
  private listening: boolean = false;
  private speaking: boolean = false;
  private socket: SocketIOClient.Socket;
  private microphone: Microphone;

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
    if (reply.endStory && this.listening) {
      this.stopListening();
    }
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
  version,
  baseUrl = "https://api.charisma.ai"
}: {
  storyId: ID;
  version?: number;
  userToken?: string;
  baseUrl: string;
}) => {
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

  let token;

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
    token = data.token;
  } catch (err) {
    throw new Error(`A playthrough token could not be generated: ${err}`);
  }

  const socket = io(`${baseUrl}/play`, {
    query: {
      token
    },
    transports: ["websocket"],
    upgrade: false
  });

  return new CharismaInstance(socket);
};

export default { connect };
