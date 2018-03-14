import EventEmitter from "eventemitter3";

export interface ISpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: (event: any) => void;
  onend: (event: any) => void;
  onerror: (event: any) => void;
  abort(): Promise<void>;
  start(): void;
}

export declare var SpeechRecognition: {
  prototype: ISpeechRecognition;
  new (): ISpeechRecognition;
};

declare global {
  // tslint:disable-next-line
  interface Window {
    SpeechRecognition?: typeof SpeechRecognition;
    webkitSpeechRecognition?: typeof SpeechRecognition;
  }
}

if (typeof window !== "undefined") {
  window.SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;
}

export default class CharismaMicrophone extends EventEmitter {
  private stream: ISpeechRecognition | null = null;

  public startListening = () => {
    const stream = this.createStream();

    stream.onresult = this.onStreamResult;
    stream.onend = () => stream.start();
    try {
      stream.start();
    } catch (err) {
      console.log(err);
      // this is fine, it just means we tried to start/stop a stream when it was already started/stopped
    }
  };

  public stopListening = () => {
    const stream = this.stream;
    if (stream) {
      stream.onresult = () => undefined;
      stream.onend = () => undefined;
      try {
        stream.abort();
      } catch (err) {
        console.log(err);
        // this is fine, it just means we tried to start/stop a stream when it was already started/stopped
      }
    }
  };

  private onStreamResult = (event: any) => {
    if (event.results && event.results[0] && event.results[0][0]) {
      const message = event.results[0][0].transcript.trim();
      if (event.results[0].isFinal === false) {
        this.emit("recognise-interim", message);
      } else {
        this.emit("recognise", message);
      }
    }
  };

  private createStream = () => {
    if (!window.SpeechRecognition) {
      throw new Error("SpeechRecognition isn't supported in this browser.");
    }

    if (this.stream) {
      return this.stream;
    }

    const stream = new window.SpeechRecognition();
    stream.continuous = false;
    stream.interimResults = true;
    stream.lang = "en-GB";
    this.stream = stream;
    return stream;
  };
}
