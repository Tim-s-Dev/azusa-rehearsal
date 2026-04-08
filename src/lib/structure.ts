import type { ChartMeasure, SongStructureSection, SectionType } from './types';
import { normalizeSectionType } from './types';

/**
 * A measure group that corresponds (by index) to one section in song.structure.
 * `measures` is the slice of chart_data measures, `offset` is the index of the
 * first measure in the parent chart_data array.
 */
export interface MeasureGroup {
  sectionLabel: string;
  type: SectionType;
  measures: ChartMeasure[];
  offset: number;
}

/**
 * Walk chart_data and split into groups whenever a measure has `.section` set.
 * The first group inherits its label from either the first measure's section
 * or "Section 1".
 */
export function groupMeasuresBySection(measures: ChartMeasure[]): MeasureGroup[] {
  if (measures.length === 0) return [];

  const groups: MeasureGroup[] = [];
  let currentLabel = measures[0].section || 'Section 1';
  let currentStart = 0;

  for (let i = 1; i < measures.length; i++) {
    if (measures[i].section !== undefined) {
      groups.push({
        sectionLabel: currentLabel,
        type: normalizeSectionType(currentLabel),
        measures: measures.slice(currentStart, i),
        offset: currentStart,
      });
      currentLabel = measures[i].section || `Section ${groups.length + 2}`;
      currentStart = i;
    }
  }
  // Final group
  groups.push({
    sectionLabel: currentLabel,
    type: normalizeSectionType(currentLabel),
    measures: measures.slice(currentStart),
    offset: currentStart,
  });

  return groups;
}

/**
 * Pair MeasureGroups with SongStructureSections by index. If counts mismatch,
 * the extras stand alone (no chart measures or no timestamps).
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
