'use client';

import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import type { SongFile } from '@/lib/types';

interface DissectButtonProps {
  songId: string;
  audioFiles: SongFile[];
  onComplete: () => void;
}

export default function DissectButton({ songId, audioFiles, onComplete }: DissectButtonProps) {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  // Prefer the "Arrangement" or full mix file if it exists
  const pickBestFile = () => {
    const arrangement = audioFiles.find(f =>
      /arrangement/i.test(f.name) || /full|mix|master/i.test(f.name)
    );
    if (arrangement) return arrangement;
    return audioFiles[0];
  };

  const dissect = async (file: SongFile) => {
    setRunning(true);
    setError(null);
    setShowPicker(false);

    try {
      const res = await fetch('/api/dissect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ song_id: songId, file_url: file.file_url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to dissect');
      onComplete();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  if (audioFiles.length === 0) return null;

  return (
    <div className="space-y-2">
      {!showPicker ? (
        <button
          onClick={() => audioFiles.length === 1 ? dissect(audioFiles[0]) : setShowPicker(true)}
          disabled={running}
          className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-blue-600 hover:scale-[1.02] active:scale-95 transition-all text-white font-semibold shadow-lg shadow-violet-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {running ? (
            <>
              <Loader2 size={18} className="animate-spin" /> Dissecting... (this takes ~30-60s)
            </>
          ) : (
            <>
              <Sparkles size={18} /> Dissect with AI
            </>
          )}
        </button>
      ) : (
        <div className="glass rounded-2xl p-4 space-y-2">
          <p className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Pick a track to analyze</p>
          {audioFiles.map(f => (
            <button
              key={f.id}
              onClick={() => dissect(f)}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/5 text-sm flex items-center gap-2"
            >
              <Sparkles size={14} className="text-violet-400" />
              {f.name.replace(/\.(mp3|m4a|wav)$/i, '')}
            </button>
          ))}
          <button
            onClick={() => setShowPicker(false)}
            className="w-full text-xs text-zinc-500 hover:text-zinc-300 mt-2"
          >
            Cancel
          </button>
        </div>
      )}

      {error && (
        <div className="text-xs text-red-400 px-3 py-2 rounded-lg bg-red-500/10">
          {error}
        </div>
      )}
    </div>
  );
}
