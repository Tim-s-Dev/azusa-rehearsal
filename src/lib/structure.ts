import type { ChartItem, SongStructureSection, SectionType } from './types';
import { isMeasure, normalizeSectionType } from './types';

/**
 * A group of chart items (measures + interleaved notes/lyrics) that
 * corresponds (by index) to one section in song.structure.
 */
export interface MeasureGroup {
  sectionLabel: string;
  type: SectionType;
  /** All items in this section: measures, notes, lyrics */
  measures: ChartItem[];
  /** Index of the first item in the parent chart_data array */
  offset: number;
}

/**
 * Walk chart items and split into groups whenever a MEASURE has `.section` set.
 * Notes and lyrics are kept inside whichever section they fall in (no boundary).
 */
export function groupMeasuresBySection(items: ChartItem[]): MeasureGroup[] {
  if (items.length === 0) return [];

  // Find the first measure to seed the section label
  const firstMeasure = items.find(isMeasure);
  const initialLabel = (firstMeasure && isMeasure(firstMeasure) && firstMeasure.section) || 'Section 1';

  const groups: MeasureGroup[] = [];
  let currentLabel = initialLabel;
  let currentStart = 0;

  for (let i = 1; i < items.length; i++) {
    const item = items[i];
    if (isMeasure(item) && item.section !== undefined) {
      groups.push({
        sectionLabel: currentLabel,
        type: normalizeSectionType(currentLabel),
        measures: items.slice(currentStart, i),
        offset: currentStart,
      });
      currentLabel = item.section || `Section ${groups.length + 2}`;
      currentStart = i;
    }
  }
  groups.push({
    sectionLabel: currentLabel,
    type: normalizeSectionType(currentLabel),
    measures: items.slice(currentStart),
    offset: currentStart,
  });

  return groups;
}

/**
 * Pair MeasureGroups with SongStructureSections by index.
 */
export interface SectionPair {
  structure: SongStructureSection | null;
  group: MeasureGroup | null;
}

export function pairSectionsWithGroups(
  structure: SongStructureSection[] | null | undefined,
  groups: MeasureGroup[]
): SectionPair[] {
  const pairs: SectionPair[] = [];
  const max = Math.max(structure?.length || 0, groups.length);
  for (let i = 0; i < max; i++) {
    pairs.push({
      structure: structure?.[i] || null,
      group: groups[i] || null,
    });
  }
  return pairs;
}
