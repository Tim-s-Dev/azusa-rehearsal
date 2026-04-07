'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Calendar, MapPin, Music } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Music size={28} className="text-indigo-500" />
            Rehearsal
          </h1>
          <p className="text-zinc-500 mt-1">Your conferences and worship events</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger className="inline-flex items-center justify-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Plus size={16} /> Conference
          </DialogTrigger>
          <DialogContent className="bg-zinc-900 border-zinc-700">
            <DialogHeader>
              <DialogTitle>New Conference</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Conference Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="bg-zinc-800 border-zinc-700" />
              <Input placeholder="Location" value={form.location} onChange={e => setForm({...form, location: e.target.value})} className="bg-zinc-800 border-zinc-700" />
              <div className="grid grid-cols-2 gap-2">
                <Input type="date" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} className="bg-zinc-800 border-zinc-700" />
                <Input type="date" value={form.end_date} onChange={e => setForm({...form, end_date: e.target.value})} className="bg-zinc-800 border-zinc-700" />
              </div>
              <Button onClick={create} className="w-full">Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {conferences.length === 0 ? (
        <div className="text-center py-20 text-zinc-500">
          <Music size={48} className="mx-auto mb-4 opacity-50" />
          <p>No conferences yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {conferences.map(conf => (
            <Link key={conf.id} href={`/conference/${conf.id}`}>
              <Card className="p-5 bg-zinc-900 border-zinc-800 hover:border-indigo-500/50 transition-colors cursor-pointer">
                <h2 className="text-xl font-bold text-white">{conf.name}</h2>
                <div className="flex items-center gap-4 mt-2 text-sm text-zinc-400">
                  {conf.location && (
                    <span className="flex items-center gap-1"><MapPin size={14} /> {conf.location}</span>
                  )}
                  {conf.start_date && (
                    <span className="flex items-center gap-1">
                      <Calendar size={14} />
                      {new Date(conf.start_date + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      {conf.end_date && ` – ${new Date(conf.end_date + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                    </span>
                  )}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
