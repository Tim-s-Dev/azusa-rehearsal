/**
 * Web Audio metronome with lookahead scheduling.
 *
 * - Pre-renders click sample as an AudioBuffer once on init (not per-beat)
 * - Schedules clicks via AudioBufferSourceNode.start(time) for sample-accurate timing
 * - Waits for AudioContext to actually be in 'running' state before starting
 * - Supports manual offset (positive = clicks land later, negative = earlier)
 *   to compensate for HTML5 audio playback latency
 */
export class MetronomeClock {
  private ctx: AudioContext | null = null;
  private clickBuffer: AudioBuffer | null = null;
  private accentBuffer: AudioBuffer | null = null;
  private nextNoteTime = 0;
  private currentBeatNum = 0;
  private timerId: number | null = null;
  private bpm = 90;
  private beatsPerMeasure = 4;
  private accentFirst = true;
  private offsetSec = 0;
  private onBeat?: (beatIdx: number) => void;

  private readonly LOOKAHEAD_MS = 25;
  private readonly SCHEDULE_AHEAD_SEC = 0.1;

  setBpm(bpm: number) { this.bpm = Math.max(20, Math.min(300, bpm)); }
  setBeatsPerMeasure(n: number) { this.beatsPerMeasure = Math.max(1, Math.min(16, n)); }
  setAccentFirst(a: boolean) { this.accentFirst = a; }
  setOffset(seconds: number) { this.offsetSec = seconds; }
  setOnBeat(cb?: (beatIdx: number) => void) { this.onBeat = cb; }

  /**
   * Pre-render a single click as an AudioBuffer. ~50ms long.
   */
  private renderClick(freq: number, gain: number): AudioBuffer {
    const ctx = this.ctx!;
    const sampleRate = ctx.sampleRate;
    const durationSec = 0.05;
    const length = Math.floor(sampleRate * durationSec);
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      // Sine wave with quick exponential decay
      const env = Math.exp(-t * 80);
      data[i] = Math.sin(2 * Math.PI * freq * t) * env * gain;
    }
    return buffer;
  }

  private async ensureContext(): Promise<AudioContext | null> {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor({ latencyHint: 'interactive' });
    }
    if (this.ctx.state === 'suspended') {
      try { await this.ctx.resume(); } catch { /* noop */ }
    }
    if (!this.clickBuffer) {
      this.clickBuffer = this.renderClick(900, 0.4);
    }
    if (!this.accentBuffer) {
      this.accentBuffer = this.renderClick(1500, 0.7);
    }
    return this.ctx;
  }

  async start() {
    const ctx = await this.ensureContext();
    if (!ctx) return;
    if (this.timerId !== null) return;
    this.currentBeatNum = 0;
    // Start ~30ms in the future to give the scheduler runway
    this.nextNoteTime = ctx.currentTime + 0.03;
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
      this.scheduleClick(this.currentBeatNum, this.nextNoteTime);
      this.advanceNote();
    }
    this.timerId = window.setTimeout(this.scheduler, this.LOOKAHEAD_MS);
  };

  private scheduleClick(beatNum: number, time: number) {
    const ctx = this.ctx;
    if (!ctx) return;

    const beatInMeasure = beatNum % this.beatsPerMeasure;
    const isAccent = this.accentFirst && beatInMeasure === 0;
    const buffer = isAccent ? this.accentBuffer : this.clickBuffer;
    if (!buffer) return;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    // Apply offset to compensate for song audio path latency
    const playTime = Math.max(ctx.currentTime, time + this.offsetSec);
    source.start(playTime);

    // Visual beat callback — fired at the actual play time
    if (this.onBeat) {
      const delayMs = Math.max(0, (playTime - ctx.currentTime) * 1000);
      window.setTimeout(() => this.onBeat?.(beatInMeasure), delayMs);
    }
  }

  private advanceNote() {
    const secondsPerBeat = 60.0 / this.bpm;
    this.nextNoteTime += secondsPerBeat;
    this.currentBeatNum += 1;
  }

  destroy() {
    this.stop();
    this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.clickBuffer = null;
    this.accentBuffer = null;
  }
}
