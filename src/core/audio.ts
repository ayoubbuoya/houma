/** Small Web Audio helper. All sounds are made with code (no audio files). */
export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private horn: { osc: OscillatorNode[]; gain: GainNode } | null = null;
  private engine: { osc: OscillatorNode; osc2: OscillatorNode; gain: GainNode; filter: BiquadFilterNode } | null = null;

  /** Must be called from a user click (browser rule). */
  unlock(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
  }

  /** Car horn: two tones, like most small cars. */
  setHorn(on: boolean, pitch = 1): void {
    if (!this.ctx || !this.master) return;
    if (on && !this.horn) {
      const gain = this.ctx.createGain();
      gain.gain.value = 0;
      gain.gain.linearRampToValueAtTime(0.22, this.ctx.currentTime + 0.02);
      gain.connect(this.master);
      const osc = [420 * pitch, 520 * pitch].map((f) => {
        const o = this.ctx!.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = f;
        const lp = this.ctx!.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 1800;
        o.connect(lp).connect(gain);
        o.start();
        return o;
      });
      this.horn = { osc, gain };
    } else if (!on && this.horn) {
      const h = this.horn;
      h.gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.05);
      h.osc.forEach((o) => o.stop(this.ctx!.currentTime + 0.08));
      this.horn = null;
    }
  }

  /** Short horn from another car. distance in meters from the listener. */
  beep(distance: number, pitch = 1): void {
    if (!this.ctx || !this.master || distance > 90) return;
    const t = this.ctx.currentTime;
    const gain = this.ctx.createGain();
    const vol = 0.16 / (1 + (distance / 14) ** 2);
    const len = 0.22 + Math.random() * 0.35;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.02);
    gain.gain.setValueAtTime(vol, t + len);
    gain.gain.linearRampToValueAtTime(0, t + len + 0.05);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1500;
    lp.connect(gain).connect(this.master);
    for (const f of [400 * pitch, 505 * pitch]) {
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.connect(lp);
      o.start(t);
      o.stop(t + len + 0.08);
    }
  }

  /** Engine hum. rpm01: 0 = idle, 1 = full speed. Pass null when the player is not in a car. */
  setEngine(rpm01: number | null, load = 0): void {
    if (!this.ctx || !this.master) return;
    if (rpm01 === null) {
      if (this.engine) {
        const e = this.engine;
        e.gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.25);
        e.osc.stop(this.ctx.currentTime + 0.3);
        e.osc2.stop(this.ctx.currentTime + 0.3);
        this.engine = null;
      }
      return;
    }
    if (!this.engine) {
      const gain = this.ctx.createGain();
      gain.gain.value = 0;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 500;
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      const osc2 = this.ctx.createOscillator();
      osc2.type = 'square';
      osc.connect(filter);
      osc2.connect(filter);
      filter.connect(gain).connect(this.master);
      osc.start();
      osc2.start();
      this.engine = { osc, osc2, gain, filter };
    }
    const t = this.ctx.currentTime;
    const f = 38 + rpm01 * 120;
    this.engine.osc.frequency.setTargetAtTime(f, t, 0.06);
    this.engine.osc2.frequency.setTargetAtTime(f * 0.5, t, 0.06);
    this.engine.filter.frequency.setTargetAtTime(380 + rpm01 * 1400 + load * 500, t, 0.08);
    this.engine.gain.gain.setTargetAtTime(0.07 + load * 0.06, t, 0.1);
  }
}
