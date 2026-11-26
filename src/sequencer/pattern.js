import { ALL_INSTRUMENT_IDS } from '../kits/instruments.js';

/**
 * Fixed time signatures offered by the UI. All presets use quarter-note
 * beats, so the 16th-note grid always has four steps per beat.
 */
export const TIME_SIGNATURE_PRESETS = ['2/4', '3/4', '4/4', '5/4', '6/4', '8/4', '12/4'];

const MAX_TOTAL_STEPS = 128;
const DEFAULT_STEP_COUNT = 16;

/** Short fallback message; the selector only exposes valid presets. */
export function getTimeSignatureError(value) {
  return `Invalid time signature "${String(value ?? '').trim()}". Choose ${TIME_SIGNATURE_PRESETS.join(', ')}.`;
}

export function isValidTimeSignature(value) {
  return TIME_SIGNATURE_PRESETS.includes(value);
}

export function getStepCountForSig(timeSignature) {
  if (!isValidTimeSignature(timeSignature)) return DEFAULT_STEP_COUNT;
  const steps = Number.parseInt(timeSignature, 10) * 4;
  return steps > 0 && steps <= MAX_TOTAL_STEPS ? steps : DEFAULT_STEP_COUNT;
}

export function getBeatGroupSize() {
  return 4;
}

export function getStepDurationSec(bpm) {
  return (60 / bpm) / 4;
}

/**
 * Row keys are track ids. Factory patterns and legacy workspaces use the
 * fixed instrument ids; imported kits use sample ids. Unknown rows are kept
 * when a grid is normalized so a saved kit always survives a reload.
 */
function uniqueRowKeys(rowKeys) {
  const keys = [];
  const seen = new Set();
  for (const key of Array.isArray(rowKeys) ? rowKeys : []) {
    if (typeof key !== 'string' || !key || seen.has(key)) continue;
    seen.add(key);
    keys.push(key);
  }
  return keys;
}

function rowKeysFromGrids(grids) {
  const keys = ALL_INSTRUMENT_IDS.slice();
  for (const grid of grids) {
    if (grid && typeof grid === 'object' && !Array.isArray(grid)) keys.push(...Object.keys(grid));
  }
  return keys;
}

export function buildGridFromHits(hitsByRow, totalSteps, rowKeys = ALL_INSTRUMENT_IDS) {
  const grid = {};
  for (const rowKey of uniqueRowKeys(rowKeys)) {
    const row = new Array(totalSteps).fill(false);
    const hitList = hitsByRow && Array.isArray(hitsByRow[rowKey]) ? hitsByRow[rowKey] : [];
    for (const index of hitList) {
      if (index >= 0 && index < totalSteps) row[index] = true;
    }
    grid[rowKey] = row;
  }
  return grid;
}

export function buildEmptyGrid(totalSteps, rowKeys = ALL_INSTRUMENT_IDS) {
  return buildGridFromHits({}, totalSteps, rowKeys);
}

/**
 * Convert a persisted boolean grid into a complete grid, truncating or padding
 * rows to the requested step count. When no explicit row list is supplied the
 * stored rows plus the 23 legacy instruments are preserved.
 */
export function normalizeGrid(grid, totalSteps, rowKeys = null) {
  const keys = uniqueRowKeys(rowKeys || rowKeysFromGrids([grid]));
  const normalized = {};
  for (const rowKey of keys) {
    const sourceRow = grid && Array.isArray(grid[rowKey]) ? grid[rowKey] : [];
    const row = new Array(totalSteps).fill(false);
    const length = Math.min(totalSteps, sourceRow.length);
    for (let index = 0; index < length; index += 1) {
      row[index] = Boolean(sourceRow[index]);
    }
    normalized[rowKey] = row;
  }
  return normalized;
}

export function resizeGrid(grid, oldStepCount, newStepCount, rowKeys = null) {
  const keys = uniqueRowKeys(rowKeys || rowKeysFromGrids([grid]));
  const resized = {};
  for (const rowKey of keys) {
    const previous = grid && Array.isArray(grid[rowKey]) ? grid[rowKey] : [];
    const next = new Array(newStepCount).fill(false);
    const length = Math.min(oldStepCount, newStepCount);
    for (let index = 0; index < length; index += 1) {
      next[index] = Boolean(previous[index]);
    }
    resized[rowKey] = next;
  }
  return resized;
}

export function cloneGrid(grid, rowKeys = null) {
  const keys = uniqueRowKeys(rowKeys || rowKeysFromGrids([grid]));
  const cloned = {};
  for (const rowKey of keys) {
    cloned[rowKey] = [...(grid && Array.isArray(grid[rowKey]) ? grid[rowKey] : [])];
  }
  return cloned;
}
