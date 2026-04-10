'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const KEYS = ['', 'C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B',
  'Cm', 'C#m', 'Dm', 'D#m', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'A#m', 'Bbm', 'Bm'];

interface AddSongDialogProps {
  /** If provided, the new song is created inside this set */
  setId?: string;
  onCreated: (song: { id: string; title: string; artist: string | null; key: string | null; bpm: number | null }) => void;
  onClose: () => void;
}

export default function AddSongDialog({ setId, onCreated, onClose }: AddSongDialogProps) {
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [key, setKey] = useState('');
  const [bpm, setBpm] = useState('');
  const [creating, setCreating] = useState(false);

  const create = async () => {
    if (!title.trim()) return;
    setCreating(true);
    const body: Record<string, unknown> = {
      title: title.trim(),
      artist: artist.trim() || null,
      key: key || null,
      bpm: bpm ? parseInt(bpm) : null,
    };
    if (setId) body.set_id = setId;
    const res = await fetch('/api/songs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const song = await res.json();
      onCreated(song);
    }
    setCreating(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="glass rounded-3xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Add New Song</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/10"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs uppercase tracking-wider text-zinc-500 mb-1 block">Title *</label>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Song title"
              className="bg-zinc-900/50 border-zinc-800 h-11"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && create()}
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-zinc-500 mb-1 block">Artist</label>
            <Input
              value={artist}
              onChange={e => setArtist(e.target.value)}
              placeholder="Artist name"
              className="bg-zinc-900/50 border-zinc-800 h-11"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs uppercase tracking-wider text-zinc-500 mb-1 block">Key</label>
              <select
                value={key}
                onChange={e => setKey(e.target.value)}
                className="w-full bg-zinc-900/50 border border-zinc-800 rounded-md px-3 py-2.5 text-sm"
              >
                <option value="">—</option>
                {KEYS.filter(Boolean).map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-zinc-500 mb-1 block">BPM</label>
              <Input
                type="number"
                value={bpm}
                onChange={e => setBpm(e.target.value)}
                placeholder="e.g. 120"
                className="bg-zinc-900/50 border-zinc-800 h-11"
                min={30}
                max={300}
              />
            </div>
          </div>
          <Button
            onClick={create}
            disabled={!title.trim() || creating}
            className="w-full h-11 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500"
          >
            {creating ? 'Creating…' : 'Add Song'}
          </Button>
        </div>
      </div>
    </div>
  );
}
