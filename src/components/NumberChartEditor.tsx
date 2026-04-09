'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Save, Sparkles, Keyboard, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ChartItem, ChartMeasure, SongFile } from '@/lib/types';
import { isMeasure } from '@/lib/types';
import { useKeypad } from './KeypadProvider';
import ChartGrid from './ChartGrid';
import MetronomeControls from './MetronomeControls';

interface NumberChartEditorProps {
  songId: string;
  songKey: string | null;
  audioFiles?: SongFile[];
  onDissectComplete?: () => void;
}

export default function NumberChartEditor({ songId, songKey, audioFiles = [], onDissectComplete }: NumberChartEditorProps) {
  const [items, setItems] = useState<ChartItem[]>([
    { type: 'measure', section: 'Intro', beats: ['', '', '', ''] },
  ]);
  const [timeSignature, setTimeSignature] = useState('4/4');
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [dissecting, setDissecting] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showMetronome, setShowMetronome] = useState(false);
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
        setItems(r.chart_data);
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
          setItems(data.chart_data);
          if (data.time_signature) setTimeSignature(data.time_signature);
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [songId]);

  // Tell the keypad how big the grid is (use total items so navigation can skip non-measure)
  useEffect(() => {
    keypad.registerGrid(items.length, beatsPerMeasure);
  }, [items.length, beatsPerMeasure, keypad]);

  const save = useCallback(async () => {
    setSaving(true);
    await fetch('/api/charts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        song_id: songId,
        key: songKey,
        time_signature: timeSignature,
        chart_data: items,
      }),
    });
    setSaving(false);
    setDirty(false);
    setLastSaved(new Date());
  }, [songId, songKey, timeSignature, items]);

  // Auto-save every 5s when dirty
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => { save(); }, 5000);
    return () => clearTimeout(t);
  }, [dirty, save]);

  const updateItems = useCallback((next: ChartItem[]) => {
    setItems(next);
    setDirty(true);
  }, []);

  const addMeasureAtEnd = () => {
    updateItems([...items, { type: 'measure', beats: Array(beatsPerMeasure).fill('') }]);
  };

  const [showSectionPicker, setShowSectionPicker] = useState(false);
  const SECTION_TYPES = ['Intro', 'Verse', 'Pre-Chorus', 'Chorus', 'Bridge', 'Interlude', 'Outro', 'Tag', 'Instrumental', 'Vamp'];
  const [customSectionName, setCustomSectionName] = useState('');

  /**
   * Smart add section: finds the last section with the same name in the chart
   * and clones its measures. If none found, creates a single empty measure.
   */
  const addSectionAtEnd = (sectionName: string) => {
    // Find all items belonging to the last occurrence of this section name
    let lastSectionStart = -1;
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      if (isMeasure(it) && it.section?.toLowerCase() === sectionName.toLowerCase()) {
        lastSectionStart = i;
        break;
      }
    }

    let newItems: ChartItem[];
    if (lastSectionStart >= 0) {
      // Find the end of that section
      let lastSectionEnd = items.length;
      for (let i = lastSectionStart + 1; i < items.length; i++) {
        const it = items[i];
        if (isMeasure(it) && it.section !== undefined) { lastSectionEnd = i; break; }
      }
      // Clone it
      newItems = items.slice(lastSectionStart, lastSectionEnd).map((item, idx) => {
        if (isMeasure(item)) {
          return { ...item, beats: [...item.beats], section: idx === 0 ? sectionName : undefined };
        }
        return { ...item };
      });
    } else {
      // No previous section with this name — create one empty measure
      newItems = [{ type: 'measure' as const, section: sectionName, beats: Array(beatsPerMeasure).fill('') }];
    }

    updateItems([...items, ...newItems]);
    setShowSectionPicker(false);
  };

  const duplicateSection = (sectionStartIdx: number) => {
    // Find the end of this section (next index where measure has .section, or end of array)
    let sectionEnd = items.length;
    for (let i = sectionStartIdx + 1; i < items.length; i++) {
      const it = items[i];
      if (isMeasure(it) && it.section !== undefined) { sectionEnd = i; break; }
    }
    const slice = items.slice(sectionStartIdx, sectionEnd).map(item => {
      if (isMeasure(item)) return { ...item, beats: [...item.beats] };
      return { ...item };
    });
    const next = [...items];
    next.splice(sectionEnd, 0, ...slice);
    updateItems(next);
  };

  if (!loaded) return <div className="text-zinc-500 py-8 text-center">Loading chart...</div>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3 flex-wrap">
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
          <button
            onClick={() => setShowMetronome(!showMetronome)}
            className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded ${
              showMetronome ? 'bg-violet-500/20 text-violet-300' : 'bg-white/5 text-zinc-400 hover:bg-white/10'
            }`}
          >
            🥁 Click
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

      {/* Inline metronome panel */}
      {showMetronome && (
        <div className="glass rounded-xl p-3">
          <MetronomeControls />
        </div>
      )}

      {/* Chart Grid */}
      <ChartGrid
        items={items}
        itemOffset={0}
        beatsPerMeasure={beatsPerMeasure}
        onChange={updateItems}
        onDuplicateSection={duplicateSection}
      />

      {/* Add buttons */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={addMeasureAtEnd}>
            <Plus size={14} className="mr-1" /> Measure
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowSectionPicker(!showSectionPicker)}>
            <Plus size={14} className="mr-1" /> Section
          </Button>
        </div>
        {showSectionPicker && (
          <div className="glass rounded-xl p-3">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">
              Pick a section — if you&apos;ve already charted it, the numbers auto-fill
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SECTION_TYPES.map(s => {
                const hasExisting = items.some(it => isMeasure(it) && it.section?.toLowerCase() === s.toLowerCase());
                return (
                  <button
                    key={s}
                    onClick={() => addSectionAtEnd(s)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      hasExisting
                        ? 'bg-violet-500/20 text-violet-300 border border-violet-500/40 hover:bg-violet-500/30'
                        : 'bg-white/5 text-zinc-300 border border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {s}
                    {hasExisting && <span className="ml-1 text-[9px] opacity-60">●</span>}
                  </button>
                );
              })}
            </div>
            {/* Custom freetext section name */}
            <div className="flex gap-1.5 mt-2">
              <input
                value={customSectionName}
                onChange={(e) => setCustomSectionName(e.target.value)}
                placeholder="Custom name…"
                className="flex-1 bg-zinc-900/50 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-600"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && customSectionName.trim()) {
                    addSectionAtEnd(customSectionName.trim());
                    setCustomSectionName('');
                  }
                }}
              />
              <button
                onClick={() => {
                  if (customSectionName.trim()) {
                    addSectionAtEnd(customSectionName.trim());
                    setCustomSectionName('');
                  }
                }}
                disabled={!customSectionName.trim()}
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-bold text-zinc-300 disabled:opacity-30"
              >
                Add
              </button>
            </div>
          </div>
        )}
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
