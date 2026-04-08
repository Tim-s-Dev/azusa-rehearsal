'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ChevronDown, ChevronRight, Save, Play, Pause, Crosshair, Radio, Plus, Trash2, Pencil, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Song, SongFile, ChartMeasure, SongStructureSection, SectionType } from '@/lib/types';
import { SECTION_COLORS, normalizeSectionType } from '@/lib/types';
import ChartGrid from './ChartGrid';
import { useKeypad } from './KeypadProvider';
import { usePlayer } from './PlayerProvider';
import { groupMeasuresBySection, type MeasureGroup } from '@/lib/structure';

interface StructureViewProps {
  song: Song;
  audioFiles: SongFile[];
  onSongChange: () => void;
}

const SECTION_TYPES: SectionType[] = [
  'intro', 'verse', 'pre-chorus', 'chorus', 'bridge',
  'instrumental', 'tag', 'outro', 'custom',
];

const TAG_BUTTONS: { type: SectionType; label: string }[] = [
  { type: 'intro', label: 'Intro' },
  { type: 'verse', label: 'Verse' },
  { type: 'pre-chorus', label: 'Pre' },
  { type: 'chorus', label: 'Chorus' },
  { type: 'bridge', label: 'Bridge' },
  { type: 'instrumental', label: 'Inst' },
  { type: 'tag', label: 'Tag' },
  { type: 'outro', label: 'Outro' },
];

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
      type: (s.type as SectionType) || normalizeSectionType(name),
      start: typeof s.start === 'number' ? s.start : 0,
      end: typeof s.end === 'number' ? s.end : 0,
      markers: Array.isArray(s.markers) ? s.markers : [],
    } as SongStructureSection;
  });
}

export default function StructureView({ song, audioFiles, onSongChange }: StructureViewProps) {
  const player = usePlayer();
  const keypad = useKeypad();
  const [sections, setSections] = useState<SongStructureSection[]>(() => normalizeStructure(song.structure));
  const [measures, setMeasures] = useState<ChartMeasure[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set([0]));
  const [liveTag, setLiveTag] = useState(false);
  const [editingTimestampIdx, setEditingTimestampIdx] = useState<number | null>(null);
  const [dissecting, setDissecting] = useState(false);
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Sync sections from song prop changes
  useEffect(() => {
    setSections(normalizeStructure(song.structure));
  }, [song.structure]);

  // Load chart measures
  useEffect(() => {
    fetch(`/api/charts?song_id=${song.id}`)
      .then(r => r.json())
      .then(data => {
        if (data && data.chart_data) setMeasures(data.chart_data);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [song.id]);

  // Group measures by section break
  const groups: MeasureGroup[] = useMemo(() => groupMeasuresBySection(measures), [measures]);

  // Total measure count for keypad navigation
  useEffect(() => {
    keypad.registerGrid(measures.length, 4);
  }, [measures.length, keypad]);

  // Player state for highlighting
  const isCurrentSong = player.song?.id === song.id;
  const currentTime = isCurrentSong ? player.currentTime : 0;
  const currentSectionIdx = useMemo(() => {
    if (!isCurrentSong || currentTime === 0) return -1;
    return sections.findIndex(s => currentTime >= s.start && currentTime < s.end);
  }, [sections, currentTime, isCurrentSong]);

  // Auto-scroll to current section
  useEffect(() => {
    if (currentSectionIdx >= 0 && sectionRefs.current[currentSectionIdx]) {
      sectionRefs.current[currentSectionIdx]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
      // Auto-expand the current section
      setExpanded(prev => new Set([...prev, currentSectionIdx]));
    }
  }, [currentSectionIdx]);

  const persistStructure = useCallback(async (next: SongStructureSection[]) => {
    setSections(next);
    setSaving(true);
    await fetch('/api/songs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: song.id, structure: next }),
    });
    setSaving(false);
    onSongChange();
  }, [song.id, onSongChange]);

  const persistChart = useCallback(async (next: ChartMeasure[]) => {
    setMeasures(next);
    setDirty(true);
  }, []);

  const saveChart = useCallback(async () => {
    setSaving(true);
    await fetch('/api/charts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        song_id: song.id,
        key: song.key,
        time_signature: '4/4',
        chart_data: measures,
      }),
    });
    setSaving(false);
    setDirty(false);
  }, [song.id, song.key, measures]);

  // Auto-save chart after 2s of inactivity
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(saveChart, 5000);
    return () => clearTimeout(t);
  }, [dirty, saveChart]);

  const dissect = async () => {
    const audio = audioFiles.filter(f => f.file_type === 'audio');
    if (audio.length === 0) return;
    const target = audio.find(f => /arrangement|full|mix|master/i.test(f.name)) || audio[0];
    setDissecting(true);
    try {
      await fetch('/api/dissect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ song_id: song.id, file_url: target.file_url }),
      });
      const r = await fetch(`/api/charts?song_id=${song.id}`).then(r => r.json());
      if (r && r.chart_data) setMeasures(r.chart_data);
      onSongChange();
    } finally {
      setDissecting(false);
    }
  };

  const toggleExpand = (i: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const seekTo = (s: SongStructureSection) => {
    if (isCurrentSong) player.seek(s.start);
  };

  const updateSection = (idx: number, partial: Partial<SongStructureSection>) => {
    const next = [...sections];
    next[idx] = { ...next[idx], ...partial };
    persistStructure(next);
  };

  const setStartToNow = (idx: number) => {
    if (!isCurrentSong) return;
    updateSection(idx, { start: currentTime });
  };

  const setEndToNow = (idx: number) => {
    if (!isCurrentSong) return;
    updateSection(idx, { end: currentTime });
  };

  const nudge = (idx: number, field: 'start' | 'end', delta: number) => {
    const v = sections[idx][field] + delta;
    updateSection(idx, { [field]: Math.max(0, v) });
  };

  const deleteSection = (idx: number) => {
    if (sections.length <= 1) return;
    const next = sections.filter((_, i) => i !== idx);
    persistStructure(next);
  };

  const addSectionAtCurrentTime = (type: SectionType, label?: string) => {
    const t = isCurrentSong ? currentTime : 0;
    const containingIdx = sections.findIndex(s => t >= s.start && t < s.end);
    const next = [...sections];
    const newSection: SongStructureSection = {
      name: label || type.charAt(0).toUpperCase() + type.slice(1),
      type,
      start: t,
      end: t + 10,
      markers: [],
    };
    if (containingIdx >= 0) {
      const orig = next[containingIdx];
      newSection.end = orig.end;
      next[containingIdx] = { ...orig, end: t };
      next.splice(containingIdx + 1, 0, newSection);
    } else {
      next.push(newSection);
    }
    persistStructure(next);
  };

  /**
   * Live tag: when active, tapping a section type "marks" the song as entering
   * that section right now. Splits whatever section currently contains the
   * playhead, inserts a new one of the tapped type from now to its original end.
   */
  const handleLiveTag = (type: SectionType, label: string) => {
    if (!isCurrentSong) return;
    addSectionAtCurrentTime(type, label);
  };

  if (!loaded) return <div className="text-zinc-500 py-8 text-center">Loading structure...</div>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-xs uppercase tracking-wider text-zinc-500">Song Structure</h3>
          <p className="text-sm text-zinc-400">{sections.length} sections · Tap a beat box to edit chord</p>
        </div>
        <div className="flex items-center gap-2">
          {audioFiles.filter(f => f.file_type === 'audio').length > 0 && (
            <button
              onClick={dissect}
              disabled={dissecting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:scale-105 transition-transform text-white text-xs font-semibold shadow-md shadow-violet-600/30 disabled:opacity-50"
            >
              <Sparkles size={12} />
              {dissecting ? 'Analyzing...' : 'AI Auto-Fill'}
            </button>
          )}
          <button
            onClick={() => setLiveTag(!liveTag)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              liveTag
                ? 'bg-red-500/20 text-red-300 ring-1 ring-red-500/50 animate-pulse'
                : 'bg-white/5 text-zinc-400 hover:bg-white/10'
            }`}
          >
            <Radio size={12} />
            {liveTag ? 'Live' : 'Tag Mode'}
          </button>
        </div>
      </div>

      {/* Live tag toolbar */}
      {liveTag && (
        <div className="glass rounded-2xl p-3 space-y-2 border border-red-500/30">
          <div className="flex items-center justify-between">
            <p className="text-xs text-red-300">
              Tap a type as the song plays — it sets that section to start NOW ({formatTime(currentTime)})
            </p>
            <button
              onClick={() => isCurrentSong && (player.isPlaying ? player.togglePlay() : player.togglePlay())}
              className="p-1.5 rounded-full bg-white/5 hover:bg-white/10"
            >
              {player.isPlaying ? <Pause size={14} /> : <Play size={14} />}
            </button>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {TAG_BUTTONS.map(({ type, label }) => {
              const colors = SECTION_COLORS[type];
              return (
                <button
                  key={type}
                  onClick={() => handleLiveTag(type, label)}
                  className={`px-2 py-2 rounded-lg ${colors.bg} ${colors.border} border ${colors.text} text-xs font-bold uppercase tracking-wide hover:brightness-150 active:scale-95 transition-all`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Vertical section list */}
      <div className="space-y-2">
        {sections.map((sec, i) => {
          const colors = SECTION_COLORS[sec.type];
          const isCurrent = i === currentSectionIdx;
          const isExpanded = expanded.has(i);
          const group = groups[i] || null;
          const sectionDur = sec.end - sec.start;

          return (
            <div
              key={i}
              ref={(el) => { sectionRefs.current[i] = el; }}
              className={`glass rounded-2xl overflow-hidden transition-all ${
                isCurrent ? `ring-2 ring-violet-400/60 shadow-lg ${colors.glow}` : ''
              }`}
            >
              {/* Section header */}
              <div className={`${colors.bg} ${colors.border} border-b`}>
                <div className="flex items-center gap-2 p-3">
                  <button
                    onClick={() => toggleExpand(i)}
                    className="p-1 rounded hover:bg-white/10 shrink-0"
                  >
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                  <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${colors.text} bg-black/30`}>
                    {sec.type}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Input
                      value={sec.name}
                      onChange={(e) => {
                        const next = [...sections];
                        next[i] = { ...next[i], name: e.target.value };
                        setSections(next);
                      }}
                      onBlur={() => persistStructure(sections)}
                      className="bg-transparent border-0 h-6 px-1 text-sm font-semibold focus:bg-black/20"
                    />
                  </div>
                  <button
                    onClick={() => seekTo(sec)}
                    className="px-2 py-1 rounded text-[10px] font-mono bg-black/30 hover:bg-black/50 text-zinc-200 shrink-0"
                    title="Jump to this section"
                  >
                    {formatTime(sec.start)}
                  </button>
                  <span className="text-[10px] text-zinc-500 font-mono shrink-0">
                    {Math.round(sectionDur)}s · {group?.measures.length || 0}m
                  </span>
                  <button
                    onClick={() => setEditingTimestampIdx(editingTimestampIdx === i ? null : i)}
                    className="p-1 rounded hover:bg-white/10 shrink-0"
                    title="Edit timestamps"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    onClick={() => deleteSection(i)}
                    className="p-1 rounded hover:bg-red-500/20 text-zinc-500 hover:text-red-400 shrink-0"
                    title="Delete section"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>

                {/* Timestamp editor */}
                {editingTimestampIdx === i && (
                  <div className="px-3 pb-3 space-y-2 border-t border-white/10 pt-2">
                    <div className="grid grid-cols-2 gap-2">
                      {(['start', 'end'] as const).map(field => (
                        <div key={field}>
                          <label className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1 block">
                            {field}
                          </label>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => nudge(i, field, -0.5)}
                              className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-xs font-mono"
                            >
                              −
                            </button>
                            <Input
                              type="number"
                              step="0.1"
                              value={sec[field].toFixed(2)}
                              onChange={(e) => {
                                const v = parseFloat(e.target.value);
                                if (!isNaN(v)) {
                                  const next = [...sections];
                                  next[i] = { ...next[i], [field]: v };
                                  setSections(next);
                                }
                              }}
                              onBlur={() => persistStructure(sections)}
                              className="bg-zinc-900/50 border-zinc-800 h-7 text-xs font-mono text-center flex-1 min-w-0"
                            />
                            <button
                              onClick={() => nudge(i, field, 0.5)}
                              className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-xs font-mono"
                            >
                              +
                            </button>
                            <button
                              onClick={() => field === 'start' ? setStartToNow(i) : setEndToNow(i)}
                              className="px-2 py-1 rounded bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 text-[10px] font-bold flex items-center gap-0.5 shrink-0"
                              title="Set to current playback time"
                              disabled={!isCurrentSong}
                            >
                              <Crosshair size={10} /> Now
                            </button>
                          </div>
                          <p className="text-[10px] text-zinc-600 mt-0.5 font-mono">{formatTime(sec[field])}</p>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] uppercase tracking-wider text-zinc-500">Type</label>
                      <select
                        value={sec.type}
                        onChange={(e) => {
                          const next = [...sections];
                          next[i] = { ...next[i], type: e.target.value as SectionType };
                          persistStructure(next);
                        }}
                        className="bg-zinc-900/50 border border-zinc-800 rounded text-xs px-2 py-1 flex-1"
                      >
                        {SECTION_TYPES.map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Chart for this section */}
              {isExpanded && (
                <div className="p-3 space-y-2">
                  {group && group.measures.length > 0 ? (
                    <ChartGrid
                      measures={group.measures}
                      measureOffset={group.offset}
                      onChange={(updatedSlice) => {
                        // Splice the updated slice back into full measures
                        const next = [...measures];
                        next.splice(group.offset, group.measures.length, ...updatedSlice);
                        persistChart(next);
                      }}
                      showSectionHeaders={false}
                      showAddRemove={true}
                    />
                  ) : (
                    <p className="text-xs text-zinc-600 text-center py-4">
                      No chart measures for this section yet.
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add section button */}
      <button
        onClick={() => addSectionAtCurrentTime('custom', 'New Section')}
        className="w-full glass rounded-2xl p-3 text-sm text-zinc-400 hover:text-white border-2 border-dashed border-white/10 hover:border-violet-500/50 transition-colors"
      >
        <Plus size={14} className="inline mr-1" />
        Add Section{isCurrentSong ? ` at ${formatTime(currentTime)}` : ''}
      </button>

      {/* Save status */}
      <div className="text-xs text-zinc-600 text-center">
        {saving ? 'Saving…' : dirty ? 'Unsaved chord changes…' : 'Saved'}
      </div>
    </div>
  );
}
