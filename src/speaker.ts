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

const speak = async (audio: number[]) => {
  if (context) {
    const arrayBuffer = new Uint8Array(audio).buffer;
    const source = context.createBufferSource();
    source.connect(context.destination);
    source.buffer = (await new Promise((resolve, reject) => {
      (context as AudioContext).decodeAudioData(arrayBuffer, resolve, reject);
    })) as AudioBuffer;
    return new Promise(resolve => {
      source.onended = () => resolve();
      source.start();
    });
  }
  return Promise.resolve();
};

export default speak;
