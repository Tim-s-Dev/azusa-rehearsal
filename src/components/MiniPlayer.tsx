'use client';

import { Play, Pause, X, Music2, ChevronUp, Disc3 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { usePlayer } from './PlayerProvider';
import { useMetronome } from './MetronomeProvider';
import { Slider } from '@/components/ui/slider';
import MetronomeControls from './MetronomeControls';

export default function MiniPlayer() {
  const { song, tracks, currentTrackIdx, isPlaying, currentTime, duration, speed, volume,
    togglePlay, seek, setSpeed, setVolume, switchTrack, stop } = usePlayer();
  const metronome = useMetronome();
  const [expanded, setExpanded] = useState(false);

  if (!song) return null;

  const formatTime = (s: number) => {
    if (!isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const currentTrack = tracks[currentTrackIdx];
  const trackName = currentTrack?.name.replace(/\.(mp3|m4a|wav)$/i, '') || '';
  const speeds = [0.5, 0.75, 1, 1.25, 1.5];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      <div className="max-w-5xl mx-auto px-2 pb-2">
        <div className="glass rounded-2xl shadow-2xl shadow-black/50 overflow-hidden border border-white/10">

          {/* Progress bar */}
          <div className="px-4 pt-2">
            <Slider
              value={[currentTime]}
              max={duration || 100}
              step={0.1}
              onValueChange={(v) => seek(typeof v === 'number' ? v : v[0])}
              className="cursor-pointer"
            />
          </div>

          {/* Compact controls */}
          <div className="flex items-center gap-3 px-3 py-2">
            <Link href={song.href} className="p-2 rounded-lg bg-violet-500/10 shrink-0">
              <Music2 size={16} className="text-violet-400" />
            </Link>
            <div className="flex-1 min-w-0">
              <Link href={song.href} className="block">
                <p className="font-semibold text-sm truncate">{song.title}</p>
                <p className="text-xs text-zinc-500 truncate">{trackName}</p>
              </Link>
            </div>
            <div className="flex items-center gap-1 text-xs text-zinc-500 font-mono mr-1">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
            <button
              onClick={metronome.toggle}
              className={`p-2 rounded-lg transition-all ${
                metronome.enabled
                  ? 'bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/40'
                  : 'hover:bg-white/5 text-zinc-400'
              }`}
              title={`Metronome ${metronome.enabled ? 'on' : 'off'} (${metronome.bpm} BPM)`}
            >
              <Disc3 size={16} className={metronome.enabled ? 'animate-spin' : ''} style={metronome.enabled ? { animationDuration: `${60 / metronome.bpm}s` } : undefined} />
            </button>
            <button
              onClick={togglePlay}
              className="p-2.5 rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 hover:scale-105 transition-transform text-white shadow-lg shadow-violet-600/30"
            >
              {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
            </button>
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-2 rounded-lg hover:bg-white/5 text-zinc-400"
              aria-label="Expand"
            >
              <ChevronUp size={16} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>
            <button
              onClick={stop}
              className="p-2 rounded-lg hover:bg-white/5 text-zinc-400"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>

          {/* Expanded controls */}
          {expanded && (
            <div className="px-4 pb-3 space-y-3 border-t border-white/5 pt-3">
              {/* Metronome */}
              <MetronomeControls />

              {/* Speed */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500 w-12">Speed</span>
                <div className="flex gap-1">
                  {speeds.map(s => (
                    <button
                      key={s}
                      onClick={() => setSpeed(s)}
                      className={`px-2 py-0.5 rounded text-xs font-mono ${
                        s === speed ? 'bg-violet-600 text-white' : 'text-zinc-500 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Volume */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500 w-12">Volume</span>
                <div className="flex-1 max-w-xs">
                  <Slider
                    value={[volume]}
                    max={1}
                    step={0.01}
                    onValueChange={(v) => setVolume(typeof v === 'number' ? v : v[0])}
                  />
                </div>
              </div>

              {/* Stems */}
              {tracks.length > 1 && (
                <div className="flex items-start gap-2">
                  <span className="text-xs text-zinc-500 w-12 pt-1">Stems</span>
                  <div className="flex flex-wrap gap-1 flex-1">
                    {tracks.map((t, i) => (
                      <button
                        key={t.id}
                        onClick={() => switchTrack(i)}
                        className={`px-2 py-1 rounded-full text-[10px] font-medium ${
                          i === currentTrackIdx
                            ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white'
                            : 'bg-white/5 text-zinc-400 hover:bg-white/10'
                        }`}
                      >
                        {t.name.replace(/\.(mp3|m4a|wav)$/i, '').replace(/^.*?[-—]\s*/, '').slice(0, 20)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
