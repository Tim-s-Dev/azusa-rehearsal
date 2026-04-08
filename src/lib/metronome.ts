/**
 * Web Audio metronome with lookahead scheduling.
 * Schedules clicks 100ms ahead, polled every 25ms — sample-accurate.
 */
export class MetronomeClock {
  private ctx: AudioContext | null = null;
  private nextNoteTime = 0;
  private current16th = 0;
  private timerId: number | null = null;
  private bpm = 90;
  private beatsPerMeasure = 4;
  private accentFirst = true;
  private onBeat?: (beatIdx: number) => void;

  private readonly LOOKAHEAD_MS = 25;
  private readonly SCHEDULE_AHEAD_SEC = 0.1;

  setBpm(bpm: number) { this.bpm = Math.max(20, Math.min(300, bpm)); }
  setBeatsPerMeasure(n: number) { this.beatsPerMeasure = Math.max(1, Math.min(16, n)); }
  setAccentFirst(a: boolean) { this.accentFirst = a; }
  setOnBeat(cb?: (beatIdx: number) => void) { this.onBeat = cb; }

  private ensureContext() {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  start() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (this.timerId !== null) return;
    this.current16th = 0;
    this.nextNoteTime = ctx.currentTime + 0.05;
    this.scheduler();
  }

  stop() {
    if (this.timerId !== null) {
      window.clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  isRunning() {
    return this.timerId !== null;
  }

  private scheduler = () => {
    const ctx = this.ctx;
    if (!ctx) return;
    while (this.nextNoteTime < ctx.currentTime + this.SCHEDULE_AHEAD_SEC) {
      this.scheduleClick(this.current16th, this.nextNoteTime);
      this.advanceNote();
    }
    this.timerId = window.setTimeout(this.scheduler, this.LOOKAHEAD_MS);
  };

  private scheduleClick(beatNum: number, time: number) {
    const ctx = this.ctx;
    if (!ctx) return;

    const isAccent = this.accentFirst && (beatNum % this.beatsPerMeasure === 0);
    const osc = ctx.createOscillator();
    const env = ctx.createGain();

    osc.frequency.value = isAccent ? 1500 : 900;
    env.gain.value = 0;
    env.gain.setValueAtTime(0, time);
    env.gain.linearRampToValueAtTime(isAccent ? 0.6 : 0.35, time + 0.001);
    env.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);

    osc.connect(env);
    env.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.06);

    // Notify listener at the right time
    if (this.onBeat) {
      const delayMs = Math.max(0, (time - ctx.currentTime) * 1000);
      const beatIdx = beatNum % this.beatsPerMeasure;
      window.setTimeout(() => this.onBeat?.(beatIdx), delayMs);
    }
  }

  private advanceNote() {
    const secondsPerBeat = 60.0 / this.bpm;
    this.nextNoteTime += secondsPerBeat;
    this.current16th += 1;
  }

  destroy() {
    this.stop();
    this.ctx?.close().catch(() => {});
    this.ctx = null;
  }
}
