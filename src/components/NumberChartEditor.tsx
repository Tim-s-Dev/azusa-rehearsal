'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Save, Sparkles, Keyboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ChartMeasure, SongFile } from '@/lib/types';
import { useKeypad } from './KeypadProvider';
import ChartGrid from './ChartGrid';

interface NumberChartEditorProps {
  songId: string;
  songKey: string | null;
  audioFiles?: SongFile[];
  onDissectComplete?: () => void;
}

export default function NumberChartEditor({ songId, songKey, audioFiles = [], onDissectComplete }: NumberChartEditorProps) {
  const [measures, setMeasures] = useState<ChartMeasure[]>([
    { section: 'Intro', beats: ['', '', '', ''] },
  ]);
  const [timeSignature, setTimeSignature] = useState('4/4');
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [dissecting, setDissecting] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const keypad = useKeypad();

  const dissect = async () => {
    const audio = audioFiles.filter(f => f.file_type === 'audio');
    if (audio.length === 0) return;
    const target = audio.find(f => /arrangement|full|mix|master/i.test(f.name)) || audio[0];
    setDissecting(true);
    try {
      await fetch('/api/dissect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ song_id: songId, file_url: target.file_url }),
      });
      const r = await fetch(`/api/charts?song_id=${songId}`).then(r => r.json());
      if (r && r.chart_data) {
        setMeasures(r.chart_data);
      }
      onDissectComplete?.();
    } finally {
      setDissecting(false);
    }
  };

  const beatsPerMeasure = parseInt(timeSignature.split('/')[0]) || 4;

  // Load chart
  useEffect(() => {
    fetch(`/api/charts?song_id=${songId}`)
      .then(r => r.json())
      .then(data => {
        if (data && data.chart_data && data.chart_data.length > 0) {
          setMeasures(data.chart_data);
          if (data.time_signature) setTimeSignature(data.time_signature);
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [songId]);

  // Tell the keypad how big the grid is
  useEffect(() => {
    keypad.registerGrid(measures.length, beatsPerMeasure);
  }, [measures.length, beatsPerMeasure, keypad]);

  const save = useCallback(async () => {
    setSaving(true);
    await fetch('/api/charts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        song_id: songId,
        key: songKey,
        time_signature: timeSignature,
        chart_data: measures,
      }),
    });
    setSaving(false);
    setDirty(false);
    setLastSaved(new Date());
  }, [songId, songKey, timeSignature, measures]);

  // Auto-save every 5s when dirty
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => { save(); }, 5000);
    return () => clearTimeout(t);
  }, [dirty, save]);

  // Wrap setMeasures to mark dirty
  const updateMeasures = useCallback((next: ChartMeasure[] | ((prev: ChartMeasure[]) => ChartMeasure[])) => {
    setMeasures(prev => {
      const value = typeof next === 'function' ? next(prev) : next;
      return value;
    });
    setDirty(true);
  }, []);

  const addMeasureAtEnd = () => {
    updateMeasures([...measures, { beats: Array(beatsPerMeasure).fill('') }]);
  };

  const addSectionAtEnd = () => {
    updateMeasures([...measures, { section: 'Verse', beats: Array(beatsPerMeasure).fill('') }]);
  };

  const duplicateSection = (sectionStartIdx: number) => {
    // Find the end of this section (next index with .section, or end of array)
    let sectionEnd = measures.length;
    for (let i = sectionStartIdx + 1; i < measures.length; i++) {
      if (measures[i].section !== undefined) { sectionEnd = i; break; }
    }
    const slice = measures.slice(sectionStartIdx, sectionEnd).map(m => ({ ...m, beats: [...m.beats] }));
    const next = [...measures];
    next.splice(sectionEnd, 0, ...slice);
    updateMeasures(next);
  };

  if (!loaded) return <div className="text-zinc-500 py-8 text-center">Loading chart...</div>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-4">
          <div className="text-sm text-zinc-400">
            Key: <span className="font-bold text-white">{songKey || '?'}</span>
          </div>
          <select
            value={timeSignature}
            onChange={(e) => setTimeSignature(e.target.value)}
            className="bg-zinc-800 text-sm rounded px-2 py-1 text-zinc-300 border border-zinc-700"
          >
            <option value="4/4">4/4</option>
            <option value="3/4">3/4</option>
            <option value="6/8">6/8</option>
            <option value="2/4">2/4</option>
          </select>
          <button
            onClick={() => keypad.setMode(keypad.mode === 'bar' ? 'popover' : 'bar')}
            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-zinc-400"
            title={`Keypad: ${keypad.mode}`}
          >
            <Keyboard size={12} />
            {keypad.mode === 'bar' ? 'Bar' : 'Popover'}
          </button>
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
          <Button onClick={save} disabled={saving} size="sm" className="gap-1">
            <Save size={14} />
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Chart Grid */}
      <ChartGrid
        measures={measures}
        measureOffset={0}
        beatsPerMeasure={beatsPerMeasure}
        onChange={updateMeasures}
        onDuplicateSection={duplicateSection}
      />

      {/* Add buttons */}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={addMeasureAtEnd}>
          <Plus size={14} className="mr-1" /> Measure
        </Button>
        <Button variant="outline" size="sm" onClick={addSectionAtEnd}>
          <Plus size={14} className="mr-1" /> Section
        </Button>
      </div>

      <div className="text-xs text-zinc-600 space-y-0.5 border-t border-zinc-800 pt-3 flex items-center justify-between">
        <p>Tap a beat box to open the keypad. Numbers append. Tap Clear to reset a cell.</p>
        <span className={dirty ? 'text-amber-400' : lastSaved ? 'text-emerald-500' : ''}>
          {saving ? 'Saving…' : dirty ? 'Unsaved (auto-saves in 5s)' : lastSaved ? `Saved ${lastSaved.toLocaleTimeString()}` : ''}
        </span>
      </div>
    </div>
  );
}
