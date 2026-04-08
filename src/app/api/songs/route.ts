import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const setId = req.nextUrl.searchParams.get('set_id');
  const songId = req.nextUrl.searchParams.get('id');
  const all = req.nextUrl.searchParams.get('all');
  const search = req.nextUrl.searchParams.get('search');

  if (songId) {
    const { data, error } = await supabase.from('songs').select('*').eq('id', songId).single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  if (all || search) {
    // Library mode: return all songs with set/event/conference info joined
    let query = supabase
      .from('songs')
      .select(`*, sets(id, name, event_id, events(id, name, conference_id, conferences(id, name)))`)
      .order('title');
    if (search) query = query.ilike('title', `%${search}%`);
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  let query = supabase.from('songs').select('*').order('sort_order');
  if (setId) query = query.eq('set_id', setId);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { data, error } = await supabase.from('songs').insert(body).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, ...updates } = body;
  const { data, error } = await supabase.from('songs').update(updates).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
