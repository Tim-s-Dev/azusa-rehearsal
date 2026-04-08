'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Plus, FileText, Music2, ArrowUpRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import type { Set, Song } from '@/lib/types';

export default function SetPage() {
  const { confId, eventId, setId } = useParams<{ confId: string; eventId: string; setId: string }>();
  const [set, setSet] = useState<Set | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', artist: '', key: '', bpm: '' });

  useEffect(() => {
    fetch(`/api/sets?event_id=${eventId}`).then(r => r.json()).then((all: Set[]) => {
      setSet(all.find(s => s.id === setId) || null);
    });
    loadSongs();
  }, [eventId, setId]);

  const loadSongs = () => fetch(`/api/songs?set_id=${setId}`).then(r => r.json()).then(setSongs);

  const create = async () => {
    await fetch('/api/songs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        bpm: form.bpm ? parseInt(form.bpm) : null,
        set_id: setId,
        sort_order: songs.length,
      }),
    });
    setForm({ title: '', artist: '', key: '', bpm: '' });
    setOpen(false);
    loadSongs();
  };

  return (
    <div className="space-y-8">
      <Link href={`/conference/${confId}/event/${eventId}`} className="inline-flex items-center gap-1 text-zinc-500 hover:text-violet-400 text-sm transition-colors">
        <ArrowLeft size={16} /> Back to Sets
      </Link>

      {/* Hero */}
      <div className="glass rounded-3xl p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-blue-600/20 to-violet-600/20 blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-blue-400 mb-2">Set</p>
            <h1 className="text-4xl font-bold tracking-tight mb-2">{set?.name || 'Loading...'}</h1>
            <p className="text-zinc-400">{songs.length} song{songs.length !== 1 ? 's' : ''}</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:scale-105 transition-transform text-white text-sm font-medium shadow-lg shadow-violet-600/20">
              <Plus size={14} /> Song
            </DialogTrigger>
            <DialogContent className="bg-zinc-950/95 backdrop-blur-xl border-zinc-800">
              <DialogHeader><DialogTitle>New Song</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Input placeholder="Song Title" value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="bg-zinc-900/50 border-zinc-800 h-11" />
                <Input placeholder="Artist" value={form.artist} onChange={e => setForm({...form, artist: e.target.value})} className="bg-zinc-900/50 border-zinc-800 h-11" />
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Key (e.g. G, Bb)" value={form.key} onChange={e => setForm({...form, key: e.target.value})} className="bg-zinc-900/50 border-zinc-800 h-11" />
                  <Input placeholder="BPM" type="number" value={form.bpm} onChange={e => setForm({...form, bpm: e.target.value})} className="bg-zinc-900/50 border-zinc-800 h-11" />
                </div>
                <Button onClick={create} className="w-full h-11 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500">Create Song</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Songs */}
      <div className="space-y-2">
        {songs.map((song, i) => (
          <Link key={song.id} href={`/conference/${confId}/event/${eventId}/set/${setId}/song/${song.id}`} className="block group">
            <div className="glass rounded-2xl p-4 transition-all hover:scale-[1.01] cursor-pointer">
              <div className="flex items-center gap-4">
                <div className="text-2xl font-bold text-zinc-700 font-mono w-10 text-center group-hover:text-violet-400 transition-colors">
                  {String(i + 1).padStart(2, '0')}
                </div>
                <div className="p-2.5 rounded-xl bg-violet-500/10">
                  <Music2 size={18} className="text-violet-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-lg truncate">{song.title}</h3>
                  {song.artist && <p className="text-sm text-zinc-500 truncate">{song.artist}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {song.notes && <FileText size={14} className="text-zinc-600" />}
                  {song.key && (
                    <div className="px-3 py-1 rounded-full bg-gradient-to-r from-violet-600/20 to-fuchsia-600/20 text-violet-300 text-xs font-bold">
                      {song.key}
                    </div>
                  )}
                  <ArrowUpRight size={16} className="text-zinc-600 group-hover:text-white transition-colors" />
                </div>
              </div>
            </div>
          </Link>
        ))}
        {songs.length === 0 && (
          <div className="glass rounded-2xl p-12 text-center text-zinc-500">No songs yet</div>
        )}
      </div>
    </div>
  );
}
