import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildEmptyGrid,
  buildGridFromHits,
  cloneGrid,
  getBeatGroupSize,
  getTimeSignatureError,
  getStepCountForSig,
  getStepDurationSec,
  isValidTimeSignature,
  normalizeGrid,
  resizeGrid,
  TIME_SIGNATURE_PRESETS,
} from '../src/sequencer/pattern.js';
import { INSTRUMENTS } from '../src/kits/instruments.js';

test('dropdown offers only the fixed quarter-note presets', () => {
  assert.deepEqual(TIME_SIGNATURE_PRESETS, ['2/4', '3/4', '4/4', '5/4', '6/4', '8/4', '12/4']);
});

test('time signatures map to 16th-note grid step counts', () => {
  assert.equal(getStepCountForSig('2/4'), 8);
  assert.equal(getStepCountForSig('3/4'), 12);
  assert.equal(getStepCountForSig('4/4'), 16);
  assert.equal(getStepCountForSig('5/4'), 20);
  assert.equal(getStepCountForSig('6/4'), 24);
  assert.equal(getStepCountForSig('8/4'), 32);
  assert.equal(getStepCountForSig('12/4'), 48);
  assert.equal(getStepCountForSig('7/8'), 16);
  assert.equal(getStepCountForSig('custom'), 16);
  assert.equal(getStepCountForSig(undefined), 16);
});

test('only the fixed presets are valid', () => {
  for (const preset of TIME_SIGNATURE_PRESETS) {
    assert.equal(isValidTimeSignature(preset), true);
  }
  assert.equal(isValidTimeSignature('7/8'), false);
  assert.equal(isValidTimeSignature('9/9'), false);
  assert.equal(isValidTimeSignature('custom'), false);
});

test('invalid time signatures get a short message', () => {
  const message = getTimeSignatureError('9/9');
  assert.equal(message, 'Invalid time signature "9/9". Choose 2/4, 3/4, 4/4, 5/4, 6/4, 8/4, 12/4.');
  assert.equal(message.length < 100, true);
  assert.equal(message.includes('N/D'), false);
});

test('every preset groups four 16th notes per beat', () => {
  for (const preset of TIME_SIGNATURE_PRESETS) {
    assert.equal(getBeatGroupSize(preset), 4);
    assert.equal(getStepDurationSec(120, preset), 0.125);
  }
});

test('grids contain a row for every instrument', () => {
  const grid = buildEmptyGrid(16);
  assert.equal(Object.keys(grid).length, INSTRUMENTS.length);
  for (const instrument of INSTRUMENTS) {
    assert.deepEqual(grid[instrument.id], Array(16).fill(false));
  }
});

test('hits outside the grid are ignored', () => {
  const grid = buildGridFromHits({ kick: [-1, 0, 15, 16] }, 16);
  assert.deepEqual(grid.kick.map((value, index) => (value ? index : null)).filter(index => index !== null), [0, 15]);
});

test('normalizeGrid pads, truncates, and coerces persisted rows', () => {
  const normalized = normalizeGrid({ kick: [1, 0, 'yes'], snare: [true, false] }, 4);
  assert.deepEqual(normalized.kick, [true, false, true, false]);
  assert.deepEqual(normalized.snare, [true, false, false, false]);
  assert.equal(normalized.crash.length, 4);
});

test('resizeGrid keeps overlapping steps and pads new ones', () => {
  const original = buildGridFromHits({ kick: [0, 4, 8, 12] }, 16);
  const shorter = resizeGrid(original, 16, 12);
  assert.deepEqual(shorter.kick, [true, false, false, false, true, false, false, false, true, false, false, false]);

  const longer = resizeGrid(shorter, 12, 16);
  assert.deepEqual(longer.kick, [true, false, false, false, true, false, false, false, true, false, false, false, false, false, false, false]);
});

test('cloneGrid does not share row arrays', () => {
  const original = buildGridFromHits({ kick: [0] }, 16);
  const copy = cloneGrid(original);
  copy.kick[0] = false;
  assert.equal(original.kick[0], true);
});
