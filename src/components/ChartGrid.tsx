'use client';

import { useEffect, useRef } from 'react';
import { Plus, Trash2, Copy } from 'lucide-react';
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
  /** Called when user clicks "duplicate" on a section header. Index is local to this slice. */
  onDuplicateSection?: (sectionStartIdx: number) => void;
}

const SECTIONS = ['Intro', 'Verse', 'Pre-Chorus', 'Chorus', 'Bridge', 'Outro', 'Tag', 'Instrumental', 'Vamp'];

export default function ChartGrid({
  measures,
  measureOffset = 0,
  beatsPerMeasure = 4,
  onChange,
  showSectionHeaders = true,
  showAddRemove = true,
  onDuplicateSection,
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

  // Register write/value handlers
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

  // Register insert handler — keypad's "Add Measure" key calls this
  useEffect(() => {
    const inserter = (afterMeasureIdx: number) => {
      const localIdx = afterMeasureIdx - measureOffset;
      if (localIdx < 0 || localIdx >= measuresRef.current.length) return;
      const next = [...measuresRef.current];
      next.splice(localIdx + 1, 0, { beats: Array(beatsPerMeasure).fill('') });
      onChange(next);
    };
    return keypad.registerInsertHandler(inserter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measureOffset, keypad, beatsPerMeasure]);

  // Register out toggle handler — keypad's OUT key calls this
  useEffect(() => {
    const outToggler = (measureIdx: number) => {
      const localIdx = measureIdx - measureOffset;
      if (localIdx < 0 || localIdx >= measuresRef.current.length) return;
      const next = [...measuresRef.current];
      next[localIdx] = { ...next[localIdx], out: !next[localIdx].out };
      onChange(next);
    };
    return keypad.registerOutHandler(outToggler);
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

  const addMeasureBelow = (afterIdx: number) => {
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
              {onDuplicateSection && (
                <button
                  onClick={() => onDuplicateSection(mIdx)}
                  className="p-1 rounded text-xs text-zinc-500 hover:text-violet-400 hover:bg-white/5 inline-flex items-center gap-1"
                  title="Duplicate this section"
                >
                  <Copy size={11} /> Duplicate
                </button>
              )}
            </div>
          )}
          <div className="flex items-center gap-1 group">
            <div className="text-xs text-zinc-600 w-6 text-right shrink-0 font-mono">
              {mIdx + measureOffset + 1}
            </div>
            <div className="flex gap-1 flex-1">
              {measure.out ? (
                // Whole measure is OUT — render single greyed badge spanning the row
                <button
                  type="button"
                  data-cell={`${mIdx + measureOffset}-0`}
                  onClick={(e) => handleCellTap(e, mIdx, 0)}
                  className="flex-1 h-12 rounded-md border border-zinc-800 bg-zinc-900/30 text-zinc-600 font-mono text-xs uppercase tracking-widest hover:border-zinc-600"
                  title="OUT — band rests this measure. Tap OUT key on keypad to toggle back."
                >
                  ◎ OUT
                </button>
              ) : (
                measure.beats.map((beat, bIdx) => (
                  <button
                    key={bIdx}
                    type="button"
                    data-cell={`${mIdx + measureOffset}-${bIdx}`}
                    onClick={(e) => handleCellTap(e, mIdx, bIdx)}
                    className={`flex-1 min-w-0 h-12 px-1 text-center font-mono rounded-md border transition-all ${
                      beat && beat.length >= 4 ? 'text-xs' : beat && beat.length >= 3 ? 'text-sm' : 'text-base'
                    } ${
                      isFocused(mIdx, bIdx)
                        ? 'bg-violet-600/30 border-violet-400 ring-2 ring-violet-400/50 text-white'
                        : beat
                          ? 'bg-zinc-900 border-zinc-700 text-white hover:border-zinc-500'
                          : 'bg-zinc-900/50 border-zinc-800 text-zinc-600 hover:border-zinc-600'
                    }`}
                    title={beat || ''}
                  >
                    <span className="truncate block">{beat || '·'}</span>
                  </button>
                ))
              )}
            </div>
            {showAddRemove && (
              <div className="flex gap-0.5 shrink-0">
                <button
                  onClick={() => addMeasureBelow(mIdx)}
                  className="p-1.5 rounded text-zinc-500 hover:text-emerald-400 hover:bg-white/5"
                  title="Add measure below"
                >
                  <Plus size={14} />
                </button>
                <button
                  onClick={() => removeMeasure(mIdx)}
                  className="p-1.5 rounded text-zinc-500 hover:text-red-400 hover:bg-white/5"
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
