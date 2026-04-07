const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  'https://rzvpqeteaybwogaqodyz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6dnBxZXRlYXlid29nYXFvZHl6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjg5OTA0MiwiZXhwIjoyMDg4NDc1MDQyfQ.I9zfq9bmEzLaKhApTt-ZEdj2dGwyneslUJSdS9f3KiA'
);

function normalizeTitle(t) {
  return t.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

function slugify(t) {
  return t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

async function upload() {
  const { data: songs } = await supabase.from('songs').select('id, title, set_id');
  console.log(`Found ${songs.length} songs in DB`);

  const manifest = JSON.parse(fs.readFileSync('downloads/manifest.json', 'utf8'));
  console.log(`Manifest has ${manifest.length} files`);

  // Map normalized titles to songs
  const songMap = {};
  songs.forEach(s => { songMap[normalizeTitle(s.title)] = s; });

  // Map download directories to their files
  const downloadBase = 'downloads';
  const dirs = fs.readdirSync(downloadBase).filter(d => {
    return fs.statSync(path.join(downloadBase, d)).isDirectory();
  });

  let uploaded = 0, skipped = 0, errors = 0;

  for (const entry of manifest) {
    const normalizedSongTitle = normalizeTitle(entry.song_title);
    const song = songMap[normalizedSongTitle];

    if (!song) {
      console.log(`  SKIP (no DB match): "${entry.song_title}"`);
      skipped++;
      continue;
    }

    // Find the file in downloads directories
    const expectedSlug = slugify(entry.song_title);
    let filePath = null;

    // Try direct directory match
    for (const dir of dirs) {
      if (dir === expectedSlug || normalizeTitle(dir) === normalizedSongTitle) {
        const dirFiles = fs.readdirSync(path.join(downloadBase, dir));
        const match = dirFiles.find(f => f === entry.filename);
        if (match) {
          filePath = path.join(downloadBase, dir, match);
          break;
        }
      }
    }

    // Broader search if not found
    if (!filePath) {
      for (const dir of dirs) {
        const dirPath = path.join(downloadBase, dir);
        const dirFiles = fs.readdirSync(dirPath);
        const match = dirFiles.find(f => f === entry.filename);
        if (match) {
          filePath = path.join(dirPath, match);
          break;
        }
      }
    }

    if (!filePath || !fs.existsSync(filePath)) {
      console.log(`  SKIP (file not found): "${entry.filename}"`);
      skipped++;
      continue;
    }

    const fileBuffer = fs.readFileSync(filePath);
    const ext = path.extname(entry.filename) || '.mp3';
    const storagePath = `${song.id}/${Date.now()}-${entry.id}${ext}`;

    const fileType = entry.content_type.startsWith('audio/') ? 'audio'
      : entry.content_type === 'application/pdf' ? 'pdf'
      : 'document';

    const { error: uploadErr } = await supabase.storage
      .from('azusa-files')
      .upload(storagePath, fileBuffer, {
        contentType: entry.content_type,
        upsert: true,
      });

    if (uploadErr) {
      console.log(`  ERROR uploading: ${uploadErr.message}`);
      errors++;
      continue;
    }

    const { data: urlData } = supabase.storage.from('azusa-files').getPublicUrl(storagePath);

    const { error: insertErr } = await supabase.from('files').insert({
      song_id: song.id,
      name: entry.filename,
      file_type: fileType,
      mime_type: entry.content_type,
      storage_path: storagePath,
      file_url: urlData.publicUrl,
      size_bytes: fileBuffer.length,
    });

    if (insertErr) {
      console.log(`  ERROR inserting: ${insertErr.message}`);
      errors++;
      continue;
    }

    uploaded++;
    if (uploaded % 10 === 0) console.log(`  Uploaded ${uploaded} files...`);
  }

  console.log(`\nDone! Uploaded: ${uploaded}, Skipped: ${skipped}, Errors: ${errors}`);
}

upload().catch(console.error);
