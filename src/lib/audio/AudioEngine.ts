type Stop = () => void;

/**
 * Áudio 100% procedural (Web Audio, sem arquivos): ambiente diferente por mundo,
 * "whoosh" ao atravessar o portal, "thump" a cada passo e blips ao digitar.
 * Só toca depois de um gesto do usuário (política dos navegadores) — o clique em "INICIAR MISSÃO".
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private stopAmbient: Stop | null = null;
  private muted = false;
  private world = -1;

  start(): void {
    if (!this.ctx) {
      const AC =
        window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.55;
      this.master.connect(this.ctx.destination);
      this.noise = this.makeNoise(this.ctx);
      this.setWorld(this.world);
    }
    void this.ctx.resume();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(muted ? 0 : 0.55, this.ctx.currentTime, 0.08);
  }

  /** -1 = espaço aberto · 0 = Nebulosa · 1 = Distrito Neon · 2 = Planeta Vermelho */
  setWorld(index: number): void {
    this.world = index;
    if (!this.ctx) return;
    this.stopAmbient?.();
    this.stopAmbient = this.buildAmbient(index);
  }

  blip(): void {
    this.beep('square', 1200 + Math.random() * 600, 900, 0.035, 0.025);
  }

  step(): void {
    this.beep('sine', 180, 55, 0.35, 0.22);
  }

  whoosh(): void {
    if (!this.ctx || !this.master || !this.noise) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 1.2;
    filter.frequency.setValueAtTime(200, t);
    filter.frequency.exponentialRampToValueAtTime(4000, t + 0.9);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.4, t + 0.35);
    g.gain.linearRampToValueAtTime(0.0001, t + 1.1);
    src.connect(filter).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + 1.2);
  }

  // ─── internos ──────────────────────────────────────────────────

  private beep(type: OscillatorType, f0: number, f1: number, dur: number, vol: number): void {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private makeNoise(ctx: AudioContext): AudioBuffer {
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  private buildAmbient(index: number): Stop {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime;
    const bus = ctx.createGain();
    bus.gain.setValueAtTime(0, t0);
    bus.gain.linearRampToValueAtTime(1, t0 + 2.5);
    bus.connect(this.master!);

    const nodes: AudioScheduledSourceNode[] = [];
    const timers: number[] = [];

    const tone = (type: OscillatorType, freq: number, vol: number, dest: AudioNode, detune = 0) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      o.detune.value = detune;
      const g = ctx.createGain();
      g.gain.value = vol;
      o.connect(g).connect(dest);
      o.start();
      nodes.push(o);
      return g;
    };
    const lfo = (target: AudioParam, rate: number, depth: number) => {
      const o = ctx.createOscillator();
      o.frequency.value = rate;
      const g = ctx.createGain();
      g.gain.value = depth;
      o.connect(g).connect(target);
      o.start();
      nodes.push(o);
    };
    const filter = (type: BiquadFilterType, freq: number, q = 0.7) => {
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      return f;
    };

    if (index === -1) {
      // espaço aberto: drone grave com batimento lento
      const lp = filter('lowpass', 240);
      lp.connect(bus);
      tone('sine', 55, 0.1, lp);
      tone('sine', 55.4, 0.08, lp);
      tone('sine', 82.4, 0.04, lp);
      lfo(lp.frequency, 0.05, 60);
    } else if (index === 0) {
      // nebulosa: pad etéreo + eco longo + cintilações agudas
      const lp = filter('lowpass', 1400);
      const delay = ctx.createDelay(1.5);
      delay.delayTime.value = 0.55;
      const fb = ctx.createGain();
      fb.gain.value = 0.45;
      lp.connect(bus);
      lp.connect(delay);
      delay.connect(fb).connect(delay);
      delay.connect(bus);
      [110, 164.81, 196, 246.94, 329.63].forEach((f) => tone('triangle', f, 0.035, lp, (Math.random() - 0.5) * 14));
      lfo(lp.frequency, 0.08, 420);
      const notes = [659.25, 783.99, 987.77, 1318.5];
      timers.push(
        window.setInterval(() => {
          const o = ctx.createOscillator();
          o.frequency.value = notes[Math.floor(Math.random() * notes.length)];
          const g = ctx.createGain();
          const t = ctx.currentTime;
          g.gain.setValueAtTime(0.0001, t);
          g.gain.linearRampToValueAtTime(0.045, t + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
          o.connect(g);
          g.connect(bus);
          g.connect(delay);
          o.start(t);
          o.stop(t + 1.7);
        }, 1800),
      );
    } else if (index === 1) {
      // distrito neon: baixo pulsante + arpejo de sintetizador
      const lp = filter('lowpass', 600);
      lp.connect(bus);
      const pump = tone('sawtooth', 55, 0.12, lp);
      lfo(pump.gain, 2, 0.06);
      const arp = [220, 261.63, 329.63, 392, 329.63, 261.63];
      let step = 0;
      const ap = filter('lowpass', 1800);
      ap.connect(bus);
      timers.push(
        window.setInterval(() => {
          const o = ctx.createOscillator();
          o.type = 'square';
          o.frequency.value = arp[step++ % arp.length];
          const g = ctx.createGain();
          const t = ctx.currentTime;
          g.gain.setValueAtTime(0.035, t);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
          o.connect(g).connect(ap);
          o.start(t);
          o.stop(t + 0.22);
        }, 230),
      );
    } else {
      // planeta vermelho: vento + drone grave
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const bp = filter('bandpass', 500, 0.8);
      const wind = ctx.createGain();
      wind.gain.value = 0.22;
      src.connect(bp).connect(wind).connect(bus);
      src.start();
      nodes.push(src);
      lfo(bp.frequency, 0.12, 250);
      tone('triangle', 49, 0.08, bus);
      tone('triangle', 73.4, 0.04, bus);
    }

    return () => {
      const t = ctx.currentTime;
      bus.gain.cancelScheduledValues(t);
      bus.gain.setValueAtTime(bus.gain.value, t);
      bus.gain.linearRampToValueAtTime(0, t + 1.2);
      timers.forEach((id) => window.clearInterval(id));
      window.setTimeout(() => {
        nodes.forEach((n) => {
          try {
            n.stop();
          } catch {
            /* já parado */
          }
        });
        bus.disconnect();
      }, 1400);
    };
  }
}
