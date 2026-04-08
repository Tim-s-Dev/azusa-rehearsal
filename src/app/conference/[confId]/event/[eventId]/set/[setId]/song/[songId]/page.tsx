'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Music2, FileText, Hash, File, Sparkles, ListTree, Piano as PianoIcon } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AudioPlayer from '@/components/AudioPlayer';
import NotesEditor from '@/components/NotesEditor';
import NumberChartEditor from '@/components/NumberChartEditor';
import FileUpload from '@/components/FileUpload';
import DissectButton from '@/components/DissectButton';
import DissectionViewer from '@/components/DissectionViewer';
import SongTimeline from '@/components/SongTimeline';
import StructureView from '@/components/StructureView';
import Piano from '@/components/Piano';
import type { Song, SongFile } from '@/lib/types';

export default function SongPage() {
  const { confId, eventId, setId, songId } = useParams<{
    confId: string; eventId: string; setId: string; songId: string;
  }>();
  const [song, setSong] = useState<Song | null>(null);
  const [files, setFiles] = useState<SongFile[]>([]);

  useEffect(() => {
    loadSong();
    loadFiles();
  }, [songId]);

  const loadSong = () => fetch(`/api/songs?id=${songId}`).then(r => r.json()).then(setSong);
  const loadFiles = () => fetch(`/api/files?song_id=${songId}`).then(r => r.json()).then(setFiles);
  const onDissectComplete = () => { loadSong(); loadFiles(); };

  const audioFiles = files.filter(f => f.file_type === 'audio');
  const pdfFiles = files.filter(f => f.file_type === 'pdf');
  const otherFiles = files.filter(f => f.file_type !== 'audio' && f.file_type !== 'pdf');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href={`/conference/${confId}/event/${eventId}/set/${setId}`}
          className="inline-flex items-center gap-1 text-zinc-500 hover:text-violet-400 text-sm transition-colors"
        >
          <ArrowLeft size={16} /> Back
        </Link>
        <Link
          href={`/live/${songId}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-red-600 to-fuchsia-600 hover:scale-105 transition-transform text-white text-xs font-bold shadow-lg shadow-red-600/30"
        >
          ● LIVE MODE
        </Link>
      </div>

      {/* Song Header - hero card */}
      <div className="glass rounded-3xl p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-violet-600/20 to-fuchsia-600/20 blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-2">
            {song?.key && (
              <div className="px-3 py-1 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white text-xs font-bold tracking-wider">
                KEY · {song.key}
              </div>
            )}
            {song?.bpm && (
              <div className="px-3 py-1 rounded-full glass text-xs font-mono">
                {song.bpm} BPM
              </div>
            )}
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-1">{song?.title || 'Loading...'}</h1>
          {song?.artist && <p className="text-zinc-400 text-lg">{song.artist}</p>}
          {song?.description && <p className="text-zinc-500 text-sm mt-2">{song.description}</p>}
        </div>
      </div>

      {/* Compact timeline */}
      {song && <SongTimeline song={song} mode="compact" />}

      {/* Tabs */}
      <Tabs defaultValue="media" className="w-full">
        <TabsList className="glass p-1 rounded-full h-auto gap-1">
          <TabsTrigger value="media" className="rounded-full px-4 py-2 gap-1.5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-600 data-[state=active]:to-fuchsia-600 data-[state=active]:text-white">
            <Music2 size={14} /> Media
            {audioFiles.length > 0 && (
              <span className="ml-1 text-xs bg-white/20 px-1.5 rounded-full">{audioFiles.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="notes" className="rounded-full px-4 py-2 gap-1.5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-600 data-[state=active]:to-fuchsia-600 data-[state=active]:text-white">
            <FileText size={14} /> Notes
          </TabsTrigger>
          <TabsTrigger value="chart" className="rounded-full px-4 py-2 gap-1.5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-600 data-[state=active]:to-fuchsia-600 data-[state=active]:text-white">
            <Hash size={14} /> Chart
          </TabsTrigger>
          <TabsTrigger value="structure" className="rounded-full px-4 py-2 gap-1.5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-600 data-[state=active]:to-fuchsia-600 data-[state=active]:text-white">
            <ListTree size={14} /> Structure
          </TabsTrigger>
          <TabsTrigger value="piano" className="rounded-full px-4 py-2 gap-1.5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-600 data-[state=active]:to-fuchsia-600 data-[state=active]:text-white">
            <PianoIcon size={14} /> Piano
          </TabsTrigger>
          <TabsTrigger value="dissect" className="rounded-full px-4 py-2 gap-1.5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-600 data-[state=active]:to-fuchsia-600 data-[state=active]:text-white">
            <Sparkles size={14} /> AI
          </TabsTrigger>
        </TabsList>

        <TabsContent value="media" className="space-y-4 mt-6">
          {/* Audio Player */}
          <div className="glass rounded-3xl p-6">
            {song && <AudioPlayer files={files} song={song} />}
          </div>

          {/* PDF Files */}
          {pdfFiles.length > 0 && (
            <div className="glass rounded-3xl p-6">
              <h3 className="text-xs uppercase tracking-wider text-zinc-500 mb-3 flex items-center gap-1">
                <File size={12} /> Documents
              </h3>
              <div className="space-y-1">
                {pdfFiles.map(f => (
                  <a
                    key={f.id}
                    href={f.file_url || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 text-sm transition-colors group"
                  >
                    <div className="p-2 rounded-lg bg-red-500/10 text-red-400">
                      <File size={16} />
                    </div>
                    <span className="flex-1 truncate group-hover:text-white">{f.name}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Other Files */}
          {otherFiles.length > 0 && (
            <div className="glass rounded-3xl p-6">
              <h3 className="text-xs uppercase tracking-wider text-zinc-500 mb-3">Other</h3>
              <div className="space-y-1">
                {otherFiles.map(f => (
                  <a
                    key={f.id}
                    href={f.file_url || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 text-sm transition-colors"
                  >
                    <File size={16} className="text-zinc-500" />
                    {f.name}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Upload */}
          <FileUpload songId={songId} onUpload={loadFiles} />
        </TabsContent>

        <TabsContent value="notes" className="mt-6">
          <div className="glass rounded-3xl p-6">
            {song && <NotesEditor songId={songId} initialNotes={song.notes} />}
          </div>
        </TabsContent>

        <TabsContent value="chart" className="mt-6 space-y-4">
          <div className="glass rounded-3xl p-6">
            <NumberChartEditor
              songId={songId}
              songKey={song?.key || null}
              audioFiles={files}
              onDissectComplete={onDissectComplete}
            />
          </div>
        </TabsContent>

        <TabsContent value="structure" className="mt-6">
          <div className="glass rounded-3xl p-6">
            {song && (
              <StructureView
                song={song}
                audioFiles={files}
                onSongChange={loadSong}
              />
            )}
          </div>
        </TabsContent>

        <TabsContent value="piano" className="mt-6">
          <div className="glass rounded-3xl p-6">
            <Piano songKey={song?.key || null} octaves={2} startMidi={48} />
            <p className="text-xs text-zinc-500 mt-3 text-center">
              Tap keys to play notes. Scale tones for {song?.key || 'this key'} are highlighted.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="dissect" className="mt-6 space-y-4">
          <div className="glass rounded-3xl p-6 space-y-4">
            <div>
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Sparkles size={18} className="text-violet-400" />
                AI Dissection
              </h3>
              <p className="text-sm text-zinc-500 mt-1">
                Run AI on the audio to extract chords, sections, and BPM. Generates a Nashville Number chart.
              </p>
            </div>
            <DissectButton songId={songId} audioFiles={audioFiles} onComplete={onDissectComplete} />
          </div>

          {song?.dissection_status === 'processing' && (
            <div className="glass rounded-3xl p-8 text-center text-zinc-400">
              <Sparkles size={24} className="mx-auto mb-2 text-violet-400 animate-pulse" />
              Processing audio... this can take 30-90 seconds.
            </div>
          )}

          {song?.dissection_md && (
            <div className="glass rounded-3xl p-8">
              <DissectionViewer markdown={song.dissection_md} />
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
