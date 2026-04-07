'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Music2, FileText, Hash, FileAudio, File } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AudioPlayer from '@/components/AudioPlayer';
import NotesEditor from '@/components/NotesEditor';
import NumberChartEditor from '@/components/NumberChartEditor';
import FileUpload from '@/components/FileUpload';
import type { Song, SongFile } from '@/lib/types';

export default function SongPage() {
  const { confId, eventId, setId, songId } = useParams<{
    confId: string; eventId: string; setId: string; songId: string;
  }>();
  const [song, setSong] = useState<Song | null>(null);
  const [files, setFiles] = useState<SongFile[]>([]);

  useEffect(() => {
    fetch(`/api/songs?id=${songId}`).then(r => r.json()).then(setSong);
    loadFiles();
  }, [songId]);

  const loadFiles = () => fetch(`/api/files?song_id=${songId}`).then(r => r.json()).then(setFiles);

  const audioFiles = files.filter(f => f.file_type === 'audio');
  const pdfFiles = files.filter(f => f.file_type === 'pdf');
  const otherFiles = files.filter(f => f.file_type !== 'audio' && f.file_type !== 'pdf');

  return (
    <div className="space-y-6">
      <Link
        href={`/conference/${confId}/event/${eventId}/set/${setId}`}
        className="flex items-center gap-1 text-zinc-500 hover:text-zinc-300 text-sm"
      >
        <ArrowLeft size={16} /> Back to Songs
      </Link>

      {/* Song Header */}
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{song?.title || 'Loading...'}</h1>
          {song?.key && (
            <Badge className="bg-indigo-600 text-white text-sm">{song.key}</Badge>
          )}
          {song?.bpm && (
            <Badge variant="outline" className="text-zinc-400 border-zinc-600">
              {song.bpm} BPM
            </Badge>
          )}
        </div>
        {song?.artist && <p className="text-zinc-400 mt-1">{song.artist}</p>}
        {song?.description && <p className="text-zinc-500 text-sm mt-1">{song.description}</p>}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="media" className="w-full">
        <TabsList className="bg-zinc-900 border border-zinc-800">
          <TabsTrigger value="media" className="gap-1 data-[state=active]:bg-zinc-800">
            <Music2 size={14} /> Media
            {audioFiles.length > 0 && (
              <span className="ml-1 text-xs bg-zinc-700 px-1.5 rounded">{audioFiles.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="notes" className="gap-1 data-[state=active]:bg-zinc-800">
            <FileText size={14} /> Notes
          </TabsTrigger>
          <TabsTrigger value="chart" className="gap-1 data-[state=active]:bg-zinc-800">
            <Hash size={14} /> Number Chart
          </TabsTrigger>
        </TabsList>

        <TabsContent value="media" className="space-y-6 mt-4">
          {/* Audio Player */}
          <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
            <h3 className="text-sm font-medium text-zinc-400 mb-3 flex items-center gap-1">
              <FileAudio size={14} /> Audio Tracks
            </h3>
            <AudioPlayer files={files} />
          </div>

          {/* PDF Files */}
          {pdfFiles.length > 0 && (
            <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
              <h3 className="text-sm font-medium text-zinc-400 mb-3 flex items-center gap-1">
                <File size={14} /> Documents
              </h3>
              <div className="space-y-2">
                {pdfFiles.map(f => (
                  <a
                    key={f.id}
                    href={f.file_url || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-2 rounded hover:bg-zinc-800 text-sm text-zinc-300 transition-colors"
                  >
                    <File size={16} className="text-red-400 shrink-0" />
                    {f.name}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Other Files */}
          {otherFiles.length > 0 && (
            <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
              <h3 className="text-sm font-medium text-zinc-400 mb-3">Other Files</h3>
              <div className="space-y-2">
                {otherFiles.map(f => (
                  <a
                    key={f.id}
                    href={f.file_url || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-2 rounded hover:bg-zinc-800 text-sm text-zinc-300 transition-colors"
                  >
                    <File size={16} className="text-zinc-500 shrink-0" />
                    {f.name}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Upload */}
          <FileUpload songId={songId} onUpload={loadFiles} />
        </TabsContent>

        <TabsContent value="notes" className="mt-4">
          {song && <NotesEditor songId={songId} initialNotes={song.notes} />}
        </TabsContent>

        <TabsContent value="chart" className="mt-4">
          <NumberChartEditor songId={songId} songKey={song?.key || null} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
