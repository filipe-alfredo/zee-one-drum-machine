import { clampBpm, createId } from '../utils/helpers.js';
import { getStepCountForSig } from './pattern.js';

/**
 * Bottom-of-screen loop arranger. Patterns are vertical rows; the horizontal
 * timeline is measured in quarter-note beats and starts with 32 columns.
 * Painting a cell places one complete occurrence of that row's pattern: a 4/4
 * pattern covers clicked beat + 3, a 2/4 pattern covers clicked beat + 1, and
 * a 12/4 pattern covers clicked beat + 11. Rows can overlap and each row has
 * its own BPM, so the same column can trigger several patterns together.
 */
export const STEPS_PER_BEAT = 4;
export const DEFAULT_BPM = 100;
export const DEFAULT_TIMELINE_BEATS = 32;
export const MAX_TIMELINE_BEATS = 512;
export const MAX_ROWS = 64;
export const MAX_BLOCKS = 512;
export const MAX_LOOP_EVENTS = 20000;

export function createDefaultArrangement() {
  return {
    enabled: false,
    timelineBeats: DEFAULT_TIMELINE_BEATS,
    rows: [],
  };
}

function clampInteger(value, min, max, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

export function getBeatsForPattern(pattern) {
  const steps = Math.max(STEPS_PER_BEAT, getStepCountForSig(pattern && pattern.timeSignature));
  return steps / STEPS_PER_BEAT;
}

export function getBlockDurationBeats(pattern) {
  return Math.max(1, Math.round(getBeatsForPattern(pattern)));
}

/**
 * Legacy data is migrated conservatively:
 * - `sequence[]` entries become painted blocks on their own pattern rows,
 *   laid out back-to-back in beats, with the old global BPM copied per row;
 * - `lanes[].blocks[]` use their saved `startBar` beat grid instead.
 * Unknown patterns are dropped; duplicate ids are regenerated.
 */
export function normalizeArrangement(raw, patterns = []) {
  const base = createDefaultArrangement();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base;

  const patternList = Array.isArray(patterns) ? patterns : [];
  const patternById = new Map(patternList.map(pattern => [pattern.id, pattern]));
  const seenRowIds = new Set();
  const seenBlockIds = new Set();
  const rows = [];
  const rowByPatternId = new Map();

  const getRow = (patternId, fallbackBpm) => {
    if (!patternById.has(patternId)) return null;
    if (rowByPatternId.has(patternId)) return rowByPatternId.get(patternId);
    if (rows.length >= MAX_ROWS) return null;
    let id = createId('row');
    while (seenRowIds.has(id)) id = createId('row');
    const row = {
      id,
      patternId,
      bpm: clampBpm(fallbackBpm),
      blocks: [],
    };
    seenRowIds.add(id);
    rows.push(row);
    rowByPatternId.set(patternId, row);
    return row;
  };

  const addBlock = (row, start, beats, rawId) => {
    if (!row || rows.length === 0 || row.blocks.length >= MAX_BLOCKS) return false;
    let id = typeof rawId === 'string' && rawId ? rawId : createId('blk');
    while (seenBlockIds.has(id)) id = createId('blk');
    const block = {
      id,
      start: Math.max(0, Math.round(Number(start) || 0)),
      beats: Math.max(1, Math.round(Number(beats) || getBlockDurationBeats(patternById.get(row.patternId)))),
    };
    seenBlockIds.add(id);
    row.blocks.push(block);
    return true;
  };

  if (Array.isArray(raw.rows)) {
    for (const savedRow of raw.rows) {
      if (!savedRow || !patternById.has(savedRow.patternId) || rows.length >= MAX_ROWS) continue;
      let id = typeof savedRow.id === 'string' && savedRow.id ? savedRow.id : createId('row');
      while (seenRowIds.has(id)) id = createId('row');
      const row = { id, patternId: savedRow.patternId, bpm: clampBpm(savedRow.bpm), blocks: [] };
      for (const savedBlock of Array.isArray(savedRow.blocks) ? savedRow.blocks : []) {
        if (!savedBlock || row.blocks.length >= MAX_BLOCKS) continue;
        let blockId = typeof savedBlock.id === 'string' && savedBlock.id ? savedBlock.id : createId('blk');
        while (seenBlockIds.has(blockId)) blockId = createId('blk');
        const beats = clampInteger(
          savedBlock.beats,
          1,
          getBlockDurationBeats(patternById.get(row.patternId)),
          1,
        );
        row.blocks.push({
          id: blockId,
          start: clampInteger(savedBlock.start, 0, MAX_TIMELINE_BEATS - beats, 0),
          beats,
        });
        seenBlockIds.add(blockId);
      }
      seenRowIds.add(id);
      rows.push(row);
      rowByPatternId.set(row.patternId, row);
    }
  } else if (Array.isArray(raw.sequence)) {
    let cursor = 0;
    for (const entry of raw.sequence) {
      if (!entry || !patternById.has(entry.patternId)) continue;
      const beats = getBlockDurationBeats(patternById.get(entry.patternId));
      const row = getRow(entry.patternId, raw.bpm);
      if (!addBlock(row, cursor, beats, entry.id)) break;
      cursor += beats;
    }
  } else if (Array.isArray(raw.lanes)) {
    for (const lane of raw.lanes) {
      for (const block of Array.isArray(lane && lane.blocks) ? lane.blocks : []) {
        if (!block || !patternById.has(block.patternId)) continue;
        const beats = getBlockDurationBeats(patternById.get(block.patternId));
        const start = Math.round(Number(block.startBar) || 0);
        const row = getRow(block.patternId, raw.bpm);
        addBlock(row, start, beats, block.id);
      }
    }
  }

  const maxStart = rows.reduce((max, row) => row.blocks.reduce(
    (rowMax, block) => Math.max(rowMax, block.start + block.beats),
    max,
  ), 0);
  const timelineBeats = clampInteger(
    raw.timelineBeats,
    DEFAULT_TIMELINE_BEATS,
    MAX_TIMELINE_BEATS,
    Math.max(DEFAULT_TIMELINE_BEATS, Math.ceil(maxStart / 8) * 8),
  );

  return { enabled: Boolean(raw.enabled), timelineBeats, rows };
}

export function getTimelineBeats(arrangement) {
  return clampInteger(
    arrangement && arrangement.timelineBeats,
    DEFAULT_TIMELINE_BEATS,
    MAX_TIMELINE_BEATS,
    DEFAULT_TIMELINE_BEATS,
  );
}

/** Timeline extends in 8-beat pages when a block reaches the right edge. */
export function ensureTimelineBeats(arrangement, requiredBeats) {
  if (!arrangement) return getTimelineBeats(arrangement);
  const needed = Math.ceil((Math.max(0, requiredBeats) + 1) / 8) * 8;
  const next = clampInteger(
    Math.max(getTimelineBeats(arrangement), needed),
    DEFAULT_TIMELINE_BEATS,
    MAX_TIMELINE_BEATS,
    DEFAULT_TIMELINE_BEATS,
  );
  if (next !== arrangement.timelineBeats) {
    arrangement.timelineBeats = next;
    return true;
  }
  return false;
}

export function countArrangementRows(arrangement) {
  return arrangement && Array.isArray(arrangement.rows) ? arrangement.rows.length : 0;
}

export function countArrangementBlocks(arrangement) {
  if (!arrangement || !Array.isArray(arrangement.rows)) return 0;
  return arrangement.rows.reduce((total, row) => total + (Array.isArray(row.blocks) ? row.blocks.length : 0), 0);
}

export function getArrangementRow(arrangement, rowId) {
  if (!arrangement || !Array.isArray(arrangement.rows)) return null;
  return arrangement.rows.find(row => row.id === rowId) || null;
}

export function addArrangementRow(arrangement, patternId, patterns = [], bpm) {
  if (!arrangement || !Array.isArray(arrangement.rows)) return null;
  const pattern = (Array.isArray(patterns) ? patterns : []).find(item => item.id === patternId);
  if (!pattern) return null;
  if (arrangement.rows.length >= MAX_ROWS) return null;
  let id = createId('row');
  while (arrangement.rows.some(row => row.id === id)) id = createId('row');
  const row = { id, patternId, bpm: clampBpm(bpm === undefined ? pattern.bpm : bpm), blocks: [] };
  arrangement.rows.push(row);
  return row;
}

export function removeArrangementRow(arrangement, rowId) {
  if (!arrangement || !Array.isArray(arrangement.rows)) return false;
  const before = arrangement.rows.length;
  arrangement.rows = arrangement.rows.filter(row => row.id !== rowId);
  return arrangement.rows.length < before;
}

export function setArrangementRowBpm(arrangement, rowId, value) {
  const row = getArrangementRow(arrangement, rowId);
  if (!row) return null;
  row.bpm = clampBpm(value);
  return row.bpm;
}

export function removePatternFromArrangement(arrangement, patternId) {
  if (!arrangement || !Array.isArray(arrangement.rows)) return false;
  const before = arrangement.rows.length;
  arrangement.rows = arrangement.rows.filter(row => row.patternId !== patternId);
  return arrangement.rows.length < before;
}

export function clearArrangementBlocks(arrangement) {
  if (!arrangement || !Array.isArray(arrangement.rows)) return false;
  let changed = false;
  for (const row of arrangement.rows) {
    if (!Array.isArray(row.blocks) || row.blocks.length === 0) continue;
    row.blocks = [];
    changed = true;
  }
  return changed;
}

export function clearArrangementRows(arrangement) {
  if (!arrangement || !Array.isArray(arrangement.rows) || arrangement.rows.length === 0) return false;
  arrangement.rows = [];
  arrangement.timelineBeats = DEFAULT_TIMELINE_BEATS;
  return true;
}

/** Find the block occupying one beat in a row. */
export function getBlockAtBeat(row, beat) {
  if (!row || !Array.isArray(row.blocks)) return null;
  return row.blocks.find(block => beat >= block.start && beat < block.start + block.beats) || null;
}

/**
 * Paint one complete pattern occurrence. Clicking an occupied beat removes the
 * whole block. Each row keeps at most one block per pattern occurrence.
 */
export function toggleArrangementBlock(arrangement, rowId, beat, patterns = []) {
  const row = getArrangementRow(arrangement, rowId);
  if (!row) return null;
  const pattern = (Array.isArray(patterns) ? patterns : []).find(item => item.id === row.patternId);
  if (!pattern) return null;

  const start = Math.max(0, Math.round(Number(beat) || 0));
  const existing = getBlockAtBeat(row, start);
  if (existing) {
    row.blocks = row.blocks.filter(block => block.id !== existing.id);
    return { action: 'removed', block: existing };
  }
  if (!Array.isArray(row.blocks)) row.blocks = [];
  if (row.blocks.length >= MAX_BLOCKS) return null;

  const beats = getBlockDurationBeats(pattern);
  let id = createId('blk');
  while (row.blocks.some(block => block.id === id)) id = createId('blk');
  const block = { id, start, beats };
  row.blocks.push(block);
  ensureTimelineBeats(arrangement, start + beats);
  return { action: 'added', block };
}

/** Last painted beat of the loop, or -1 when the loop is empty. */
export function getArrangementEndBeat(arrangement) {
  if (!arrangement || !Array.isArray(arrangement.rows)) return -1;
  let end = -1;
  for (const row of arrangement.rows) {
    for (const block of Array.isArray(row.blocks) ? row.blocks : []) {
      end = Math.max(end, block.start + block.beats - 1);
    }
  }
  return end;
}

export function getArrangementBeats(arrangement) {
  return getArrangementEndBeat(arrangement) + 1;
}

/**
 * Absolute loop events in seconds. Each row runs at its own BPM: one beat is
 * 60/bpm seconds and each pattern step is a quarter of that beat. A block
 * starts at its timeline beat converted to that row's tempo, which deliberately
 * allows rows with different BPMs to drift relative to one another.
 */
export function getArrangementEvents(arrangement, patterns = []) {
  if (!arrangement || !Array.isArray(arrangement.rows)) return [];
  const patternById = new Map(
    (Array.isArray(patterns) ? patterns : []).map(pattern => [pattern.id, pattern]),
  );
  const events = [];
  for (const row of arrangement.rows) {
    const pattern = patternById.get(row.patternId);
    if (!pattern || !Array.isArray(row.blocks)) continue;
    const beatDuration = 60 / clampBpm(row.bpm);
    const stepDuration = beatDuration / STEPS_PER_BEAT;
    const patternSteps = Math.max(STEPS_PER_BEAT, getStepCountForSig(pattern.timeSignature));
    for (const block of row.blocks) {
      const blockStart = block.start * beatDuration;
      for (let step = 0; step < patternSteps && events.length < MAX_LOOP_EVENTS; step += 1) {
        events.push({
          source: 'loop',
          bpm: row.bpm,
          time: blockStart + step * stepDuration,
          stepIndex: step,
          pattern,
          patternId: row.patternId,
          rowId: row.id,
          blockId: block.id,
          beat: block.start,
        });
      }
      if (events.length >= MAX_LOOP_EVENTS) break;
    }
    if (events.length >= MAX_LOOP_EVENTS) break;
  }
  events.sort((left, right) => left.time - right.time);
  return events;
}

/** Approximate loop length in seconds (the latest scheduled event tail). */
export function getArrangementDurationSec(arrangement, patterns = []) {
  const events = getArrangementEvents(arrangement, patterns);
  if (events.length === 0) return 0;
  const last = events[events.length - 1];
  return last.time + (60 / clampBpm(last.bpm)) / STEPS_PER_BEAT;
}

/** Event times for the playhead: which block is active at one elapsed second. */
export function getArrangementRowsAtTime(arrangement, patterns, timeSec) {
  if (!arrangement || !Array.isArray(arrangement.rows) || !Number.isFinite(timeSec)) return [];
  const patternById = new Map(
    (Array.isArray(patterns) ? patterns : []).map(pattern => [pattern.id, pattern]),
  );
  const current = [];
  for (const row of arrangement.rows) {
    const pattern = patternById.get(row.patternId);
    if (!pattern || !Array.isArray(row.blocks)) continue;
    const beatDuration = 60 / clampBpm(row.bpm);
    for (const block of row.blocks) {
      const start = block.start * beatDuration;
      const end = start + block.beats * beatDuration;
      if (timeSec >= start && timeSec < end) {
        current.push({
          rowId: row.id,
          blockId: block.id,
          patternId: row.patternId,
          beat: block.start,
        });
        break;
      }
    }
  }
  return current;
}

/**
 * Compatibility helper for the playhead. The old clock counted 16th steps;
 * map an absolute step back to the beat that is currently active.
 */
export function getArrangementRowAtStep(arrangement, stepIndex) {
  if (!Number.isFinite(stepIndex) || stepIndex < 0) return null;
  const beat = Math.floor(stepIndex / STEPS_PER_BEAT);
  if (!arrangement || !Array.isArray(arrangement.rows)) return null;
  for (const row of arrangement.rows) {
    const block = getBlockAtBeat(row, beat);
    if (block) return { rowId: row.id, blockId: block.id, beat };
  }
  return null;
}
