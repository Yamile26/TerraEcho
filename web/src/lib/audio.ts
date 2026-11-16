import type { CellVoice, EicScore, FireWeek } from "./types";

/** Browser synthesis consumes the Python score verbatim; no anomaly is recomputed here. */
export class Sonifier {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private active = new Set<OscillatorNode>();
  async enable() {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = 0.35;
      const compressor = this.context.createDynamicsCompressor();
      compressor.threshold.value = -18;
      compressor.ratio.value = 8;
      this.master.connect(compressor);
      compressor.connect(this.context.destination);
    }
    await this.context.resume();
  }
  volume(value: number) {
    if (this.context && this.master)
      this.master.gain.setTargetAtTime(
        Math.max(0, Math.min(1, value)),
        this.context.currentTime,
        0.08,
      );
  }
  stop() {
    for (const voice of this.active) {
      try {
        voice.stop();
      } catch {}
    }
    this.active.clear();
  }
  dispose() {
    this.stop();
    void this.context?.close();
    this.context = null;
    this.master = null;
  }
  private tone(
    midi: number,
    gain: number,
    pan: number,
    start: number,
    duration: number,
    detune = 0,
    harmonics?: number[],
  ) {
    const ctx = this.context;
    if (!ctx || !this.master || gain <= 0.001) return;
    const osc = ctx.createOscillator(),
      envelope = ctx.createGain(),
      stereo = ctx.createStereoPanner();
    const now = ctx.currentTime + start;
    osc.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
    osc.detune.value = detune;
    if (harmonics) {
      const real = new Float32Array(harmonics.length + 1),
        imag = new Float32Array(harmonics.length + 1);
      harmonics.forEach((v, i) => (imag[i + 1] = v));
      osc.setPeriodicWave(ctx.createPeriodicWave(real, imag));
    } else osc.type = "sine";
    envelope.gain.setValueAtTime(0, now);
    envelope.gain.linearRampToValueAtTime(gain, now + 0.035);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    stereo.pan.value = Math.max(-1, Math.min(1, pan));
    osc.connect(envelope);
    envelope.connect(stereo);
    stereo.connect(this.master);
    this.active.add(osc);
    osc.onended = () => {
      this.active.delete(osc);
      osc.disconnect();
      envelope.disconnect();
      stereo.disconnect();
    };
    osc.start(now);
    osc.stop(now + duration + 0.025);
  }
  fire(week: FireWeek, cells: CellVoice[], useCountryChord = true) {
    if (week.data_gap) {
      this.stop();
      return;
    }
    const voices = [...cells].sort((a, b) => b.frp - a.frp).slice(0, 18);
    if (!voices.length) return;
    const norm = 0.15 / Math.sqrt(voices.length);
    if (useCountryChord)
      for (const midi of week.country.chord) this.tone(midi, 0.065, 0, 0, 1.25);
    voices.forEach((c, i) => {
      for (let p = 0; p < c.density; p++) {
        const time = (p * 1.2) / c.density + i * 0.007;
        this.tone(c.midi, c.gain * norm, c.pan, time, 0.35, c.detune_cents);
        this.tone(
          c.midi + c.interval,
          c.gain * c.partner_gain * norm,
          c.pan,
          time,
          0.35,
        );
      }
    });
  }
  eic(score: EicScore, index: number, enabled: Set<string>) {
    const step = score.steps[index];
    if (!step) return;
    for (const [name, layer] of Object.entries(step.layers))
      if (enabled.has(name))
        this.tone(
          layer.midi,
          layer.gain * 0.12,
          step.pan,
          0,
          0.24,
          0,
          score.meta.layers[name]?.harmonics,
        );
  }
}
