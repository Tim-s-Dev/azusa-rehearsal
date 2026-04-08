import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  const eventId = req.nextUrl.searchParams.get('event_id');
  if (id) {
    const { data, error } = await supabase.from('sets').select('*').eq('id', id).maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }
  let query = supabase.from('sets').select('*').order('sort_order');
  if (eventId) query = query.eq('event_id', eventId);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { data, error } = await supabase.from('sets').insert(body).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
