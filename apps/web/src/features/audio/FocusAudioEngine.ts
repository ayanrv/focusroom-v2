import type { Room } from "../../components/AtmosphereLayer";

export type LayerKey = "a" | "b" | "c";
export type LayerSourceKind = "file";

export type LayerMeta = {
  label: string;
  kind: LayerSourceKind;
  asset: string;
};

export const roomAudioConfig: Record<Room, Record<LayerKey, LayerMeta>> = {
  "rain-city": {
    a: { label: "Rain + thunder", kind: "file", asset: "/audio/rain-city/rain-thunder.mp3" },
    b: { label: "Traffic", kind: "file", asset: "/audio/rain-city/traffic.mp3" },
    c: { label: "City life", kind: "file", asset: "/audio/rain-city/city-life.mp3" },
  },
  "night-train": {
    a: { label: "Rails", kind: "file", asset: "/audio/night-train/rails.mp3" },
    b: { label: "Wind", kind: "file", asset: "/audio/night-train/wind.mp3" },
    c: { label: "Lo-fi", kind: "file", asset: "/audio/night-train/lofi.mp3" },
  },
  "orbital-lab": {
    a: { label: "Cosmos", kind: "file", asset: "/audio/orbital-lab/cosmos.mp3" },
    b: { label: "Ventilation", kind: "file", asset: "/audio/orbital-lab/ventilation.mp3" },
    c: { label: "Systems", kind: "file", asset: "/audio/orbital-lab/systems.mp3" },
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

function createMediaLayer(
  context: AudioContext,
  destination: AudioNode,
  asset: string,
): LayerNodes {
  const output = context.createGain();
  output.gain.value = 1;
  output.connect(destination);

  const audio = new Audio(asset);
  audio.loop = true;
  audio.preload = "auto";

  let source: MediaElementAudioSourceNode | null = null;

  try {
    source = context.createMediaElementSource(audio);
    source.connect(output);
    void audio.play().catch(() => {
      // Missing assets remain silent until the user adds the real file.
    });
  } catch {
    // A failed media layer stays silent rather than breaking the session.
  }

  return {
    gain: output,
    stop: () => {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      source?.disconnect();
      output.disconnect();
    },
  };
}

function createRoomGraph(context: AudioContext, room: Room): RoomGraph {
  const gain = context.createGain();
  gain.gain.value = 0;

  return {
    gain,
    layers: {
      a: createMediaLayer(context, gain, roomAudioConfig[room].a.asset),
      b: createMediaLayer(context, gain, roomAudioConfig[room].b.asset),
      c: createMediaLayer(context, gain, roomAudioConfig[room].c.asset),
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
