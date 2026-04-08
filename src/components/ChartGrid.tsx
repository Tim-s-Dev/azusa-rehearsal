'use client';

import { useEffect, useRef } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { ChartMeasure } from '@/lib/types';
import { useKeypad } from './KeypadProvider';

interface ChartGridProps {
  measures: ChartMeasure[];
  /**
   * Offset of the FIRST measure passed in, relative to the global chart.
   * Used so the keypad's data-cell coordinates point to the right index in
   * the parent's full measures array.
   */
  measureOffset?: number;
  beatsPerMeasure?: number;
  onChange: (next: ChartMeasure[]) => void;
  showSectionHeaders?: boolean;
  showAddRemove?: boolean;
}

const SECTIONS = ['Intro', 'Verse', 'Pre-Chorus', 'Chorus', 'Bridge', 'Outro', 'Tag', 'Instrumental', 'Vamp'];

export default function ChartGrid({
  measures,
  measureOffset = 0,
  beatsPerMeasure = 4,
  onChange,
  showSectionHeaders = true,
  showAddRemove = true,
}: ChartGridProps) {
  const keypad = useKeypad();
  const measuresRef = useRef(measures);
  useEffect(() => { measuresRef.current = measures; }, [measures]);

  const updateBeat = (mIdx: number, bIdx: number, value: string) => {
    const next = [...measuresRef.current];
    if (!next[mIdx]) return;
    next[mIdx] = {
      ...next[mIdx],
      beats: next[mIdx].beats.map((b, i) => (i === bIdx ? value : b)),
    };
    onChange(next);
  };

  // Register write/value handlers — these translate global cell coords back
  // to this slice using measureOffset.
  useEffect(() => {
    const writer = (pos: { measureIdx: number; beatIdx: number }, value: string) => {
      const localIdx = pos.measureIdx - measureOffset;
      if (localIdx < 0 || localIdx >= measuresRef.current.length) return;
      updateBeat(localIdx, pos.beatIdx, value);
    };
    return keypad.registerWriteHandler(writer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measureOffset, keypad]);

  useEffect(() => {
    const getter = (pos: { measureIdx: number; beatIdx: number }) => {
      const localIdx = pos.measureIdx - measureOffset;
      if (localIdx < 0 || localIdx >= measuresRef.current.length) return undefined;
      return measuresRef.current[localIdx]?.beats[pos.beatIdx] || '';
    };
    return keypad.registerValueGetter(getter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measureOffset, keypad]);

  const handleCellTap = (e: React.MouseEvent<HTMLButtonElement>, mIdx: number, bIdx: number) => {
    e.stopPropagation();
    keypad.focusCell({ measureIdx: mIdx + measureOffset, beatIdx: bIdx }, e.currentTarget);
  };

  const isFocused = (mIdx: number, bIdx: number) =>
    keypad.focusedCell?.measureIdx === mIdx + measureOffset &&
    keypad.focusedCell?.beatIdx === bIdx;

  const updateSection = (mIdx: number, section: string) => {
    const next = [...measures];
    next[mIdx] = { ...next[mIdx], section };
    onChange(next);
  };

  const addMeasure = (afterIdx: number) => {
    const next = [...measures];
    next.splice(afterIdx + 1, 0, { beats: Array(beatsPerMeasure).fill('') });
    onChange(next);
  };

  const removeMeasure = (idx: number) => {
    if (measures.length <= 1) return;
    onChange(measures.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-1">
      {measures.map((measure, mIdx) => (
        <div key={mIdx}>
          {showSectionHeaders && measure.section !== undefined && (
            <div className="flex items-center gap-2 mt-3 mb-1">
              <select
                value={measure.section}
                onChange={(e) => updateSection(mIdx, e.target.value)}
                className="bg-zinc-800 text-xs font-bold rounded px-2 py-1 text-indigo-400 border border-zinc-700 uppercase tracking-wide"
              >
                {SECTIONS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex items-center gap-1 group">
            <div className="text-xs text-zinc-600 w-6 text-right shrink-0 font-mono">
              {mIdx + measureOffset + 1}
            </div>
            <div className="flex gap-1 flex-1">
              {measure.beats.map((beat, bIdx) => (
                <button
                  key={bIdx}
                  type="button"
                  data-cell={`${mIdx + measureOffset}-${bIdx}`}
                  onClick={(e) => handleCellTap(e, mIdx, bIdx)}
                  className={`flex-1 min-w-0 h-12 text-center text-base font-mono rounded-md border transition-all ${
                    isFocused(mIdx, bIdx)
                      ? 'bg-violet-600/30 border-violet-400 ring-2 ring-violet-400/50 text-white'
                      : beat
                        ? 'bg-zinc-900 border-zinc-700 text-white hover:border-zinc-500'
                        : 'bg-zinc-900/50 border-zinc-800 text-zinc-600 hover:border-zinc-600'
                  }`}
                >
                  {beat || '·'}
                </button>
              ))}
            </div>
            {showAddRemove && (
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button
                  onClick={() => addMeasure(mIdx)}
                  className="p-1 text-zinc-600 hover:text-zinc-300"
                  title="Add measure below"
                >
                  <Plus size={14} />
                </button>
                <button
                  onClick={() => removeMeasure(mIdx)}
                  className="p-1 text-zinc-600 hover:text-red-400"
                  title="Remove measure"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
