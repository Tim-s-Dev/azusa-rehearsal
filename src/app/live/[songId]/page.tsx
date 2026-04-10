'use client';

import { useEffect, useState, useRef, useMemo, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Play, Pause, X, Pencil, MessageSquare, Mic, Save, Repeat, Circle } from 'lucide-react';
import type { Song, SongFile, ChartItem, SongStructureSection, ChartMeasure, ChartNote, ChartLyric } from '@/lib/types';
import { isMeasure, SECTION_COLORS, normalizeSectionType } from '@/lib/types';
import { groupMeasuresBySection } from '@/lib/structure';
import { usePlayer } from '@/components/PlayerProvider';
import { useKeypad } from '@/components/KeypadProvider';

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
  const [scrollSpeed, setScrollSpeed] = useState(1); // multiplier: 0.5x 1x 2x
  const [editMode, setEditMode] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loopA, setLoopA] = useState<number | null>(null);
  const [loopB, setLoopB] = useState<number | null>(null);
  const [recording, setRecording] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const autoScrollTimerRef = useRef<number | null>(null);
  const keypad = useKeypad();
  const lastManualScrollRef = useRef(0);
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const itemsRef = useRef(items);
  useEffect(() => { itemsRef.current = items; }, [items]);

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

  // Continuous auto-scroll: scrolls the page at a rate based on BPM × speed multiplier
  // When the song is playing + autoScroll is on, the page teleprompter-scrolls
  useEffect(() => {
    if (!autoScroll || !player.isPlaying || !isCurrentSong) {
      if (autoScrollTimerRef.current) { cancelAnimationFrame(autoScrollTimerRef.current); autoScrollTimerRef.current = null; }
      return;
    }
    // Pixels per second: ~40px/s at 100bpm × scrollSpeed, scale linearly
    const bpm = song?.bpm || 90;
    const pxPerSec = (bpm / 100) * 40 * scrollSpeed;

    let lastT = performance.now();
    const tick = (now: number) => {
      // Pause if user touched the screen recently
      if (Date.now() - lastManualScrollRef.current > 3000) {
        const dt = (now - lastT) / 1000;
        window.scrollBy(0, pxPerSec * dt);
      }
      lastT = now;
      autoScrollTimerRef.current = requestAnimationFrame(tick);
    };
    autoScrollTimerRef.current = requestAnimationFrame(tick);
    return () => { if (autoScrollTimerRef.current) cancelAnimationFrame(autoScrollTimerRef.current); };
  }, [autoScroll, scrollSpeed, player.isPlaying, isCurrentSong, song?.bpm]);

  // Also snap to current section when it changes (in addition to continuous scroll)
  useEffect(() => {
    if (!autoScroll || currentSectionIdx < 0) return;
    if (Date.now() - lastManualScrollRef.current < 3000) return;
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

  // ── Edit mode helpers ──────────────────────────────────────────
  const saveChart = async () => {
    setSaving(true);
    await fetch('/api/charts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        song_id: songId,
        key: song?.key,
        time_signature: '4/4',
        chart_data: items,
      }),
    });
    setSaving(false);
    setDirty(false);
  };

  // Auto-save when dirty
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(saveChart, 5000);
    return () => clearTimeout(t);
  }, [dirty, items]);

  const updateBeat = (globalItemIdx: number, beatIdx: number, value: string) => {
    const next = [...itemsRef.current];
    const item = next[globalItemIdx];
    if (!isMeasure(item)) return;
    next[globalItemIdx] = { ...item, beats: item.beats.map((b, i) => i === beatIdx ? value : b) };
    setItems(next);
    setDirty(true);
  };

  // Register keypad write/value handlers when in edit mode
  useEffect(() => {
    if (!editMode) return;
    const writer = (pos: { measureIdx: number; beatIdx: number }, value: string) => {
      updateBeat(pos.measureIdx, pos.beatIdx, value);
    };
    const unsub1 = keypad.registerWriteHandler(writer);
    const getter = (pos: { measureIdx: number; beatIdx: number }) => {
      const item = itemsRef.current[pos.measureIdx];
      if (!isMeasure(item)) return undefined;
      return item.beats[pos.beatIdx] || '';
    };
    const unsub2 = keypad.registerValueGetter(getter);
    keypad.registerGrid(items.length, 4);
    return () => { unsub1(); unsub2(); };
  }, [editMode, keypad, items.length]);

  const handleCellTap = (e: React.MouseEvent, itemIdx: number, beatIdx: number) => {
    if (!editMode) return;
    e.stopPropagation();
    keypad.focusCell({ measureIdx: itemIdx, beatIdx }, e.currentTarget as HTMLElement);
  };

  const toggleEditMode = () => {
    if (editMode && dirty) saveChart();
    if (editMode) keypad.blur();
    setEditMode(!editMode);
  };

  // ── A→B Loop enforcement ───────────────────────────────────────
  useEffect(() => {
    if (!isCurrentSong || loopA === null || loopB === null) return;
    if (loopB <= loopA) return;
    if (currentTime >= loopB) {
      player.seek(loopA);
    }
  }, [currentTime, loopA, loopB, isCurrentSong, player]);

  const nudge = (seconds: number) => {
    if (!isCurrentSong) return;
    player.seek(Math.max(0, currentTime + seconds));
  };

  const setLoopPoint = (point: 'A' | 'B') => {
    if (!isCurrentSong) return;
    if (point === 'A') {
      setLoopA(currentTime);
      if (loopB !== null && currentTime >= loopB) setLoopB(null);
    } else {
      setLoopB(currentTime);
      if (loopA === null) setLoopA(0);
    }
  };

  const clearLoop = () => { setLoopA(null); setLoopB(null); };

  const loopSection = (sec: SongStructureSection) => {
    setLoopA(sec.start);
    setLoopB(sec.end);
    if (isCurrentSong) player.seek(sec.start);
  };

  const isLooping = loopA !== null && loopB !== null;

  // ── Recording: tap sections to stamp timestamps ──────────────
  const TAG_TYPES: { type: string; label: string; color: string }[] = [
    { type: 'intro', label: 'Intro', color: '#64748b' },
    { type: 'verse', label: 'Verse', color: '#3b82f6' },
    { type: 'pre-chorus', label: 'Pre', color: '#06b6d4' },
    { type: 'chorus', label: 'Chorus', color: '#8b5cf6' },
    { type: 'bridge', label: 'Bridge', color: '#d946ef' },
    { type: 'interlude', label: 'Intrlde', color: '#f59e0b' },
    { type: 'instrumental', label: 'Inst', color: '#f59e0b' },
    { type: 'tag', label: 'Tag', color: '#10b981' },
    { type: 'outro', label: 'Outro', color: '#71717a' },
  ];

  const startRecording = () => {
    setRecording(true);
    if (isCurrentSong && !player.isPlaying) player.togglePlay();
  };

  const stopRecording = async () => {
    setRecording(false);
    // Close the last open section at the current time
    if (song && structure.length > 0) {
      const last = structure[structure.length - 1];
      if (last.end <= last.start || last.end < currentTime) {
        const updated = [...structure];
        updated[updated.length - 1] = { ...last, end: currentTime };
        await fetch('/api/songs', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: songId, structure: updated }),
        });
        setSong(prev => prev ? { ...prev, structure: updated } : null);
      }
    }
  };

  const tagSection = async (type: string, label: string) => {
    if (!isCurrentSong || !song) return;
    const t = currentTime;
    const updated = [...structure];
    // Close the previous section at this time
    if (updated.length > 0) {
      const last = updated[updated.length - 1];
      updated[updated.length - 1] = { ...last, end: t };
    }
    // Add new section starting at this time
    updated.push({
      name: label,
      type: type as SongStructureSection['type'],
      start: t,
      end: t + 30, // placeholder end — will be closed by next tag or stopRecording
      markers: [],
    });
    await fetch('/api/songs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: songId, structure: updated }),
    });
    setSong(prev => prev ? { ...prev, structure: updated } : null);
  };

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
      {/* Sticky header — always visible */}
      <div className="sticky top-0 z-30 glass border-b border-white/10 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-3 py-1.5 space-y-1">
          {/* Row 1: Song info + key */}
          <div className="flex items-center gap-2">
            <Link
              href={confInfo ? `/conference/${confInfo.confId}/event/${confInfo.eventId}/set/${confInfo.setId}/song/${songId}` : '/'}
              className="p-1.5 rounded-lg hover:bg-white/10 shrink-0"
              title="Exit Live Mode"
            >
              <X size={14} />
            </Link>
            <select
              value={song.key || ''}
              onChange={async (e) => {
                const newKey = e.target.value;
                await fetch('/api/songs', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ id: songId, key: newKey }),
                });
                setSong(prev => prev ? { ...prev, key: newKey } : null);
              }}
              className="px-2 py-0.5 rounded-full bg-violet-600 text-white text-xs font-bold border border-violet-500 cursor-pointer shrink-0"
            >
              <option value="">KEY</option>
              {['C','C#','Db','D','D#','Eb','E','F','F#','Gb','G','G#','Ab','A','A#','Bb','B',
                'Cm','C#m','Dm','D#m','Ebm','Em','Fm','F#m','Gm','G#m','Am','A#m','Bbm','Bm'].map(k => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
            <div className="flex-1 min-w-0 text-center">
              <div className="text-sm font-bold truncate">{song.title}</div>
              {song.artist && <div className="text-[10px] text-zinc-500 truncate">{song.artist}</div>}
            </div>
            {song.bpm && (
              <span className="text-xs font-mono text-zinc-400 shrink-0">{song.bpm}</span>
            )}
          </div>
          {/* Row 2: Action buttons */}
          <div className="flex items-center gap-1 justify-center">
            <button
              onClick={recording ? stopRecording : startRecording}
              className={`px-2 py-0.5 rounded text-[10px] font-bold ${recording ? 'bg-red-500/30 text-red-300 animate-pulse' : 'bg-white/5 text-zinc-500'}`}
            >
              <Circle size={7} className={`inline mr-0.5 ${recording ? 'fill-red-400' : ''}`} />
              {recording ? 'REC' : 'TAG'}
            </button>
            <button
              onClick={toggleEditMode}
              className={`px-2 py-0.5 rounded text-[10px] font-bold ${editMode ? 'bg-amber-500/30 text-amber-200' : 'bg-white/5 text-zinc-500'}`}
            >
              {editMode ? (saving ? 'SAVING' : dirty ? 'EDIT ●' : 'EDIT ✓') : 'EDIT'}
            </button>
            <div className="flex items-center">
              <button
                onClick={() => setAutoScroll(!autoScroll)}
                className={`px-2 py-0.5 rounded-l text-[10px] font-bold ${autoScroll ? 'bg-violet-500/30 text-violet-200' : 'bg-white/5 text-zinc-500'}`}
              >
                {autoScroll ? '⏬' : 'SCROLL'}
              </button>
              {autoScroll && (
                <select
                  value={scrollSpeed}
                  onChange={(e) => setScrollSpeed(parseFloat(e.target.value))}
                  className="bg-violet-500/20 text-violet-200 text-[10px] font-bold rounded-r border-0 py-0.5 px-1"
                >
                  <option value={0.5}>0.5×</option>
                  <option value={1}>1×</option>
                  <option value={1.5}>1.5×</option>
                  <option value={2}>2×</option>
                  <option value={3}>3×</option>
                </select>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Chart content */}
      <div className="max-w-4xl mx-auto px-4 py-4">

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
                    <div className="flex items-center gap-2">
                      {struct && (
                        <button
                          onClick={() => loopSection(struct)}
                          className={`text-sm font-mono px-2 py-0.5 rounded transition-all ${
                            isLooping && loopA === struct.start && loopB === struct.end
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : 'text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10'
                          }`}
                          title="Loop this section"
                        >
                          <Repeat size={12} className="inline mr-1" />
                          {formatTime(struct.start)}–{formatTime(struct.end)}
                        </button>
                      )}
                    </div>
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
                      const globalIdx = group.offset + iIdx;
                      const focused = keypad.focusedCell;
                      return (
                        <div key={iIdx} className="grid grid-cols-4 gap-2">
                          {measure.beats.map((beat, bIdx) => {
                            const isFocused = editMode && focused?.measureIdx === globalIdx && focused?.beatIdx === bIdx;
                            return (
                              <button
                                key={bIdx}
                                type="button"
                                data-cell={`${globalIdx}-${bIdx}`}
                                onClick={(e) => handleCellTap(e, globalIdx, bIdx)}
                                className={`h-16 rounded-lg border flex items-center justify-center font-mono font-bold transition-all ${
                                  isFocused
                                    ? 'bg-violet-600/40 border-violet-400 ring-2 ring-violet-400/50 text-white text-2xl'
                                    : editMode
                                      ? beat
                                        ? 'bg-zinc-900 border-zinc-600 text-2xl text-white hover:border-violet-500'
                                        : 'bg-zinc-900/30 border-zinc-700 text-zinc-600 hover:border-violet-500'
                                      : beat
                                        ? 'bg-zinc-900 border-zinc-700 text-2xl text-white'
                                        : 'bg-zinc-900/30 border-zinc-800 text-zinc-700'
                                }`}
                              >
                                {beat || '·'}
                              </button>
                            );
                          })}
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

      {/* Recording tag buttons */}
      {recording && (
        <div className="fixed bottom-[220px] left-0 right-0 z-40 px-2">
          <div className="max-w-4xl mx-auto glass rounded-2xl p-2 shadow-2xl shadow-black/50 border border-red-500/30">
            <div className="text-[9px] uppercase tracking-widest text-red-400 text-center mb-1.5">
              ● REC — Tap a section as you hear it
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {TAG_TYPES.map(t => (
                <button
                  key={t.type}
                  onClick={() => tagSection(t.type, t.label)}
                  className="py-2.5 rounded-lg text-[10px] font-bold text-white transition-all active:scale-90"
                  style={{ backgroundColor: t.color + '40', borderColor: t.color, borderWidth: 1 }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Colored section progress bar */}
      {structure.length > 0 && player.duration > 0 && (
        <div className="fixed bottom-[185px] left-0 right-0 z-40 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex h-4 rounded-full overflow-hidden bg-zinc-900/80 border border-white/5 relative">
              {structure.map((sec, i) => {
                const startPct = (sec.start / player.duration) * 100;
                const widthPct = ((sec.end - sec.start) / player.duration) * 100;
                const tagDef = TAG_TYPES.find(t => t.type === sec.type) || TAG_TYPES[0];
                return (
                  <button
                    key={i}
                    onClick={() => { if (isCurrentSong) player.seek(sec.start); }}
                    className="absolute top-0 bottom-0 transition-all hover:brightness-150"
                    style={{
                      left: `${startPct}%`,
                      width: `${Math.max(widthPct, 0.5)}%`,
                      backgroundColor: tagDef.color + '60',
                      borderRight: '1px solid rgba(0,0,0,0.3)',
                    }}
                    title={`${sec.name} (${formatTime(sec.start)})`}
                  >
                    {widthPct > 6 && (
                      <span className="text-[7px] font-bold text-white/80 truncate block px-0.5 leading-4">
                        {sec.name}
                      </span>
                    )}
                  </button>
                );
              })}
              {/* Playhead */}
              {isCurrentSong && (
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-white z-10 shadow-lg shadow-white/50"
                  style={{ left: `${(currentTime / player.duration) * 100}%` }}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bottom control bar */}
      <div className="fixed bottom-24 left-0 right-0 z-40 px-2">
        <div className="max-w-4xl mx-auto glass rounded-2xl p-2 shadow-2xl shadow-black/50 space-y-2">
          {/* Row 1: Nudge + Play + Prev/Next */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigate(prevSong)}
              disabled={!prevSong}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-20"
              title="Previous song"
            >
              <ChevronLeft size={18} />
            </button>
            <button onClick={() => nudge(-15)} className="px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-bold text-zinc-300">
              −15s
            </button>
            <button onClick={() => nudge(-5)} className="px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-bold text-zinc-300">
              −5s
            </button>
            <div className="flex-1 flex justify-center">
              <button
                onClick={() => isCurrentSong && player.togglePlay()}
                className="p-3 rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-600/30"
              >
                {player.isPlaying ? <Pause size={22} /> : <Play size={22} className="ml-0.5" />}
              </button>
            </div>
            <button onClick={() => nudge(5)} className="px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-bold text-zinc-300">
              +5s
            </button>
            <button onClick={() => nudge(15)} className="px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-bold text-zinc-300">
              +15s
            </button>
            <button
              onClick={() => navigate(nextSong)}
              disabled={!nextSong}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-20"
              title="Next song"
            >
              <ChevronRight size={18} />
            </button>
          </div>
          {/* Row 2: A→B Loop */}
          <div className="flex items-center gap-1.5 justify-center">
            <button
              onClick={() => setLoopPoint('A')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                loopA !== null ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-white/5 text-zinc-400'
              }`}
            >
              A {loopA !== null ? formatTime(loopA) : '—'}
            </button>
            <Repeat size={14} className={isLooping ? 'text-emerald-400' : 'text-zinc-600'} />
            <button
              onClick={() => setLoopPoint('B')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                loopB !== null ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-white/5 text-zinc-400'
              }`}
            >
              B {loopB !== null ? formatTime(loopB) : '—'}
            </button>
            {isLooping && (
              <button
                onClick={clearLoop}
                className="px-2 py-1 rounded-lg bg-red-500/10 text-red-300 text-[10px] font-bold"
              >
                Clear
              </button>
            )}
            <div className="text-[10px] text-zinc-600 font-mono ml-2">
              {formatTime(currentTime)} / {formatTime(player.duration)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
