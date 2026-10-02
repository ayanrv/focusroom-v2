import type { Room } from "../../components/AtmosphereLayer";

type LayerKey = "a" | "b" | "c";

type LayerNodes = {
  gain: GainNode;
  sources: AudioScheduledSourceNode[];
  stop: () => void;
};

type RoomGraph = {
  gain: GainNode;
  layers: Record<LayerKey, LayerNodes>;
};

type Volumes = {
  a: number;
  b: number;
  c: number;
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

function createNoiseBuffer(context: AudioContext, seconds = 2) {
  const length = Math.max(1, Math.floor(context.sampleRate * seconds));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < length; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }

  return buffer;
}

function createNoiseLayer(
  context: AudioContext,
  destination: AudioNode,
  {
    highpass = 0,
    lowpass = 20000,
    gain = 0.25,
    playbackRate = 1,
  }: {
    highpass?: number;
    lowpass?: number;
    gain?: number;
    playbackRate?: number;
  },
): LayerNodes {
  const output = context.createGain();
  output.gain.value = gain;
  output.connect(destination);

  const source = context.createBufferSource();
  source.buffer = createNoiseBuffer(context, 2.5);
  source.loop = true;
  source.playbackRate.value = playbackRate;

  let current: AudioNode = source;

  if (highpass > 0) {
    const filter = context.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = highpass;
    current.connect(filter);
    current = filter;
  }

  if (lowpass < 20000) {
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = lowpass;
    current.connect(filter);
    current = filter;
  }

  current.connect(output);
  source.start();

  return {
    gain: output,
    sources: [source],
    stop: () => {
      try {
        source.stop();
      } catch {
        // Source may already be stopped.
      }
      output.disconnect();
    },
  };
}

function createToneLayer(
  context: AudioContext,
  destination: AudioNode,
  frequencies: number[],
  gain = 0.12,
  type: OscillatorType = "sine",
): LayerNodes {
  const output = context.createGain();
  output.gain.value = gain;
  output.connect(destination);

  const sources: AudioScheduledSourceNode[] = [];

  frequencies.forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const voiceGain = context.createGain();

    oscillator.type = type;
    oscillator.frequency.value = frequency;
    oscillator.detune.value = index % 2 === 0 ? -4 : 5;
    voiceGain.gain.value = 1 / frequencies.length;

    oscillator.connect(voiceGain);
    voiceGain.connect(output);
    oscillator.start();

    sources.push(oscillator);
  });

  return {
    gain: output,
    sources,
    stop: () => {
      sources.forEach((source) => {
        try {
          source.stop();
        } catch {
          // Already stopped.
        }
      });
      output.disconnect();
    },
  };
}

function createPulseLayer(
  context: AudioContext,
  destination: AudioNode,
  frequency: number,
  intervalSeconds: number,
  gain = 0.1,
): LayerNodes {
  const output = context.createGain();
  output.gain.value = gain;
  output.connect(destination);

  const oscillator = context.createOscillator();
  const pulseGain = context.createGain();

  oscillator.type = "sine";
  oscillator.frequency.value = frequency;
  pulseGain.gain.value = 0;

  oscillator.connect(pulseGain);
  pulseGain.connect(output);
  oscillator.start();

  const now = context.currentTime;
  for (let t = now; t < now + 180; t += intervalSeconds) {
    pulseGain.gain.setValueAtTime(0, t);
    pulseGain.gain.linearRampToValueAtTime(0.8, t + 0.025);
    pulseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  }

  return {
    gain: output,
    sources: [oscillator],
    stop: () => {
      try {
        oscillator.stop();
      } catch {
        // Already stopped.
      }
      output.disconnect();
    },
  };
}

function createRoomGraph(context: AudioContext, room: Room): RoomGraph {
  const gain = context.createGain();
  gain.gain.value = 0;

  let layers: Record<LayerKey, LayerNodes>;

  switch (room) {
    case "night-train":
      layers = {
        a: createPulseLayer(context, gain, 52, 0.54, 0.18),
        b: createNoiseLayer(context, gain, { highpass: 90, lowpass: 520, gain: 0.26, playbackRate: 0.78 }),
        c: createNoiseLayer(context, gain, { highpass: 950, lowpass: 5200, gain: 0.12, playbackRate: 0.56 }),
      };
      break;
    case "orbital-lab":
      layers = {
        a: createNoiseLayer(context, gain, { highpass: 70, lowpass: 700, gain: 0.16, playbackRate: 0.68 }),
        b: createToneLayer(context, gain, [110, 164.81, 220], 0.08, "sine"),
        c: createToneLayer(context, gain, [55, 82.41], 0.11, "triangle"),
      };
      break;
    case "cozy-cafe":
      layers = {
        a: createNoiseLayer(context, gain, { highpass: 250, lowpass: 2400, gain: 0.17, playbackRate: 0.82 }),
        b: createPulseLayer(context, gain, 820, 3.7, 0.055),
        c: createNoiseLayer(context, gain, { highpass: 500, lowpass: 4800, gain: 0.075, playbackRate: 0.33 }),
      };
      break;
    case "rain-city":
    default:
      layers = {
        a: createNoiseLayer(context, gain, { highpass: 1600, lowpass: 9200, gain: 0.24, playbackRate: 1.08 }),
        b: createNoiseLayer(context, gain, { highpass: 80, lowpass: 780, gain: 0.19, playbackRate: 0.64 }),
        c: createToneLayer(context, gain, [61.74, 92.5], 0.075, "sine"),
      };
      break;
  }

  return { gain, layers };
}

export class FocusAudioEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private graph: RoomGraph | null = null;
  private activeRoom: Room = "rain-city";
  private volumes: Volumes = { a: 0.72, b: 0.46, c: 0.58 };
  private masterVolume = 0.72;
  private muted = false;

  async enable() {
    if (!this.context) {
      const AudioContextCtor = window.AudioContext ?? window.webkitAudioContext;
      this.context = new AudioContextCtor();
      this.master = this.context.createGain();
      this.master.connect(this.context.destination);
      this.applyMasterVolume(true);
      this.graph = createRoomGraph(this.context, this.activeRoom);
      this.graph.gain.connect(this.master);
      this.applyLayerVolumes(true);
      this.fadeRoomGain(this.graph.gain, 1, 0.45);
    }

    if (this.context.state === "suspended") {
      await this.context.resume();
    }
  }

  isEnabled() {
    return this.context !== null && this.context.state !== "closed";
  }

  setRoom(room: Room) {
    this.activeRoom = room;
    if (!this.context || !this.master) return;

    const previous = this.graph;
    const next = createRoomGraph(this.context, room);
    next.gain.connect(this.master);
    this.graph = next;
    this.applyLayerVolumes(true);

    this.fadeRoomGain(next.gain, 1, 0.65);

    if (previous) {
      this.fadeRoomGain(previous.gain, 0, 0.65);
      window.setTimeout(() => {
        Object.values(previous.layers).forEach((layer) => layer.stop());
        previous.gain.disconnect();
      }, 850);
    }
  }

  setLayerVolumes(a: number, b: number, c: number) {
    this.volumes = {
      a: clamp01(a / 100),
      b: clamp01(b / 100),
      c: clamp01(c / 100),
    };
    this.applyLayerVolumes();
  }

  setMasterVolume(value: number) {
    this.masterVolume = clamp01(value / 100);
    this.applyMasterVolume();
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    this.applyMasterVolume();
  }

  getMuted() {
    return this.muted;
  }

  private applyLayerVolumes(immediate = false) {
    if (!this.context || !this.graph) return;
    const now = this.context.currentTime;
    const duration = immediate ? 0 : 0.12;

    (Object.keys(this.volumes) as LayerKey[]).forEach((key) => {
      const node = this.graph?.layers[key].gain;
      if (!node) return;
      const target = this.volumes[key];

      node.gain.cancelScheduledValues(now);
      node.gain.setValueAtTime(node.gain.value, now);
      node.gain.linearRampToValueAtTime(target, now + duration);
    });
  }

  private applyMasterVolume(immediate = false) {
    if (!this.context || !this.master) return;
    const now = this.context.currentTime;
    const target = this.muted ? 0 : this.masterVolume;
    const duration = immediate ? 0 : 0.18;

    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(target, now + duration);
  }

  private fadeRoomGain(node: GainNode, target: number, seconds: number) {
    if (!this.context) return;
    const now = this.context.currentTime;
    node.gain.cancelScheduledValues(now);
    node.gain.setValueAtTime(node.gain.value, now);
    node.gain.linearRampToValueAtTime(target, now + seconds);
  }

  destroy() {
    if (!this.context) return;

    if (this.graph) {
      Object.values(this.graph.layers).forEach((layer) => layer.stop());
      this.graph.gain.disconnect();
      this.graph = null;
    }

    void this.context.close();
    this.context = null;
    this.master = null;
  }
}

declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}

export const focusAudioEngine = new FocusAudioEngine();
