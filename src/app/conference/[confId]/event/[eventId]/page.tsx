'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Plus, Music, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import type { Event, Set } from '@/lib/types';

export default function EventPage() {
  const { confId, eventId } = useParams<{ confId: string; eventId: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [sets, setSets] = useState<Set[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', start_time: '' });

  useEffect(() => {
    fetch(`/api/events?conference_id=${confId}`).then(r => r.json()).then((all: Event[]) => {
      setEvent(all.find(e => e.id === eventId) || null);
    });
    fetch(`/api/sets?event_id=${eventId}`).then(r => r.json()).then(setSets);
  }, [confId, eventId]);

  const create = async () => {
    await fetch('/api/sets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, event_id: eventId, sort_order: sets.length }),
    });
    setForm({ name: '', start_time: '' });
    setOpen(false);
    fetch(`/api/sets?event_id=${eventId}`).then(r => r.json()).then(setSets);
  };

  return (
    <div className="space-y-6">
      <Link href={`/conference/${confId}`} className="flex items-center gap-1 text-zinc-500 hover:text-zinc-300 text-sm">
        <ArrowLeft size={16} /> Back to Events
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{event?.name || 'Loading...'}</h1>
          {event?.date && (
            <p className="text-zinc-400 text-sm mt-1">
              {new Date(event.date + 'T00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          )}
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger className="inline-flex items-center justify-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Plus size={14} /> Set
          </DialogTrigger>
          <DialogContent className="bg-zinc-900 border-zinc-700">
            <DialogHeader><DialogTitle>New Set</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Artist / Worship Leader" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="bg-zinc-800 border-zinc-700" />
              <Input type="time" placeholder="Start Time" value={form.start_time} onChange={e => setForm({...form, start_time: e.target.value})} className="bg-zinc-800 border-zinc-700" />
              <Button onClick={create} className="w-full">Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3">
        {sets.map(s => (
          <Link key={s.id} href={`/conference/${confId}/event/${eventId}/set/${s.id}`}>
            <Card className="p-4 bg-zinc-900 border-zinc-800 hover:border-indigo-500/50 transition-colors cursor-pointer">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-indigo-400" />
                <h3 className="font-semibold text-white">{s.name}</h3>
              </div>
              {s.start_time && (
                <p className="text-sm text-zinc-500 mt-1 ml-6">{s.start_time.slice(0, 5)}</p>
              )}
            </Card>
          </Link>
        ))}
        {sets.length === 0 && (
          <p className="text-center py-12 text-zinc-500">No sets yet. Add one to get started.</p>
        )}
      </div>
    </div>
  );
}
