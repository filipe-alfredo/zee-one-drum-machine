import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_TIMELINE_BEATS,
  MAX_BLOCKS,
  MAX_ROWS,
  STEPS_PER_BEAT,
  addArrangementRow,
  clearArrangementBlocks,
  clearArrangementRows,
  countArrangementBlocks,
  countArrangementRows,
  createDefaultArrangement,
  ensureTimelineBeats,
  getArrangementBeats,
  getArrangementDurationSec,
  getArrangementEvents,
  getArrangementRow,
  getArrangementRowsAtTime,
  getBeatsForPattern,
  getBlockAtBeat,
  getTimelineBeats,
  normalizeArrangement,
  removeArrangementRow,
  removePatternFromArrangement,
  setArrangementRowBpm,
  toggleArrangementBlock,
} from '../src/sequencer/arrangement.js';

const patterns = [
  { id: 'p2', name: 'Two', timeSignature: '2/4' },
  { id: 'p4', name: 'Four', timeSignature: '4/4' },
  { id: 'p12', name: 'Twelve', timeSignature: '12/4' },
];

test('default arrangement has an empty 32-beat timeline and no global BPM', () => {
  const arrangement = createDefaultArrangement();

  assert.equal(arrangement.enabled, false);
  assert.equal(arrangement.timelineBeats, DEFAULT_TIMELINE_BEATS);
  assert.deepEqual(arrangement.rows, []);
  assert.equal(getTimelineBeats(arrangement), 32);
  assert.equal(countArrangementRows(arrangement), 0);
  assert.equal(countArrangementBlocks(arrangement), 0);
  assert.equal(getArrangementBeats(arrangement), 0);
  assert.equal(getArrangementDurationSec(arrangement, patterns), 0);
  assert.equal(Object.prototype.hasOwnProperty.call(arrangement, 'bpm'), false);
});

test('a painted block covers the pattern length in beats, not one cell', () => {
  const arrangement = createDefaultArrangement();
  const row = addArrangementRow(arrangement, 'p4', patterns, 120);
  assert.ok(row);

  const painted = toggleArrangementBlock(arrangement, row.id, 5, patterns);
  assert.equal(painted.action, 'added');
  assert.equal(painted.block.start, 5);
  assert.equal(painted.block.beats, 4);

  for (let beat = 5; beat < 9; beat += 1) {
    assert.equal(getBlockAtBeat(row, beat).id, painted.block.id);
  }
  assert.equal(getBlockAtBeat(row, 4), null);
  assert.equal(getBlockAtBeat(row, 9), null);
  assert.equal(getArrangementBeats(arrangement), 9);

  const removed = toggleArrangementBlock(arrangement, row.id, 8, patterns);
  assert.equal(removed.action, 'removed');
  assert.equal(removed.block.id, painted.block.id);
  assert.equal(countArrangementBlocks(arrangement), 0);
});

test('2/4 and 12/4 patterns paint 2 and 12 cells respectively', () => {
  const arrangement = createDefaultArrangement();
  const two = addArrangementRow(arrangement, 'p2', patterns);
  const twelve = addArrangementRow(arrangement, 'p12', patterns);

  assert.equal(getBeatsForPattern(patterns[0]), 2);
  assert.equal(getBeatsForPattern(patterns[2]), 12);
  assert.equal(toggleArrangementBlock(arrangement, two.id, 0, patterns).block.beats, 2);
  assert.equal(toggleArrangementBlock(arrangement, twelve.id, 20, patterns).block.beats, 12);
  assert.equal(getBlockAtBeat(two, 1).patternId, undefined);
  assert.equal(getBlockAtBeat(two, 1).id, getBlockAtBeat(two, 0).id);
  assert.equal(getBlockAtBeat(twelve, 31).id, getBlockAtBeat(twelve, 20).id);
  assert.equal(getBlockAtBeat(twelve, 32), null);
});

test('timeline grows in 8-beat pages when a block reaches the right edge', () => {
  const arrangement = createDefaultArrangement();
  const row = addArrangementRow(arrangement, 'p4', patterns);

  assert.equal(ensureTimelineBeats(arrangement, 31), false);
  toggleArrangementBlock(arrangement, row.id, 29, patterns);
  assert.equal(getTimelineBeats(arrangement), 40);
  assert.equal(countArrangementBlocks(arrangement), 1);
});

test('rows can overlap, have their own BPM, and are removed individually', () => {
  const arrangement = createDefaultArrangement();
  const first = addArrangementRow(arrangement, 'p2', patterns, 60);
  const second = addArrangementRow(arrangement, 'p4', patterns, 120);

  assert.equal(setArrangementRowBpm(arrangement, first.id, 90), 90);
  assert.equal(setArrangementRowBpm(arrangement, first.id, 999), 240);
  assert.equal(setArrangementRowBpm(arrangement, 'missing', 100), null);
  assert.equal(addArrangementRow(arrangement, 'missing', patterns), null);

  toggleArrangementBlock(arrangement, first.id, 4, patterns);
  toggleArrangementBlock(arrangement, second.id, 2, patterns);
  const active = getArrangementRowsAtTime(arrangement, patterns, 4 * (60 / 240));
  assert.deepEqual(active.map(item => item.rowId).sort(), [first.id, second.id].sort());

  assert.equal(removeArrangementRow(arrangement, first.id), true);
  assert.equal(removeArrangementRow(arrangement, first.id), false);
  assert.equal(getArrangementRow(arrangement, first.id), null);
  assert.equal(countArrangementRows(arrangement), 1);
});

test('events use each row BPM and allow simultaneous blocks', () => {
  const arrangement = createDefaultArrangement();
  const slow = addArrangementRow(arrangement, 'p2', patterns, 60);
  const fast = addArrangementRow(arrangement, 'p2', patterns, 120);
  setArrangementRowBpm(arrangement, slow.id, 60);
  toggleArrangementBlock(arrangement, slow.id, 0, patterns);
  toggleArrangementBlock(arrangement, fast.id, 0, patterns);

  const events = getArrangementEvents(arrangement, patterns);
  assert.equal(events.length, 16);
  assert.deepEqual([...new Set(events.map(event => event.time))].sort((a, b) => a - b),
    [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1, 1.25, 1.5, 1.75]);
  assert.equal(events[0].source, 'loop');
  assert.equal(getArrangementDurationSec(arrangement, patterns), 2);

  const atStart = events.filter(event => event.time === 0);
  assert.equal(atStart.length, 2);
  assert.deepEqual(atStart.map(event => event.rowId).sort(), [slow.id, fast.id].sort());
});

test('clear actions distinguish painted cells from pattern rows', () => {
  const arrangement = createDefaultArrangement();
  const row = addArrangementRow(arrangement, 'p4', patterns);
  toggleArrangementBlock(arrangement, row.id, 0, patterns);

  assert.equal(clearArrangementBlocks(arrangement), true);
  assert.equal(countArrangementRows(arrangement), 1);
  assert.equal(countArrangementBlocks(arrangement), 0);
  assert.equal(clearArrangementBlocks(arrangement), false);

  toggleArrangementBlock(arrangement, row.id, 8, patterns);
  assert.equal(clearArrangementRows(arrangement), true);
  assert.equal(countArrangementRows(arrangement), 0);
  assert.equal(getTimelineBeats(arrangement), 32);
  assert.equal(clearArrangementRows(arrangement), false);
});

test('deleting a pattern unlinks its row from the loop', () => {
  const arrangement = createDefaultArrangement();
  addArrangementRow(arrangement, 'p2', patterns);
  addArrangementRow(arrangement, 'p4', patterns);

  assert.equal(removePatternFromArrangement(arrangement, 'p12'), false);
  assert.equal(removePatternFromArrangement(arrangement, 'p2'), true);
  assert.deepEqual(arrangement.rows.map(row => row.patternId), ['p4']);
});

test('new-format rows survive normalization with BPM and blocks intact', () => {
  const arrangement = createDefaultArrangement();
  const row = addArrangementRow(arrangement, 'p4', patterns, 145);
  toggleArrangementBlock(arrangement, row.id, 7, patterns);
  const saved = JSON.parse(JSON.stringify(arrangement));

  const normalized = normalizeArrangement(saved, patterns);
  assert.deepEqual(normalized, saved);
  assert.equal(normalized.rows[0].bpm, 145);
  assert.equal(normalized.rows[0].blocks[0].beats, 4);
});

test('legacy sequence and lanes migrate to painted rows', () => {
  const sequence = normalizeArrangement({
    enabled: true,
    bpm: 150,
    sequence: [
      { id: 's1', patternId: 'p2' },
      { id: 's2', patternId: 'p4' },
      { id: 's1', patternId: 'missing' },
      { id: 's4', patternId: 'p2' },
    ],
  }, patterns);

  assert.equal(sequence.enabled, true);
  assert.equal(sequence.rows.length, 2);
  assert.equal(sequence.rows[0].bpm, 150);
  assert.deepEqual(sequence.rows[0].blocks.map(block => block.start), [0, 6]);
  assert.deepEqual(sequence.rows[1].blocks.map(block => block.start), [2]);
  assert.notEqual(sequence.rows[0].blocks[1].id, 's1');

  const lanes = normalizeArrangement({
    lanes: [
      { id: 'lane_1', blocks: [
        { id: 'b1', patternId: 'p4', startBar: 5, lengthBars: 1 },
        { id: 'b2', patternId: 'p2', startBar: 0, lengthBars: 1 },
      ] },
    ],
  }, patterns);
  assert.deepEqual(lanes.rows.map(row => row.patternId), ['p4', 'p2']);
  assert.equal(lanes.rows[0].blocks[0].start, 5);
  assert.equal(lanes.rows[1].blocks[0].start, 0);
});

test('normalization rejects unknown patterns, caps rows/blocks and clamps values', () => {
  const cappedRows = Array.from({ length: MAX_ROWS + 4 }, (_, index) => ({
    id: `row_${index}`,
    patternId: 'p4',
    bpm: 999,
    blocks: [],
  }));
  const normalized = normalizeArrangement({ rows: cappedRows }, patterns);
  assert.equal(normalized.rows.length, MAX_ROWS);

  const manyBlocks = normalizeArrangement({
    rows: [{
      id: 'r1',
      patternId: 'p4',
      bpm: 10,
      blocks: Array.from({ length: MAX_BLOCKS + 10 }, (_, index) => ({
        id: `b${index}`,
        start: index * 5,
        beats: 99,
      })),
    }],
  }, patterns);
  assert.equal(manyBlocks.rows[0].bpm, 40);
  assert.equal(manyBlocks.rows[0].blocks.length, MAX_BLOCKS);
  assert.equal(manyBlocks.rows[0].blocks[0].beats, 4);
  assert.deepEqual(normalizeArrangement(null, patterns), createDefaultArrangement());
});
