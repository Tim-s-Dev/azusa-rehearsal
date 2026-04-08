// Convert chord names to Nashville Number System based on song key

const MAJOR_SCALE_INTERVALS = [0, 2, 4, 5, 7, 9, 11];
const NOTE_TO_PC: Record<string, number> = {
  'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4,
  'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9,
  'A#': 10, 'Bb': 10, 'B': 11,
};

export interface ChordEvent {
  start: number; // seconds
  end: number;
  chord: string; // e.g. "G", "Em", "Cmaj7", "D/F#"
}

export interface SongSection {
  name: string; // "Intro", "Verse 1", "Chorus", etc.
  start: number;
  end: number;
  chords: ChordEvent[];
}

// Scale degree → expected chord quality for major and minor keys
// Major: I ii iii IV V vi vii°
const MAJOR_QUALITIES = ['', 'm', 'm', '', '', 'm', 'dim'];
// Natural minor: i ii° III iv v VI VII
const MINOR_QUALITIES = ['m', 'dim', '', 'm', 'm', '', ''];
// Harmonic minor often uses V (major) and vii° instead of v / VII
const MINOR_QUALITIES_ALT = ['m', 'dim', '', 'm', '', '', ''];

/**
 * Score how well a set of chords fits a given key.
 * Rewards diatonic chords with correct quality.
 */
export function scoreKeyFit(chords: ChordEvent[], key: string, isMinor: boolean): number {
  const keyMatch = key.match(/^([A-G][#b]?)/);
  if (!keyMatch) return -Infinity;
  const keyRoot = NOTE_TO_PC[keyMatch[1]];
  if (keyRoot === undefined) return -Infinity;

  let score = 0;
  for (const c of chords) {
    if (!c.chord || c.chord === 'N') continue;
    const dur = c.end - c.start;

    const m = c.chord.match(/^([A-G][#b]?)(.*)$/);
    if (!m) continue;
    const [, chordRoot, qualityRaw] = m;
    const chordPc = NOTE_TO_PC[chordRoot];
    if (chordPc === undefined) continue;

    // Detect chord quality
    let quality = '';
    if (/dim/.test(qualityRaw)) quality = 'dim';
    else if (/^m(?!aj)/.test(qualityRaw)) quality = 'm';
    // major triad if no quality marker

    // Interval from key root
    const interval = (chordPc - keyRoot + 12) % 12;

    // Find scale degree
    const intervals = isMinor
      ? [0, 2, 3, 5, 7, 8, 10] // natural minor
      : [0, 2, 4, 5, 7, 9, 11]; // major
    const degree = intervals.indexOf(interval);

    if (degree === -1) {
      // Chromatic — small penalty
      score -= dur * 0.3;
      continue;
    }

    // Check quality match
    const expectedQualities = isMinor ? MINOR_QUALITIES : MAJOR_QUALITIES;
    const expected = expectedQualities[degree];
    const altExpected = isMinor ? MINOR_QUALITIES_ALT[degree] : null;

    if (quality === expected || quality === altExpected) {
      score += dur * 3; // perfect match
    } else if (
      (quality === '' && expected === 'm') ||
      (quality === 'm' && expected === '')
    ) {
      // Wrong mode (major/minor flip) — partial match (could be borrowed)
      score += dur * 0.5;
    } else {
      // Wrong quality (e.g., dim vs major) — penalty
      score -= dur * 0.2;
    }
  }
  return score;
}

/**
 * Detect the most likely key from a list of chord events.
 * Returns major key if it scores well; otherwise returns the relative or true minor.
 */
export function detectKey(chords: ChordEvent[]): string {
  if (chords.length === 0) return 'C';

  const keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  let bestKey = 'C';
  let bestScore = -Infinity;

  for (const k of keys) {
    // Try major
    const majorScore = scoreKeyFit(chords, k, false);
    if (majorScore > bestScore) {
      bestScore = majorScore;
      bestKey = k;
    }
    // Try minor
    const minorScore = scoreKeyFit(chords, k, true);
    if (minorScore > bestScore) {
      bestScore = minorScore;
      bestKey = k + 'm';
    }
  }
  return bestKey;
}

/**
 * Convert a chord name to Nashville number based on key.
 * E.g. in key of G: G→1, Am→2m, C→4, D→5, Em→6m
 * Minor key: Am=1m, C=b3, Dm=4m, Em=5m, F=b6, G=b7
 */
const MINOR_SCALE_INTERVALS = [0, 2, 3, 5, 7, 8, 10];

/**
 * Snap a chromatic chord to the nearest diatonic chord in the given key.
 * Used after AI detection to clean up flicker errors.
 *
 * In G#m, if detector says "G", we snap to "G#m" (1m, the closest scale tone).
 * If detector says "F#m" but the key uses "F#" major (VII in minor), we change to "F#".
 */
export function snapChordToKey(chord: string, key: string): string {
  if (!chord || chord === 'N') return chord;

  const m = chord.match(/^([A-G][#b]?)(.*)$/);
  if (!m) return chord;
  const [, root, qualityRaw] = m;
  const keyMatch = key.match(/^([A-G][#b]?)(m?)$/);
  if (!keyMatch) return chord;

  const keyRoot = NOTE_TO_PC[keyMatch[1]];
  const isMinorKey = keyMatch[2] === 'm';
  const chordPc = NOTE_TO_PC[root];
  if (keyRoot === undefined || chordPc === undefined) return chord;

  const intervals = isMinorKey ? MINOR_SCALE_INTERVALS : MAJOR_SCALE_INTERVALS;
  const expectedQualities = isMinorKey ? MINOR_QUALITIES : MAJOR_QUALITIES;

  const interval = (chordPc - keyRoot + 12) % 12;
  const degreeIdx = intervals.indexOf(interval);

  let detectedQuality = '';
  if (/dim/.test(qualityRaw)) detectedQuality = 'dim';
  else if (/^m(?!aj)/.test(qualityRaw)) detectedQuality = 'm';

  // If the chord root IS in the scale, just fix the quality if wrong
  if (degreeIdx >= 0) {
    const expected = expectedQualities[degreeIdx];
    // If the detected quality is wildly wrong (e.g. dim where major expected), fix it
    if (detectedQuality !== expected && expected !== 'dim') {
      // Snap to expected quality (preserves the root, fixes the mode)
      return root + expected;
    }
    return chord; // already diatonic with correct quality
  }

  // Chromatic root — find the closest diatonic root (within 1 semitone)
  let bestNewRoot = root;
  let bestDistance = Infinity;
  let bestExpectedQuality = '';
  for (let i = 0; i < intervals.length; i++) {
    const diatonicPc = (keyRoot + intervals[i]) % 12;
    const dist = Math.min((diatonicPc - chordPc + 12) % 12, (chordPc - diatonicPc + 12) % 12);
    if (dist <= 1 && dist < bestDistance) {
      bestDistance = dist;
      bestNewRoot = NOTES[diatonicPc];
      bestExpectedQuality = expectedQualities[i];
    }
  }
  if (bestDistance <= 1) {
    return bestNewRoot + bestExpectedQuality;
  }
  // Truly chromatic, no nearby diatonic — leave as is
  return chord;
}

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function chordToNashville(chord: string, key: string): string {
  if (!chord || chord === 'N' || chord === 'N.C.') return '-';

  const match = chord.match(/^([A-G][#b]?)(.*)$/);
  if (!match) return chord;

  const [, root, quality] = match;
  const keyMatch = key.match(/^([A-G][#b]?)(m?)$/);
  if (!keyMatch) return chord;

  const keyRoot = NOTE_TO_PC[keyMatch[1]];
  const isMinorKey = keyMatch[2] === 'm';
  const chordRoot = NOTE_TO_PC[root];
  if (keyRoot === undefined || chordRoot === undefined) return chord;

  const interval = (chordRoot - keyRoot + 12) % 12;
  const intervals = isMinorKey ? MINOR_SCALE_INTERVALS : MAJOR_SCALE_INTERVALS;
  const idx = intervals.indexOf(interval);

  let number: string;
  if (idx >= 0) {
    number = String(idx + 1);
  } else {
    // Chromatic — use flat notation
    const closestIdx = intervals.findIndex(i => i > interval);
    const baseNum = closestIdx > 0 ? closestIdx : 1;
    number = `b${baseNum + 1}`;
  }

  // Handle quality
  let suffix = '';
  const isMinorChord = /^m(?!aj)/.test(quality);
  const isDim = /dim/.test(quality);
  const isAug = /aug/.test(quality);

  if (isDim) suffix = 'dim';
  else if (isAug) suffix = 'aug';
  else if (isMinorChord) suffix = 'm';
  // Else major — no suffix in Nashville notation (capital number)

  // Extensions
  if (/7/.test(quality) && !/maj7/.test(quality)) suffix += '7';
  if (/maj7/.test(quality)) suffix += 'maj7';
  if (/sus/.test(quality)) suffix += 'sus';

  // Slash chord
  const slashMatch = quality.match(/\/([A-G][#b]?)/);
  if (slashMatch) {
    const bassNote = NOTE_TO_PC[slashMatch[1]];
    if (bassNote !== undefined) {
      const bassInterval = (bassNote - keyRoot + 12) % 12;
      const bassIdx = intervals.indexOf(bassInterval);
      if (bassIdx >= 0) suffix += `/${bassIdx + 1}`;
    }
  }

  return number + suffix;
}

/**
 * Group consecutive identical chords into measures.
 * Assumes 4/4 time. Uses BPM to estimate measure boundaries.
 */
export function chordsToMeasures(
  chords: ChordEvent[],
  bpm: number = 90,
  beatsPerMeasure: number = 4
): { chord: string; durationBeats: number }[] {
  const secPerBeat = 60 / bpm;
  const measures: { chord: string; durationBeats: number }[] = [];

  for (const event of chords) {
    const durationSec = event.end - event.start;
    const beats = Math.max(1, Math.round(durationSec / secPerBeat));
    measures.push({ chord: event.chord, durationBeats: beats });
  }

  return measures;
}

/**
 * Build a Markdown chart from sections.
 */
export function buildMarkdown(opts: {
  title: string;
  artist?: string;
  key: string;
  bpm?: number;
  sections: SongSection[];
}): string {
  const { title, artist, key, bpm, sections } = opts;
  const lines: string[] = [];

  lines.push(`# ${title}`);
  if (artist) lines.push(`**Artist:** ${artist}`);
  lines.push(`**Key:** ${key}${bpm ? ` · **BPM:** ${bpm}` : ''}`);
  lines.push(`**Time:** 4/4`);
  lines.push('');
  lines.push('---');
  lines.push('');

  for (const section of sections) {
    lines.push(`## ${section.name}`);
    lines.push('');

    // Group chords into bars (4 beats each)
    const numbers = section.chords.map(c => chordToNashville(c.chord, key));

    // Build bar lines
    const bars: string[][] = [];
    let currentBar: string[] = [];
    for (const num of numbers) {
      currentBar.push(num);
      if (currentBar.length === 4) {
        bars.push(currentBar);
        currentBar = [];
      }
    }
    if (currentBar.length > 0) {
      while (currentBar.length < 4) currentBar.push('-');
      bars.push(currentBar);
    }

    // Format bars in rows of 4 (16 chords per line)
    for (let i = 0; i < bars.length; i += 4) {
      const row = bars.slice(i, i + 4);
      const formatted = row.map(bar => bar.join('  ')).join('  |  ');
      lines.push('`' + formatted + '`');
    }

    lines.push('');
  }

  lines.push('---');
  lines.push('*Auto-dissected with AI · Verify before performing*');

  return lines.join('\n');
}
