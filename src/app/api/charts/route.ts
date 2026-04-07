import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const songId = req.nextUrl.searchParams.get('song_id');
  if (!songId) return NextResponse.json({ error: 'song_id required' }, { status: 400 });
  const { data, error } = await supabase
    .from('number_charts')
    .select('*')
    .eq('song_id', songId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { data: existing } = await supabase
    .from('number_charts')
    .select('id')
    .eq('song_id', body.song_id)
    .limit(1)
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from('number_charts')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  const { data, error } = await supabase.from('number_charts').insert(body).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
