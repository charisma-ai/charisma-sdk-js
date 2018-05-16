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
}

const speak = async (audio: number[]) => {
  if (!audio) {
    console.error("No audio to speak was provided.");
    return;
  }

  if (!context && window.AudioContext) {
    context = new window.AudioContext();
  }

  if (!context) {
    console.error("An `AudioContext` was not able to be created.");
    return;
  }

  const arrayBuffer = new Uint8Array(audio).buffer;
  const source = context.createBufferSource();
  source.connect(context.destination);
  source.buffer = (await new Promise((resolve, reject) => {
    (context as AudioContext).decodeAudioData(arrayBuffer, resolve, reject);
  })) as AudioBuffer;
  await new Promise(resolve => {
    source.onended = () => resolve();
    source.start();
  });
};

export default speak;
