import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (id) {
    // Single setlist with its songs joined
    const { data, error } = await supabase
      .from('setlists')
      .select('*, setlist_songs(*, songs(*))')
      .eq('id', id)
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    // Sort songs by sort_order
    if (data?.setlist_songs) {
      data.setlist_songs.sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order);
    }
    return NextResponse.json(data);
  }
  const { data, error } = await supabase
    .from('setlists')
    .select('*, setlist_songs(count)')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { data, error } = await supabase.from('setlists').insert(body).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, ...updates } = body;
  // Handle setlist_songs updates (reorder, add, remove, key overrides)
  if (updates.songs) {
    // Delete existing and re-insert
    await supabase.from('setlist_songs').delete().eq('setlist_id', id);
    const rows = updates.songs.map((s: { song_id: string; sort_order: number; key_override?: string; notes?: string }, i: number) => ({
      setlist_id: id,
      song_id: s.song_id,
      sort_order: s.sort_order ?? i,
      key_override: s.key_override || null,
      notes: s.notes || null,
    }));
    if (rows.length > 0) {
      await supabase.from('setlist_songs').insert(rows);
    }
    return NextResponse.json({ success: true });
  }
  const { data, error } = await supabase.from('setlists').update(updates).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const { error } = await supabase.from('setlists').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
