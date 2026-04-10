'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus, Trash2, Copy, X, MessageSquare, Mic, Play } from 'lucide-react';
import type { ChartMeasure, ChartItem, ChartNote, ChartLyric } from '@/lib/types';
import { isMeasure } from '@/lib/types';
import { useKeypad } from './KeypadProvider';
import { usePlayer } from './PlayerProvider';

interface ChartGridProps {
  /** Full ChartItem list (measures + notes + lyrics interleaved) */
  items: ChartItem[];
  /** Offset of the FIRST item passed in, relative to the parent's full items array */
  itemOffset?: number;
  beatsPerMeasure?: number;
  onChange: (next: ChartItem[]) => void;
  showSectionHeaders?: boolean;
  showAddRemove?: boolean;
  /** Called when user clicks "duplicate" on a section header. Index is local to this slice. */
  onDuplicateSection?: (sectionStartIdx: number) => void;
  /** Map of section index → start timestamp in seconds (used for seek-to-section buttons) */
  sectionTimestamps?: Record<number, number>;
}

const SECTIONS = ['Intro', 'Verse', 'Pre-Chorus', 'Chorus', 'Bridge', 'Interlude', 'Outro', 'Tag', 'Instrumental', 'Vamp'];

function SectionHeader({ measure, itemIdx, sectionIdx, totalSections, sectionTimestamp, reorderSection, updateSection, onDuplicateSection }: {
  measure: ChartMeasure;
  itemIdx: number;
  sectionIdx: number;
  totalSections: number;
  sectionTimestamp?: number;
  reorderSection: (from: number, to: number) => void;
  updateSection: (iIdx: number, section: string) => void;
  onDuplicateSection?: (iIdx: number) => void;
}) {
  const player = usePlayer();
  const seekHere = () => {
    if (sectionTimestamp !== undefined && player.song) {
      player.seek(sectionTimestamp);
    }
  };
  const formatT = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };
  return (
    <div className="flex items-center gap-1.5 mt-3 mb-1 rounded-lg px-1 py-0.5">
      {/* Up / Down */}
      <div className="flex flex-col shrink-0">
        <button
          onClick={() => { if (sectionIdx > 0) reorderSection(sectionIdx, sectionIdx - 1); }}
          disabled={sectionIdx === 0}
          className="p-0.5 text-zinc-600 hover:text-zinc-300 disabled:opacity-20"
          title="Move section up"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 2L2 7h8L6 2z" fill="currentColor"/></svg>
        </button>
        <button
          onClick={() => { if (sectionIdx < totalSections - 1) reorderSection(sectionIdx, sectionIdx + 1); }}
          disabled={sectionIdx >= totalSections - 1}
          className="p-0.5 text-zinc-600 hover:text-zinc-300 disabled:opacity-20"
          title="Move section down"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 10L2 5h8L6 10z" fill="currentColor"/></svg>
        </button>
      </div>
      {/* Seek button */}
      {sectionTimestamp !== undefined && (
        <button
          onClick={seekHere}
          className="p-1.5 rounded-lg bg-violet-500/10 hover:bg-violet-500/20 text-violet-300 shrink-0"
          title={`Jump to ${formatT(sectionTimestamp)}`}
        >
          <Play size={12} />
        </button>
      )}
      <select
        value={SECTIONS.includes(measure.section || '') ? measure.section : '__custom__'}
        onChange={(e) => {
          if (e.target.value === '__custom__') {
            const name = window.prompt('Section name:', measure.section || '');
            if (name) updateSection(itemIdx, name);
          } else {
            updateSection(itemIdx, e.target.value);
          }
        }}
        className="bg-zinc-800 text-xs font-bold rounded px-2 py-1 text-indigo-400 border border-zinc-700 uppercase tracking-wide"
      >
        {SECTIONS.map(s => (<option key={s} value={s}>{s}</option>))}
        <option value="__custom__">Custom…</option>
        {measure.section && !SECTIONS.includes(measure.section) && (
          <option value={measure.section}>{measure.section}</option>
        )}
      </select>
      {onDuplicateSection && (
        <button
          onClick={() => onDuplicateSection(itemIdx)}
          className="p-1 rounded text-xs text-zinc-500 hover:text-violet-400 hover:bg-white/5 inline-flex items-center gap-1"
          title="Duplicate this section"
        >
          <Copy size={11} /> Dup
        </button>
      )}
    </div>
  );
}
const NOTE_COLORS = ['violet', 'fuchsia', 'blue', 'emerald', 'amber', 'red'] as const;
const NOTE_COLOR_CLASSES: Record<string, { bg: string; border: string; text: string }> = {
  violet:  { bg: 'bg-violet-500/10',  border: 'border-violet-500/40',  text: 'text-violet-300' },
  fuchsia: { bg: 'bg-fuchsia-500/10', border: 'border-fuchsia-500/40', text: 'text-fuchsia-300' },
  blue:    { bg: 'bg-blue-500/10',    border: 'border-blue-500/40',    text: 'text-blue-300' },
  emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/40', text: 'text-emerald-300' },
  amber:   { bg: 'bg-amber-500/10',   border: 'border-amber-500/40',   text: 'text-amber-300' },
  red:     { bg: 'bg-red-500/10',     border: 'border-red-500/40',     text: 'text-red-300' },
};

export default function ChartGrid({
  items,
  itemOffset = 0,
  beatsPerMeasure = 4,
  onChange,
  showSectionHeaders = true,
  showAddRemove = true,
  onDuplicateSection,
  sectionTimestamps,
}: ChartGridProps) {
  const keypad = useKeypad();
  const itemsRef = useRef(items);
  useEffect(() => { itemsRef.current = items; }, [items]);
  const [editingItem, setEditingItem] = useState<number | null>(null);

  // Map global itemIdx (only counting measures, including itemOffset) to update beats
  const updateBeat = (globalItemIdx: number, bIdx: number, value: string) => {
    const next = [...itemsRef.current];
    const localIdx = globalItemIdx - itemOffset;
    if (localIdx < 0 || localIdx >= next.length) return;
    const item = next[localIdx];
    if (!isMeasure(item)) return;
    next[localIdx] = {
      ...item,
      beats: item.beats.map((b, i) => (i === bIdx ? value : b)),
    };
    onChange(next);
  };

  // Register write handler — uses global itemIdx
  useEffect(() => {
    const writer = (pos: { measureIdx: number; beatIdx: number }, value: string) => {
      const localIdx = pos.measureIdx - itemOffset;
      if (localIdx < 0 || localIdx >= itemsRef.current.length) return;
      if (!isMeasure(itemsRef.current[localIdx])) return;
      updateBeat(pos.measureIdx, pos.beatIdx, value);
    };
    return keypad.registerWriteHandler(writer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemOffset, keypad]);

  useEffect(() => {
    const getter = (pos: { measureIdx: number; beatIdx: number }) => {
      const localIdx = pos.measureIdx - itemOffset;
      if (localIdx < 0 || localIdx >= itemsRef.current.length) return undefined;
      const item = itemsRef.current[localIdx];
      if (!isMeasure(item)) return undefined;
      return item.beats[pos.beatIdx] || '';
    };
    return keypad.registerValueGetter(getter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemOffset, keypad]);

  // Insert a new measure after the focused one
  useEffect(() => {
    const inserter = (afterItemIdx: number) => {
      const localIdx = afterItemIdx - itemOffset;
      if (localIdx < 0 || localIdx >= itemsRef.current.length) return;
      const next = [...itemsRef.current];
      next.splice(localIdx + 1, 0, { type: 'measure', beats: Array(beatsPerMeasure).fill('') });
      onChange(next);
    };
    return keypad.registerInsertHandler(inserter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemOffset, keypad, beatsPerMeasure]);

  // Toggle out
  useEffect(() => {
    const outToggler = (itemIdx: number) => {
      const localIdx = itemIdx - itemOffset;
      if (localIdx < 0 || localIdx >= itemsRef.current.length) return;
      const item = itemsRef.current[localIdx];
      if (!isMeasure(item)) return;
      const next = [...itemsRef.current];
      next[localIdx] = { ...item, out: !item.out };
      onChange(next);
    };
    return keypad.registerOutHandler(outToggler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemOffset, keypad]);

  const longPressTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Build section index map: for each item, which section (by first-measure index) does it belong to?
  const sectionStarts: number[] = [];
  items.forEach((item, i) => {
    if (isMeasure(item) && item.section !== undefined) sectionStarts.push(i);
  });

  const getSectionIdx = (itemIdx: number) => {
    for (let i = sectionStarts.length - 1; i >= 0; i--) {
      if (itemIdx >= sectionStarts[i]) return i;
    }
    return 0;
  };

  const getSectionRange = (sIdx: number): [number, number] => {
    const start = sectionStarts[sIdx];
    const end = sIdx + 1 < sectionStarts.length ? sectionStarts[sIdx + 1] : items.length;
    return [start, end];
  };

  const reorderSection = (fromSIdx: number, toSIdx: number) => {
    if (fromSIdx === toSIdx) return;
    const [fromStart, fromEnd] = getSectionRange(fromSIdx);
    const movedItems = items.slice(fromStart, fromEnd);
    const remaining = [...items.slice(0, fromStart), ...items.slice(fromEnd)];
    // Recalculate insertion point after removing
    const newSectionStarts: number[] = [];
    remaining.forEach((item, i) => {
      if (isMeasure(item) && item.section !== undefined) newSectionStarts.push(i);
    });
    const targetIdx = toSIdx >= newSectionStarts.length
      ? remaining.length
      : newSectionStarts[Math.min(toSIdx, newSectionStarts.length - 1)];
    const result = [...remaining];
    result.splice(targetIdx, 0, ...movedItems);
    onChange(result);
  };

  const handleCellPointerDown = (e: React.PointerEvent<HTMLButtonElement>, itemIdx: number, bIdx: number) => {
    e.stopPropagation();
    const globalIdx = itemIdx + itemOffset;
    const key = `${globalIdx}-${bIdx}`;
    // Start long-press timer (400ms)
    const timer = setTimeout(() => {
      longPressTimers.current.delete(key);
      // Lock the cell
      keypad.focusCell({ measureIdx: globalIdx, beatIdx: bIdx }, e.currentTarget);
      keypad.lockCell();
    }, 400);
    longPressTimers.current.set(key, timer);
  };

  const handleCellPointerUp = (e: React.PointerEvent<HTMLButtonElement>, itemIdx: number, bIdx: number) => {
    const globalIdx = itemIdx + itemOffset;
    const key = `${globalIdx}-${bIdx}`;
    const timer = longPressTimers.current.get(key);
    if (timer) {
      // Short press — normal focus (not locked)
      clearTimeout(timer);
      longPressTimers.current.delete(key);
      keypad.focusCell({ measureIdx: globalIdx, beatIdx: bIdx }, e.currentTarget);
    }
    // If timer already fired (long press), we already locked in pointerDown
  };

  const handleCellTap = (e: React.MouseEvent<HTMLButtonElement>, itemIdx: number, bIdx: number) => {
    // No-op — handled by pointer events now
    e.stopPropagation();
  };

  const isFocused = (itemIdx: number, bIdx: number) =>
    keypad.focusedCell?.measureIdx === itemIdx + itemOffset &&
    keypad.focusedCell?.beatIdx === bIdx;

  const isCellLocked = (itemIdx: number, bIdx: number) =>
    isFocused(itemIdx, bIdx) && keypad.isLocked;

  const updateSection = (itemIdx: number, section: string) => {
    const next = [...items];
    const item = next[itemIdx];
    if (!isMeasure(item)) return;
    next[itemIdx] = { ...item, section };
    onChange(next);
  };

  const addMeasureBelow = (afterIdx: number) => {
    const next = [...items];
    next.splice(afterIdx + 1, 0, { type: 'measure', beats: Array(beatsPerMeasure).fill('') });
    onChange(next);
  };

  const duplicateMeasure = (idx: number) => {
    const item = items[idx];
    if (!isMeasure(item)) return;
    const clone: ChartMeasure = { ...item, beats: [...item.beats], section: undefined };
    const next = [...items];
    next.splice(idx + 1, 0, clone);
    onChange(next);
  };

  const addNoteBelow = (afterIdx: number) => {
    const next = [...items];
    const newNote: ChartNote = { type: 'note', text: 'Note', color: 'violet' };
    next.splice(afterIdx + 1, 0, newNote);
    onChange(next);
    setEditingItem(afterIdx + 1);
  };

  const addLyricBelow = (afterIdx: number) => {
    const next = [...items];
    const newLyric: ChartLyric = { type: 'lyric', text: 'lyric...' };
    next.splice(afterIdx + 1, 0, newLyric);
    onChange(next);
    setEditingItem(afterIdx + 1);
  };

  const removeItem = (idx: number) => {
    if (items.length <= 1) return;
    onChange(items.filter((_, i) => i !== idx));
  };

  const updateNote = (idx: number, partial: Partial<ChartNote>) => {
    const next = [...items];
    const item = next[idx];
    if (item.type !== 'note') return;
    next[idx] = { ...item, ...partial };
    onChange(next);
  };

  const updateLyric = (idx: number, text: string) => {
    const next = [...items];
    const item = next[idx];
    if (item.type !== 'lyric') return;
    next[idx] = { ...item, text };
    onChange(next);
  };

  // Compute global measure number for display (skip notes/lyrics)
  const measureNumbers: number[] = [];
  let mNum = itemOffset === 0 ? 0 : (() => {
    // Count measures in the parent's prior items if we had access; for now assume offset is global item idx
    return itemOffset;
  })();
  items.forEach((item) => {
    if (isMeasure(item)) {
      mNum++;
      measureNumbers.push(mNum);
    } else {
      measureNumbers.push(0);
    }
  });

  return (
    <div className="space-y-1">
      {items.map((item, iIdx) => {
        // ===== NOTE =====
        if (item.type === 'note') {
          const c = NOTE_COLOR_CLASSES[item.color || 'violet'];
          return (
            <div key={iIdx} className={`my-2 rounded-lg ${c.bg} border-l-4 ${c.border} px-3 py-2 group flex items-start gap-2`}>
              <MessageSquare size={14} className={`${c.text} mt-0.5 shrink-0`} />
              {editingItem === iIdx ? (
                <input
                  autoFocus
                  value={item.text}
                  onChange={(e) => updateNote(iIdx, { text: e.target.value })}
                  onBlur={() => setEditingItem(null)}
                  onKeyDown={(e) => e.key === 'Enter' && setEditingItem(null)}
                  className={`flex-1 bg-transparent border-0 outline-none font-mono text-sm ${c.text}`}
                />
              ) : (
                <button onClick={() => setEditingItem(iIdx)} className={`flex-1 text-left font-mono text-sm ${c.text} truncate`}>
                  {item.text || 'Note'}
                </button>
              )}
              <div className="flex gap-0.5 shrink-0">
                {NOTE_COLORS.map(col => (
                  <button
                    key={col}
                    onClick={() => updateNote(iIdx, { color: col })}
                    className={`w-3 h-3 rounded-full ${NOTE_COLOR_CLASSES[col].bg} ${NOTE_COLOR_CLASSES[col].border} border ${item.color === col ? 'ring-1 ring-white' : ''}`}
                    title={col}
                  />
                ))}
                <button onClick={() => removeItem(iIdx)} className="p-0.5 text-zinc-500 hover:text-red-400">
                  <X size={12} />
                </button>
              </div>
            </div>
          );
        }
        // ===== LYRIC =====
        if (item.type === 'lyric') {
          return (
            <div key={iIdx} className="my-1 px-3 group flex items-start gap-2">
              <Mic size={12} className="text-zinc-600 mt-1 shrink-0" />
              {editingItem === iIdx ? (
                <input
                  autoFocus
                  value={item.text}
                  onChange={(e) => updateLyric(iIdx, e.target.value)}
                  onBlur={() => setEditingItem(null)}
                  onKeyDown={(e) => e.key === 'Enter' && setEditingItem(null)}
                  className="flex-1 bg-zinc-900/50 border border-zinc-700 rounded px-2 text-sm italic text-zinc-300"
                />
              ) : (
                <button onClick={() => setEditingItem(iIdx)} className="flex-1 text-left text-sm italic text-zinc-400 truncate">
                  {item.text || 'lyric...'}
                </button>
              )}
              <button onClick={() => removeItem(iIdx)} className="p-0.5 text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100">
                <X size={12} />
              </button>
            </div>
          );
        }
        // ===== MEASURE =====
        const measure = item as ChartMeasure;
        return (
          <div key={iIdx}>
            {showSectionHeaders && measure.section !== undefined && <SectionHeader
              measure={measure}
              itemIdx={iIdx}
              sectionIdx={getSectionIdx(iIdx)}
              totalSections={sectionStarts.length}
              sectionTimestamp={sectionTimestamps?.[getSectionIdx(iIdx)]}
              reorderSection={reorderSection}
              updateSection={updateSection}
              onDuplicateSection={onDuplicateSection}
            />}
            <div className="flex items-center gap-1 group">
              <div className="text-xs text-zinc-600 w-6 text-right shrink-0 font-mono">
                {measureNumbers[iIdx]}
              </div>
              <div className="flex gap-1 flex-1">
                {measure.out ? (
                  <button
                    type="button"
                    data-cell={`${iIdx + itemOffset}-0`}
                    onClick={(e) => handleCellTap(e, iIdx, 0)}
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
                      data-cell={`${iIdx + itemOffset}-${bIdx}`}
                      onPointerDown={(e) => handleCellPointerDown(e, iIdx, bIdx)}
                      onPointerUp={(e) => handleCellPointerUp(e, iIdx, bIdx)}
                      onPointerCancel={(e) => handleCellPointerUp(e, iIdx, bIdx)}
                      onClick={(e) => handleCellTap(e, iIdx, bIdx)}
                      className={`flex-1 min-w-0 h-12 px-1 text-center font-mono rounded-md border transition-all ${
                        beat && beat.length >= 4 ? 'text-xs' : beat && beat.length >= 3 ? 'text-sm' : 'text-base'
                      } ${
                        isCellLocked(iIdx, bIdx)
                          ? 'bg-amber-600/30 border-amber-400 ring-2 ring-amber-400/60 text-white'
                          : isFocused(iIdx, bIdx)
                            ? 'bg-violet-600/30 border-violet-400 ring-2 ring-violet-400/50 text-white'
                            : beat
                              ? 'bg-zinc-900 border-zinc-700 text-white hover:border-zinc-500'
                              : 'bg-zinc-900/50 border-zinc-800 text-zinc-600 hover:border-zinc-600'
                      }`}
                      title={isCellLocked(iIdx, bIdx) ? 'LOCKED — numbers append here' : beat || ''}
                    >
                      <span className="truncate block">{beat || '·'}</span>
                    </button>
                  ))
                )}
              </div>
              {showAddRemove && (
                <div className="flex gap-0.5 shrink-0">
                  <button
                    onClick={() => duplicateMeasure(iIdx)}
                    className="px-1.5 py-1 rounded text-[10px] font-bold text-cyan-400/70 hover:text-cyan-300 hover:bg-cyan-500/10 flex items-center gap-0.5"
                    title="Duplicate this measure (with its numbers)"
                  >
                    <Copy size={12} /> DUP
                  </button>
                  <button
                    onClick={() => addMeasureBelow(iIdx)}
                    className="p-1.5 rounded text-zinc-500 hover:text-emerald-400 hover:bg-white/5"
                    title="Add empty measure below"
                  >
                    <Plus size={14} />
                  </button>
                  <button
                    onClick={() => removeItem(iIdx)}
                    className="p-1.5 rounded text-zinc-500 hover:text-red-400 hover:bg-white/5"
                    title="Remove measure"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
