import assert from 'node:assert/strict';
import test from 'node:test';
import { buildKitConfig, parseKitConfig, sanitizeFileName } from '../src/kits/kit-format.js';

test('file and kit names are sanitized', () => {
  assert.equal(sanitizeFileName('My Kick! 01.WAV'), 'My_Kick_01.WAV');
  assert.equal(sanitizeFileName('../../etc/passwd'), 'passwd');
});

test('buildKitConfig writes one sample path per instrument', () => {
  const config = buildKitConfig({
    id: 'My Kit!',
    name: 'My Kit',
    assignments: [
      { instrumentId: 'kick', fileName: 'KD_D_Demo_01.wav' },
      { instrumentId: 'snare', fileName: 'SN_D_Demo_01.wav' },
      { instrumentId: 'not_an_instrument', fileName: 'ignored.wav' },
    ],
  });

  assert.deepEqual(config, {
    id: 'my-kit',
    name: 'My Kit',
    version: 1,
    instruments: {
      kick: {
        file: 'samples/kick/KD_D_Demo_01.wav',
        label: 'KD_D_Demo_01.wav',
      },
      snare: {
        file: 'samples/snare/SN_D_Demo_01.wav',
        label: 'SN_D_Demo_01.wav',
      },
    },
  });
});

test('parseKitConfig validates instrument ids and sample paths', () => {
  const config = parseKitConfig({
    id: 'demo',
    name: 'Demo',
    instruments: {
      kick: { file: 'samples/kick/kick.wav' },
      snare: { file: 'bad/path/snare.wav' },
      clap: { file: 'samples/clap/../click.wav' },
      unknown: { file: 'samples/unknown/x.wav' },
    },
  });

  assert.equal(config.id, 'demo');
  assert.deepEqual(Object.keys(config.instruments), ['kick']);
  assert.equal(parseKitConfig(null), null);
});
