-- Azusa Rehearsal App Schema
create extension if not exists "uuid-ossp";

-- Conferences
create table conferences (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  location text,
  start_date date,
  end_date date,
  created_at timestamptz default now()
);

-- Events within a conference
create table events (
  id uuid primary key default uuid_generate_v4(),
  conference_id uuid not null references conferences(id) on delete cascade,
  name text not null,
  description text,
  date date,
  start_time time,
  end_time time,
  sort_order int default 0,
  created_at timestamptz default now()
);

-- Sets within an event (artist/worship leader grouping)
create table sets (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid not null references events(id) on delete cascade,
  name text not null,
  description text,
  start_time time,
  sort_order int default 0,
  created_at timestamptz default now()
);

-- Songs within a set
create table songs (
  id uuid primary key default uuid_generate_v4(),
  set_id uuid not null references sets(id) on delete cascade,
  title text not null,
  artist text,
  key text,
  bpm int,
  duration text,
  notes text,
  description text,
  sort_order int default 0,
  created_at timestamptz default now()
);

-- Files attached to songs
create table files (
  id uuid primary key default uuid_generate_v4(),
  song_id uuid not null references songs(id) on delete cascade,
  name text not null,
  file_type text not null, -- 'audio', 'pdf', 'document', 'image'
  mime_type text,
  storage_path text,
  file_url text,
  size_bytes bigint,
  created_at timestamptz default now()
);

-- Number charts per song
create table number_charts (
  id uuid primary key default uuid_generate_v4(),
  song_id uuid not null references songs(id) on delete cascade,
  key text,
  time_signature text default '4/4',
  bpm int,
  chart_data jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Indexes
create index idx_events_conference on events(conference_id);
create index idx_sets_event on sets(event_id);
create index idx_songs_set on songs(set_id);
create index idx_files_song on files(song_id);
create index idx_charts_song on number_charts(song_id);

-- Storage bucket for files
insert into storage.buckets (id, name, public) values ('azusa-files', 'azusa-files', true)
on conflict (id) do nothing;

-- Allow public read access to files bucket
create policy "Public read access" on storage.objects for select using (bucket_id = 'azusa-files');
create policy "Authenticated upload" on storage.objects for insert with check (bucket_id = 'azusa-files');
create policy "Authenticated delete" on storage.objects for delete using (bucket_id = 'azusa-files');
