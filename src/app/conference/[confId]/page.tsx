'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Plus, Clock, Calendar, ArrowUpRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
    <div className="space-y-8">
      <Link href="/" className="inline-flex items-center gap-1 text-zinc-500 hover:text-violet-400 text-sm transition-colors">
        <ArrowLeft size={16} /> All Conferences
      </Link>

      {/* Hero */}
      <div className="glass rounded-3xl p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-violet-600/20 to-fuchsia-600/20 blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-violet-400 mb-2">Conference</p>
            <h1 className="text-4xl font-bold tracking-tight mb-3">{conf?.name || 'Loading...'}</h1>
            {conf?.location && <p className="text-zinc-400">{conf.location}</p>}
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:scale-105 transition-transform text-white text-sm font-medium shadow-lg shadow-violet-600/20">
              <Plus size={14} /> Event
            </DialogTrigger>
            <DialogContent className="bg-zinc-950/95 backdrop-blur-xl border-zinc-800">
              <DialogHeader><DialogTitle>New Event</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Input placeholder="Event Name (e.g. Opening Night)" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="bg-zinc-900/50 border-zinc-800 h-11" />
                <Input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="bg-zinc-900/50 border-zinc-800 h-11" />
                <div className="grid grid-cols-2 gap-2">
                  <Input type="time" value={form.start_time} onChange={e => setForm({...form, start_time: e.target.value})} className="bg-zinc-900/50 border-zinc-800 h-11" />
                  <Input type="time" value={form.end_time} onChange={e => setForm({...form, end_time: e.target.value})} className="bg-zinc-900/50 border-zinc-800 h-11" />
                </div>
                <Button onClick={create} className="w-full h-11 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500">Create Event</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Events */}
      <div>
        <h2 className="text-xs uppercase tracking-wider text-zinc-500 mb-3">Events</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {events.map((ev, i) => (
            <Link key={ev.id} href={`/conference/${confId}/event/${ev.id}`} className="group">
              <div className="glass rounded-2xl p-5 transition-all hover:scale-[1.02] cursor-pointer">
                <div className="flex items-start justify-between mb-3">
                  <div className={`px-2 py-1 rounded-lg text-xs font-mono ${
                    i % 4 === 0 ? 'bg-violet-500/10 text-violet-400'
                    : i % 4 === 1 ? 'bg-fuchsia-500/10 text-fuchsia-400'
                    : i % 4 === 2 ? 'bg-blue-500/10 text-blue-400'
                    : 'bg-emerald-500/10 text-emerald-400'
                  }`}>
                    #{i + 1}
                  </div>
                  <ArrowUpRight size={16} className="text-zinc-600 group-hover:text-white transition-colors" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{ev.name}</h3>
                <div className="flex flex-wrap gap-3 text-sm text-zinc-400">
                  {ev.date && (
                    <span className="flex items-center gap-1">
                      <Calendar size={13} className="text-zinc-600" />
                      {new Date(ev.date + 'T00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </span>
                  )}
                  {ev.start_time && (
                    <span className="flex items-center gap-1">
                      <Clock size={13} className="text-zinc-600" />
                      {ev.start_time.slice(0, 5)}{ev.end_time ? `–${ev.end_time.slice(0, 5)}` : ''}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
        {events.length === 0 && (
          <div className="glass rounded-2xl p-12 text-center text-zinc-500">No events yet</div>
        )}
      </div>
    </div>
  );
}
