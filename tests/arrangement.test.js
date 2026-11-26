import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ARRANGEMENT_STEPS_PER_BAR,
  DEFAULT_LOOP_BARS,
  MAX_BLOCK_BARS,
  MAX_LANES,
  MAX_LOOP_BARS,
  addArrangementBlock,
  addArrangementLane,
  clearArrangementBlocks,
  countArrangementBlocks,
  createDefaultArrangement,
  getArrangementBlock,
  getArrangementDurationSec,
  getArrangementLane,
  getArrangementNotesAtStep,
  getArrangementSteps,
  getArrangementStepDuration,
  moveArrangementBlock,
  normalizeArrangement,
  removeArrangementBlock,
  removeArrangementLane,
  removePatternFromArrangement,
  setArrangementBpm,
  setLoopBars,
} from '../src/sequencer/arrangement.js';

test('default arrangement uses a 16-step bar grid with its own tempo', () => {
  const arrangement = createDefaultArrangement();

  assert.equal(arrangement.enabled, false);
  assert.equal(arrangement.bpm, 100);
  assert.equal(arrangement.loopBars, DEFAULT_LOOP_BARS);
  assert.equal(arrangement.lanes.length, 4);
  assert.equal(getArrangementSteps(arrangement), DEFAULT_LOOP_BARS * ARRANGEMENT_STEPS_PER_BAR);
  assert.equal(getArrangementStepDuration(arrangement), 0.15);
  assert.equal(getArrangementDurationSec(arrangement), 19.2);

  assert.equal(setArrangementBpm(arrangement, 999), 240);
  assert.equal(getArrangementStepDuration(arrangement), 0.0625);
  assert.equal(setArrangementBpm(arrangement, 'not-a-number'), 100);
  assert.equal(setLoopBars(arrangement, 999), MAX_LOOP_BARS);
  assert.equal(getArrangementSteps(arrangement), 512);
  assert.equal(setLoopBars(arrangement, 0), 1);
  assert.equal(getArrangementSteps(arrangement), 16);
});

test('normalization clamps values, drops unknown patterns, and resolves overlaps', () => {
  const lanes = Array.from({ length: 10 }, (_, index) => ({
    id: `lane_${index}`,
    name: `Lane ${index}`,
    blocks: [],
  }));
  lanes[0].blocks = [
    { id: 'b_late', patternId: 'p2', startBar: 5, lengthBars: 2 },
    { id: 'b_unknown', patternId: 'missing', startBar: 0, lengthBars: 1 },
    { id: 'b_first', patternId: 'p1', startBar: 0, lengthBars: 2 },
    { id: 'b_overlap', patternId: 'p2', startBar: 1, lengthBars: 1 },
    { id: 'b_first', patternId: 'p2', startBar: 10, lengthBars: 1 },
    { id: 'b_trim', patternId: 'p1', startBar: 31, lengthBars: 99 },
  ];

  const arrangement = normalizeArrangement({
    enabled: true,
    bpm: 999,
    loopBars: 999,
    lanes,
  }, [{ id: 'p1' }, { id: 'p2' }]);

  assert.equal(arrangement.enabled, true);
  assert.equal(arrangement.bpm, 240);
  assert.equal(arrangement.loopBars, MAX_LOOP_BARS);
  assert.equal(arrangement.lanes.length, MAX_LANES);
  assert.deepEqual(
    arrangement.lanes[0].blocks.map(block => block.id),
    ['b_first', 'b_late', arrangement.lanes[0].blocks[2].id, 'b_trim'],
  );
  assert.notEqual(arrangement.lanes[0].blocks[2].id, 'b_first');
  assert.equal(arrangement.lanes[0].blocks[3].lengthBars, 1);
  assert.deepEqual(normalizeArrangement(null, [{ id: 'p1' }]), createDefaultArrangement());
});

test('blocks can be added, moved, and removed but never overlap inside a lane', () => {
  const arrangement = createDefaultArrangement();
  const firstLane = arrangement.lanes[0];
  const secondLane = arrangement.lanes[1];
  const thirdLane = arrangement.lanes[2];

  const block = addArrangementBlock(arrangement, {
    laneId: firstLane.id,
    patternId: 'p1',
    startBar: 0,
    lengthBars: 2,
  });
  assert.ok(block);
  assert.equal(countArrangementBlocks(arrangement), 1);
  assert.equal(addArrangementBlock(arrangement, {
    laneId: firstLane.id,
    patternId: 'p2',
    startBar: 1,
    lengthBars: 1,
  }), null);
  assert.equal(addArrangementBlock(arrangement, {
    laneId: secondLane.id,
    patternId: 'p2',
    startBar: 0,
    lengthBars: 1,
  }).startBar, 0);
  assert.equal(addArrangementBlock(arrangement, {
    laneId: thirdLane.id,
    patternId: 'p2',
    startBar: 0,
    lengthBars: MAX_BLOCK_BARS + 1,
  }).lengthBars, DEFAULT_LOOP_BARS);
  addArrangementBlock(arrangement, {
    laneId: firstLane.id,
    patternId: 'p2',
    startBar: 4,
    lengthBars: 1,
  });

  assert.equal(moveArrangementBlock(arrangement, block.id, firstLane.id, 4), false);
  assert.equal(moveArrangementBlock(arrangement, block.id, secondLane.id, 0), false);
  assert.equal(moveArrangementBlock(arrangement, block.id, secondLane.id, 1), true);
  assert.equal(getArrangementBlock(arrangement, block.id).lane.id, secondLane.id);
  assert.equal(getArrangementBlock(arrangement, block.id).block.startBar, 1);
  assert.equal(moveArrangementBlock(arrangement, block.id, firstLane.id, 5), true);
  assert.equal(getArrangementBlock(arrangement, block.id).lane.id, firstLane.id);
  assert.equal(getArrangementBlock(arrangement, block.id).block.startBar, 5);

  assert.equal(removeArrangementBlock(arrangement, block.id), true);
  assert.equal(removeArrangementBlock(arrangement, block.id), false);
  assert.equal(clearArrangementBlocks(arrangement), true);
  assert.equal(countArrangementBlocks(arrangement), 0);

  const addedLane = addArrangementLane(arrangement);
  assert.equal(arrangement.lanes.length, 5);
  assert.ok(getArrangementLane(arrangement, addedLane.id));
  assert.equal(removeArrangementLane(arrangement, firstLane.id), true);
  assert.equal(removeArrangementLane(arrangement, addedLane.id), true);
  while (arrangement.lanes.length > 1) {
    assert.equal(removeArrangementLane(arrangement, arrangement.lanes[0].id), true);
  }
  assert.equal(removeArrangementLane(arrangement, arrangement.lanes[0].id), false);
});

test('shortening the loop trims or drops blocks and deleted patterns are unlinked', () => {
  const arrangement = createDefaultArrangement();
  const firstLane = arrangement.lanes[0];
  const trimmed = addArrangementBlock(arrangement, {
    laneId: firstLane.id,
    patternId: 'p1',
    startBar: 6,
    lengthBars: 4,
  });
  assert.equal(trimmed.lengthBars, 2);

  const removed = addArrangementBlock(arrangement, {
    laneId: arrangement.lanes[1].id,
    patternId: 'p2',
    startBar: 7,
    lengthBars: 1,
  });
  assert.equal(setLoopBars(arrangement, 4), 4);
  assert.equal(getArrangementBlock(arrangement, removed.id), null);
  assert.equal(getArrangementBlock(arrangement, trimmed.id), null);
  assert.equal(countArrangementBlocks(arrangement), 0);

  const linked = addArrangementBlock(arrangement, {
    laneId: firstLane.id,
    patternId: 'p1',
    startBar: 1,
    lengthBars: 1,
  });
  assert.equal(removePatternFromArrangement(arrangement, 'p2'), false);
  assert.equal(removePatternFromArrangement(arrangement, 'p1'), true);
  assert.equal(getArrangementBlock(arrangement, linked.id), null);
});

test('every block repeats its pattern on each covered bar with mapped steps', () => {
  const arrangement = createDefaultArrangement();
  setLoopBars(arrangement, 3);
  setArrangementBpm(arrangement, 120);

  addArrangementBlock(arrangement, {
    laneId: arrangement.lanes[0].id,
    patternId: 'p16',
    startBar: 0,
    lengthBars: 2,
  });
  addArrangementBlock(arrangement, {
    laneId: arrangement.lanes[1].id,
    patternId: 'p8',
    startBar: 1,
    lengthBars: 2,
  });
  const patterns = [
    { id: 'p16', timeSignature: '4/4' },
    { id: 'p8', timeSignature: '2/4' },
  ];

  const at = step => getArrangementNotesAtStep(arrangement, patterns, step)
    .map(note => `${note.patternId}:${note.stepIndex}`);

  assert.deepEqual(at(0), ['p16:0']);
  assert.deepEqual(at(15), ['p16:15']);
  assert.deepEqual(at(16), ['p16:0', 'p8:0']);
  assert.deepEqual(at(17), ['p16:1', 'p8:0']);
  assert.deepEqual(at(31), ['p16:15', 'p8:7']);
  assert.deepEqual(at(32), ['p8:0']);
  assert.deepEqual(at(47), ['p8:7']);
  assert.deepEqual(at(48), []);
  assert.deepEqual(at(-1), []);
  assert.equal(getArrangementStepDuration(arrangement), 0.125);
});
