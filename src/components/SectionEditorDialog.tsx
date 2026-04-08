'use client';

import { useState } from 'react';
import { X, Plus, Trash2, Flag } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { SongStructureSection, SectionType, SectionMarker, MarkerType } from '@/lib/types';

interface SectionEditorDialogProps {
  section: SongStructureSection;
  currentTime: number;
  onSave: (updated: SongStructureSection) => void;
  onDelete: () => void;
  onClose: () => void;
}

const SECTION_TYPES: SectionType[] = [
  'intro', 'verse', 'pre-chorus', 'chorus', 'bridge',
  'instrumental', 'tag', 'outro', 'custom'
];

const MARKER_TYPES: { value: MarkerType; label: string }[] = [
  { value: 'key_change', label: 'Key Change' },
  { value: 'modulation', label: 'Modulation' },
  { value: 'breakdown', label: 'Breakdown' },
  { value: 'note', label: 'Note' },
];

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function SectionEditorDialog({ section, currentTime, onSave, onDelete, onClose }: SectionEditorDialogProps) {
  const [name, setName] = useState(section.name);
  const [type, setType] = useState<SectionType>(section.type);
  const [start, setStart] = useState(section.start);
  const [end, setEnd] = useState(section.end);
  const [markers, setMarkers] = useState<SectionMarker[]>(section.markers || []);

  const save = () => {
    onSave({ name, type, start, end, markers });
  };

  const addMarker = () => {
    const t = currentTime > start && currentTime < end ? currentTime : start + (end - start) / 2;
    setMarkers([...markers, { time: t, type: 'key_change', label: '' }]);
  };

  const updateMarker = (idx: number, partial: Partial<SectionMarker>) => {
    setMarkers(markers.map((m, i) => (i === idx ? { ...m, ...partial } : m)));
  };

  const deleteMarker = (idx: number) => {
    setMarkers(markers.filter((_, i) => i !== idx));
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="glass rounded-3xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Edit Section</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/10">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs uppercase tracking-wider text-zinc-500 mb-1 block">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-zinc-900/50 border-zinc-800"
            />
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider text-zinc-500 mb-1 block">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as SectionType)}
              className="w-full bg-zinc-900/50 border border-zinc-800 rounded-md px-3 py-2 text-sm"
            >
              {SECTION_TYPES.map(t => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs uppercase tracking-wider text-zinc-500 mb-1 block">Start</label>
              <div className="flex gap-1">
                <Input
                  type="number"
                  step="0.1"
                  value={start}
                  onChange={(e) => setStart(parseFloat(e.target.value))}
                  className="bg-zinc-900/50 border-zinc-800"
                />
                <button
                  onClick={() => setStart(currentTime)}
                  className="px-2 text-xs rounded bg-violet-500/20 text-violet-300 hover:bg-violet-500/30"
                  title="Set to current playback time"
                >
                  Now
                </button>
              </div>
              <div className="text-xs text-zinc-600 mt-0.5 font-mono">{formatTime(start)}</div>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-zinc-500 mb-1 block">End</label>
              <div className="flex gap-1">
                <Input
                  type="number"
                  step="0.1"
                  value={end}
                  onChange={(e) => setEnd(parseFloat(e.target.value))}
                  className="bg-zinc-900/50 border-zinc-800"
                />
                <button
                  onClick={() => setEnd(currentTime)}
                  className="px-2 text-xs rounded bg-violet-500/20 text-violet-300 hover:bg-violet-500/30"
                  title="Set to current playback time"
                >
                  Now
                </button>
              </div>
              <div className="text-xs text-zinc-600 mt-0.5 font-mono">{formatTime(end)}</div>
            </div>
          </div>

          {/* Markers */}
          <div className="border-t border-white/5 pt-3">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs uppercase tracking-wider text-zinc-500">Markers</label>
              <button
                onClick={addMarker}
                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-xs"
              >
                <Plus size={12} /> Add
              </button>
            </div>
            <div className="space-y-2">
              {markers.length === 0 && (
                <p className="text-xs text-zinc-600 text-center py-2">No markers</p>
              )}
              {markers.map((m, i) => (
                <div key={i} className="flex items-center gap-2 bg-zinc-900/50 rounded-lg p-2">
                  <Flag size={14} className="text-red-400 shrink-0" />
                  <select
                    value={m.type}
                    onChange={(e) => updateMarker(i, { type: e.target.value as MarkerType })}
                    className="bg-zinc-800 text-xs rounded px-1.5 py-1 border border-zinc-700"
                  >
                    {MARKER_TYPES.map(mt => (
                      <option key={mt.value} value={mt.value}>{mt.label}</option>
                    ))}
                  </select>
                  <Input
                    value={m.label || ''}
                    placeholder="Label"
                    onChange={(e) => updateMarker(i, { label: e.target.value })}
                    className="bg-zinc-800 border-zinc-700 h-7 text-xs flex-1 min-w-0"
                  />
                  <Input
                    type="number"
                    step="0.1"
                    value={m.time}
                    onChange={(e) => updateMarker(i, { time: parseFloat(e.target.value) })}
                    className="bg-zinc-800 border-zinc-700 h-7 text-xs w-16 font-mono"
                  />
                  <button
                    onClick={() => deleteMarker(i)}
                    className="p-1 text-zinc-500 hover:text-red-400"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-3">
            <Button
              onClick={onDelete}
              variant="outline"
              size="sm"
              className="text-red-400 border-red-500/30 hover:bg-red-500/10"
            >
              <Trash2 size={14} className="mr-1" /> Delete Section
            </Button>
            <div className="flex-1" />
            <Button onClick={onClose} variant="outline" size="sm">Cancel</Button>
            <Button onClick={save} size="sm" className="bg-gradient-to-r from-violet-600 to-fuchsia-600">
              Save
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
