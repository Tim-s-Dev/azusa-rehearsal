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
  toggle: () => void;
  setBpm: (n: number) => void;
  setBeatsPerMeasure: (n: number) => void;
  setAccentFirst: (a: boolean) => void;
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
  const tapTimes = useRef<number[]>([]);
  const player = usePlayer();
  const lastSongIdRef = useRef<string | null>(null);

  // Init clock
  useEffect(() => {
    clockRef.current = new MetronomeClock();
    clockRef.current.setOnBeat((b) => setCurrentBeat(b));
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

  const toggle = useCallback(() => {
    if (!clockRef.current) return;
    if (enabled) {
      clockRef.current.stop();
      setEnabled(false);
    } else {
      clockRef.current.setBpm(bpm);
      clockRef.current.setBeatsPerMeasure(beatsPerMeasure);
      clockRef.current.setAccentFirst(accentFirst);
      clockRef.current.start();
      setEnabled(true);
    }
  }, [enabled, bpm, beatsPerMeasure, accentFirst]);

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
      enabled, bpm, beatsPerMeasure, accentFirst, currentBeat,
      toggle, setBpm, setBeatsPerMeasure, setAccentFirst, tap,
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
