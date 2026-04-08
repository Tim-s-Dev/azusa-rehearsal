'use client';

import { useEffect } from 'react';
import { Play, Pause, SkipBack, RotateCcw, Volume2, AudioLines } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { SongFile, Song } from '@/lib/types';
import { usePlayer } from './PlayerProvider';
import { usePathname } from 'next/navigation';

interface AudioPlayerProps {
  files: SongFile[];
  song: Song;
}

export default function AudioPlayer({ files, song }: AudioPlayerProps) {
  const audioFiles = files.filter(f => f.file_type === 'audio');
  const pathname = usePathname();
  const player = usePlayer();

  // When mounted with audio files, register the song with the global player
  useEffect(() => {
    if (audioFiles.length === 0) return;
    player.loadSong(
      { id: song.id, title: song.title, artist: song.artist, href: pathname || '/' },
      audioFiles,
      0
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song.id, audioFiles.length]);

  // Pull state from global player IF it's playing this song, else local zero state
  const isCurrentSong = player.song?.id === song.id;
  const currentTrackIdx = isCurrentSong ? player.currentTrackIdx : 0;
  const isPlaying = isCurrentSong ? player.isPlaying : false;
  const currentTime = isCurrentSong ? player.currentTime : 0;
  const duration = isCurrentSong ? player.duration : 0;
  const speed = player.speed;
  const isLooping = player.isLooping;
  const volume = player.volume;

  const currentFile = audioFiles[currentTrackIdx];
  const speeds = [0.5, 0.75, 1, 1.25, 1.5];

  const formatTime = (s: number) => {
    if (!isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const ensureLoaded = () => {
    if (!isCurrentSong) {
      player.loadSong(
        { id: song.id, title: song.title, artist: song.artist, href: pathname || '/' },
        audioFiles,
        currentTrackIdx
      );
    }
  };

  const togglePlay = () => {
    ensureLoaded();
    setTimeout(() => player.togglePlay(), 50);
  };

  if (audioFiles.length === 0) {
    return (
      <div className="text-center text-zinc-500 py-12">
        <AudioLines size={32} className="mx-auto mb-2 opacity-50" />
        <p>No audio files yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Now playing */}
      <div className="text-center">
        <p className="text-xs uppercase tracking-wider text-zinc-500 mb-1">Now Playing</p>
        <p className="text-lg font-medium truncate">{currentFile?.name.replace(/\.(mp3|m4a|wav)$/i, '')}</p>
      </div>

      {/* Big play button + progress */}
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => player.seek(0)} className="p-3 rounded-full glass hover:scale-110 transition-transform">
            <SkipBack size={18} />
          </button>
          <button
            onClick={togglePlay}
            className="p-5 rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-violet-600/30 text-white"
          >
            {isPlaying ? <Pause size={28} /> : <Play size={28} className="ml-1" />}
          </button>
          <button
            onClick={() => player.setLooping(!isLooping)}
            className={`p-3 rounded-full transition-all ${isLooping ? 'bg-violet-500/20 text-violet-400 ring-1 ring-violet-500/50' : 'glass hover:scale-110'}`}
          >
            <RotateCcw size={18} />
          </button>
        </div>

        {/* Progress */}
        <div className="w-full space-y-1">
          <Slider
            value={[currentTime]}
            max={duration || 100}
            step={0.1}
            onValueChange={(v) => player.seek(typeof v === 'number' ? v : v[0])}
            className="cursor-pointer"
          />
          <div className="flex justify-between text-xs text-zinc-500 font-mono">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>

      {/* Speed + Volume */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-1 flex-1">
          {speeds.map(s => (
            <button
              key={s}
              onClick={() => player.setSpeed(s)}
              className={`px-2.5 py-1 rounded-md text-xs font-mono font-semibold transition-all ${
                s === speed ? 'bg-violet-600 text-white' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 w-32">
          <Volume2 size={14} className="text-zinc-500 shrink-0" />
          <Slider
            value={[volume]}
            max={1}
            step={0.01}
            onValueChange={(v) => player.setVolume(typeof v === 'number' ? v : v[0])}
          />
        </div>
      </div>

      {/* Track selector */}
      <div className="pt-4 border-t border-white/5">
        <p className="text-xs uppercase tracking-wider text-zinc-500 mb-3">Stems ({audioFiles.length})</p>
        <div className="flex flex-wrap gap-2">
          {audioFiles.map((f, i) => (
            <button
              key={f.id}
              onClick={() => {
                ensureLoaded();
                setTimeout(() => player.switchTrack(i), 50);
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                i === currentTrackIdx
                  ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-md shadow-violet-600/30'
                  : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              {f.name.replace(/\.(mp3|m4a|wav)$/i, '').replace(/^.*?[-—]\s*/, '')}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
