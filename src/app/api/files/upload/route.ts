import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const supabase = getServiceSupabase();
  const formData = await req.formData();
  const file = formData.get('file') as File;
  const songId = formData.get('song_id') as string;

  if (!file || !songId) {
    return NextResponse.json({ error: 'file and song_id required' }, { status: 400 });
  }

  const ext = file.name.split('.').pop() || '';
  const fileType = file.type.startsWith('audio/') ? 'audio'
    : file.type === 'application/pdf' ? 'pdf'
    : file.type.startsWith('image/') ? 'image'
    : 'document';

  const path = `${songId}/${Date.now()}-${file.name}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from('azusa-files')
    .upload(path, buffer, { contentType: file.type });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: urlData } = supabase.storage.from('azusa-files').getPublicUrl(path);

  const { data, error } = await supabase.from('files').insert({
    song_id: songId,
    name: file.name,
    file_type: fileType,
    mime_type: file.type,
    storage_path: path,
    file_url: urlData.publicUrl,
    size_bytes: file.size,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
