'use client';

import { useState, useEffect, useMemo } from 'react';
import { Plus, Pencil, Flag } from 'lucide-react';
import { usePlayer } from './PlayerProvider';
import { SECTION_COLORS, normalizeSectionType, type Song, type SongStructureSection, type SectionMarker, type SectionType } from '@/lib/types';
import SectionEditorDialog from './SectionEditorDialog';

interface SongTimelineProps {
  song: Song;
  mode: 'compact' | 'detailed';
  onChange?: (sections: SongStructureSection[]) => void;
}

// Normalize raw structure data (might come from old dissection_data shape)
function normalizeStructure(raw: unknown): SongStructureSection[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((s: Record<string, unknown>) => {
    const name = (s.name as string) || (s.label as string) || 'Section';
    return {
      name,
      type: (s.type as SectionType) || normalizeSectionType(name),
      start: typeof s.start === 'number' ? s.start : 0,
      end: typeof s.end === 'number' ? s.end : 0,
      markers: Array.isArray(s.markers) ? (s.markers as SectionMarker[]) : [],
    };
  }).filter(s => s.end > s.start);
}

export default function SongTimeline({ song, mode, onChange }: SongTimelineProps) {
  const player = usePlayer();
  const [sections, setSections] = useState<SongStructureSection[]>(() => normalizeStructure(song.structure));
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  useEffect(() => {
    setSections(normalizeStructure(song.structure));
  }, [song.structure]);

  const isCurrentSong = player.song?.id === song.id;
  const currentTime = isCurrentSong ? player.currentTime : 0;

  const totalDuration = useMemo(() => {
    if (sections.length === 0) return 0;
    return sections[sections.length - 1].end;
  }, [sections]);

  const currentSectionIdx = useMemo(() => {
    if (!isCurrentSong || currentTime === 0) return -1;
    return sections.findIndex(s => currentTime >= s.start && currentTime < s.end);
  }, [sections, currentTime, isCurrentSong]);

  const persist = async (next: SongStructureSection[]) => {
    setSections(next);
    onChange?.(next);
    await fetch('/api/songs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: song.id, structure: next }),
    });
  };

  const handleSeek = (sec: SongStructureSection) => {
    if (!isCurrentSong) return;
    player.seek(sec.start);
  };

  const handleSectionUpdate = async (idx: number, updated: SongStructureSection) => {
    const next = [...sections];
    next[idx] = updated;
    await persist(next);
  };

  const handleSectionDelete = async (idx: number) => {
    if (sections.length <= 1) return;
    const next = sections.filter((_, i) => i !== idx);
    await persist(next);
  };

  const handleAddSection = async () => {
    const t = isCurrentSong ? currentTime : 0;
    // Find which section we're in
    const idx = sections.findIndex(s => t >= s.start && t < s.end);
    const next = [...sections];
    if (idx >= 0) {
      // Split the existing section at current time
      const orig = next[idx];
      next[idx] = { ...orig, end: t };
      next.splice(idx + 1, 0, {
        name: 'New Section',
        type: 'custom',
        start: t,
        end: orig.end,
        markers: [],
      });
    } else {
      next.push({
        name: 'New Section',
        type: 'custom',
        start: t,
        end: t + 10,
        markers: [],
      });
    }
    await persist(next);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  if (sections.length === 0) {
    return mode === 'compact' ? null : (
      <div className="text-center text-zinc-500 text-sm py-4">
        No structure yet. Run AI Dissect or add sections manually.
      </div>
    );
  }

  if (mode === 'compact') {
    return (
      <div className="space-y-1">
        <div className="flex h-3 rounded-full overflow-hidden bg-zinc-900/50 border border-white/5">
          {sections.map((s, i) => {
            const widthPct = ((s.end - s.start) / totalDuration) * 100;
            const colors = SECTION_COLORS[s.type];
            const isCurrent = i === currentSectionIdx;
            return (
              <button
                key={i}
                onClick={() => handleSeek(s)}
                style={{ width: `${widthPct}%` }}
                className={`${colors.bg} ${colors.border} border-r last:border-r-0 transition-all hover:brightness-150 ${isCurrent ? 'ring-2 ring-white/40 ring-inset' : ''}`}
                title={`${s.name} (${formatTime(s.start)})`}
              >
                <span className="sr-only">{s.name}</span>
              </button>
            );
          })}
        </div>
        <div className="flex justify-between text-[10px] text-zinc-600 font-mono px-1">
          <span>{formatTime(0)}</span>
          {currentSectionIdx >= 0 && (
            <span className="text-violet-400 font-bold">
              {sections[currentSectionIdx].name.toUpperCase()}
            </span>
          )}
          <span>{formatTime(totalDuration)}</span>
        </div>
      </div>
    );
  }

  // Detailed mode
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs uppercase tracking-wider text-zinc-500">Song Structure</h3>
        <button
          onClick={handleAddSection}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 text-xs text-zinc-300"
        >
          <Plus size={12} /> Section
        </button>
      </div>
      <div className="flex h-14 rounded-2xl overflow-hidden bg-zinc-900/50 border border-white/5 relative">
        {sections.map((s, i) => {
          const widthPct = ((s.end - s.start) / totalDuration) * 100;
          const colors = SECTION_COLORS[s.type];
          const isCurrent = i === currentSectionIdx;
          return (
            <div
              key={i}
              style={{ width: `${widthPct}%` }}
              className={`${colors.bg} ${colors.border} border-r last:border-r-0 group relative flex flex-col justify-center px-2 transition-all hover:brightness-125 cursor-pointer ${isCurrent ? 'ring-2 ring-white/50 ring-inset shadow-lg ' + colors.glow : ''}`}
              onClick={() => handleSeek(s)}
            >
              <div className={`text-[10px] font-bold uppercase tracking-wider truncate ${colors.text}`}>
                {s.name}
              </div>
              <div className="text-[9px] text-zinc-500 font-mono truncate">
                {formatTime(s.start)}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setEditingIdx(i); }}
                className="absolute top-1 right-1 p-0.5 rounded hover:bg-white/20 opacity-0 group-hover:opacity-100"
                title="Edit"
              >
                <Pencil size={10} className="text-white/80" />
              </button>
              {/* Markers */}
              {s.markers?.map((marker, mi) => {
                const sectionDur = s.end - s.start;
                const markerPosPct = ((marker.time - s.start) / sectionDur) * 100;
                return (
                  <div
                    key={mi}
                    className="absolute top-0 bottom-0 w-0.5 bg-red-500 pointer-events-none"
                    style={{ left: `${markerPosPct}%` }}
                  >
                    <Flag size={8} className="text-red-400 absolute -top-1 -left-1" />
                  </div>
                );
              })}
            </div>
          );
        })}
        {/* Playhead */}
        {isCurrentSong && totalDuration > 0 && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white pointer-events-none z-10 shadow-lg shadow-white/50"
            style={{ left: `${(currentTime / totalDuration) * 100}%` }}
          />
        )}
      </div>

      {editingIdx !== null && (
        <SectionEditorDialog
          section={sections[editingIdx]}
          currentTime={isCurrentSong ? currentTime : 0}
          onSave={(updated) => { handleSectionUpdate(editingIdx, updated); setEditingIdx(null); }}
          onDelete={() => { handleSectionDelete(editingIdx); setEditingIdx(null); }}
          onClose={() => setEditingIdx(null)}
        />
      )}
    </div>
  );
}
