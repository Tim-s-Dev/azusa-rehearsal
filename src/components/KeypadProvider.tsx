'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';

export type KeypadMode = 'bar' | 'popover';

interface CellPos {
  measureIdx: number;
  beatIdx: number;
}

interface KeypadContextValue {
  mode: KeypadMode;
  setMode: (m: KeypadMode) => void;
  focusedCell: CellPos | null;
  focusedRect: DOMRect | null;
  totalMeasures: number;
  beatsPerMeasure: number;
  /** Cell is "fresh" — first input replaces the placeholder/cleared value, then auto-advances. */
  isFresh: boolean;
  /** Cell is "locked" — long-press activates, all input appends without advancing. Tap another cell to unlock. */
  isLocked: boolean;
  lockCell: () => void;
  unlockCell: () => void;
  registerGrid: (measures: number, beats: number) => void;
  focusCell: (pos: CellPos, el: HTMLElement | null) => void;
  blur: () => void;
  appendChar: (c: string) => void;
  writeAndAdvance: (c: string) => void;
  setBeatValue: (value: string) => void;
  clearBeat: () => void;
  advance: () => void;
  retreat: () => void;
  insertMeasureAfter: () => void;
  toggleOut: () => void;
  // Subscribe handlers
  registerWriteHandler: (h: (pos: CellPos, value: string) => void) => () => void;
  getCurrentValue: () => string;
  registerValueGetter: (g: (pos: CellPos) => string | undefined) => () => void;
  registerInsertHandler: (h: (afterMeasureIdx: number) => void) => () => void;
  registerOutHandler: (h: (measureIdx: number) => void) => () => void;
}

const KeypadContext = createContext<KeypadContextValue | null>(null);

export function KeypadProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<KeypadMode>('bar');
  const [focusedCell, setFocusedCell] = useState<CellPos | null>(null);
  const [focusedRect, setFocusedRect] = useState<DOMRect | null>(null);
  const [totalMeasures, setTotalMeasures] = useState(1);
  const [beatsPerMeasure, setBeatsPerMeasure] = useState(4);
  const [isFresh, setIsFresh] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const writeHandlers = useRef<((pos: CellPos, value: string) => void)[]>([]);
  const valueGetters = useRef<((pos: CellPos) => string | undefined)[]>([]);
  const insertHandlers = useRef<((afterMeasureIdx: number) => void)[]>([]);
  const outHandlers = useRef<((measureIdx: number) => void)[]>([]);

  // Load mode preference
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem('keypad_mode') as KeypadMode | null;
    if (stored === 'bar' || stored === 'popover') {
      setModeState(stored);
    }
  }, []);

  const setMode = useCallback((m: KeypadMode) => {
    setModeState(m);
    if (typeof window !== 'undefined') localStorage.setItem('keypad_mode', m);
  }, []);

  const registerGrid = useCallback((measures: number, beats: number) => {
    setTotalMeasures(measures);
    setBeatsPerMeasure(beats);
  }, []);

  const focusCell = useCallback((pos: CellPos, el: HTMLElement | null) => {
    setFocusedCell(pos);
    setIsFresh(true);
    setIsLocked(false); // tapping a new cell always unlocks
    if (el) setFocusedRect(el.getBoundingClientRect());
  }, []);

  const lockCell = useCallback(() => {
    setIsLocked(true);
    setIsFresh(false);
  }, []);

  const unlockCell = useCallback(() => {
    setIsLocked(false);
  }, []);

  const blur = useCallback(() => {
    setFocusedCell(null);
    setFocusedRect(null);
  }, []);

  const registerWriteHandler = useCallback((h: (pos: CellPos, value: string) => void) => {
    writeHandlers.current.push(h);
    return () => {
      writeHandlers.current = writeHandlers.current.filter(x => x !== h);
    };
  }, []);

  const registerValueGetter = useCallback((g: (pos: CellPos) => string | undefined) => {
    valueGetters.current.push(g);
    return () => {
      valueGetters.current = valueGetters.current.filter(x => x !== g);
    };
  }, []);

  const registerInsertHandler = useCallback((h: (afterMeasureIdx: number) => void) => {
    insertHandlers.current.push(h);
    return () => {
      insertHandlers.current = insertHandlers.current.filter(x => x !== h);
    };
  }, []);

  const registerOutHandler = useCallback((h: (measureIdx: number) => void) => {
    outHandlers.current.push(h);
    return () => {
      outHandlers.current = outHandlers.current.filter(x => x !== h);
    };
  }, []);

  const getCurrentValue = useCallback(() => {
    if (!focusedCell) return '';
    for (const g of valueGetters.current) {
      const v = g(focusedCell);
      if (v !== undefined) return v;
    }
    return '';
  }, [focusedCell]);

  const writeToCell = useCallback((value: string) => {
    if (!focusedCell) return;
    writeHandlers.current.forEach(h => h(focusedCell, value));
  }, [focusedCell]);

  const setBeatValue = useCallback((value: string) => {
    writeToCell(value);
  }, [writeToCell]);

  const advance = useCallback(() => {
    if (!focusedCell) return;
    let nextBeat = focusedCell.beatIdx + 1;
    let nextMeasure = focusedCell.measureIdx;
    if (nextBeat >= beatsPerMeasure) {
      nextBeat = 0;
      nextMeasure += 1;
    }
    if (nextMeasure >= totalMeasures) return;
    const el = document.querySelector<HTMLElement>(`[data-cell="${nextMeasure}-${nextBeat}"]`);
    setFocusedCell({ measureIdx: nextMeasure, beatIdx: nextBeat });
    setIsFresh(true);
    if (el) setFocusedRect(el.getBoundingClientRect());
  }, [focusedCell, beatsPerMeasure, totalMeasures]);

  const retreat = useCallback(() => {
    if (!focusedCell) return;
    let prevBeat = focusedCell.beatIdx - 1;
    let prevMeasure = focusedCell.measureIdx;
    if (prevBeat < 0) {
      prevBeat = beatsPerMeasure - 1;
      prevMeasure -= 1;
    }
    if (prevMeasure < 0) return;
    const el = document.querySelector<HTMLElement>(`[data-cell="${prevMeasure}-${prevBeat}"]`);
    setFocusedCell({ measureIdx: prevMeasure, beatIdx: prevBeat });
    setIsFresh(true);
    if (el) setFocusedRect(el.getBoundingClientRect());
  }, [focusedCell, beatsPerMeasure]);

  const appendChar = useCallback((c: string) => {
    if (!focusedCell) return;
    if (isFresh) {
      writeToCell(c);
      setIsFresh(false);
    } else {
      const current = getCurrentValue();
      writeToCell(current + c);
    }
  }, [focusedCell, isFresh, getCurrentValue, writeToCell]);

  /** Write a number and immediately advance to the next cell — unless the cell is locked. */
  const writeAndAdvance = useCallback((c: string) => {
    if (!focusedCell) return;
    // Write to current cell
    if (isFresh) {
      writeToCell(c);
    } else {
      const current = getCurrentValue();
      writeToCell(current + c);
    }
    // If locked, stay on this cell (append mode)
    if (isLocked) {
      setIsFresh(false);
      return;
    }
    // Advance
    let nextBeat = focusedCell.beatIdx + 1;
    let nextMeasure = focusedCell.measureIdx;
    if (nextBeat >= beatsPerMeasure) {
      nextBeat = 0;
      nextMeasure += 1;
    }
    if (nextMeasure >= totalMeasures) {
      setIsFresh(false);
      return;
    }
    setFocusedCell({ measureIdx: nextMeasure, beatIdx: nextBeat });
    setIsFresh(true);
    const el = document.querySelector<HTMLElement>(`[data-cell="${nextMeasure}-${nextBeat}"]`);
    if (el) setFocusedRect(el.getBoundingClientRect());
  }, [focusedCell, isFresh, isLocked, getCurrentValue, writeToCell, beatsPerMeasure, totalMeasures]);

  const clearBeat = useCallback(() => {
    writeToCell('');
    setIsFresh(true);
  }, [writeToCell]);

  const insertMeasureAfter = useCallback(() => {
    if (!focusedCell) return;
    insertHandlers.current.forEach(h => h(focusedCell.measureIdx));
    // Move focus to first beat of the newly-inserted measure
    setTimeout(() => {
      const newMeasureIdx = focusedCell.measureIdx + 1;
      const el = document.querySelector<HTMLElement>(`[data-cell="${newMeasureIdx}-0"]`);
      setFocusedCell({ measureIdx: newMeasureIdx, beatIdx: 0 });
      setIsFresh(true);
      if (el) setFocusedRect(el.getBoundingClientRect());
    }, 50);
  }, [focusedCell]);

  const toggleOut = useCallback(() => {
    if (!focusedCell) return;
    outHandlers.current.forEach(h => h(focusedCell.measureIdx));
  }, [focusedCell]);

  return (
    <KeypadContext.Provider
      value={{
        mode, setMode,
        focusedCell, focusedRect,
        totalMeasures, beatsPerMeasure,
        isFresh, isLocked, lockCell, unlockCell,
        registerGrid, focusCell, blur,
        appendChar, writeAndAdvance, setBeatValue, clearBeat,
        advance, retreat,
        insertMeasureAfter, toggleOut,
        registerWriteHandler,
        getCurrentValue,
        registerValueGetter,
        registerInsertHandler,
        registerOutHandler,
      }}
    >
      {children}
    </KeypadContext.Provider>
  );
}

export function useKeypad() {
  const ctx = useContext(KeypadContext);
  if (!ctx) throw new Error('useKeypad must be inside KeypadProvider');
  return ctx;
}
