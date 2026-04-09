'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Delete, X, Plus, Move, CircleSlash } from 'lucide-react';
import { useKeypad } from './KeypadProvider';

type KeyType = 'num' | 'mod' | 'replace' | 'special';

const KEYS: { label: string; value: string; type: KeyType; className?: string }[] = [
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
  { label: '7th', value: '7', type: 'mod', className: 'text-violet-300 text-xs' },

  { label: 'dim', value: 'dim', type: 'mod', className: 'text-cyan-300 text-xs' },
  { label: 'sus', value: 'sus', type: 'mod', className: 'text-cyan-300 text-xs' },
  { label: '–', value: '-', type: 'replace', className: 'text-zinc-400' },
  { label: '◇', value: '◇', type: 'replace', className: 'text-zinc-400' },
];

export default function ChartKeypad() {
  const k = useKeypad();
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  // Drag state in a ref so we never re-render mid-drag
  const dragRef = useRef<{
    pointerId: number;
    startPointerX: number;
    startPointerY: number;
    startElX: number;
    startElY: number;
    moved: boolean;
  } | null>(null);

  // Restore persisted position per mode
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem(`keypad_pos_${k.mode}`);
    if (stored) {
      try {
        const p = JSON.parse(stored);
        if (typeof p.x === 'number' && typeof p.y === 'number') setPos(p);
      } catch {}
    } else {
      setPos(null);
    }
  }, [k.mode]);

  // Click outside to dismiss in popover mode
  useEffect(() => {
    if (k.mode !== 'popover' || !k.focusedCell) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (ref.current?.contains(target)) return;
      if (target.closest('[data-cell]')) return;
      k.blur();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [k.mode, k.focusedCell, k]);

  if (!k.focusedCell) return null;

  const handleKey = (key: typeof KEYS[number]) => {
    if (key.type === 'num' || key.type === 'mod') {
      k.appendChar(key.value);
    } else if (key.type === 'replace') {
      k.setBeatValue(key.value);
      k.advance();
    }
  };

  // ── Drag handlers ────────────────────────────────────────────────
  // Pattern: capture pointer on the handle, move element via direct DOM
  // style writes (no React state). Commit to React state only on release.
  const onHandlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragRef.current = {
      pointerId: e.pointerId,
      startPointerX: e.clientX,
      startPointerY: e.clientY,
      startElX: rect.left,
      startElY: rect.top,
      moved: false,
    };
    // Use the handle as the capture target so we get move/up even if pointer leaves
    try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch {}
    // Pin element to absolute coordinates so we can move freely
    el.style.left = `${rect.left}px`;
    el.style.top = `${rect.top}px`;
    el.style.right = 'auto';
    el.style.bottom = 'auto';
    el.style.transform = 'none';
    el.style.transition = 'none';
    e.preventDefault();
  };

  const onHandlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const el = ref.current;
    if (!drag || !el) return;
    if (drag.pointerId !== e.pointerId) return;

    const dx = e.clientX - drag.startPointerX;
    const dy = e.clientY - drag.startPointerY;
    if (!drag.moved && Math.hypot(dx, dy) < 3) return; // ignore micro-movements
    drag.moved = true;

    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const newX = Math.max(8, Math.min(window.innerWidth - w - 8, drag.startElX + dx));
    const newY = Math.max(8, Math.min(window.innerHeight - h - 8, drag.startElY + dy));
    el.style.left = `${newX}px`;
    el.style.top = `${newY}px`;
  };

  const onHandlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const el = ref.current;
    if (!drag || !el) return;
    if (drag.pointerId !== e.pointerId) return;
    try { (e.currentTarget as Element).releasePointerCapture(e.pointerId); } catch {}
    if (drag.moved) {
      const rect = el.getBoundingClientRect();
      const next = { x: rect.left, y: rect.top };
      setPos(next);
      try { localStorage.setItem(`keypad_pos_${k.mode}`, JSON.stringify(next)); } catch {}
    }
    dragRef.current = null;
  };

  const keypadInner = (
    <div className="space-y-2">
      <div
        className="flex items-center justify-between text-xs text-zinc-500 cursor-grab active:cursor-grabbing select-none -m-3 -mb-1 p-3 pb-1 touch-none"
        onPointerDown={onHandlePointerDown}
        onPointerMove={onHandlePointerMove}
        onPointerUp={onHandlePointerUp}
        onPointerCancel={onHandlePointerUp}
      >
        <div className="flex items-center gap-1.5">
          <Move size={11} className="text-zinc-600" />
          <span>
            M{k.focusedCell.measureIdx + 1} · B{k.focusedCell.beatIdx + 1}
          </span>
        </div>
        <div className="flex gap-1">
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => k.setMode(k.mode === 'bar' ? 'popover' : 'bar')}
            className="px-2 py-0.5 rounded text-[10px] bg-white/5 hover:bg-white/10 text-zinc-400"
          >
            {k.mode === 'bar' ? '↗ Pop' : '↓ Bar'}
          </button>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={k.blur}
            className="p-1 rounded hover:bg-white/10"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {KEYS.map((key, i) => (
          <button
            key={i}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => handleKey(key)}
            className={`h-10 rounded-lg bg-white/5 hover:bg-white/15 active:bg-violet-600/40 active:scale-95 transition-all font-mono font-bold text-base ${key.className || ''}`}
          >
            {key.label}
          </button>
        ))}
      </div>

      {/* Special row: Out · +Measure · Clear */}
      <div className="grid grid-cols-3 gap-1.5">
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={k.toggleOut}
          className="h-9 rounded-lg bg-zinc-800/50 hover:bg-zinc-700/50 active:scale-95 flex items-center justify-center text-zinc-400 text-[10px] font-bold tracking-widest gap-1"
          title="Mark this measure as OUT (band rests)"
        >
          <CircleSlash size={11} /> OUT
        </button>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={k.insertMeasureAfter}
          className="h-9 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 active:scale-95 flex items-center justify-center text-emerald-300 text-[10px] font-bold gap-1"
          title="Add a new measure after this one"
        >
          <Plus size={11} /> MEASURE
        </button>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={k.clearBeat}
          className="h-9 rounded-lg bg-red-500/10 hover:bg-red-500/20 active:scale-95 flex items-center justify-center text-red-300 text-[10px] font-bold gap-1"
        >
          <Delete size={11} /> CLEAR
        </button>
      </div>

      {/* Nav row */}
      <div className="grid grid-cols-2 gap-1.5">
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={k.retreat}
          className="h-9 rounded-lg bg-white/5 hover:bg-white/15 active:scale-95 flex items-center justify-center"
        >
          <ArrowLeft size={16} />
        </button>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={k.advance}
          className="h-9 rounded-lg bg-violet-600/30 hover:bg-violet-600/50 active:scale-95 flex items-center justify-center text-violet-200"
        >
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );

  // Position calc
  let style: React.CSSProperties;
  if (pos) {
    style = { top: pos.y, left: pos.x };
  } else if (k.mode === 'popover' && k.focusedRect) {
    const cellTop = k.focusedRect.top;
    const popoverHeight = 280;
    const showBelow = cellTop < popoverHeight + 20;
    const top = showBelow ? k.focusedRect.bottom + 8 : cellTop - popoverHeight - 8;
    const left = Math.max(8, Math.min(window.innerWidth - 280 - 8, k.focusedRect.left - 100));
    style = { top, left };
  } else {
    // Bar mode default position (bottom of screen, above mini-player)
    style = { bottom: 96, left: '50%', transform: 'translateX(-50%)' };
  }

  return (
    <div
      ref={ref}
      className="fixed z-[60] glass rounded-2xl p-3 w-[280px] shadow-2xl shadow-black/60 border border-white/10"
      style={style}
    >
      {keypadInner}
    </div>
  );
}
