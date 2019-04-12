import EventEmitter from "eventemitter3";

interface IWindow extends Window {
  /* eslint-disable no-undef */
  SpeechRecognition?: typeof SpeechRecognition;
  webkitSpeechRecognition?: typeof SpeechRecognition;
  /* eslint-enable no-undef */
}

declare const window: IWindow;

// Needs to work with server-side rendering
// eslint-disable-next-line no-undef
let SpeechRecognitionClass: typeof SpeechRecognition | undefined;
if (typeof window !== "undefined") {
  SpeechRecognitionClass =
    window.SpeechRecognition || window.webkitSpeechRecognition;
}

export default class CharismaMicrophone extends EventEmitter {
  private stream: SpeechRecognition | null = null;

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
    const { stream } = this;
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

  private onStreamResult = (event: SpeechRecognitionEvent) => {
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
    if (!SpeechRecognitionClass) {
      throw new Error("SpeechRecognition isn't supported in this browser.");
    }

    if (this.stream) {
      return this.stream;
    }

    const stream = new SpeechRecognitionClass();
    stream.continuous = false;
    stream.interimResults = true;
    stream.lang = "en-GB";
    this.stream = stream;
    return stream;
  };
}
