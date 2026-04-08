'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Calendar, MapPin, Music2 as Music, Sparkles, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type { Conference } from '@/lib/types';

export default function HomePage() {
  const [conferences, setConferences] = useState<Conference[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', location: '', start_date: '', end_date: '' });

  const load = () => fetch('/api/conferences').then(r => r.json()).then(setConferences);
  useEffect(() => { load(); }, []);

  const create = async () => {
    await fetch('/api/conferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setForm({ name: '', location: '', start_date: '', end_date: '' });
    setOpen(false);
    load();
  };

  return (
    <div className="space-y-10">
      {/* Hero */}
      <div className="flex items-start justify-between pt-4">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass text-xs text-zinc-400">
            <Sparkles size={12} className="text-violet-400" />
            Rehearsal Studio
          </div>
          <h1 className="text-5xl font-bold tracking-tight">
            <span className="gradient-text">Rehearse</span>
            <span className="text-white"> like a pro.</span>
          </h1>
          <p className="text-zinc-400 text-lg max-w-md">
            Multi-track audio, smart notes, and Nashville Number charts — all in one place.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-medium shadow-lg shadow-violet-600/20 transition-all hover:shadow-violet-600/40 hover:scale-105">
            <Plus size={16} /> New Conference
          </DialogTrigger>
          <DialogContent className="bg-zinc-950/95 backdrop-blur-xl border-zinc-800">
            <DialogHeader>
              <DialogTitle className="text-xl">Create Conference</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Conference Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="bg-zinc-900/50 border-zinc-800 h-11" />
              <Input placeholder="Location" value={form.location} onChange={e => setForm({...form, location: e.target.value})} className="bg-zinc-900/50 border-zinc-800 h-11" />
              <div className="grid grid-cols-2 gap-2">
                <Input type="date" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} className="bg-zinc-900/50 border-zinc-800 h-11" />
                <Input type="date" value={form.end_date} onChange={e => setForm({...form, end_date: e.target.value})} className="bg-zinc-900/50 border-zinc-800 h-11" />
              </div>
              <Button onClick={create} className="w-full h-11 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500">Create Conference</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Conference grid */}
      {conferences.length === 0 ? (
        <div className="glass rounded-3xl p-16 text-center">
          <div className="inline-flex p-4 rounded-2xl bg-violet-500/10 mb-4">
            <Music size={32} className="text-violet-400" />
          </div>
          <p className="text-zinc-400 text-lg">No conferences yet</p>
          <p className="text-zinc-600 text-sm mt-1">Create one to get started</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {conferences.map((conf, i) => (
            <Link key={conf.id} href={`/conference/${conf.id}`} className="group">
              <div className="glass rounded-3xl p-6 transition-all hover:scale-[1.02] hover:shadow-2xl hover:shadow-violet-600/10 cursor-pointer h-full">
                <div className="flex items-start justify-between mb-4">
                  <div className={`inline-flex p-2.5 rounded-xl ${
                    i % 3 === 0 ? 'bg-violet-500/10 text-violet-400'
                    : i % 3 === 1 ? 'bg-fuchsia-500/10 text-fuchsia-400'
                    : 'bg-blue-500/10 text-blue-400'
                  }`}>
                    <Music size={18} />
                  </div>
                  <ArrowUpRight size={20} className="text-zinc-600 group-hover:text-white transition-colors" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-3 leading-tight">{conf.name}</h2>
                <div className="space-y-1.5 text-sm text-zinc-400">
                  {conf.location && (
                    <div className="flex items-center gap-2">
                      <MapPin size={14} className="text-zinc-600" />
                      {conf.location}
                    </div>
                  )}
                  {conf.start_date && (
                    <div className="flex items-center gap-2">
                      <Calendar size={14} className="text-zinc-600" />
                      {new Date(conf.start_date + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      {conf.end_date && ` – ${new Date(conf.end_date + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                    </div>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
