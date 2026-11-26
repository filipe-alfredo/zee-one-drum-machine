import assert from 'node:assert/strict';
import test from 'node:test';
import { matchInstrumentByFilename, resolveInstrumentFromLabel } from '../src/kits/kit-loader.js';

test('filename matching is case-insensitive substring matching', () => {
  assert.equal(matchInstrumentByFilename('Kick.wav').id, 'kick');
  assert.equal(matchInstrumentByFilename('my SNARE 01.wav').id, 'snare');
  assert.equal(matchInstrumentByFilename('closed-hat.wav').id, 'close_hat');
  assert.equal(matchInstrumentByFilename('unknown.wav'), null);
});

test('bundled Vortex abbreviations are not auto-matched by keywords', () => {
  assert.equal(matchInstrumentByFilename('KD_D_TMKD_Vortex_01.wav'), null);
  assert.equal(matchInstrumentByFilename('SN_TMKD-Vortex_1.wav'), null);
});

test('free-form labels resolve to the 23 instrument tracks', () => {
  assert.equal(resolveInstrumentFromLabel('snare 1').id, 'snare');
  assert.equal(resolveInstrumentFromLabel('tom grave').id, 'tom_low');
  assert.equal(resolveInstrumentFromLabel('Tom Médio').id, 'tom_mid');
  assert.equal(resolveInstrumentFromLabel('tom agudo').id, 'tom_high');
  assert.equal(resolveInstrumentFromLabel('caixa 2').id, 'snare');
  assert.equal(resolveInstrumentFromLabel('chimbal').id, 'close_hat');
  assert.equal(resolveInstrumentFromLabel('', null), null);
  assert.equal(resolveInstrumentFromLabel('misterioso'), null);
});
