import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  const confId = req.nextUrl.searchParams.get('conference_id');
  if (id) {
    const { data, error } = await supabase.from('events').select('*').eq('id', id).maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }
  let query = supabase.from('events').select('*').order('sort_order');
  if (confId) query = query.eq('conference_id', confId);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { data, error } = await supabase.from('events').insert(body).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
