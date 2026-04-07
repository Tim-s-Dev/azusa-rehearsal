'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ChartMeasure } from '@/lib/types';

interface NumberChartEditorProps {
  songId: string;
  songKey: string | null;
}

const SECTIONS = ['Intro', 'Verse', 'Pre-Chorus', 'Chorus', 'Bridge', 'Outro', 'Tag', 'Instrumental', 'Vamp'];

export default function NumberChartEditor({ songId, songKey }: NumberChartEditorProps) {
  const [measures, setMeasures] = useState<ChartMeasure[]>([
    { section: 'Intro', beats: ['', '', '', ''] },
  ]);
  const [timeSignature, setTimeSignature] = useState('4/4');
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

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
  }, [songId, songKey, timeSignature, measures]);

  const addMeasure = (afterIndex: number) => {
    const newMeasures = [...measures];
    newMeasures.splice(afterIndex + 1, 0, {
      beats: Array(beatsPerMeasure).fill(''),
    });
    setMeasures(newMeasures);
  };

  const addSection = (afterIndex: number) => {
    const newMeasures = [...measures];
    newMeasures.splice(afterIndex + 1, 0, {
      section: 'Verse',
      beats: Array(beatsPerMeasure).fill(''),
    });
    setMeasures(newMeasures);
  };

  const removeMeasure = (index: number) => {
    if (measures.length <= 1) return;
    setMeasures(measures.filter((_, i) => i !== index));
  };

  const updateBeat = (measureIdx: number, beatIdx: number, value: string) => {
    const newMeasures = [...measures];
    newMeasures[measureIdx] = {
      ...newMeasures[measureIdx],
      beats: newMeasures[measureIdx].beats.map((b, i) => (i === beatIdx ? value : b)),
    };
    setMeasures(newMeasures);
  };

  const updateSection = (measureIdx: number, section: string) => {
    const newMeasures = [...measures];
    newMeasures[measureIdx] = { ...newMeasures[measureIdx], section };
    setMeasures(newMeasures);
  };

  if (!loaded) return <div className="text-zinc-500 py-8 text-center">Loading chart...</div>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
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
        </div>
        <Button onClick={save} disabled={saving} size="sm" className="gap-1">
          <Save size={14} />
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>

      {/* Chart Grid */}
      <div className="space-y-1">
        {measures.map((measure, mIdx) => (
          <div key={mIdx}>
            {/* Section header */}
            {measure.section !== undefined && (
              <div className="flex items-center gap-2 mt-3 mb-1">
                <select
                  value={measure.section}
                  onChange={(e) => updateSection(mIdx, e.target.value)}
                  className="bg-zinc-800 text-xs font-bold rounded px-2 py-1 text-indigo-400 border border-zinc-700 uppercase tracking-wide"
                >
                  {SECTIONS.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            )}
            {/* Measure row */}
            <div className="flex items-center gap-1 group">
              <div className="text-xs text-zinc-600 w-6 text-right shrink-0">{mIdx + 1}</div>
              <div className="flex gap-1 flex-1">
                {measure.beats.map((beat, bIdx) => (
                  <Input
                    key={bIdx}
                    value={beat}
                    onChange={(e) => updateBeat(mIdx, bIdx, e.target.value)}
                    className="w-14 h-10 text-center text-lg font-mono bg-zinc-900 border-zinc-700 text-white"
                    placeholder="-"
                  />
                ))}
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => addMeasure(mIdx)}
                  className="p-1 text-zinc-600 hover:text-zinc-300"
                  title="Add measure"
                >
                  <Plus size={14} />
                </button>
                <button
                  onClick={() => addSection(mIdx)}
                  className="p-1 text-zinc-600 hover:text-indigo-400"
                  title="Add section"
                >
                  <Plus size={14} />
                </button>
                <button
                  onClick={() => removeMeasure(mIdx)}
                  className="p-1 text-zinc-600 hover:text-red-400"
                  title="Remove"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add buttons */}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => addMeasure(measures.length - 1)}>
          <Plus size={14} className="mr-1" /> Measure
        </Button>
        <Button variant="outline" size="sm" onClick={() => addSection(measures.length - 1)}>
          <Plus size={14} className="mr-1" /> Section
        </Button>
      </div>

      {/* Legend */}
      <div className="text-xs text-zinc-600 space-y-0.5 border-t border-zinc-800 pt-3">
        <p>Nashville Numbers: 1=root, 2=ii, 3=iii, 4=IV, 5=V, 6=vi, 7=vii</p>
        <p>Modifiers: # (sharp), b (flat), / (slash chord), - (hold), &diamond; (whole note)</p>
      </div>
    </div>
  );
}
