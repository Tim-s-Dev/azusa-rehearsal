'use client';

import { useState, useRef, useEffect } from 'react';
import { Play, Pause, SkipBack, RotateCcw, Volume2 } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { SongFile } from '@/lib/types';

interface AudioPlayerProps {
  files: SongFile[];
}

export default function AudioPlayer({ files }: AudioPlayerProps) {
  const audioFiles = files.filter(f => f.file_type === 'audio');
  const [currentTrack, setCurrentTrack] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [isLooping, setIsLooping] = useState(false);
  const [volume, setVolume] = useState(1);
  const audioRef = useRef<HTMLAudioElement>(null);

  const currentFile = audioFiles[currentTrack];

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setCurrentTime(audio.currentTime);
    const onLoaded = () => setDuration(audio.duration);
    const onEnded = () => { if (!isLooping) setIsPlaying(false); };
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('ended', onEnded);
    };
  }, [isLooping]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  }, [speed]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const togglePlay = () => {
    if (!audioRef.current || !currentFile) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const seek = (value: number | readonly number[]) => {
    if (audioRef.current) {
      const v = typeof value === 'number' ? value : value[0];
      audioRef.current.currentTime = v;
      setCurrentTime(v);
    }
  };

  const restart = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
    }
  };

  const switchTrack = (idx: number) => {
    setCurrentTrack(idx);
    setCurrentTime(0);
    setIsPlaying(false);
    setTimeout(() => {
      if (audioRef.current) {
        audioRef.current.load();
      }
    }, 50);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const speeds = [0.5, 0.75, 1, 1.25, 1.5];

  if (audioFiles.length === 0) {
    return (
      <div className="text-center text-zinc-500 py-8">
        No audio files attached to this song.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {currentFile && (
        <audio ref={audioRef} src={currentFile.file_url || ''} loop={isLooping} preload="metadata" />
      )}

      {/* Track selector */}
      <div className="flex flex-wrap gap-2">
        {audioFiles.map((f, i) => (
          <button
            key={f.id}
            onClick={() => switchTrack(i)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              i === currentTrack
                ? 'bg-indigo-600 text-white'
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
          >
            {f.name.replace(/\.(mp3|m4a|wav)$/i, '')}
          </button>
        ))}
      </div>

      {/* Progress */}
      <div className="space-y-2">
        <Slider
          value={[currentTime]}
          max={duration || 100}
          step={0.1}
          onValueChange={seek}
          className="cursor-pointer"
        />
        <div className="flex justify-between text-xs text-zinc-500">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={restart} className="p-2 rounded-full hover:bg-zinc-800 text-zinc-400">
            <SkipBack size={20} />
          </button>
          <button
            onClick={togglePlay}
            className="p-3 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white"
          >
            {isPlaying ? <Pause size={24} /> : <Play size={24} className="ml-0.5" />}
          </button>
          <button
            onClick={() => setIsLooping(!isLooping)}
            className={`p-2 rounded-full ${isLooping ? 'bg-indigo-600/20 text-indigo-400' : 'text-zinc-400 hover:bg-zinc-800'}`}
          >
            <RotateCcw size={20} />
          </button>
        </div>

        {/* Speed */}
        <div className="flex items-center gap-1">
          {speeds.map(s => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`px-2 py-1 rounded text-xs font-medium ${
                s === speed ? 'bg-indigo-600 text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>

        {/* Volume */}
        <div className="flex items-center gap-2 w-24">
          <Volume2 size={16} className="text-zinc-500 shrink-0" />
          <Slider
            value={[volume]}
            max={1}
            step={0.01}
            onValueChange={(v) => setVolume(typeof v === 'number' ? v : v[0])}
          />
        </div>
      </div>
    </div>
  );
}
