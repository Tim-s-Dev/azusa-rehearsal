'use client';

import { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from 'react';
import { MetronomeClock } from '@/lib/metronome';
import { usePlayer } from './PlayerProvider';

interface MetronomeContextValue {
  enabled: boolean;
  bpm: number;
  beatsPerMeasure: number;
  accentFirst: boolean;
  currentBeat: number;
  offsetMs: number;
  toggle: () => void;
  setBpm: (n: number) => void;
  setBeatsPerMeasure: (n: number) => void;
  setAccentFirst: (a: boolean) => void;
  setOffsetMs: (ms: number) => void;
  tap: () => void;
}

const MetronomeContext = createContext<MetronomeContextValue | null>(null);

export function MetronomeProvider({ children }: { children: ReactNode }) {
  const clockRef = useRef<MetronomeClock | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [bpm, setBpmState] = useState(90);
  const [beatsPerMeasure, setBeatsPerMeasureState] = useState(4);
  const [accentFirst, setAccentFirstState] = useState(true);
  const [currentBeat, setCurrentBeat] = useState(0);
  const [offsetMs, setOffsetMsState] = useState(0);
  const tapTimes = useRef<number[]>([]);
  const player = usePlayer();
  const lastSongIdRef = useRef<string | null>(null);

  // Init clock
  useEffect(() => {
    clockRef.current = new MetronomeClock();
    clockRef.current.setOnBeat((b) => setCurrentBeat(b));
    // Restore saved offset
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('metronome_offset_ms');
      if (stored) {
        const v = parseInt(stored, 10);
        if (!isNaN(v)) {
          setOffsetMsState(v);
          clockRef.current.setOffset(v / 1000);
        }
      }
    }
    return () => {
      clockRef.current?.destroy();
      clockRef.current = null;
    };
  }, []);

  // Auto-pull BPM when a song loads (but only when the song actually changes)
  useEffect(() => {
    if (!player.song) return;
    if (lastSongIdRef.current === player.song.id) return;
    lastSongIdRef.current = player.song.id;
    // Pull BPM from the DB via API
    fetch(`/api/songs?id=${player.song.id}`)
      .then(r => r.json())
      .then(data => {
        if (data && typeof data.bpm === 'number' && data.bpm > 0) {
          setBpmState(data.bpm);
          clockRef.current?.setBpm(data.bpm);
        }
      })
      .catch(() => {});
  }, [player.song]);

  const toggle = useCallback(async () => {
    if (!clockRef.current) return;
    if (enabled) {
      clockRef.current.stop();
      setEnabled(false);
    } else {
      clockRef.current.setBpm(bpm);
      clockRef.current.setBeatsPerMeasure(beatsPerMeasure);
      clockRef.current.setAccentFirst(accentFirst);
      clockRef.current.setOffset(offsetMs / 1000);
      await clockRef.current.start();
      setEnabled(true);
    }
  }, [enabled, bpm, beatsPerMeasure, accentFirst, offsetMs]);

  const setBpm = useCallback((n: number) => {
    setBpmState(n);
    clockRef.current?.setBpm(n);
  }, []);

  const setBeatsPerMeasure = useCallback((n: number) => {
    setBeatsPerMeasureState(n);
    clockRef.current?.setBeatsPerMeasure(n);
  }, []);

  const setAccentFirst = useCallback((a: boolean) => {
    setAccentFirstState(a);
    clockRef.current?.setAccentFirst(a);
  }, []);

  const setOffsetMs = useCallback((ms: number) => {
    const clamped = Math.max(-500, Math.min(500, Math.round(ms)));
    setOffsetMsState(clamped);
    clockRef.current?.setOffset(clamped / 1000);
    if (typeof window !== 'undefined') {
      localStorage.setItem('metronome_offset_ms', String(clamped));
    }
  }, []);

  const tap = useCallback(() => {
    const now = performance.now();
    tapTimes.current.push(now);
    // Keep last 5 taps within 3 seconds
    tapTimes.current = tapTimes.current.filter(t => now - t < 3000);
    if (tapTimes.current.length >= 2) {
      const intervals: number[] = [];
      for (let i = 1; i < tapTimes.current.length; i++) {
        intervals.push(tapTimes.current[i] - tapTimes.current[i - 1]);
      }
      const avgMs = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const newBpm = Math.round(60000 / avgMs);
      if (newBpm >= 30 && newBpm <= 250) {
        setBpm(newBpm);
      }
    }
  }, [setBpm]);

  return (
    <MetronomeContext.Provider value={{
      enabled, bpm, beatsPerMeasure, accentFirst, currentBeat, offsetMs,
      toggle, setBpm, setBeatsPerMeasure, setAccentFirst, setOffsetMs, tap,
    }}>
      {children}
    </MetronomeContext.Provider>
  );
}

export function useMetronome() {
  const ctx = useContext(MetronomeContext);
  if (!ctx) throw new Error('useMetronome must be inside MetronomeProvider');
  return ctx;
}
