'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Plus, Trash2, Search, X, Music2, Radio, Save, ChevronDown, ChevronRight, Pencil, Download } from 'lucide-react';
import AddSongDialog from '@/components/AddSongDialog';
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
  const [editingName, setEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [showAddNewSong, setShowAddNewSong] = useState(false);
  const [eventSets, setEventSets] = useState<{ setId: string; setName: string; eventName: string; confName: string; songs: SongOption[] }[]>([]);

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

  const renameSetlist = async () => {
    if (!activeId || !editNameValue.trim()) return;
    await fetch('/api/setlists', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: activeId, name: editNameValue.trim() }),
    });
    setEditingName(false);
    loadSetlists();
    loadSetlist(activeId);
  };

  const loadEventSets = async () => {
    setShowImport(true);
    // Get all sets with their songs + event + conference info
    const res = await fetch('/api/sets');
    const sets = await res.json();
    if (!Array.isArray(sets)) return;
    const result: typeof eventSets = [];
    for (const s of sets) {
      const songsRes = await fetch(`/api/songs?set_id=${s.id}`);
      const setSongs = await songsRes.json();
      // Get event name
      let eventName = '';
      let confName = '';
      if (s.event_id) {
        const evRes = await fetch(`/api/events?id=${s.event_id}`);
        const ev = await evRes.json();
        if (ev) {
          eventName = ev.name || '';
          if (ev.conference_id) {
            const confRes = await fetch(`/api/conferences`);
            const confs = await confRes.json();
            const conf = Array.isArray(confs) ? confs.find((c: { id: string }) => c.id === ev.conference_id) : null;
            confName = conf?.name || '';
          }
        }
      }
      if (Array.isArray(setSongs) && setSongs.length > 0) {
        result.push({
          setId: s.id,
          setName: s.name,
          eventName,
          confName,
          songs: setSongs.map((ss: SongOption) => ({ id: ss.id, title: ss.title, artist: ss.artist, key: ss.key, bpm: ss.bpm })),
        });
      }
    }
    setEventSets(result);
  };

  const importSet = async (set: typeof eventSets[number]) => {
    // Add all songs from the set that aren't already in the setlist
    const existing = new Set(songs.map(s => s.song_id));
    const toAdd = set.songs.filter(s => !existing.has(s.id));
    if (toAdd.length === 0) return;
    const updated = [...songs, ...toAdd.map((s, i) => ({
      id: '', song_id: s.id, sort_order: songs.length + i,
      key_override: null, notes: null,
      songs: s,
    } as SetlistSongRow))];
    await saveOrder(updated);
    setShowImport(false);
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
            {/* Editable name */}
            <div className="flex items-center justify-between gap-2">
              {editingName ? (
                <div className="flex items-center gap-2 flex-1">
                  <Input
                    value={editNameValue}
                    onChange={(e) => setEditNameValue(e.target.value)}
                    className="bg-zinc-900/50 border-zinc-800 text-xl font-bold"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && renameSetlist()}
                  />
                  <Button size="sm" onClick={renameSetlist}>Save</Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingName(false)}>Cancel</Button>
                </div>
              ) : (
                <button
                  onClick={() => { setEditingName(true); setEditNameValue(activeSetlist.name); }}
                  className="text-xl font-bold flex items-center gap-2 hover:text-violet-300 transition-colors"
                >
                  {activeSetlist.name} <Pencil size={14} className="text-zinc-500" />
                </button>
              )}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={loadEventSets}
                  className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-zinc-300 flex items-center gap-1"
                  title="Import songs from an event set"
                >
                  <Download size={12} /> Import Set
                </button>
                <div className="text-xs text-zinc-500">
                  {saving ? 'Saving…' : `${songs.length} songs`}
                </div>
              </div>
            </div>

            {/* Song list */}
            <div className="space-y-1">
              {songs.map((ss, i) => {
                const song = ss.songs;
                if (!song) return null;
                const displayKey = ss.key_override || song.key || '?';
                return (
                  <div
                    key={ss.id || i}
                    className="flex items-center gap-2 p-2 rounded-xl hover:bg-white/5"
                  >
                    <div className="flex flex-col shrink-0">
                      <button
                        onClick={() => { if (i > 0) reorder(i, i - 1); }}
                        disabled={i === 0}
                        className="p-0.5 text-zinc-600 hover:text-zinc-300 disabled:opacity-20"
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 2L2 7h8L6 2z" fill="currentColor"/></svg>
                      </button>
                      <button
                        onClick={() => { if (i < songs.length - 1) reorder(i, i + 1); }}
                        disabled={i >= songs.length - 1}
                        className="p-0.5 text-zinc-600 hover:text-zinc-300 disabled:opacity-20"
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 10L2 5h8L6 10z" fill="currentColor"/></svg>
                      </button>
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
              <button
                onClick={() => setShowAddNewSong(true)}
                className="w-full px-3 py-2 rounded-xl border-2 border-dashed border-white/10 hover:border-violet-500/50 text-xs text-zinc-400 hover:text-white transition-colors flex items-center justify-center gap-1"
              >
                <Plus size={12} /> Create New Song
              </button>
              {showAddNewSong && (
                <AddSongDialog
                  onCreated={(song) => {
                    setShowAddNewSong(false);
                    // Add the new song to allSongs + to the setlist
                    setAllSongs(prev => [...prev, song]);
                    addSong(song.id);
                  }}
                  onClose={() => setShowAddNewSong(false)}
                />
              )}
            </div>

            {/* Import from event sets */}
            {showImport && (
              <div className="glass rounded-xl p-3 space-y-2 border border-violet-500/30">
                <div className="flex items-center justify-between">
                  <div className="text-xs uppercase tracking-wider text-violet-400">Import from event sets</div>
                  <button onClick={() => setShowImport(false)} className="p-1 hover:bg-white/10 rounded"><X size={14} /></button>
                </div>
                {eventSets.length === 0 ? (
                  <div className="text-xs text-zinc-500 text-center py-4">Loading sets…</div>
                ) : (
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {eventSets.map(es => (
                      <button
                        key={es.setId}
                        onClick={() => importSet(es)}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/5 border border-white/5"
                      >
                        <div className="font-semibold text-sm">{es.setName}</div>
                        <div className="text-[10px] text-zinc-500">{es.confName} · {es.eventName} · {es.songs.length} songs</div>
                        <div className="text-[10px] text-zinc-600 truncate mt-0.5">
                          {es.songs.map(s => s.title).join(', ')}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
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
