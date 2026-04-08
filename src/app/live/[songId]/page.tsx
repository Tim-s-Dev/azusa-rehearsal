'use client';

import { useEffect, useState, useRef, useMemo, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Play, Pause, X, Pencil, MessageSquare, Mic } from 'lucide-react';
import type { Song, SongFile, ChartItem, SongStructureSection, ChartMeasure, ChartNote, ChartLyric } from '@/lib/types';
import { isMeasure, SECTION_COLORS, normalizeSectionType } from '@/lib/types';
import { groupMeasuresBySection } from '@/lib/structure';
import { usePlayer } from '@/components/PlayerProvider';

interface LivePageProps {
  params: Promise<{ songId: string }>;
}

function formatTime(s: number) {
  if (!isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function normalizeStructure(raw: unknown): SongStructureSection[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((s: Record<string, unknown>) => {
    const name = (s.name as string) || (s.label as string) || 'Section';
    return {
      name,
      type: (s.type as SongStructureSection['type']) || normalizeSectionType(name),
      start: typeof s.start === 'number' ? s.start : 0,
      end: typeof s.end === 'number' ? s.end : 0,
      markers: Array.isArray(s.markers) ? (s.markers as SongStructureSection['markers']) : [],
    };
  });
}

export default function LivePage({ params }: LivePageProps) {
  const { songId } = use(params);
  const router = useRouter();
  const player = usePlayer();

  const [song, setSong] = useState<Song | null>(null);
  const [files, setFiles] = useState<SongFile[]>([]);
  const [items, setItems] = useState<ChartItem[]>([]);
  const [setSongs, setSetSongs] = useState<Song[]>([]);
  const [confInfo, setConfInfo] = useState<{ confId: string; eventId: string; setId: string } | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const lastManualScrollRef = useRef(0);
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Load song + files + chart
  useEffect(() => {
    fetch(`/api/songs?id=${songId}`).then(r => r.json()).then(setSong);
    fetch(`/api/files?song_id=${songId}`).then(r => r.json()).then(setFiles);
    fetch(`/api/charts?song_id=${songId}`).then(r => r.json()).then(d => {
      if (d?.chart_data) setItems(d.chart_data);
    });
  }, [songId]);

  // Load other songs in the same set + the parent path so we can navigate
  useEffect(() => {
    if (!song?.set_id) return;
    fetch(`/api/songs?set_id=${song.set_id}`).then(r => r.json()).then(setSetSongs);
    // Find the conf/event hierarchy for the back-link
    fetch(`/api/sets?id=${song.set_id}`).then(r => r.ok ? r.json() : null).then(s => {
      if (!s || !s.event_id) return;
      fetch(`/api/events?id=${s.event_id}`).then(r => r.ok ? r.json() : null).then(ev => {
        if (!ev || !ev.conference_id) return;
        setConfInfo({ confId: ev.conference_id, eventId: s.event_id, setId: song.set_id });
      });
    }).catch(() => {});
  }, [song?.set_id]);

  // Auto-load song into player when entering live mode
  useEffect(() => {
    if (!song || files.length === 0) return;
    const audioFiles = files.filter(f => f.file_type === 'audio');
    if (audioFiles.length === 0) return;
    const arrangement = audioFiles.find(f => /arrangement|full|mix|master/i.test(f.name)) || audioFiles[0];
    const idx = audioFiles.indexOf(arrangement);
    player.loadSong(
      { id: song.id, title: song.title, artist: song.artist, href: `/live/${song.id}` },
      audioFiles,
      idx
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song?.id, files.length]);

  const isCurrentSong = player.song?.id === song?.id;
  const currentTime = isCurrentSong ? player.currentTime : 0;

  // Group items by section
  const groups = useMemo(() => groupMeasuresBySection(items), [items]);
  const structure = useMemo(() => normalizeStructure(song?.structure), [song?.structure]);

  // Find which section is currently playing
  const currentSectionIdx = useMemo(() => {
    if (!isCurrentSong || currentTime === 0) return -1;
    return structure.findIndex(s => currentTime >= s.start && currentTime < s.end);
  }, [structure, currentTime, isCurrentSong]);

  // Auto-scroll to current section
  useEffect(() => {
    if (!autoScroll || currentSectionIdx < 0) return;
    if (Date.now() - lastManualScrollRef.current < 5000) return;
    sectionRefs.current[currentSectionIdx]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [currentSectionIdx, autoScroll]);

  // Detect manual scroll to pause auto-scroll briefly
  useEffect(() => {
    const onScroll = () => { lastManualScrollRef.current = Date.now(); };
    window.addEventListener('wheel', onScroll, { passive: true });
    window.addEventListener('touchmove', onScroll, { passive: true });
    return () => {
      window.removeEventListener('wheel', onScroll);
      window.removeEventListener('touchmove', onScroll);
    };
  }, []);

  // Prev/next song nav (in same set)
  const sortedSetSongs = useMemo(
    () => [...setSongs].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
    [setSongs]
  );
  const currentIdx = sortedSetSongs.findIndex(s => s.id === songId);
  const prevSong = currentIdx > 0 ? sortedSetSongs[currentIdx - 1] : null;
  const nextSong = currentIdx >= 0 && currentIdx < sortedSetSongs.length - 1 ? sortedSetSongs[currentIdx + 1] : null;

  const navigate = (target: Song | null) => {
    if (!target) return;
    router.push(`/live/${target.id}`);
  };

  // Swipe navigation (touch)
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;
    if (Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy) * 2) {
      if (dx < 0 && nextSong) navigate(nextSong);
      else if (dx > 0 && prevSong) navigate(prevSong);
    }
    touchStart.current = null;
  };

  if (!song) {
    return <div className="text-center text-zinc-500 py-20">Loading song…</div>;
  }

  return (
    <div className="min-h-screen pb-32" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {/* Top bar */}
      <div className="sticky top-0 z-30 glass border-b border-white/10 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-3 py-2 flex items-center gap-2">
          <Link
            href={confInfo ? `/conference/${confInfo.confId}/event/${confInfo.eventId}/set/${confInfo.setId}/song/${songId}` : '/'}
            className="p-2 rounded-lg hover:bg-white/10"
            title="Exit Live Mode"
          >
            <X size={16} />
          </Link>
          <div className="flex-1 min-w-0 text-center">
            <div className="text-[10px] uppercase tracking-widest text-violet-400">LIVE</div>
            <div className="text-sm font-bold truncate">{song.title}</div>
          </div>
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`px-2 py-1 rounded text-[10px] font-bold ${autoScroll ? 'bg-violet-500/30 text-violet-200' : 'bg-white/5 text-zinc-500'}`}
            title="Auto-scroll to current section"
          >
            AUTO
          </button>
        </div>
      </div>

      {/* Hero */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-3 mb-2">
            {song.key && (
              <span className="px-3 py-1 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white text-sm font-bold">
                KEY · {song.key}
              </span>
            )}
            {song.bpm && (
              <span className="px-3 py-1 rounded-full glass text-sm font-mono">
                {song.bpm} BPM
              </span>
            )}
          </div>
          <h1 className="text-5xl font-bold tracking-tight">{song.title}</h1>
          {song.artist && <p className="text-zinc-400 mt-1">{song.artist}</p>}
        </div>

        {/* Big chart */}
        <div className="space-y-6">
          {groups.length === 0 ? (
            <div className="glass rounded-3xl p-12 text-center text-zinc-500">
              No chart yet. Open the song&apos;s Chart tab to fill it in or run AI dissect.
            </div>
          ) : (
            groups.map((group, gIdx) => {
              const struct = structure[gIdx];
              const colors = SECTION_COLORS[group.type];
              const isCurrent = gIdx === currentSectionIdx;
              return (
                <div
                  key={gIdx}
                  ref={(el) => { sectionRefs.current[gIdx] = el; }}
                  className={`glass rounded-3xl p-6 transition-all ${
                    isCurrent ? `ring-4 ring-violet-400/60 ${colors.glow} shadow-2xl` : ''
                  }`}
                >
                  <div className="flex items-baseline justify-between mb-4">
                    <h2 className={`text-2xl font-bold uppercase tracking-wider ${colors.text}`}>
                      {group.sectionLabel}
                    </h2>
                    {struct && (
                      <span className="text-sm font-mono text-zinc-500">
                        {formatTime(struct.start)}–{formatTime(struct.end)}
                      </span>
                    )}
                  </div>
                  {/* Render items inside this group */}
                  <div className="space-y-2">
                    {group.measures.map((item, iIdx) => {
                      if (item.type === 'note') {
                        const note = item as ChartNote;
                        const color = note.color || 'violet';
                        return (
                          <div key={iIdx} className={`rounded-lg bg-${color}-500/10 border-l-4 border-${color}-500/40 px-3 py-2 flex items-center gap-2`}>
                            <MessageSquare size={14} className={`text-${color}-300 shrink-0`} />
                            <span className={`font-mono text-base text-${color}-200`}>{note.text}</span>
                          </div>
                        );
                      }
                      if (item.type === 'lyric') {
                        const lyric = item as ChartLyric;
                        return (
                          <div key={iIdx} className="px-3 flex items-center gap-2">
                            <Mic size={12} className="text-zinc-600 shrink-0" />
                            <span className="text-base italic text-zinc-400">{lyric.text}</span>
                          </div>
                        );
                      }
                      const measure = item as ChartMeasure;
                      if (measure.out) {
                        return (
                          <div key={iIdx} className="rounded-lg border border-zinc-800 bg-zinc-900/30 text-zinc-600 font-mono text-sm uppercase tracking-widest text-center py-3">
                            ◎ OUT
                          </div>
                        );
                      }
                      return (
                        <div key={iIdx} className="grid grid-cols-4 gap-2">
                          {measure.beats.map((beat, bIdx) => (
                            <div
                              key={bIdx}
                              className={`h-16 rounded-lg border flex items-center justify-center font-mono font-bold ${
                                beat
                                  ? 'bg-zinc-900 border-zinc-700 text-2xl text-white'
                                  : 'bg-zinc-900/30 border-zinc-800 text-zinc-700'
                              }`}
                            >
                              {beat || '·'}
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Bottom nav bar */}
      <div className="fixed bottom-24 left-0 right-0 z-40 px-4">
        <div className="max-w-4xl mx-auto glass rounded-2xl p-2 flex items-center gap-2 shadow-2xl shadow-black/50">
          <button
            onClick={() => navigate(prevSong)}
            disabled={!prevSong}
            className="p-3 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <ChevronLeft size={20} />
            <span className="text-xs hidden sm:block max-w-[120px] truncate">{prevSong?.title || 'Start'}</span>
          </button>
          <div className="flex-1 text-center">
            <div className="text-[10px] uppercase tracking-widest text-zinc-500">
              {currentIdx + 1} / {sortedSetSongs.length}
            </div>
            <button
              onClick={() => isCurrentSong && player.togglePlay()}
              className="p-2.5 rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-600/30"
            >
              {player.isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
            </button>
          </div>
          <button
            onClick={() => navigate(nextSong)}
            disabled={!nextSong}
            className="p-3 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <span className="text-xs hidden sm:block max-w-[120px] truncate">{nextSong?.title || 'End'}</span>
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
