'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Volume2 } from 'lucide-react';
import { PianoSynth, buildKeyboard, type PianoNote } from '@/lib/piano';
import { Slider } from '@/components/ui/slider';

interface PianoProps {
  /** Optional song key to highlight scale tones */
  songKey?: string | null;
  /** Number of octaves to show */
  octaves?: number;
  /** Starting MIDI note (default C3 = 48) */
  startMidi?: number;
}

const KEY_TO_PC: Record<string, number> = {
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5,
  'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11,
};

const MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11];
const MINOR_INTERVALS = [0, 2, 3, 5, 7, 8, 10];

function getScalePcs(key: string | null | undefined): Set<number> {
  if (!key) return new Set();
  const m = key.match(/^([A-G][#b]?)(m?)$/);
  if (!m) return new Set();
  const root = KEY_TO_PC[m[1]];
  if (root === undefined) return new Set();
  const intervals = m[2] === 'm' ? MINOR_INTERVALS : MAJOR_INTERVALS;
  return new Set(intervals.map(i => (root + i) % 12));
}

function getRootPc(key: string | null | undefined): number | null {
  if (!key) return null;
  const m = key.match(/^([A-G][#b]?)/);
  if (!m) return null;
  return KEY_TO_PC[m[1]] ?? null;
}

export default function Piano({
  songKey,
  octaves = 2,
  startMidi = 48, // C3
}: PianoProps) {
  const synthRef = useRef<PianoSynth | null>(null);
  const [activeNotes, setActiveNotes] = useState<Set<number>>(new Set());
  const [sustain, setSustain] = useState(false);
  const [volume, setVolume] = useState(0.3);
  const [showLabels, setShowLabels] = useState(true);

  const endMidi = startMidi + octaves * 12 - 1;
  const notes = useMemo(() => buildKeyboard(startMidi, endMidi), [startMidi, endMidi]);
  const whiteNotes = notes.filter(n => !n.isBlack);
  const scalePcs = useMemo(() => getScalePcs(songKey), [songKey]);
  const rootPc = useMemo(() => getRootPc(songKey), [songKey]);

  // Init synth
  useEffect(() => {
    synthRef.current = new PianoSynth();
    synthRef.current.setVolume(0.3);
    return () => {
      synthRef.current?.destroy();
      synthRef.current = null;
    };
  }, []);

  useEffect(() => {
    synthRef.current?.setVolume(volume);
  }, [volume]);

  useEffect(() => {
    synthRef.current?.setSustain(sustain);
  }, [sustain]);

  const press = async (midi: number) => {
    await synthRef.current?.playNote(midi);
    setActiveNotes(prev => new Set([...prev, midi]));
  };

  const release = (midi: number) => {
    if (!sustain) {
      synthRef.current?.stopNote(midi);
    }
    setActiveNotes(prev => {
      const next = new Set(prev);
      next.delete(midi);
      return next;
    });
  };

  // Compute black-key positions relative to white-key grid
  const whiteKeyWidthPct = 100 / whiteNotes.length;

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSustain(!sustain)}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
              sustain
                ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30'
                : 'bg-white/5 text-zinc-400 hover:bg-white/10'
            }`}
          >
            Sustain
          </button>
          <button
            onClick={() => setShowLabels(!showLabels)}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
              showLabels ? 'bg-white/10 text-zinc-300' : 'bg-white/5 text-zinc-500'
            }`}
          >
            Labels
          </button>
          {songKey && (
            <span className="text-xs text-zinc-500">
              Key <span className="font-bold text-violet-400">{songKey}</span> highlighted
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 w-32">
          <Volume2 size={14} className="text-zinc-500 shrink-0" />
          <Slider
            value={[volume]}
            max={1}
            step={0.01}
            onValueChange={(v) => setVolume(typeof v === 'number' ? v : v[0])}
          />
        </div>
      </div>

      {/* Keyboard */}
      <div className="relative w-full select-none touch-none" style={{ height: '160px' }}>
        {/* White keys */}
        <div className="flex h-full w-full">
          {whiteNotes.map(note => {
            const isActive = activeNotes.has(note.midi);
            const inScale = scalePcs.has(note.midi % 12);
            const isRoot = note.midi % 12 === rootPc;
            return (
              <button
                key={note.midi}
                onPointerDown={(e) => { e.preventDefault(); press(note.midi); }}
                onPointerUp={() => release(note.midi)}
                onPointerLeave={() => activeNotes.has(note.midi) && release(note.midi)}
                className={`relative flex-1 border border-zinc-700 rounded-b-md flex items-end justify-center pb-2 transition-colors ${
                  isActive
                    ? 'bg-gradient-to-b from-violet-400 to-violet-600 text-white'
                    : isRoot
                      ? 'bg-violet-100 hover:bg-violet-200 text-zinc-900'
                      : inScale
                        ? 'bg-zinc-200 hover:bg-zinc-100 text-zinc-700'
                        : 'bg-white hover:bg-zinc-50 text-zinc-500'
                }`}
                style={{ width: `${whiteKeyWidthPct}%` }}
              >
                {showLabels && (
                  <span className="text-[10px] font-mono">
                    {note.pitchClass}{note.octave}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Black keys overlaid */}
        <div className="absolute top-0 left-0 right-0 h-[60%] pointer-events-none">
          {notes.map(note => {
            if (!note.isBlack) return null;
            // Find this black key's position: it sits between two white keys
            // Black key offsets within an octave (in white-key units from C):
            //  C# = 0.65, D# = 1.65, F# = 3.65, G# = 4.65, A# = 5.65
            const whiteIdx = whiteNotes.findIndex(w => w.midi > note.midi);
            const prevWhiteIdx = whiteIdx - 1;
            if (prevWhiteIdx < 0) return null;
            // Center between the previous and next white key
            const leftPct = (prevWhiteIdx + 0.7) * whiteKeyWidthPct;
            const isActive = activeNotes.has(note.midi);
            const inScale = scalePcs.has(note.midi % 12);
            const isRoot = note.midi % 12 === rootPc;
            return (
              <button
                key={note.midi}
                onPointerDown={(e) => { e.preventDefault(); press(note.midi); }}
                onPointerUp={() => release(note.midi)}
                onPointerLeave={() => activeNotes.has(note.midi) && release(note.midi)}
                className={`absolute top-0 rounded-b-md border border-black transition-colors pointer-events-auto ${
                  isActive
                    ? 'bg-gradient-to-b from-violet-400 to-violet-700'
                    : isRoot
                      ? 'bg-violet-700 hover:bg-violet-600'
                      : inScale
                        ? 'bg-zinc-700 hover:bg-zinc-600'
                        : 'bg-zinc-900 hover:bg-zinc-800'
                }`}
                style={{
                  left: `${leftPct}%`,
                  width: `${whiteKeyWidthPct * 0.6}%`,
                  height: '100%',
                  zIndex: 10,
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
