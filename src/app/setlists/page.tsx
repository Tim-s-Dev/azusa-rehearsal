'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Plus, Trash2, GripVertical, Search, X, Music2, Radio, Save, ChevronDown, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface SetlistRow {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  setlist_songs: { count: number }[] | SetlistSongRow[];
}

interface SetlistSongRow {
  id: string;
  song_id: string;
  sort_order: number;
  key_override: string | null;
  notes: string | null;
  songs: {
    id: string;
    title: string;
    artist: string | null;
    key: string | null;
    bpm: number | null;
  };
}

interface SongOption {
  id: string;
  title: string;
  artist: string | null;
  key: string | null;
  bpm: number | null;
}

const KEYS = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B',
  'Cm', 'C#m', 'Dm', 'D#m', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'A#m', 'Bbm', 'Bm'];

export default function SetlistsPage() {
  const [setlists, setSetlists] = useState<SetlistRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeSetlist, setActiveSetlist] = useState<SetlistRow | null>(null);
  const [allSongs, setAllSongs] = useState<SongOption[]>([]);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const loadSetlists = () => fetch('/api/setlists').then(r => r.json()).then(d => { setSetlists(Array.isArray(d) ? d : []); setLoading(false); });

  useEffect(() => { loadSetlists(); }, []);

  // Load all songs for the "add song" search
  useEffect(() => {
    fetch('/api/songs?all=1').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setAllSongs(d.map((s: SongOption) => ({ id: s.id, title: s.title, artist: s.artist, key: s.key, bpm: s.bpm })));
    });
  }, []);

  const loadSetlist = (id: string) => {
    setActiveId(id);
    fetch(`/api/setlists?id=${id}`).then(r => r.json()).then(setActiveSetlist);
  };

  const createSetlist = async () => {
    if (!newName.trim()) return;
    const res = await fetch('/api/setlists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() }),
    });
    const data = await res.json();
    setNewName('');
    setShowCreate(false);
    await loadSetlists();
    loadSetlist(data.id);
  };

  const deleteSetlist = async (id: string) => {
    await fetch(`/api/setlists?id=${id}`, { method: 'DELETE' });
    if (activeId === id) { setActiveId(null); setActiveSetlist(null); }
    loadSetlists();
  };

  const songs = (activeSetlist?.setlist_songs || []) as SetlistSongRow[];

  const saveOrder = useCallback(async (updatedSongs: SetlistSongRow[]) => {
    if (!activeId) return;
    setSaving(true);
    await fetch('/api/setlists', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: activeId,
        songs: updatedSongs.map((s, i) => ({
          song_id: s.song_id,
          sort_order: i,
          key_override: s.key_override,
          notes: s.notes,
        })),
      }),
    });
    setSaving(false);
    loadSetlist(activeId);
  }, [activeId]);

  const addSong = async (songId: string) => {
    const updated = [...songs, {
      id: '', song_id: songId, sort_order: songs.length,
      key_override: null, notes: null,
      songs: allSongs.find(s => s.id === songId)!,
    } as SetlistSongRow];
    await saveOrder(updated);
    setSearch('');
  };

  const removeSong = async (idx: number) => {
    const updated = songs.filter((_, i) => i !== idx);
    await saveOrder(updated);
  };

  const updateKeyOverride = (idx: number, key: string | null) => {
    const updated = [...songs];
    updated[idx] = { ...updated[idx], key_override: key };
    setActiveSetlist(prev => prev ? { ...prev, setlist_songs: updated } : null);
    // Debounce save
    saveOrder(updated);
  };

  const reorder = (from: number, to: number) => {
    if (from === to) return;
    const updated = [...songs];
    const [moved] = updated.splice(from, 1);
    updated.splice(to, 0, moved);
    setActiveSetlist(prev => prev ? { ...prev, setlist_songs: updated } : null);
    saveOrder(updated);
  };

  const filteredSongs = search.trim()
    ? allSongs.filter(s => {
        const q = search.toLowerCase();
        const inSetlist = songs.some(ss => ss.song_id === s.id);
        return !inSetlist && (s.title.toLowerCase().includes(q) || (s.artist || '').toLowerCase().includes(q));
      })
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            <span className="gradient-text">Setlists</span>
          </h1>
          <p className="text-zinc-400 text-sm mt-1">Build custom setlists, set keys per song, drag to reorder</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:scale-105 transition-transform text-white text-sm font-medium shadow-lg shadow-violet-600/20"
        >
          <Plus size={16} /> New Setlist
        </button>
      </div>

      {showCreate && (
        <div className="glass rounded-2xl p-4 flex gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Setlist name…"
            className="bg-zinc-900/50 border-zinc-800"
            onKeyDown={(e) => e.key === 'Enter' && createSetlist()}
            autoFocus
          />
          <Button onClick={createSetlist}>Create</Button>
        </div>
      )}

      <div className="grid md:grid-cols-[300px_1fr] gap-4">
        {/* Setlist list */}
        <div className="space-y-2">
          {loading ? (
            <div className="text-zinc-500 text-center py-8">Loading…</div>
          ) : setlists.length === 0 ? (
            <div className="glass rounded-2xl p-8 text-center text-zinc-500">
              <Music2 size={24} className="mx-auto mb-2 opacity-50" />
              No setlists yet
            </div>
          ) : (
            setlists.map(sl => {
              const count = Array.isArray(sl.setlist_songs) ? sl.setlist_songs.length : 0;
              const isActive = activeId === sl.id;
              return (
                <button
                  key={sl.id}
                  onClick={() => loadSetlist(sl.id)}
                  className={`w-full text-left glass rounded-xl p-3 transition-all ${
                    isActive ? 'ring-2 ring-violet-400/60' : 'hover:scale-[1.01]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{sl.name}</div>
                      <div className="text-xs text-zinc-500">{count} songs</div>
                    </div>
                    <div className="flex gap-1">
                      {isActive && (
                        <Link
                          href={`/live/${songs[0]?.song_id || ''}`}
                          className="p-1.5 rounded bg-red-500/10 text-red-300 hover:bg-red-500/20"
                          title="Open in Live Mode"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Radio size={14} />
                        </Link>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteSetlist(sl.id); }}
                        className="p-1.5 rounded text-zinc-500 hover:text-red-400 hover:bg-white/5"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Active setlist editor */}
        {activeSetlist ? (
          <div className="glass rounded-2xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">{activeSetlist.name}</h2>
              <div className="text-xs text-zinc-500">
                {saving ? 'Saving…' : `${songs.length} songs`}
              </div>
            </div>

            {/* Song list */}
            <div className="space-y-1">
              {songs.map((ss, i) => {
                const song = ss.songs;
                if (!song) return null;
                const displayKey = ss.key_override || song.key || '?';
                const isDragging = dragIdx === i;
                const isDragOver = dragOverIdx === i && dragIdx !== i;
                return (
                  <div
                    key={ss.id || i}
                    draggable
                    onDragStart={() => setDragIdx(i)}
                    onDragOver={(e) => { e.preventDefault(); if (dragOverIdx !== i) setDragOverIdx(i); }}
                    onDragLeave={() => { if (dragOverIdx === i) setDragOverIdx(null); }}
                    onDrop={(e) => { e.preventDefault(); if (dragIdx !== null) reorder(dragIdx, i); setDragIdx(null); setDragOverIdx(null); }}
                    onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
                    className={`flex items-center gap-2 p-2 rounded-xl transition-all ${
                      isDragging ? 'opacity-40' : ''
                    } ${isDragOver ? 'ring-2 ring-violet-400 bg-violet-500/10' : 'hover:bg-white/5'}`}
                  >
                    <div className="cursor-grab active:cursor-grabbing text-zinc-600 hover:text-zinc-300 shrink-0">
                      <GripVertical size={14} />
                    </div>
                    <div className="text-xs font-mono text-zinc-600 w-6 text-right shrink-0">
                      {i + 1}
                    </div>
                    <Link href={`/live/${song.id}`} className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">{song.title}</div>
                      {song.artist && <div className="text-xs text-zinc-500 truncate">{song.artist}</div>}
                    </Link>
                    {/* Editable key */}
                    <select
                      value={displayKey}
                      onChange={(e) => updateKeyOverride(i, e.target.value === song.key ? null : e.target.value)}
                      className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-xs font-bold text-violet-300 w-16 text-center"
                      title="Key (tap to change)"
                    >
                      {KEYS.map(k => (
                        <option key={k} value={k}>{k}</option>
                      ))}
                    </select>
                    {song.bpm && <span className="text-xs text-zinc-500 font-mono shrink-0">{song.bpm}</span>}
                    <button
                      onClick={() => removeSong(i)}
                      className="p-1 rounded text-zinc-500 hover:text-red-400 shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Add song search */}
            <div className="space-y-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search songs to add…"
                  className="pl-9 bg-zinc-900/50 border-zinc-800"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500">
                    <X size={14} />
                  </button>
                )}
              </div>
              {filteredSongs.length > 0 && (
                <div className="glass rounded-xl max-h-48 overflow-y-auto">
                  {filteredSongs.slice(0, 20).map(s => (
                    <button
                      key={s.id}
                      onClick={() => addSong(s.id)}
                      className="w-full text-left px-3 py-2 hover:bg-white/5 flex items-center gap-2 text-sm border-b border-white/5 last:border-0"
                    >
                      <Plus size={12} className="text-emerald-400 shrink-0" />
                      <span className="truncate flex-1">{s.title}</span>
                      {s.key && <span className="text-xs text-violet-300 shrink-0">{s.key}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="glass rounded-2xl p-12 text-center text-zinc-500">
            <Music2 size={32} className="mx-auto mb-2 opacity-50" />
            <p>Select a setlist or create a new one</p>
          </div>
        )}
      </div>
    </div>
  );
}
