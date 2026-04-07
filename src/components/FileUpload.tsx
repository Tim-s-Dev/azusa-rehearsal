'use client';

import { useState, useRef } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FileUploadProps {
  songId: string;
  onUpload: () => void;
}

export default function FileUpload({ songId, onUpload }: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFiles = async (fileList: FileList) => {
    setUploading(true);
    for (const file of Array.from(fileList)) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('song_id', songId);
      await fetch('/api/files/upload', { method: 'POST', body: formData });
    }
    setUploading(false);
    onUpload();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
        dragOver ? 'border-indigo-500 bg-indigo-500/10' : 'border-zinc-700 hover:border-zinc-500'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && uploadFiles(e.target.files)}
        accept="audio/*,application/pdf,image/*,.doc,.docx"
      />
      <Upload size={24} className="mx-auto text-zinc-500 mb-2" />
      <p className="text-sm text-zinc-400">
        {uploading ? 'Uploading...' : 'Drop files here or'}
      </p>
      {!uploading && (
        <Button variant="outline" size="sm" className="mt-2" onClick={() => inputRef.current?.click()}>
          Browse Files
        </Button>
      )}
    </div>
  );
}
