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
