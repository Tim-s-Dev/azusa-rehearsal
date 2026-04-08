'use client';

import { useMetronome } from './MetronomeProvider';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';

export default function MetronomeControls() {
  const m = useMetronome();

  return (
    <div className="space-y-2">
      {/* Main row */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-zinc-500 w-12">Click</span>
        <button
          onClick={m.toggle}
          className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
            m.enabled
              ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30'
              : 'bg-white/5 text-zinc-400 hover:bg-white/10'
          }`}
        >
          {m.enabled ? 'On' : 'Off'}
        </button>
        <Input
          type="number"
          value={m.bpm}
          onChange={(e) => {
            const v = parseInt(e.target.value);
            if (!isNaN(v)) m.setBpm(v);
          }}
          className="w-16 h-7 text-xs font-mono bg-zinc-900 border-zinc-700"
          min={30}
          max={250}
        />
        <span className="text-xs text-zinc-500">BPM</span>
        <button
          onClick={m.tap}
          className="px-2 py-1 rounded text-xs bg-white/5 hover:bg-white/10 text-zinc-300 font-semibold"
          title="Tap tempo"
        >
          Tap
        </button>
        <button
          onClick={() => m.setAccentFirst(!m.accentFirst)}
          className={`px-2 py-1 rounded text-xs ${
            m.accentFirst ? 'bg-violet-500/20 text-violet-300' : 'bg-white/5 text-zinc-500'
          }`}
          title="Accent first beat"
        >
          ◆ 1
        </button>
        <div className="flex gap-1 ml-1">
          {Array.from({ length: m.beatsPerMeasure }).map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-all ${
                m.enabled && i === m.currentBeat
                  ? i === 0 && m.accentFirst
                    ? 'bg-fuchsia-400 scale-150 shadow-md shadow-fuchsia-400/50'
                    : 'bg-violet-400 scale-125'
                  : 'bg-zinc-700'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Offset row */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-zinc-500 w-12" title="Adjust click timing relative to song audio">
          Offset
        </span>
        <button
          onClick={() => m.setOffsetMs(m.offsetMs - 10)}
          className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-xs font-mono"
        >
          −10
        </button>
        <div className="flex-1 max-w-xs">
          <Slider
            value={[m.offsetMs]}
            min={-500}
            max={500}
            step={5}
            onValueChange={(v) => m.setOffsetMs(typeof v === 'number' ? v : v[0])}
          />
        </div>
        <button
          onClick={() => m.setOffsetMs(m.offsetMs + 10)}
          className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-xs font-mono"
        >
          +10
        </button>
        <span className="text-xs font-mono text-zinc-400 w-12 text-right">
          {m.offsetMs > 0 ? '+' : ''}{m.offsetMs}ms
        </span>
        <button
          onClick={() => m.setOffsetMs(0)}
          className="text-xs text-zinc-600 hover:text-zinc-400"
          title="Reset"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
