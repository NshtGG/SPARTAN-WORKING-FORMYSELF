/**
 * Ambient sound engine.
 *
 * The previous version ran every "different" sound through the same white-noise
 * buffer and a single biquad filter, which is why they all sounded identical.
 * Each texture below now has its own generator: rain uses filtered noise with
 * droplet transients, campfire uses sparse crackle bursts, ocean uses a slow
 * amplitude swell, beats use actual scheduled notes over a pulse.
 */

export type TrackKind = 'nature' | 'room' | 'tone' | 'beats';

export interface AmbientTrack {
  id: string;
  name: string;
  emoji: string;
  kind: TrackKind;
  description: string;
}

export const AMBIENT_TRACKS: AmbientTrack[] = [
  { id: 'gentle-rain', name: 'Gentle Rain', emoji: '🌧️', kind: 'nature', description: 'Steady soft rainfall' },
  { id: 'thunderstorm', name: 'Thunderstorm', emoji: '⛈️', kind: 'nature', description: 'Rain with rolling thunder' },
  { id: 'ocean-waves', name: 'Ocean Waves', emoji: '🌊', kind: 'nature', description: 'Slow breaking surf' },
  { id: 'campfire', name: 'Campfire', emoji: '🔥', kind: 'nature', description: 'Crackling wood fire' },
  { id: 'night-forest', name: 'Night Forest', emoji: '🌙', kind: 'nature', description: 'Crickets and still air' },
  { id: 'underwater', name: 'Underwater', emoji: '🫧', kind: 'nature', description: 'Deep muffled hum' },
  { id: 'cafe', name: 'Cafe Environment', emoji: '☕', kind: 'room', description: 'Murmur, cups, distant chatter' },
  { id: 'classroom', name: 'Classroom', emoji: '🏫', kind: 'room', description: 'Quiet room, pages, shuffling' },
  { id: 'white-noise', name: 'White Noise', emoji: '📻', kind: 'tone', description: 'Flat masking noise' },
  { id: 'gamma-40', name: '40 Hz Focus Tone', emoji: '🧠', kind: 'tone', description: 'Steady 40 Hz gamma pulse' },
  { id: 'study-beats', name: 'Study Beats', emoji: '📚', kind: 'beats', description: 'Slow lo-fi pulse, 72 BPM' },
  { id: 'work-beats', name: 'Work Beats', emoji: '⚙️', kind: 'beats', description: 'Driving mid-tempo, 92 BPM' },
  { id: 'deep-focus', name: 'Deep Focus', emoji: '🎧', kind: 'beats', description: 'Sparse minimal pulse, 60 BPM' },
];

type Cleanup = () => void;

class AmbientEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private cleanups: Cleanup[] = [];
  private currentId: string | null = null;

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.7;
      this.master.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  /* ---------------- building blocks ---------------- */

  private noiseBuffer(ctx: AudioContext, seconds: number, colour: 'white' | 'pink' | 'brown') {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    if (colour === 'white') {
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      return buffer;
    }

    if (colour === 'brown') {
      let last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        last = (last + 0.02 * w) / 1.02;
        data[i] = last * 3.5;
      }
      return buffer;
    }

    // Pink noise — far warmer than white, the right bed for rain and rooms.
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
    return buffer;
  }

  private noiseSource(ctx: AudioContext, colour: 'white' | 'pink' | 'brown', seconds = 4) {
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx, seconds, colour);
    src.loop = true;
    src.start();
    this.cleanups.push(() => {
      try { src.stop(); } catch { /* already stopped */ }
      src.disconnect();
    });
    return src;
  }

  private gain(ctx: AudioContext, value: number) {
    const g = ctx.createGain();
    g.gain.value = value;
    this.cleanups.push(() => g.disconnect());
    return g;
  }

  private filter(ctx: AudioContext, type: BiquadFilterType, freq: number, q = 1) {
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    this.cleanups.push(() => f.disconnect());
    return f;
  }

  /** A slow oscillator modulating a parameter — waves, wind, pressure drift. */
  private lfo(ctx: AudioContext, rate: number, depth: number, target: AudioParam) {
    const osc = ctx.createOscillator();
    osc.frequency.value = rate;
    const amp = ctx.createGain();
    amp.gain.value = depth;
    osc.connect(amp);
    amp.connect(target);
    osc.start();
    this.cleanups.push(() => {
      try { osc.stop(); } catch { /* already stopped */ }
      osc.disconnect();
      amp.disconnect();
    });
  }

  /** Repeating scheduler used by crackle, thunder, chatter and beats. */
  private every(ms: number, fn: () => void) {
    const id = window.setInterval(fn, ms);
    this.cleanups.push(() => window.clearInterval(id));
  }

  /** One short filtered noise burst — a crackle, a page turn, a footstep. */
  private burst(ctx: AudioContext, dest: AudioNode, opts: {
    freq: number; q: number; duration: number; volume: number; type?: BiquadFilterType;
  }) {
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx, Math.max(0.05, opts.duration), 'white');
    const f = ctx.createBiquadFilter();
    f.type = opts.type ?? 'bandpass';
    f.frequency.value = opts.freq;
    f.Q.value = opts.q;
    const g = ctx.createGain();
    const now = ctx.currentTime;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(opts.volume, now + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, now + opts.duration);
    src.connect(f); f.connect(g); g.connect(dest);
    src.start(now);
    src.stop(now + opts.duration + 0.05);
  }

  /** One pitched note with a soft envelope — used by the beat tracks. */
  private note(ctx: AudioContext, dest: AudioNode, opts: {
    freq: number; duration: number; volume: number; type?: OscillatorType;
  }) {
    const osc = ctx.createOscillator();
    osc.type = opts.type ?? 'sine';
    osc.frequency.value = opts.freq;
    const g = ctx.createGain();
    const now = ctx.currentTime;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(opts.volume, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + opts.duration);
    osc.connect(g); g.connect(dest);
    osc.start(now);
    osc.stop(now + opts.duration + 0.05);
  }

  /* ---------------- the textures ---------------- */

  private buildTrack(ctx: AudioContext, id: string, out: GainNode) {
    switch (id) {
      case 'gentle-rain': {
        // Bright hiss for the sheet of rain, plus individual droplets on top.
        const body = this.noiseSource(ctx, 'white');
        const hp = this.filter(ctx, 'highpass', 900);
        const lp = this.filter(ctx, 'lowpass', 7000);
        const g = this.gain(ctx, 0.32);
        body.connect(hp); hp.connect(lp); lp.connect(g); g.connect(out);
        this.every(110, () => {
          if (Math.random() > 0.55) {
            this.burst(ctx, out, { freq: 2200 + Math.random() * 3500, q: 12, duration: 0.05, volume: 0.05 });
          }
        });
        break;
      }

      case 'thunderstorm': {
        // Heavier rain bed, with a low rumble that swells and decays.
        const body = this.noiseSource(ctx, 'pink');
        const lp = this.filter(ctx, 'lowpass', 3200);
        const g = this.gain(ctx, 0.42);
        body.connect(lp); lp.connect(g); g.connect(out);

        const rumble = this.noiseSource(ctx, 'brown');
        const rlp = this.filter(ctx, 'lowpass', 180, 0.7);
        const rg = this.gain(ctx, 0.0001);
        rumble.connect(rlp); rlp.connect(rg); rg.connect(out);

        this.every(9000, () => {
          if (Math.random() > 0.45) return;
          const now = ctx.currentTime;
          rg.gain.cancelScheduledValues(now);
          rg.gain.setValueAtTime(0.0001, now);
          rg.gain.exponentialRampToValueAtTime(0.5, now + 0.35);
          rg.gain.exponentialRampToValueAtTime(0.0001, now + 3.5);
        });
        break;
      }

      case 'ocean-waves': {
        // Brown noise with a slow swell — the LFO is the wave itself.
        const body = this.noiseSource(ctx, 'brown');
        const lp = this.filter(ctx, 'lowpass', 1100, 0.8);
        const g = this.gain(ctx, 0.3);
        body.connect(lp); lp.connect(g); g.connect(out);
        this.lfo(ctx, 0.09, 0.22, g.gain);
        this.lfo(ctx, 0.055, 900, lp.frequency);
        break;
      }

      case 'campfire': {
        // Quiet low roar, with sharp irregular crackles layered over it.
        const body = this.noiseSource(ctx, 'brown');
        const lp = this.filter(ctx, 'lowpass', 700);
        const g = this.gain(ctx, 0.18);
        body.connect(lp); lp.connect(g); g.connect(out);
        this.every(90, () => {
          if (Math.random() > 0.75) {
            this.burst(ctx, out, {
              freq: 1200 + Math.random() * 2600, q: 6,
              duration: 0.03 + Math.random() * 0.07, volume: 0.06 + Math.random() * 0.1,
            });
          }
        });
        break;
      }

      case 'night-forest': {
        // Near-silent air bed plus rhythmic cricket chirps in bursts.
        const body = this.noiseSource(ctx, 'pink');
        const lp = this.filter(ctx, 'lowpass', 900);
        const g = this.gain(ctx, 0.1);
        body.connect(lp); lp.connect(g); g.connect(out);
        this.every(420, () => {
          if (Math.random() > 0.5) return;
          const chirps = 2 + Math.floor(Math.random() * 3);
          for (let i = 0; i < chirps; i++) {
            window.setTimeout(() => {
              this.burst(ctx, out, { freq: 4200 + Math.random() * 900, q: 28, duration: 0.035, volume: 0.05 });
            }, i * 70);
          }
        });
        break;
      }

      case 'underwater': {
        // Very low hum, everything above 300 Hz rolled off, slow pressure drift.
        const body = this.noiseSource(ctx, 'brown');
        const lp = this.filter(ctx, 'lowpass', 300, 1.2);
        const g = this.gain(ctx, 0.4);
        body.connect(lp); lp.connect(g); g.connect(out);
        this.lfo(ctx, 0.07, 90, lp.frequency);
        this.every(2600, () => {
          if (Math.random() > 0.6) {
            this.burst(ctx, out, { freq: 500 + Math.random() * 400, q: 18, duration: 0.12, volume: 0.04 });
          }
        });
        break;
      }

      case 'cafe': {
        // Band-limited murmur in the speech range, plus cup and chair sounds.
        const body = this.noiseSource(ctx, 'pink');
        const bp = this.filter(ctx, 'bandpass', 700, 0.9);
        const g = this.gain(ctx, 0.22);
        body.connect(bp); bp.connect(g); g.connect(out);
        this.lfo(ctx, 1.6, 0.08, g.gain);
        this.every(1400, () => {
          const r = Math.random();
          if (r > 0.7) {
            this.burst(ctx, out, { freq: 3800, q: 22, duration: 0.09, volume: 0.05 });
          } else if (r > 0.5) {
            this.burst(ctx, out, { freq: 320, q: 3, duration: 0.22, volume: 0.04 });
          }
        });
        break;
      }

      case 'classroom': {
        // Much quieter than the cafe: room tone, pages, occasional shuffle.
        const body = this.noiseSource(ctx, 'pink');
        const lp = this.filter(ctx, 'lowpass', 1400);
        const g = this.gain(ctx, 0.12);
        body.connect(lp); lp.connect(g); g.connect(out);
        this.every(2200, () => {
          const r = Math.random();
          if (r > 0.72) {
            this.burst(ctx, out, { freq: 2600, q: 3, duration: 0.18, volume: 0.05, type: 'highpass' });
          } else if (r > 0.55) {
            this.burst(ctx, out, { freq: 420, q: 2, duration: 0.3, volume: 0.03 });
          }
        });
        break;
      }

      case 'white-noise': {
        const body = this.noiseSource(ctx, 'white');
        const g = this.gain(ctx, 0.24);
        body.connect(g); g.connect(out);
        break;
      }

      case 'gamma-40': {
        // 40 Hz amplitude modulation on a soft carrier, plus a quiet noise bed
        // so it isn't fatiguing on phone speakers.
        const carrier = ctx.createOscillator();
        carrier.type = 'sine';
        carrier.frequency.value = 220;
        const depth = this.gain(ctx, 0.5);
        const g = this.gain(ctx, 0.12);
        carrier.connect(depth); depth.connect(g); g.connect(out);
        carrier.start();
        this.cleanups.push(() => {
          try { carrier.stop(); } catch { /* already stopped */ }
          carrier.disconnect();
        });
        this.lfo(ctx, 40, 0.5, depth.gain);

        const bed = this.noiseSource(ctx, 'pink');
        const blp = this.filter(ctx, 'lowpass', 1800);
        const bg = this.gain(ctx, 0.06);
        bed.connect(blp); blp.connect(bg); bg.connect(out);
        break;
      }

      case 'study-beats':
        this.buildBeats(ctx, out, { bpm: 72, root: 110, warmth: 900, swing: true, padVolume: 0.05 });
        break;

      case 'work-beats':
        this.buildBeats(ctx, out, { bpm: 92, root: 146.8, warmth: 1500, swing: false, padVolume: 0.04 });
        break;

      case 'deep-focus':
        this.buildBeats(ctx, out, { bpm: 60, root: 98, warmth: 600, swing: false, padVolume: 0.07 });
        break;

      default: {
        const body = this.noiseSource(ctx, 'pink');
        const g = this.gain(ctx, 0.2);
        body.connect(g); g.connect(out);
      }
    }
  }

  /**
   * The three beat tracks: a soft sustained pad, a kick on the beat, a hat
   * offbeat, and a slow bass line. Same skeleton, different tempo and colour.
   */
  private buildBeats(ctx: AudioContext, out: GainNode, opts: {
    bpm: number; root: number; warmth: number; swing: boolean; padVolume: number;
  }) {
    const beatMs = 60000 / opts.bpm;

    const pad = this.noiseSource(ctx, 'pink');
    const padFilter = this.filter(ctx, 'lowpass', opts.warmth, 1.2);
    const padGain = this.gain(ctx, opts.padVolume);
    pad.connect(padFilter); padFilter.connect(padGain); padGain.connect(out);
    this.lfo(ctx, 0.06, opts.warmth * 0.3, padFilter.frequency);

    const scale = [1, 1.2, 1.5, 1.8];
    let step = 0;

    this.every(beatMs, () => {
      const isDownbeat = step % 4 === 0;

      if (isDownbeat || step % 4 === 2) {
        this.note(ctx, out, { freq: opts.root / 2, duration: 0.18, volume: 0.16, type: 'sine' });
      }

      const hatDelay = opts.swing && step % 2 === 1 ? beatMs * 0.12 : 0;
      window.setTimeout(() => {
        this.burst(ctx, out, { freq: 8000, q: 2, duration: 0.03, volume: 0.03, type: 'highpass' });
      }, beatMs / 2 + hatDelay);

      if (isDownbeat) {
        const interval = scale[(step / 4) % scale.length];
        this.note(ctx, out, {
          freq: opts.root * interval,
          duration: (beatMs / 1000) * 1.6,
          volume: 0.05,
          type: 'triangle',
        });
      }

      step = (step + 1) % 16;
    });
  }

  /* ---------------- public API ---------------- */

  play(track: AmbientTrack | string) {
    const id = typeof track === 'string' ? track : track.id;
    this.stop();
    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') void ctx.resume();

    const out = ctx.createGain();
    out.gain.value = 1;
    out.connect(this.master!);
    this.cleanups.push(() => out.disconnect());

    this.buildTrack(ctx, id, out);
    this.currentId = id;
  }

  stop() {
    for (const fn of this.cleanups) {
      try { fn(); } catch { /* node already torn down */ }
    }
    this.cleanups = [];
    this.currentId = null;
  }

  get playing(): string | null {
    return this.currentId;
  }

  setVolume(v: number) {
    if (this.master) this.master.gain.value = Math.max(0, Math.min(1, v));
  }
}

export const ambientEngine = new AmbientEngine();
