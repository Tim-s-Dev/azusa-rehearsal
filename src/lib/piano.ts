/**
 * Lightweight piano synthesizer using Web Audio.
 * Each note = oscillator + gain envelope. Polyphonic.
 */

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export interface PianoNote {
  midi: number;
  name: string;       // 'C4'
  pitchClass: string; // 'C'
  octave: number;
  isBlack: boolean;
}

export function buildKeyboard(startMidi: number, endMidi: number): PianoNote[] {
  const notes: PianoNote[] = [];
  for (let m = startMidi; m <= endMidi; m++) {
    const pcIdx = m % 12;
    const name = NOTE_NAMES[pcIdx];
    const octave = Math.floor(m / 12) - 1; // MIDI 60 = C4
    notes.push({
      midi: m,
      name: `${name}${octave}`,
      pitchClass: name,
      octave,
      isBlack: name.includes('#'),
    });
  }
  return notes;
}

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export class PianoSynth {
  private ctx: AudioContext | null = null;
  private active = new Map<number, { osc: OscillatorNode; env: GainNode }>();
  private masterGain: GainNode | null = null;
  private volume = 0.3;
  private sustain = false;
  private sustained = new Set<number>();

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.masterGain) this.masterGain.gain.value = this.volume;
  }

  setSustain(s: boolean) {
    this.sustain = s;
    if (!s) {
      // Release everything sustained
      this.sustained.forEach(midi => this.stopNote(midi));
      this.sustained.clear();
    }
  }

  async ensureContext(): Promise<AudioContext | null> {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor({ latencyHint: 'interactive' });
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.volume;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      try { await this.ctx.resume(); } catch { /* noop */ }
    }
    return this.ctx;
  }

  async playNote(midi: number) {
    const ctx = await this.ensureContext();
    if (!ctx || !this.masterGain) return;

    // Stop existing note at this midi (re-trigger)
    this.stopNote(midi);

    const freq = midiToFreq(midi);
    const now = ctx.currentTime;

    // Layered tone for richer piano-ish sound: triangle + soft sine
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;

    const env = ctx.createGain();
    env.gain.value = 0;

    // Quick attack, slow exponential decay (piano-like)
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(0.7, now + 0.005);
    env.gain.exponentialRampToValueAtTime(0.001, now + 2.0);

    osc.connect(env);
    env.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 2.1);

    this.active.set(midi, { osc, env });

    if (this.sustain) {
      this.sustained.add(midi);
    }

    osc.onended = () => {
      const cur = this.active.get(midi);
      if (cur && cur.osc === osc) this.active.delete(midi);
    };
  }

  stopNote(midi: number) {
    const cur = this.active.get(midi);
    if (!cur || !this.ctx) return;
    if (this.sustain && this.sustained.has(midi)) return; // hold while sustain on
    const now = this.ctx.currentTime;
    try {
      cur.env.gain.cancelScheduledValues(now);
      cur.env.gain.setValueAtTime(cur.env.gain.value, now);
      cur.env.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      cur.osc.stop(now + 0.12);
    } catch {/* noop */}
    this.active.delete(midi);
  }

  stopAll() {
    Array.from(this.active.keys()).forEach(m => this.stopNote(m));
    this.sustained.clear();
  }

  destroy() {
    this.stopAll();
    this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.masterGain = null;
  }
}
