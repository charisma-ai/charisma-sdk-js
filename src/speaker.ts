interface IWindow extends Window {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
}

declare var window: IWindow;

// Needs to work with server-side rendering
let AudioContextClass: typeof AudioContext | undefined;
if (typeof window !== "undefined") {
  AudioContextClass = window.AudioContext || window.webkitAudioContext;
}

let context: AudioContext | null = null;

const speak = async (audio: number[]) => {
  if (!audio) {
    console.error("No audio to speak was provided.");
    return;
  }

  if (!context && AudioContextClass) {
    context = new AudioContextClass();
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
