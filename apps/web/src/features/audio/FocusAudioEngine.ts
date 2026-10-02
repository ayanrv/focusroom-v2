import type { Room } from "../../components/AtmosphereLayer";

export type LayerKey = "a" | "b" | "c";
export type LayerSourceKind = "procedural" | "file";

export type LayerMeta = {
  label: string;
  kind: LayerSourceKind;
  asset?: string;
};

export const roomAudioConfig: Record<Room, Record<LayerKey, LayerMeta>> = {
  "rain-city": {
    a: { label: "Rain + thunder", kind: "procedural" },
    b: { label: "Traffic", kind: "file", asset: "/audio/rain-city/traffic.mp3" },
    c: { label: "City life", kind: "file", asset: "/audio/rain-city/city-life.mp3" },
  },
  "night-train": {
    a: { label: "Rails", kind: "procedural" },
    b: { label: "Wind", kind: "procedural" },
    c: { label: "Lo-fi", kind: "file", asset: "/audio/night-train/lofi.mp3" },
  },
  "orbital-lab": {
    a: { label: "Cosmos", kind: "file", asset: "/audio/orbital-lab/cosmos.mp3" },
    b: { label: "Ventilation", kind: "procedural" },
    c: { label: "Systems", kind: "procedural" },
  },
  "cozy-cafe": {
    a: { label: "Crowd", kind: "file", asset: "/audio/cozy-cafe/crowd.mp3" },
    b: { label: "Coffee bar", kind: "file", asset: "/audio/cozy-cafe/coffee-bar.mp3" },
    c: { label: "Jazz / vinyl", kind: "file", asset: "/audio/cozy-cafe/jazz-vinyl.mp3" },
  },
};

type LayerNodes = {
  gain: GainNode;
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

function createNoiseBuffer(context: AudioContext, seconds = 3) {
  const length = Math.max(1, Math.floor(context.sampleRate * seconds));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < length; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }

  return buffer;
}

function createSilentLayer(context: AudioContext, destination: AudioNode): LayerNodes {
  const gain = context.createGain();
  gain.gain.value = 0;
  gain.connect(destination);

  return {
    gain,
    stop: () => gain.disconnect(),
  };
}

function createNoiseLayer(
  context: AudioContext,
  destination: AudioNode,
  options: {
    highpass?: number;
    lowpass?: number;
    gain?: number;
    playbackRate?: number;
  } = {},
): LayerNodes {
  const {
    highpass = 0,
    lowpass = 20000,
    gain: initialGain = 0.25,
    playbackRate = 1,
  } = options;

  const output = context.createGain();
  output.gain.value = initialGain;
  output.connect(destination);

  const source = context.createBufferSource();
  source.buffer = createNoiseBuffer(context);
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
    stop: () => {
      try {
        source.stop();
      } catch {
        // Already stopped.
      }
      output.disconnect();
    },
  };
}

function createToneLayer(
  context: AudioContext,
  destination: AudioNode,
  frequencies: number[],
  gain = 0.1,
  type: OscillatorType = "sine",
): LayerNodes {
  const output = context.createGain();
  output.gain.value = gain;
  output.connect(destination);

  const oscillators: OscillatorNode[] = [];

  frequencies.forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const voiceGain = context.createGain();

    oscillator.type = type;
    oscillator.frequency.value = frequency;
    oscillator.detune.value = index % 2 === 0 ? -5 : 5;
    voiceGain.gain.value = 1 / frequencies.length;

    oscillator.connect(voiceGain);
    voiceGain.connect(output);
    oscillator.start();
    oscillators.push(oscillator);
  });

  return {
    gain: output,
    stop: () => {
      oscillators.forEach((oscillator) => {
        try {
          oscillator.stop();
        } catch {
          // Already stopped.
        }
      });
      output.disconnect();
    },
  };
}

function createRailLayer(context: AudioContext, destination: AudioNode): LayerNodes {
  const output = context.createGain();
  output.gain.value = 0.2;
  output.connect(destination);

  const rumble = createNoiseLayer(context, output, {
    highpass: 45,
    lowpass: 420,
    gain: 0.34,
    playbackRate: 0.72,
  });

  const oscillator = context.createOscillator();
  const pulse = context.createGain();
  oscillator.type = "triangle";
  oscillator.frequency.value = 46;
  pulse.gain.value = 0.07;
  oscillator.connect(pulse);
  pulse.connect(output);
  oscillator.start();

  const interval = window.setInterval(() => {
    const now = context.currentTime;
    pulse.gain.cancelScheduledValues(now);
    pulse.gain.setValueAtTime(0.025, now);
    pulse.gain.linearRampToValueAtTime(0.16, now + 0.035);
    pulse.gain.exponentialRampToValueAtTime(0.025, now + 0.22);
  }, 540);

  return {
    gain: output,
    stop: () => {
      window.clearInterval(interval);
      rumble.stop();
      try {
        oscillator.stop();
      } catch {
        // Already stopped.
      }
      output.disconnect();
    },
  };
}

function createSystemsLayer(context: AudioContext, destination: AudioNode): LayerNodes {
  const output = context.createGain();
  output.gain.value = 0.11;
  output.connect(destination);

  const drone = createToneLayer(context, output, [55, 82.41, 110], 0.16, "sine");
  const beep = context.createOscillator();
  const beepGain = context.createGain();
  beep.type = "sine";
  beep.frequency.value = 740;
  beepGain.gain.value = 0;
  beep.connect(beepGain);
  beepGain.connect(output);
  beep.start();

  const scheduleBeep = () => {
    const now = context.currentTime;
    beep.frequency.setValueAtTime(620 + Math.random() * 520, now);
    beepGain.gain.cancelScheduledValues(now);
    beepGain.gain.setValueAtTime(0.0001, now);
    beepGain.gain.exponentialRampToValueAtTime(0.11, now + 0.015);
    beepGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
  };

  scheduleBeep();
  const interval = window.setInterval(scheduleBeep, 2400 + Math.random() * 1800);

  return {
    gain: output,
    stop: () => {
      window.clearInterval(interval);
      drone.stop();
      try {
        beep.stop();
      } catch {
        // Already stopped.
      }
      output.disconnect();
    },
  };
}

function createRainThunderLayer(context: AudioContext, destination: AudioNode): LayerNodes {
  const output = context.createGain();
  output.gain.value = 0.23;
  output.connect(destination);

  const rain = createNoiseLayer(context, output, {
    highpass: 1350,
    lowpass: 10000,
    gain: 0.72,
    playbackRate: 1.05,
  });

  const thunderGain = context.createGain();
  thunderGain.gain.value = 0;
  thunderGain.connect(output);

  const thunderSource = context.createBufferSource();
  thunderSource.buffer = createNoiseBuffer(context, 4);
  thunderSource.loop = true;

  const thunderFilter = context.createBiquadFilter();
  thunderFilter.type = "lowpass";
  thunderFilter.frequency.value = 170;
  thunderSource.connect(thunderFilter);
  thunderFilter.connect(thunderGain);
  thunderSource.start();

  let timeout: number | null = null;
  let stopped = false;

  const scheduleThunder = () => {
    if (stopped) return;

    const delayMs = 45000 + Math.random() * 120000;
    timeout = window.setTimeout(() => {
      if (stopped) return;

      const now = context.currentTime;
      const peak = 0.12 + Math.random() * 0.16;
      const attack = 0.18 + Math.random() * 0.18;
      const decay = 2.8 + Math.random() * 2.4;

      thunderGain.gain.cancelScheduledValues(now);
      thunderGain.gain.setValueAtTime(0.0001, now);
      thunderGain.gain.exponentialRampToValueAtTime(peak, now + attack);
      thunderGain.gain.exponentialRampToValueAtTime(0.0001, now + decay);

      scheduleThunder();
    }, delayMs);
  };

  scheduleThunder();

  return {
    gain: output,
    stop: () => {
      stopped = true;
      if (timeout !== null) window.clearTimeout(timeout);
      rain.stop();
      try {
        thunderSource.stop();
      } catch {
        // Already stopped.
      }
      output.disconnect();
    },
  };
}

function createMediaLayer(
  context: AudioContext,
  destination: AudioNode,
  asset: string,
): LayerNodes {
  const output = context.createGain();
  output.gain.value = 0.75;
  output.connect(destination);

  const audio = new Audio(asset);
  audio.loop = true;
  audio.preload = "auto";
  audio.crossOrigin = "anonymous";

  let source: MediaElementAudioSourceNode | null = null;

  try {
    source = context.createMediaElementSource(audio);
    source.connect(output);
    void audio.play().catch(() => {
      // Missing or not-yet-authorized assets stay silent without breaking the room.
    });
  } catch {
    // If media element routing fails, keep the layer silent.
  }

  return {
    gain: output,
    stop: () => {
      audio.pause();
      audio.src = "";
      source?.disconnect();
      output.disconnect();
    },
  };
}

function createConfiguredLayer(
  context: AudioContext,
  destination: AudioNode,
  room: Room,
  key: LayerKey,
): LayerNodes {
  const config = roomAudioConfig[room][key];

  if (config.kind === "file") {
    return config.asset
      ? createMediaLayer(context, destination, config.asset)
      : createSilentLayer(context, destination);
  }

  if (room === "rain-city" && key === "a") {
    return createRainThunderLayer(context, destination);
  }

  if (room === "night-train" && key === "a") {
    return createRailLayer(context, destination);
  }

  if (room === "night-train" && key === "b") {
    return createNoiseLayer(context, destination, {
      highpass: 500,
      lowpass: 5200,
      gain: 0.18,
      playbackRate: 0.64,
    });
  }

  if (room === "orbital-lab" && key === "b") {
    return createNoiseLayer(context, destination, {
      highpass: 80,
      lowpass: 720,
      gain: 0.22,
      playbackRate: 0.68,
    });
  }

  if (room === "orbital-lab" && key === "c") {
    return createSystemsLayer(context, destination);
  }

  return createSilentLayer(context, destination);
}

function createRoomGraph(context: AudioContext, room: Room): RoomGraph {
  const gain = context.createGain();
  gain.gain.value = 0;

  return {
    gain,
    layers: {
      a: createConfiguredLayer(context, gain, room, "a"),
      b: createConfiguredLayer(context, gain, room, "b"),
      c: createConfiguredLayer(context, gain, room, "c"),
    },
  };
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
      const AudioContextCtor =
        window.AudioContext ??
        (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

      if (!AudioContextCtor) {
        throw new Error("Web Audio is not supported in this browser.");
      }

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

  private applyLayerVolumes(immediate = false) {
    if (!this.context || !this.graph) return;
    const now = this.context.currentTime;
    const duration = immediate ? 0 : 0.12;

    (Object.keys(this.volumes) as LayerKey[]).forEach((key) => {
      const node = this.graph?.layers[key].gain;
      if (!node) return;

      node.gain.cancelScheduledValues(now);
      node.gain.setValueAtTime(node.gain.value, now);
      node.gain.linearRampToValueAtTime(this.volumes[key], now + duration);
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

export const focusAudioEngine = new FocusAudioEngine();
