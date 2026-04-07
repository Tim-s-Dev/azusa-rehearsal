'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Plus, Music2, FileText, Hash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
    <div className="space-y-6">
      <Link href={`/conference/${confId}/event/${eventId}`} className="flex items-center gap-1 text-zinc-500 hover:text-zinc-300 text-sm">
        <ArrowLeft size={16} /> Back to Sets
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{set?.name || 'Loading...'}</h1>
          <p className="text-zinc-400 text-sm mt-1">{songs.length} song{songs.length !== 1 ? 's' : ''}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger className="inline-flex items-center justify-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Plus size={14} /> Song
          </DialogTrigger>
          <DialogContent className="bg-zinc-900 border-zinc-700">
            <DialogHeader><DialogTitle>New Song</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Song Title" value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="bg-zinc-800 border-zinc-700" />
              <Input placeholder="Artist" value={form.artist} onChange={e => setForm({...form, artist: e.target.value})} className="bg-zinc-800 border-zinc-700" />
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Key (e.g. G, Bb)" value={form.key} onChange={e => setForm({...form, key: e.target.value})} className="bg-zinc-800 border-zinc-700" />
                <Input placeholder="BPM" type="number" value={form.bpm} onChange={e => setForm({...form, bpm: e.target.value})} className="bg-zinc-800 border-zinc-700" />
              </div>
              <Button onClick={create} className="w-full">Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {songs.map((song, i) => (
          <Link key={song.id} href={`/conference/${confId}/event/${eventId}/set/${setId}/song/${song.id}`}>
            <Card className="p-4 bg-zinc-900 border-zinc-800 hover:border-indigo-500/50 transition-colors cursor-pointer">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-zinc-600 text-sm font-mono w-5">{i + 1}</span>
                  <div>
                    <h3 className="font-semibold text-white">{song.title}</h3>
                    {song.artist && <p className="text-sm text-zinc-500">{song.artist}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {song.key && (
                    <Badge variant="outline" className="text-indigo-400 border-indigo-500/30">
                      {song.key}
                    </Badge>
                  )}
                  {song.notes && <FileText size={14} className="text-zinc-500" />}
                </div>
              </div>
            </Card>
          </Link>
        ))}
        {songs.length === 0 && (
          <p className="text-center py-12 text-zinc-500">No songs yet. Add one to get started.</p>
        )}
      </div>
    </div>
  );
}
