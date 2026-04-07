'use client';

import { useState, useEffect, useCallback } from 'react';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface NotesEditorProps {
  songId: string;
  initialNotes: string | null;
}

export default function NotesEditor({ songId, initialNotes }: NotesEditorProps) {
  const [notes, setNotes] = useState(initialNotes || '');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setNotes(initialNotes || '');
    setDirty(false);
  }, [initialNotes]);

  const save = useCallback(async () => {
    setSaving(true);
    await fetch('/api/songs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: songId, notes }),
    });
    setSaving(false);
    setDirty(false);
  }, [songId, notes]);

  // Auto-save after 2 seconds of inactivity
  useEffect(() => {
    if (!dirty) return;
    const timer = setTimeout(save, 2000);
    return () => clearTimeout(timer);
  }, [notes, dirty, save]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">
          {dirty ? 'Unsaved changes...' : saving ? 'Saving...' : 'Auto-saved'}
        </p>
        <Button onClick={save} disabled={saving || !dirty} size="sm" variant="outline" className="gap-1">
          <Save size={14} />
          Save
        </Button>
      </div>
      <Textarea
        value={notes}
        onChange={(e) => { setNotes(e.target.value); setDirty(true); }}
        placeholder="Add your rehearsal notes here..."
        className="min-h-[300px] bg-zinc-900 border-zinc-700 text-white resize-y font-mono text-sm"
      />
    </div>
  );
}
