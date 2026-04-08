'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Plus, Users, ArrowUpRight, Clock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
    <div className="space-y-8">
      <Link href={`/conference/${confId}`} className="inline-flex items-center gap-1 text-zinc-500 hover:text-violet-400 text-sm transition-colors">
        <ArrowLeft size={16} /> Back to Events
      </Link>

      {/* Hero */}
      <div className="glass rounded-3xl p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-fuchsia-600/20 to-blue-600/20 blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-fuchsia-400 mb-2">Event</p>
            <h1 className="text-4xl font-bold tracking-tight mb-2">{event?.name || 'Loading...'}</h1>
            {event?.date && (
              <p className="text-zinc-400">
                {new Date(event.date + 'T00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            )}
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:scale-105 transition-transform text-white text-sm font-medium shadow-lg shadow-violet-600/20">
              <Plus size={14} /> Set
            </DialogTrigger>
            <DialogContent className="bg-zinc-950/95 backdrop-blur-xl border-zinc-800">
              <DialogHeader><DialogTitle>New Set</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Input placeholder="Artist / Worship Leader" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="bg-zinc-900/50 border-zinc-800 h-11" />
                <Input type="time" value={form.start_time} onChange={e => setForm({...form, start_time: e.target.value})} className="bg-zinc-900/50 border-zinc-800 h-11" />
                <Button onClick={create} className="w-full h-11 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500">Create Set</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Sets */}
      <div>
        <h2 className="text-xs uppercase tracking-wider text-zinc-500 mb-3">Sets ({sets.length})</h2>
        <div className="space-y-3">
          {sets.map((s, i) => (
            <Link key={s.id} href={`/conference/${confId}/event/${eventId}/set/${s.id}`} className="group block">
              <div className="glass rounded-2xl p-5 transition-all hover:scale-[1.01] cursor-pointer">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-violet-600/20 to-fuchsia-600/20">
                      <Users size={18} className="text-violet-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{s.name}</h3>
                      {s.start_time && (
                        <p className="text-sm text-zinc-500 flex items-center gap-1 mt-0.5">
                          <Clock size={12} /> {s.start_time.slice(0, 5)}
                        </p>
                      )}
                    </div>
                  </div>
                  <ArrowUpRight size={18} className="text-zinc-600 group-hover:text-white transition-colors" />
                </div>
              </div>
            </Link>
          ))}
        </div>
        {sets.length === 0 && (
          <div className="glass rounded-2xl p-12 text-center text-zinc-500">No sets yet</div>
        )}
      </div>
    </div>
  );
}
