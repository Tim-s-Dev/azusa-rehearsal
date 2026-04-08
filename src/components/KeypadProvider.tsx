'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

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
  registerGrid: (measures: number, beats: number) => void;
  focusCell: (pos: CellPos, el: HTMLElement | null) => void;
  blur: () => void;
  appendChar: (c: string) => void;
  setBeatValue: (value: string) => void;
  clearBeat: () => void;
  advance: () => void;
  retreat: () => void;
  // Subscribe handlers
  onWriteHandlers: ((pos: CellPos, value: string) => void)[];
  registerWriteHandler: (h: (pos: CellPos, value: string) => void) => () => void;
  getCurrentValue: () => string;
  registerValueGetter: (g: (pos: CellPos) => string | undefined) => () => void;
}

const KeypadContext = createContext<KeypadContextValue | null>(null);

export function KeypadProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<KeypadMode>('bar');
  const [focusedCell, setFocusedCell] = useState<CellPos | null>(null);
  const [focusedRect, setFocusedRect] = useState<DOMRect | null>(null);
  const [totalMeasures, setTotalMeasures] = useState(1);
  const [beatsPerMeasure, setBeatsPerMeasure] = useState(4);
  const [writeHandlers, setWriteHandlers] = useState<((pos: CellPos, value: string) => void)[]>([]);
  const [valueGetters, setValueGetters] = useState<((pos: CellPos) => string | undefined)[]>([]);

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
    if (el) setFocusedRect(el.getBoundingClientRect());
  }, []);

  const blur = useCallback(() => {
    setFocusedCell(null);
    setFocusedRect(null);
  }, []);

  const registerWriteHandler = useCallback((h: (pos: CellPos, value: string) => void) => {
    setWriteHandlers(prev => [...prev, h]);
    return () => setWriteHandlers(prev => prev.filter(x => x !== h));
  }, []);

  const registerValueGetter = useCallback((g: (pos: CellPos) => string | undefined) => {
    setValueGetters(prev => [...prev, g]);
    return () => setValueGetters(prev => prev.filter(x => x !== g));
  }, []);

  const getCurrentValue = useCallback(() => {
    if (!focusedCell) return '';
    for (const g of valueGetters) {
      const v = g(focusedCell);
      if (v !== undefined) return v;
    }
    return '';
  }, [focusedCell, valueGetters]);

  const writeToCell = useCallback((value: string) => {
    if (!focusedCell) return;
    writeHandlers.forEach(h => h(focusedCell, value));
  }, [focusedCell, writeHandlers]);

  const setBeatValue = useCallback((value: string) => {
    writeToCell(value);
  }, [writeToCell]);

  const appendChar = useCallback((c: string) => {
    if (!focusedCell) return;
    const current = getCurrentValue();
    writeToCell(current + c);
  }, [focusedCell, getCurrentValue, writeToCell]);

  const clearBeat = useCallback(() => {
    writeToCell('');
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
    // Find the DOM element for the next cell
    const el = document.querySelector<HTMLElement>(`[data-cell="${nextMeasure}-${nextBeat}"]`);
    if (el) {
      el.focus();
      focusCell({ measureIdx: nextMeasure, beatIdx: nextBeat }, el);
    } else {
      setFocusedCell({ measureIdx: nextMeasure, beatIdx: nextBeat });
    }
  }, [focusedCell, beatsPerMeasure, totalMeasures, focusCell]);

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
    if (el) {
      el.focus();
      focusCell({ measureIdx: prevMeasure, beatIdx: prevBeat }, el);
    } else {
      setFocusedCell({ measureIdx: prevMeasure, beatIdx: prevBeat });
    }
  }, [focusedCell, beatsPerMeasure, focusCell]);

  return (
    <KeypadContext.Provider
      value={{
        mode, setMode,
        focusedCell, focusedRect,
        totalMeasures, beatsPerMeasure,
        registerGrid, focusCell, blur,
        appendChar, setBeatValue, clearBeat,
        advance, retreat,
        onWriteHandlers: writeHandlers,
        registerWriteHandler,
        getCurrentValue,
        registerValueGetter,
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
