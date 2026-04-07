'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Plus, Clock, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import type { Conference, Event } from '@/lib/types';

export default function ConferencePage() {
  const { confId } = useParams<{ confId: string }>();
  const [conf, setConf] = useState<Conference | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', date: '', start_time: '', end_time: '' });

  useEffect(() => {
    fetch(`/api/conferences`).then(r => r.json()).then((all: Conference[]) => {
      setConf(all.find(c => c.id === confId) || null);
    });
    fetch(`/api/events?conference_id=${confId}`).then(r => r.json()).then(setEvents);
  }, [confId]);

  const create = async () => {
    await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, conference_id: confId, sort_order: events.length }),
    });
    setForm({ name: '', date: '', start_time: '', end_time: '' });
    setOpen(false);
    fetch(`/api/events?conference_id=${confId}`).then(r => r.json()).then(setEvents);
  };

  return (
    <div className="space-y-6">
      <Link href="/" className="flex items-center gap-1 text-zinc-500 hover:text-zinc-300 text-sm">
        <ArrowLeft size={16} /> All Conferences
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{conf?.name || 'Loading...'}</h1>
          {conf?.location && <p className="text-zinc-400 text-sm mt-1">{conf.location}</p>}
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger className="inline-flex items-center justify-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Plus size={14} /> Event
          </DialogTrigger>
          <DialogContent className="bg-zinc-900 border-zinc-700">
            <DialogHeader><DialogTitle>New Event</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Event Name (e.g. Opening Night)" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="bg-zinc-800 border-zinc-700" />
              <Input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="bg-zinc-800 border-zinc-700" />
              <div className="grid grid-cols-2 gap-2">
                <Input type="time" placeholder="Start" value={form.start_time} onChange={e => setForm({...form, start_time: e.target.value})} className="bg-zinc-800 border-zinc-700" />
                <Input type="time" placeholder="End" value={form.end_time} onChange={e => setForm({...form, end_time: e.target.value})} className="bg-zinc-800 border-zinc-700" />
              </div>
              <Button onClick={create} className="w-full">Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3">
        {events.map(ev => (
          <Link key={ev.id} href={`/conference/${confId}/event/${ev.id}`}>
            <Card className="p-4 bg-zinc-900 border-zinc-800 hover:border-indigo-500/50 transition-colors cursor-pointer">
              <h3 className="font-semibold text-white">{ev.name}</h3>
              <div className="flex items-center gap-3 mt-1.5 text-sm text-zinc-400">
                {ev.date && (
                  <span className="flex items-center gap-1">
                    <Calendar size={13} />
                    {new Date(ev.date + 'T00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </span>
                )}
                {ev.start_time && (
                  <span className="flex items-center gap-1">
                    <Clock size={13} />
                    {ev.start_time.slice(0, 5)}{ev.end_time ? ` – ${ev.end_time.slice(0, 5)}` : ''}
                  </span>
                )}
              </div>
            </Card>
          </Link>
        ))}
        {events.length === 0 && (
          <p className="text-center py-12 text-zinc-500">No events yet. Add one to get started.</p>
        )}
      </div>
    </div>
  );
}
