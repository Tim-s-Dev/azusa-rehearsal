'use client';

import { createContext, useContext, useState, useRef, useEffect, useCallback, ReactNode } from 'react';
import type { SongFile } from '@/lib/types';

interface PlayerSongInfo {
  id: string;
  title: string;
  artist?: string | null;
  href: string; // back-link to the song page
}

interface PlayerContextValue {
  // State
  song: PlayerSongInfo | null;
  tracks: SongFile[];
  currentTrackIdx: number;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  speed: number;
  isLooping: boolean;
  volume: number;
  // Actions
  loadSong: (info: PlayerSongInfo, tracks: SongFile[], startIdx?: number) => void;
  togglePlay: () => void;
  seek: (time: number) => void;
  setSpeed: (s: number) => void;
  setLooping: (l: boolean) => void;
  setVolume: (v: number) => void;
  switchTrack: (idx: number) => void;
  stop: () => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [song, setSong] = useState<PlayerSongInfo | null>(null);
  const [tracks, setTracks] = useState<SongFile[]>([]);
  const [currentTrackIdx, setCurrentTrackIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeedState] = useState(1);
  const [isLooping, setIsLoopingState] = useState(false);
  const [volume, setVolumeState] = useState(1);

  // Init audio element once
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.preload = 'metadata';
    }
    const audio = audioRef.current;
    const onTime = () => setCurrentTime(audio.currentTime);
    const onLoaded = () => setDuration(audio.duration);
    const onEnded = () => { if (!audio.loop) setIsPlaying(false); };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
    };
  }, []);

  const loadSong = useCallback((info: PlayerSongInfo, songTracks: SongFile[], startIdx = 0) => {
    const audio = audioRef.current;
    if (!audio) return;
    const audioTracks = songTracks.filter(t => t.file_type === 'audio');
    if (audioTracks.length === 0) return;

    // Same song? Don't reload
    if (song?.id === info.id && audio.src === audioTracks[startIdx]?.file_url) {
      return;
    }

    setSong(info);
    setTracks(audioTracks);
    setCurrentTrackIdx(startIdx);
    audio.src = audioTracks[startIdx].file_url || '';
    audio.load();
    setCurrentTime(0);
  }, [song?.id]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !audio.src) return;
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  }, []);

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = time;
    setCurrentTime(time);
  }, []);

  const setSpeed = useCallback((s: number) => {
    setSpeedState(s);
    if (audioRef.current) audioRef.current.playbackRate = s;
  }, []);

  const setLooping = useCallback((l: boolean) => {
    setIsLoopingState(l);
    if (audioRef.current) audioRef.current.loop = l;
  }, []);

  const setVolume = useCallback((v: number) => {
    setVolumeState(v);
    if (audioRef.current) audioRef.current.volume = v;
  }, []);

  const switchTrack = useCallback((idx: number) => {
    const audio = audioRef.current;
    if (!audio || !tracks[idx]) return;
    const wasPlaying = !audio.paused;
    const prevTime = audio.currentTime;
    setCurrentTrackIdx(idx);
    audio.src = tracks[idx].file_url || '';
    audio.load();
    audio.currentTime = prevTime;
    if (wasPlaying) audio.play().catch(() => {});
  }, [tracks]);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.src = '';
    }
    setSong(null);
    setTracks([]);
    setIsPlaying(false);
  }, []);

  return (
    <PlayerContext.Provider value={{
      song, tracks, currentTrackIdx, isPlaying, currentTime, duration, speed, isLooping, volume,
      loadSong, togglePlay, seek, setSpeed, setLooping, setVolume, switchTrack, stop,
    }}>
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be inside PlayerProvider');
  return ctx;
}
