import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { chordToNashville, detectKey, snapChordToKey, type SongSection, type ChordEvent } from '@/lib/nashville';

const REPLICATE_TOKEN = process.env.REPLICATE_API_TOKEN;
const STRUCTURE_MODEL = '001b4137be6ac67bdc28cb5cffacf128b874f530258d033de23121e785cb7290';
const CHORD_SERVICE_URL = process.env.CHORD_SERVICE_URL || 'http://5.161.122.179:8201';
const CHORDINO_SERVICE_URL = process.env.CHORDINO_SERVICE_URL || 'http://5.161.122.179:8202';

interface SegmentRaw { start: number; end: number; label: string }
interface AnalysisJson {
  bpm: number;
  beats: number[];
  downbeats: number[];
  segments: SegmentRaw[];
  beat_positions?: number[];
}

export async function POST(req: NextRequest) {
  if (!REPLICATE_TOKEN) {
    return NextResponse.json({ error: 'REPLICATE_API_TOKEN not configured' }, { status: 500 });
  }

  const { song_id, file_url } = await req.json();
  if (!song_id || !file_url) {
    return NextResponse.json({ error: 'song_id and file_url required' }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  await supabase.from('songs').update({ dissection_status: 'processing' }).eq('id', song_id);

  const { data: song } = await supabase.from('songs').select('*').eq('id', song_id).single();
  if (!song) return NextResponse.json({ error: 'Song not found' }, { status: 404 });

  try {
    // 1. Submit prediction
    const createRes = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${REPLICATE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: STRUCTURE_MODEL,
        input: {
          music_input: file_url,
          model: 'harmonix-all',
          visualize: false,
          sonify: false,
          activ: false,
          embed: false,
          include_activations: false,
          include_embeddings: false,
        },
      }),
    });

    if (!createRes.ok) {
      throw new Error(`Replicate create failed: ${await createRes.text()}`);
    }

    const prediction = await createRes.json();
    const predictionId = prediction.id;

    // 2. Poll
    let result = prediction;
    for (let i = 0; i < 300; i++) {
      if (result.status === 'succeeded' || result.status === 'failed' || result.status === 'canceled') break;
      await new Promise(r => setTimeout(r, 1000));
      const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
        headers: { 'Authorization': `Token ${REPLICATE_TOKEN}` },
      });
      result = await pollRes.json();
    }

    if (result.status !== 'succeeded') {
      throw new Error(`Replicate failed: ${result.error || result.status}`);
    }

    // 3. Output is a list of URLs to JSON files
    const output = result.output;
    const jsonUrl = Array.isArray(output) ? output[0] : output;
    if (!jsonUrl || typeof jsonUrl !== 'string') {
      throw new Error('No JSON URL in output');
    }

    const analysisRes = await fetch(jsonUrl);
    const analysis: AnalysisJson = await analysisRes.json();

    const bpm = Math.round(analysis.bpm || song.bpm || 90);
    const segments = (analysis.segments || []).filter(s => s.label !== 'start' && s.label !== 'end');
    const downbeats = analysis.downbeats || [];

    // 4. Run REAL chord detection via Chordino on Hetzner
    // Prefer the "Arrangement" or full-mix file for chord recognition since
    // Chordino works best with full harmonic content.
    const { data: songFiles } = await supabase
      .from('files')
      .select('name, file_url')
      .eq('song_id', song_id)
      .eq('file_type', 'audio');

    const arrangementFile = (songFiles || []).find(f =>
      /arrangement|full|mix|master/i.test(f.name)
    );
    const chordSourceUrl = arrangementFile?.file_url || file_url;

    let detectedChords: ChordEvent[] = [];

    try {
      const chordinoRes = await fetch(`${CHORDINO_SERVICE_URL}/detect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: chordSourceUrl }),
        signal: AbortSignal.timeout(240_000),
      });
      if (chordinoRes.ok) {
        const chordData = await chordinoRes.json();
        detectedChords = (chordData.chords || []).filter((c: ChordEvent) => c.chord && c.chord !== 'N');
        console.log(`Chordino detected ${detectedChords.length} chords`);
      }
    } catch (chordErr) {
      console.error('Chordino service failed:', chordErr);
    }

    // Fallback to v1 librosa detector if Chordino failed
    if (detectedChords.length === 0) {
      try {
        const fallbackRes = await fetch(`${CHORD_SERVICE_URL}/detect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: chordSourceUrl }),
          signal: AbortSignal.timeout(180_000),
        });
        if (fallbackRes.ok) {
          const fallbackData = await fallbackRes.json();
          detectedChords = (fallbackData.chords || []).filter((c: ChordEvent) => c.chord && c.chord !== 'N');
        }
      } catch (e) {
        console.error('Fallback also failed:', e);
      }
    }

    // 6. Auto-detect key from chord distribution
    let workingKey = song.key || 'C';
    if (detectedChords.length > 5) {
      workingKey = detectKey(detectedChords);
    }

    // 7. Snap chromatic chords to nearest diatonic in detected key
    detectedChords = detectedChords.map(c => ({
      ...c,
      chord: snapChordToKey(c.chord, workingKey),
    }));

    // 5. Build sections with REAL chords mapped into measures
    // For each section, find the chord playing at each downbeat
    const sections: SongSection[] = segments.map(seg => {
      const sectionDownbeats = downbeats.filter(db => db >= seg.start && db < seg.end);
      const numMeasures = Math.max(1, sectionDownbeats.length);

      const chords: ChordEvent[] = [];
      for (let m = 0; m < numMeasures; m++) {
        const measureStart = sectionDownbeats[m] ?? seg.start + (m * 4 * 60 / bpm);
        const measureEnd = sectionDownbeats[m + 1] ?? seg.end;
        const beatDur = (measureEnd - measureStart) / 4;
        for (let b = 0; b < 4; b++) {
          const beatTime = measureStart + b * beatDur;
          // Find chord playing at this beat
          const chordAtBeat = detectedChords.find(c => c.start <= beatTime && c.end > beatTime);
          chords.push({
            start: beatTime,
            end: beatTime + beatDur,
            chord: chordAtBeat?.chord || '_',
          });
        }
      }

      return {
        name: prettySection(seg.label),
        start: seg.start,
        end: seg.end,
        chords,
      };
    });

    // 5. Build markdown chart with timestamps + measure boxes
    const markdown = buildStructureMarkdown({
      title: song.title,
      artist: song.artist,
      key: workingKey,
      bpm,
      sections,
    });

    // 6. Save .md as file
    const mdPath = `${song_id}/dissection-${Date.now()}.md`;
    const mdBuffer = Buffer.from(markdown, 'utf-8');

    const { error: uploadErr } = await supabase.storage
      .from('azusa-files')
      .upload(mdPath, mdBuffer, { contentType: 'text/markdown', upsert: true });

    if (uploadErr) throw uploadErr;

    const { data: urlData } = supabase.storage.from('azusa-files').getPublicUrl(mdPath);

    await supabase.from('files').insert({
      song_id,
      name: `${song.title} - AI Chart.md`,
      file_type: 'document',
      mime_type: 'text/markdown',
      storage_path: mdPath,
      file_url: urlData.publicUrl,
      size_bytes: mdBuffer.length,
    });

    // 7. Seed number_chart in DB with REAL Nashville numbers from detected chords
    const songKey = workingKey;
    const chartMeasures = sections.flatMap(s => {
      const measures: { section?: string; beats: string[] }[] = [];
      const numMeasures = Math.ceil(s.chords.length / 4);
      for (let m = 0; m < numMeasures; m++) {
        const beats: string[] = [];
        for (let b = 0; b < 4; b++) {
          const idx = m * 4 + b;
          const chordEvent = s.chords[idx];
          const chord = chordEvent?.chord;
          if (!chord || chord === '_' || chord === 'N') {
            beats.push('-');
          } else {
            // Reduce repeated chords to '-' (hold)
            const prevBeat = idx > 0 ? s.chords[idx - 1]?.chord : null;
            if (prevBeat === chord) {
              beats.push('-');
            } else {
              beats.push(chordToNashville(chord, songKey));
            }
          }
        }
        const measure: { section?: string; beats: string[] } = { beats };
        if (m === 0) measure.section = s.name;
        measures.push(measure);
      }
      return measures;
    });

    // Upsert number chart
    const { data: existingChart } = await supabase
      .from('number_charts')
      .select('id')
      .eq('song_id', song_id)
      .limit(1)
      .maybeSingle();

    if (existingChart) {
      await supabase.from('number_charts').update({
        chart_data: chartMeasures,
        bpm,
        key: workingKey,
        updated_at: new Date().toISOString(),
      }).eq('id', existingChart.id);
    } else {
      await supabase.from('number_charts').insert({
        song_id,
        chart_data: chartMeasures,
        bpm,
        key: workingKey,
        time_signature: '4/4',
      });
    }

    // 8. Save dissection on song. Also build the editable `structure` column
    // (only seed it if there's no existing structure — never overwrite user edits)
    const structureSections = sections.map(s => {
      const lower = s.name.toLowerCase();
      let sectionType: string = 'custom';
      if (lower.includes('pre')) sectionType = 'pre-chorus';
      else if (lower.includes('chorus')) sectionType = 'chorus';
      else if (lower.includes('verse')) sectionType = 'verse';
      else if (lower.includes('bridge')) sectionType = 'bridge';
      else if (lower.includes('intro')) sectionType = 'intro';
      else if (lower.includes('outro')) sectionType = 'outro';
      else if (lower.includes('tag')) sectionType = 'tag';
      else if (lower.includes('inst') || lower.includes('solo') || lower.includes('break')) sectionType = 'instrumental';
      return {
        name: s.name,
        type: sectionType,
        start: s.start,
        end: s.end,
        markers: [],
      };
    });

    const updatePayload: Record<string, unknown> = {
      dissection_md: markdown,
      dissection_status: 'complete',
      dissection_data: { sections, bpm, segments_raw: segments, detected_key: workingKey },
      bpm: song.bpm || bpm,
      key: song.key || workingKey,
    };
    // Only seed structure if it's empty
    if (!song.structure || (Array.isArray(song.structure) && song.structure.length === 0)) {
      updatePayload.structure = structureSections;
    }
    await supabase.from('songs').update(updatePayload).eq('id', song_id);

    return NextResponse.json({ success: true, markdown, sections, bpm, key: workingKey });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    await supabase.from('songs').update({ dissection_status: 'error' }).eq('id', song_id);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function prettySection(label: string): string {
  const map: Record<string, string> = {
    'intro': 'Intro',
    'verse': 'Verse',
    'chorus': 'Chorus',
    'bridge': 'Bridge',
    'outro': 'Outro',
    'pre-chorus': 'Pre-Chorus',
    'prechorus': 'Pre-Chorus',
    'instrumental': 'Instrumental',
    'inst': 'Instrumental',
    'solo': 'Solo',
    'break': 'Break',
    'tag': 'Tag',
  };
  const lower = label.toLowerCase().trim();
  return map[lower] || label.charAt(0).toUpperCase() + label.slice(1);
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function buildStructureMarkdown(opts: {
  title: string;
  artist?: string | null;
  key: string;
  bpm: number;
  sections: SongSection[];
}): string {
  const { title, artist, key, bpm, sections } = opts;
  const lines: string[] = [];

  lines.push(`# ${title}`);
  if (artist) lines.push(`**Artist:** ${artist}`);
  lines.push(`**Key:** ${key} · **BPM:** ${bpm} · **Time:** 4/4`);
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## Song Map');
  lines.push('');
  for (const s of sections) {
    const dur = s.end - s.start;
    const numMeasures = Math.ceil(s.chords.length / 4);
    lines.push(`- **${s.name}** · ${formatTime(s.start)}–${formatTime(s.end)} · ${numMeasures} measures · ${Math.round(dur)}s`);
  }
  lines.push('');
  lines.push('---');
  lines.push('');

  for (const s of sections) {
    const numMeasures = Math.ceil(s.chords.length / 4);
    lines.push(`## ${s.name}`);
    lines.push(`*${formatTime(s.start)}–${formatTime(s.end)} · ${numMeasures} bars*`);
    lines.push('');

    // Build bar grid with REAL Nashville numbers
    const bars: string[] = [];
    for (let m = 0; m < numMeasures; m++) {
      const beats: string[] = [];
      for (let b = 0; b < 4; b++) {
        const idx = m * 4 + b;
        const chord = s.chords[idx]?.chord;
        if (!chord || chord === '_' || chord === 'N') {
          beats.push('-');
        } else {
          const prevChord = idx > 0 ? s.chords[idx - 1]?.chord : null;
          if (prevChord === chord) {
            beats.push('-');
          } else {
            beats.push(chordToNashville(chord, key));
          }
        }
      }
      bars.push(`| ${beats.join('  ')} |`);
    }
    // 4 bars per row
    for (let i = 0; i < bars.length; i += 4) {
      lines.push('`' + bars.slice(i, i + 4).join(' ') + '`');
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('*AI-detected with chord recognition (Chordino) + structure analysis. Verify before performing — accuracy ~70-85%.*');
  return lines.join('\n');
}
