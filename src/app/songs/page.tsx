'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Search, Music2, ArrowUpRight, Filter, X, Radio } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface SongRow {
  id: string;
  title: string;
  artist: string | null;
  key: string | null;
  bpm: number | null;
  set_id: string;
  sets: {
    id: string;
    name: string;
    event_id: string;
    events: {
      id: string;
      name: string;
      conference_id: string;
      conferences: {
        id: string;
        name: string;
      } | null;
    } | null;
  } | null;
}

type SortBy = 'title' | 'artist' | 'key' | 'bpm' | 'recent';

export default function SongsLibraryPage() {
  const [songs, setSongs] = useState<SongRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [keyFilter, setKeyFilter] = useState<string | null>(null);
  const [confFilter, setConfFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>('title');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetch('/api/songs?all=1')
      .then(r => r.json())
      .then(data => {
        setSongs(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Build unique key + conference filter options
  const allKeys = useMemo(() => {
    const set = new Set<string>();
    songs.forEach(s => { if (s.key) set.add(s.key); });
    return [...set].sort();
  }, [songs]);

  const allConferences = useMemo(() => {
    const map = new Map<string, string>();
    songs.forEach(s => {
      const conf = s.sets?.events?.conferences;
      if (conf) map.set(conf.id, conf.name);
    });
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [songs]);

  // Apply filters and sort
  const filtered = useMemo(() => {
    let result = songs;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(s =>
        s.title.toLowerCase().includes(q) ||
        (s.artist || '').toLowerCase().includes(q)
      );
    }
    if (keyFilter) result = result.filter(s => s.key === keyFilter);
    if (confFilter) result = result.filter(s => s.sets?.events?.conferences?.id === confFilter);

    // Sort
    return [...result].sort((a, b) => {
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      if (sortBy === 'artist') return (a.artist || '').localeCompare(b.artist || '');
      if (sortBy === 'key') return (a.key || '').localeCompare(b.key || '');
      if (sortBy === 'bpm') return (a.bpm || 0) - (b.bpm || 0);
      return 0;
    });
  }, [songs, search, keyFilter, confFilter, sortBy]);

  const hasActiveFilters = keyFilter || confFilter || search;

  const buildSongLink = (song: SongRow) => {
    const conf = song.sets?.events?.conferences;
    const event = song.sets?.events;
    const set = song.sets;
    if (!conf || !event || !set) return `/live/${song.id}`;
    return `/conference/${conf.id}/event/${event.id}/set/${set.id}/song/${song.id}`;
  };

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass text-xs text-zinc-400">
          <Music2 size={12} className="text-violet-400" />
          Library · {songs.length} songs
        </div>
        <h1 className="text-4xl font-bold tracking-tight">
          <span className="gradient-text">All songs</span>
        </h1>
        <p className="text-zinc-400">Search and jump to any song without digging through events.</p>
      </div>

      {/* Search + filter bar */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title or artist…"
              className="pl-9 bg-zinc-900/50 border-zinc-800 h-11"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2.5 rounded-xl transition-colors ${
              showFilters || hasActiveFilters
                ? 'bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/40'
                : 'bg-white/5 text-zinc-400 hover:bg-white/10'
            }`}
          >
            <Filter size={18} />
          </button>
        </div>

        {showFilters && (
          <div className="glass rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-zinc-500">Filters</span>
              {hasActiveFilters && (
                <button
                  onClick={() => { setKeyFilter(null); setConfFilter(null); setSearch(''); }}
                  className="text-xs text-zinc-500 hover:text-zinc-300"
                >
                  Clear all
                </button>
              )}
            </div>

            {/* Key chips */}
            {allKeys.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-zinc-600 mb-1.5">Key</div>
                <div className="flex flex-wrap gap-1">
                  {allKeys.map(k => (
                    <button
                      key={k}
                      onClick={() => setKeyFilter(keyFilter === k ? null : k)}
                      className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold ${
                        keyFilter === k
                          ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white'
                          : 'bg-white/5 text-zinc-300 hover:bg-white/10'
                      }`}
                    >
                      {k}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Conference chips */}
            {allConferences.length > 1 && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-zinc-600 mb-1.5">Conference</div>
                <div className="flex flex-wrap gap-1">
                  {allConferences.map(c => (
                    <button
                      key={c.id}
                      onClick={() => setConfFilter(confFilter === c.id ? null : c.id)}
                      className={`px-2.5 py-1 rounded-full text-xs ${
                        confFilter === c.id
                          ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white'
                          : 'bg-white/5 text-zinc-300 hover:bg-white/10'
                      }`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Sort */}
            <div>
              <div className="text-[10px] uppercase tracking-wider text-zinc-600 mb-1.5">Sort by</div>
              <div className="flex gap-1">
                {(['title', 'artist', 'key', 'bpm'] as SortBy[]).map(s => (
                  <button
                    key={s}
                    onClick={() => setSortBy(s)}
                    className={`px-2.5 py-1 rounded-full text-xs capitalize ${
                      sortBy === s
                        ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white'
                        : 'bg-white/5 text-zinc-300 hover:bg-white/10'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Results count */}
      {!loading && (
        <div className="text-xs text-zinc-500">
          {filtered.length} {filtered.length === 1 ? 'song' : 'songs'}{hasActiveFilters ? ' (filtered)' : ''}
        </div>
      )}

      {/* Song list */}
      {loading ? (
        <div className="text-center py-20 text-zinc-500">Loading library…</div>
      ) : filtered.length === 0 ? (
        <div className="glass rounded-3xl p-16 text-center text-zinc-500">
          <Music2 size={32} className="mx-auto mb-2 opacity-50" />
          <p>No songs match your filters</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((song, i) => (
            <div key={song.id} className="glass rounded-2xl overflow-hidden group hover:scale-[1.005] transition-transform">
              <div className="flex items-center gap-3 p-3">
                <div className="text-xs text-zinc-600 font-mono w-8 text-right shrink-0">
                  {String(i + 1).padStart(2, '0')}
                </div>
                <Link
                  href={buildSongLink(song)}
                  className="flex items-center gap-3 flex-1 min-w-0"
                >
                  <div className="p-2 rounded-lg bg-violet-500/10 shrink-0">
                    <Music2 size={14} className="text-violet-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{song.title}</div>
                    <div className="text-xs text-zinc-500 truncate">
                      {song.artist || '—'}
                      {song.sets?.events?.conferences?.name && (
                        <span className="ml-2 text-zinc-600">· {song.sets.events.conferences.name}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {song.key && (
                      <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-violet-600/20 to-fuchsia-600/20 text-violet-300 text-xs font-bold">
                        {song.key}
                      </span>
                    )}
                    {song.bpm && (
                      <span className="text-xs text-zinc-500 font-mono">{song.bpm}</span>
                    )}
                  </div>
                </Link>
                <Link
                  href={`/live/${song.id}`}
                  className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 shrink-0"
                  title="Open in Live Mode"
                >
                  <Radio size={14} />
                </Link>
                <Link
                  href={buildSongLink(song)}
                  className="p-2 rounded-lg hover:bg-white/5 text-zinc-500 hover:text-white shrink-0"
                  title="Open"
                >
                  <ArrowUpRight size={14} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
