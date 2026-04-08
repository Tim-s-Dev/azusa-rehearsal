'use client';

import { useEffect, useRef } from 'react';
import { ArrowLeft, ArrowRight, Delete, X } from 'lucide-react';
import { useKeypad } from './KeypadProvider';

const KEYS: { label: string; value: string; type: 'num' | 'mod' | 'replace' | 'special'; className?: string }[] = [
  { label: '1', value: '1', type: 'num' },
  { label: '2', value: '2', type: 'num' },
  { label: '3', value: '3', type: 'num' },
  { label: 'b', value: 'b', type: 'mod', className: 'text-amber-300' },

  { label: '4', value: '4', type: 'num' },
  { label: '5', value: '5', type: 'num' },
  { label: '6', value: '6', type: 'num' },
  { label: '#', value: '#', type: 'mod', className: 'text-amber-300' },

  { label: '7', value: '7', type: 'num' },
  { label: 'm', value: 'm', type: 'mod', className: 'text-violet-300' },
  { label: '/', value: '/', type: 'mod', className: 'text-violet-300' },
  { label: '7th', value: '7', type: 'mod', className: 'text-violet-300' },

  { label: 'dim', value: 'dim', type: 'mod', className: 'text-cyan-300 text-xs' },
  { label: 'sus', value: 'sus', type: 'mod', className: 'text-cyan-300 text-xs' },
  { label: '–', value: '-', type: 'replace', className: 'text-zinc-400' },
  { label: '◇', value: '◇', type: 'replace', className: 'text-zinc-400' },
];

export default function ChartKeypad() {
  const k = useKeypad();
  const ref = useRef<HTMLDivElement>(null);

  // Click outside to dismiss in popover mode
  useEffect(() => {
    if (k.mode !== 'popover' || !k.focusedCell) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (ref.current?.contains(target)) return;
      // Don't dismiss if clicking another cell
      if (target.closest('[data-cell]')) return;
      k.blur();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [k.mode, k.focusedCell, k]);

  if (!k.focusedCell) return null;

  const handleKey = (key: typeof KEYS[number]) => {
    if (key.type === 'num' || key.type === 'mod') {
      // All inputs append. Use Clear to start fresh.
      k.appendChar(key.value);
    } else if (key.type === 'replace') {
      // Hold (-) and whole-note (◇) replace the cell entirely
      k.setBeatValue(key.value);
      k.advance();
    }
  };

  const keypadInner = (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span>
          Measure {k.focusedCell.measureIdx + 1}, Beat {k.focusedCell.beatIdx + 1}
        </span>
        <div className="flex gap-1">
          <button
            onClick={() => k.setMode(k.mode === 'bar' ? 'popover' : 'bar')}
            className="px-2 py-0.5 rounded text-[10px] bg-white/5 hover:bg-white/10 text-zinc-400"
          >
            {k.mode === 'bar' ? '↗ Popover' : '↓ Bar'}
          </button>
          <button onClick={k.blur} className="p-1 rounded hover:bg-white/10">
            <X size={12} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {KEYS.map((key, i) => (
          <button
            key={i}
            onClick={() => handleKey(key)}
            className={`h-10 rounded-lg bg-white/5 hover:bg-white/15 active:bg-violet-600/40 active:scale-95 transition-all font-mono font-bold text-base ${key.className || ''}`}
          >
            {key.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <button
          onClick={k.retreat}
          className="h-9 rounded-lg bg-white/5 hover:bg-white/15 active:scale-95 flex items-center justify-center"
        >
          <ArrowLeft size={16} />
        </button>
        <button
          onClick={k.clearBeat}
          className="h-9 rounded-lg bg-red-500/10 hover:bg-red-500/20 active:scale-95 flex items-center justify-center text-red-300 text-xs font-bold gap-1"
        >
          <Delete size={14} /> Clear
        </button>
        <button
          onClick={k.advance}
          className="h-9 rounded-lg bg-violet-600/30 hover:bg-violet-600/50 active:scale-95 flex items-center justify-center text-violet-200"
        >
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );

  if (k.mode === 'popover' && k.focusedRect) {
    // Position above or below the cell
    const cellTop = k.focusedRect.top;
    const cellBottom = k.focusedRect.bottom;
    const popoverHeight = 240;
    const showBelow = cellTop < popoverHeight + 20;
    const top = showBelow ? cellBottom + 8 : cellTop - popoverHeight - 8;
    const left = Math.max(8, Math.min(window.innerWidth - 280 - 8, k.focusedRect.left - 100));

    return (
      <div
        ref={ref}
        className="fixed z-[60] glass rounded-2xl p-3 w-[280px] shadow-2xl shadow-black/60 border border-white/10"
        style={{ top, left }}
      >
        {keypadInner}
      </div>
    );
  }

  // Bar mode — fixed at bottom, above mini player (which is bottom-0)
  return (
    <div
      ref={ref}
      className="fixed bottom-24 left-0 right-0 z-[55] px-2 pointer-events-none"
    >
      <div className="max-w-md mx-auto pointer-events-auto glass rounded-2xl p-3 shadow-2xl shadow-black/60 border border-white/10">
        {keypadInner}
      </div>
    </div>
  );
}
