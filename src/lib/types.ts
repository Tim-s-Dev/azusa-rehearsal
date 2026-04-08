export interface Conference {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

export interface Event {
  id: string;
  conference_id: string;
  name: string;
  description: string | null;
  date: string | null;
  start_time: string | null;
  end_time: string | null;
  sort_order: number;
  created_at: string;
}

export interface Set {
  id: string;
  event_id: string;
  name: string;
  description: string | null;
  start_time: string | null;
  sort_order: number;
  created_at: string;
}

export type SectionType =
  | 'intro' | 'verse' | 'pre-chorus' | 'chorus' | 'bridge'
  | 'instrumental' | 'tag' | 'outro' | 'custom';

export type MarkerType = 'key_change' | 'modulation' | 'breakdown' | 'note';

export interface SectionMarker {
  time: number;
  type: MarkerType;
  label?: string;
}

export interface SongStructureSection {
  name: string;
  type: SectionType;
  start: number;
  end: number;
  markers?: SectionMarker[];
}

export interface Song {
  id: string;
  set_id: string;
  title: string;
  artist: string | null;
  key: string | null;
  bpm: number | null;
  duration: string | null;
  notes: string | null;
  description: string | null;
  sort_order: number;
  created_at: string;
  dissection_md: string | null;
  dissection_status: 'none' | 'processing' | 'complete' | 'error' | null;
  structure?: SongStructureSection[] | null;
}

export const SECTION_COLORS: Record<SectionType, { bg: string; text: string; border: string; glow: string }> = {
  'intro':        { bg: 'bg-slate-500/20',    text: 'text-slate-300',    border: 'border-slate-500/40',    glow: 'shadow-slate-500/50' },
  'verse':        { bg: 'bg-blue-500/20',     text: 'text-blue-300',     border: 'border-blue-500/40',     glow: 'shadow-blue-500/50' },
  'pre-chorus':   { bg: 'bg-cyan-500/20',     text: 'text-cyan-300',     border: 'border-cyan-500/40',     glow: 'shadow-cyan-500/50' },
  'chorus':       { bg: 'bg-violet-500/30',   text: 'text-violet-200',   border: 'border-violet-500/50',   glow: 'shadow-violet-500/50' },
  'bridge':       { bg: 'bg-fuchsia-500/20',  text: 'text-fuchsia-300',  border: 'border-fuchsia-500/40',  glow: 'shadow-fuchsia-500/50' },
  'instrumental': { bg: 'bg-amber-500/20',    text: 'text-amber-300',    border: 'border-amber-500/40',    glow: 'shadow-amber-500/50' },
  'tag':          { bg: 'bg-emerald-500/20',  text: 'text-emerald-300',  border: 'border-emerald-500/40',  glow: 'shadow-emerald-500/50' },
  'outro':        { bg: 'bg-zinc-500/20',     text: 'text-zinc-300',     border: 'border-zinc-500/40',     glow: 'shadow-zinc-500/50' },
  'custom':       { bg: 'bg-pink-500/20',     text: 'text-pink-300',     border: 'border-pink-500/40',     glow: 'shadow-pink-500/50' },
};

export function normalizeSectionType(label: string): SectionType {
  const l = label.toLowerCase().trim();
  if (l.includes('pre')) return 'pre-chorus';
  if (l.includes('chorus')) return 'chorus';
  if (l.includes('verse')) return 'verse';
  if (l.includes('bridge')) return 'bridge';
  if (l.includes('intro')) return 'intro';
  if (l.includes('outro')) return 'outro';
  if (l.includes('tag')) return 'tag';
  if (l.includes('inst') || l.includes('solo') || l.includes('break')) return 'instrumental';
  return 'custom';
}

export interface SongFile {
  id: string;
  song_id: string;
  name: string;
  file_type: 'audio' | 'pdf' | 'document' | 'image';
  mime_type: string | null;
  storage_path: string | null;
  file_url: string | null;
  size_bytes: number | null;
  created_at: string;
}

export interface NumberChart {
  id: string;
  song_id: string;
  key: string | null;
  time_signature: string;
  bpm: number | null;
  chart_data: ChartMeasure[];
  created_at: string;
  updated_at: string;
}

export interface ChartMeasure {
  section?: string; // "Intro", "Verse", "Chorus", etc.
  beats: string[]; // Nashville numbers per beat, e.g. ["1", "4", "5", "1"]
}
