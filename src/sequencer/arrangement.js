import { clamp, clampBpm, createId } from '../utils/helpers.js';
import { getStepCountForSig } from './pattern.js';

/**
 * Bottom-of-screen pattern arranger, in the style of a music-workstation
 * playlist. The timeline is a fixed 16th-note grid (16 steps per bar) running
 * at its own BPM. Each lane holds pattern blocks; a block repeats its pattern
 * once per arrangement bar, mapping the pattern's own steps proportionally
 * into the 16 timeline steps. Patterns therefore stay short and reusable.
 */
export const ARRANGEMENT_STEPS_PER_BAR = 16;
export const MIN_LOOP_BARS = 1;
export const MAX_LOOP_BARS = 32;
export const DEFAULT_LOOP_BARS = 8;
export const MAX_LANES = 8;
export const MIN_BLOCK_BARS = 1;
export const MAX_BLOCK_BARS = 16;
export const MAX_LOOP_STEPS = 512;

export function createDefaultArrangement() {
  return {
    enabled: false,
    bpm: 100,
    loopBars: DEFAULT_LOOP_BARS,
    lanes: [
      { id: 'lane_1', name: 'Loop 1', blocks: [] },
      { id: 'lane_2', name: 'Loop 2', blocks: [] },
      { id: 'lane_3', name: 'Loop 3', blocks: [] },
      { id: 'lane_4', name: 'Loop 4', blocks: [] },
    ],
  };
}

function clampInteger(value, min, max, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return clamp(parsed, min, max);
}

function blockFits(lane, startBar, lengthBars, ignoreId = null) {
  const end = startBar + lengthBars;
  return !lane.blocks.some(block => {
    if (block.id === ignoreId) return false;
    return startBar < block.startBar + block.lengthBars && block.startBar < end;
  });
}

/**
 * Validate a persisted arrangement. Unknown pattern ids are dropped, ids are
 * de-duplicated, blocks are trimmed to the loop length, and overlaps inside a
 * lane are resolved by keeping the block that starts first.
 */
export function normalizeArrangement(raw, patterns = []) {
  const base = createDefaultArrangement();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base;

  const patternIds = new Set(
    (Array.isArray(patterns) ? patterns : []).map(pattern => pattern.id),
  );
  const loopBars = clampInteger(raw.loopBars, MIN_LOOP_BARS, MAX_LOOP_BARS, DEFAULT_LOOP_BARS);
  const seenLaneIds = new Set();
  const seenBlockIds = new Set();
  const lanes = [];

  for (const rawLane of (Array.isArray(raw.lanes) ? raw.lanes : []).slice(0, MAX_LANES)) {
    if (!rawLane || typeof rawLane !== 'object') continue;
    let laneId = typeof rawLane.id === 'string' && rawLane.id ? rawLane.id : createId('lane');
    while (seenLaneIds.has(laneId)) laneId = createId('lane');
    seenLaneIds.add(laneId);

    const lane = {
      id: laneId,
      name: String(rawLane.name || `Loop ${lanes.length + 1}`).slice(0, 80),
      blocks: [],
    };

    const rawBlocks = Array.isArray(rawLane.blocks) ? rawLane.blocks.slice().sort((a, b) => {
      const left = Number(a && a.startBar) || 0;
      const right = Number(b && b.startBar) || 0;
      return left - right;
    }) : [];

    for (const rawBlock of rawBlocks) {
      if (!rawBlock || typeof rawBlock !== 'object') continue;
      if (!patternIds.has(rawBlock.patternId)) continue;

      let blockId = typeof rawBlock.id === 'string' && rawBlock.id ? rawBlock.id : createId('blk');
      while (seenBlockIds.has(blockId)) blockId = createId('blk');
      seenBlockIds.add(blockId);

      const startBar = clampInteger(rawBlock.startBar, 0, loopBars - 1, 0);
      const maxLength = Math.min(MAX_BLOCK_BARS, loopBars - startBar);
      const lengthBars = clampInteger(rawBlock.lengthBars, MIN_BLOCK_BARS, maxLength, 1);
      const block = { id: blockId, patternId: rawBlock.patternId, startBar, lengthBars };
      if (blockFits(lane, startBar, lengthBars)) lane.blocks.push(block);
    }

    lanes.push(lane);
  }

  return {
    enabled: Boolean(raw.enabled),
    bpm: clampBpm(raw.bpm),
    loopBars,
    lanes: lanes.length > 0 ? lanes : base.lanes,
  };
}

export function getArrangementSteps(arrangement) {
  const bars = clampInteger(arrangement && arrangement.loopBars, MIN_LOOP_BARS, MAX_LOOP_BARS, DEFAULT_LOOP_BARS);
  return Math.min(MAX_LOOP_STEPS, bars * ARRANGEMENT_STEPS_PER_BAR);
}

export function getArrangementStepDuration(arrangement) {
  const bpm = clampBpm(arrangement ? arrangement.bpm : 100);
  return (60 / bpm) / 4;
}

export function getArrangementDurationSec(arrangement) {
  return getArrangementSteps(arrangement) * getArrangementStepDuration(arrangement);
}

export function getArrangementLane(arrangement, laneId) {
  if (!arrangement || !Array.isArray(arrangement.lanes)) return null;
  return arrangement.lanes.find(lane => lane.id === laneId) || null;
}

export function getArrangementBlock(arrangement, blockId) {
  if (!arrangement || !Array.isArray(arrangement.lanes)) return null;
  for (const lane of arrangement.lanes) {
    const block = lane.blocks.find(item => item.id === blockId);
    if (block) return { lane, block };
  }
  return null;
}

export function countArrangementBlocks(arrangement) {
  if (!arrangement || !Array.isArray(arrangement.lanes)) return 0;
  return arrangement.lanes.reduce((sum, lane) => sum + lane.blocks.length, 0);
}

export function addArrangementLane(arrangement) {
  if (!arrangement || !Array.isArray(arrangement.lanes) || arrangement.lanes.length >= MAX_LANES) return null;
  const lane = {
    id: createId('lane'),
    name: `Loop ${arrangement.lanes.length + 1}`,
    blocks: [],
  };
  arrangement.lanes.push(lane);
  return lane;
}

export function removeArrangementLane(arrangement, laneId) {
  if (!arrangement || arrangement.lanes.length <= 1) return false;
  const before = arrangement.lanes.length;
  arrangement.lanes = arrangement.lanes.filter(lane => lane.id !== laneId);
  return arrangement.lanes.length < before;
}

export function addArrangementBlock(arrangement, { laneId, patternId, startBar, lengthBars }) {
  const lane = getArrangementLane(arrangement, laneId);
  if (!lane || !patternId) return null;

  const bar = clampInteger(startBar, 0, arrangement.loopBars - 1, 0);
  const maxLength = Math.min(MAX_BLOCK_BARS, arrangement.loopBars - bar);
  const length = clampInteger(lengthBars, MIN_BLOCK_BARS, maxLength, 1);
  if (!blockFits(lane, bar, length)) return null;

  const block = { id: createId('blk'), patternId, startBar: bar, lengthBars: length };
  lane.blocks.push(block);
  return block;
}

export function moveArrangementBlock(arrangement, blockId, laneId, startBar) {
  const found = getArrangementBlock(arrangement, blockId);
  const target = getArrangementLane(arrangement, laneId);
  if (!found || !target) return false;

  const bar = clampInteger(startBar, 0, arrangement.loopBars - 1, found.block.startBar);
  const targetLaneBlocks = found.lane.id === target.id
    ? found.lane.blocks.filter(block => block.id !== blockId)
    : target.blocks;
  const candidate = { ...found.block, startBar: bar };
  if (!blockFits({ blocks: targetLaneBlocks }, bar, candidate.lengthBars, blockId)) return false;
  if (found.lane.id !== target.id) {
    found.lane.blocks = found.lane.blocks.filter(block => block.id !== blockId);
    target.blocks.push(candidate);
  } else {
    found.block.startBar = bar;
  }
  return true;
}

export function removeArrangementBlock(arrangement, blockId) {
  const found = getArrangementBlock(arrangement, blockId);
  if (!found) return false;
  found.lane.blocks = found.lane.blocks.filter(block => block.id !== blockId);
  return true;
}

export function clearArrangementBlocks(arrangement) {
  if (!arrangement || !Array.isArray(arrangement.lanes)) return false;
  let changed = false;
  for (const lane of arrangement.lanes) {
    if (lane.blocks.length === 0) continue;
    lane.blocks = [];
    changed = true;
  }
  return changed;
}

export function setArrangementBpm(arrangement, value) {
  if (!arrangement) return 100;
  arrangement.bpm = clampBpm(value);
  return arrangement.bpm;
}

export function setLoopBars(arrangement, value) {
  if (!arrangement) return DEFAULT_LOOP_BARS;
  arrangement.loopBars = clampInteger(value, MIN_LOOP_BARS, MAX_LOOP_BARS, DEFAULT_LOOP_BARS);
  for (const lane of arrangement.lanes) {
    lane.blocks = lane.blocks
      .filter(block => block.startBar < arrangement.loopBars)
      .map(block => ({
        ...block,
        lengthBars: Math.min(block.lengthBars, arrangement.loopBars - block.startBar),
      }));
  }
  return arrangement.loopBars;
}

export function removePatternFromArrangement(arrangement, patternId) {
  if (!arrangement || !Array.isArray(arrangement.lanes)) return false;
  let changed = false;
  for (const lane of arrangement.lanes) {
    const next = lane.blocks.filter(block => block.patternId !== patternId);
    if (next.length !== lane.blocks.length) {
      lane.blocks = next;
      changed = true;
    }
  }
  return changed;
}

/**
 * Notes scheduled at one absolute arrangement step. A block that spans N bars
 * plays its pattern once in each bar; the pattern's own step count is mapped
 * proportionally onto the 16 timeline steps.
 */
export function getArrangementNotesAtStep(arrangement, patterns, stepIndex) {
  if (!arrangement || !Array.isArray(arrangement.lanes)) return [];
  const totalSteps = getArrangementSteps(arrangement);
  if (stepIndex < 0 || stepIndex >= totalSteps) return [];

  const bar = Math.floor(stepIndex / ARRANGEMENT_STEPS_PER_BAR);
  const stepInBar = stepIndex % ARRANGEMENT_STEPS_PER_BAR;
  const patternById = new Map(
    (Array.isArray(patterns) ? patterns : []).map(pattern => [pattern.id, pattern]),
  );
  const notes = [];

  for (const lane of arrangement.lanes) {
    for (const block of lane.blocks) {
      if (bar < block.startBar || bar >= block.startBar + block.lengthBars) continue;
      const pattern = patternById.get(block.patternId);
      if (!pattern) continue;
      const patternSteps = Math.max(1, getStepCountForSig(pattern.timeSignature));
      const localStep = Math.min(
        patternSteps - 1,
        Math.floor(stepInBar * patternSteps / ARRANGEMENT_STEPS_PER_BAR),
      );
      notes.push({ pattern, patternId: block.patternId, stepIndex: localStep, blockId: block.id });
    }
  }

  return notes;
}
