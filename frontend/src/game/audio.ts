/**
 * Procedural ambient music with the Web Audio API. Each track is a slow drone
 * bed plus a sparse pentatonic melody scheduled ahead of time. No audio assets.
 *
 * Browsers require a user gesture before audio starts, so the engine lazily
 * creates its AudioContext on the first play() call.
 */

interface TrackSpec {
  root: number;
  scale: number[];
  noteGap: number;
  bell: number;
}

const TRACKS: Record<string, TrackSpec> = {
  menu: { root: 110.0, scale: [0, 3, 5, 7, 10], noteGap: 2.6, bell: 0 },
  moonroot: { root: 98.0, scale: [0, 3, 5, 7, 10], noteGap: 2.2, bell: 0 },
  foundry: { root: 82.41, scale: [0, 2, 3, 7, 8], noteGap: 2.8, bell: 0.7 },
  basilica: { root: 123.47, scale: [0, 4, 7, 11, 14], noteGap: 2.4, bell: 0.2 },
};

export class MusicEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private drones: OscillatorNode[] = [];
  private timer: number | null = null;
  private current: string | null = null;
  enabled: boolean;

  constructor() {
    this.enabled = localStorage.getItem("soulsfan-games.music") !== "off";
  }

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.22;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  play(trackId: string): void {
    if (!TRACKS[trackId] || trackId === this.current) return;
    this.current = trackId;
    if (!this.enabled) return;
    this.start(trackId);
  }

  private start(trackId: string): void {
    const ctx = this.ensureContext();
    this.stopNodes();
    const spec = TRACKS[trackId];

    // Drone bed: sub-root, root, fifth.
    for (const [mult, gain] of [[0.5, 0.16], [1, 0.1], [1.5, 0.07]]) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = spec.root * mult;
      g.gain.value = gain;
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 0.05 + Math.random() * 0.06;
      lfoGain.gain.value = gain * 0.3;
      lfo.connect(lfoGain).connect(g.gain);
      osc.connect(g).connect(this.master!);
      osc.start();
      lfo.start();
      this.drones.push(osc, lfo);
    }
    this.scheduleMelody(spec);
  }

  private scheduleMelody(spec: TrackSpec): void {
    const ctx = this.ctx!;
    const step = () => {
      if (!this.enabled || !this.master) return;
      const degree = spec.scale[Math.floor(Math.random() * spec.scale.length)] + (Math.random() < 0.4 ? 12 : 0);
      const freq = spec.root * 2 * 2 ** (degree / 12);
      const now = ctx.currentTime;
      const length = 1.6 + Math.random() * 1.6;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.08, now + length * 0.25);
      g.gain.linearRampToValueAtTime(0, now + length);
      osc.connect(g).connect(this.master);
      if (spec.bell) {
        const bell = ctx.createOscillator();
        bell.type = "sine";
        bell.frequency.value = freq * 2.76;
        const bg = ctx.createGain();
        bg.gain.value = spec.bell * 0.03;
        bell.connect(bg).connect(this.master);
        bell.start(now);
        bell.stop(now + length);
      }
      osc.start(now);
      osc.stop(now + length);
      const gap = spec.noteGap * (0.65 + Math.random() * 0.85) * 1000;
      this.timer = window.setTimeout(step, gap);
    };
    this.timer = window.setTimeout(step, 600);
  }

  toggle(): boolean {
    this.enabled = !this.enabled;
    localStorage.setItem("soulsfan-games.music", this.enabled ? "on" : "off");
    if (!this.enabled) this.stopNodes();
    else if (this.current) this.start(this.current);
    return this.enabled;
  }

  stop(): void {
    this.current = null;
    this.stopNodes();
  }

  private stopNodes(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    for (const osc of this.drones) {
      try {
        osc.stop();
      } catch {
        /* already stopped */
      }
    }
    this.drones = [];
  }
}
