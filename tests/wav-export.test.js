import assert from 'node:assert/strict';
import test from 'node:test';
import { encodeWavBlob } from '../src/audio/audio-utils.js';
import { buildLoopWavFileName, buildWavFileName } from '../src/audio/wav-export.js';

function readString(view, offset, length) {
  let value = '';
  for (let index = 0; index < length; index += 1) {
    value += String.fromCharCode(view.getUint8(offset + index));
  }
  return value;
}

test('WAV file names are derived from the pattern name and BPM', () => {
  assert.equal(buildWavFileName({ name: 'Rock 1', bpm: 100 }), 'zeeone_rock_1_100bpm.wav');
  assert.equal(buildWavFileName({ name: 'My Pattern!', bpm: 82 }), 'zeeone_my_pattern__82bpm.wav');
});

test('loop WAV names report rows and painted beats without a global BPM', () => {
  const arrangement = {
    enabled: true,
    timelineBeats: 32,
    rows: [
      { id: 'r1', patternId: 'p1', bpm: 90, blocks: [{ id: 'b1', start: 0, beats: 4 }] },
      { id: 'r2', patternId: 'p2', bpm: 160, blocks: [{ id: 'b2', start: 8, beats: 5 }] },
    ],
  };
  assert.equal(buildLoopWavFileName(arrangement), 'zeeone_loop_2rows_13beats.wav');
  assert.equal(buildLoopWavFileName(createEmptyArrangement()), 'zeeone_loop_0rows_1beats.wav');
});

function createEmptyArrangement() {
  return { enabled: false, timelineBeats: 32, rows: [] };
}

test('encoded audio has a valid 16-bit stereo WAV header', async () => {
  const audioBuffer = {
    numberOfChannels: 2,
    sampleRate: 44100,
    length: 4,
    getChannelData(channel) {
      return channel === 0 ? [0, 1, -1, 0.5] : [0, -1, 1, 0];
    },
  };

  const blob = encodeWavBlob(audioBuffer);
  assert.equal(blob.type, 'audio/wav');
  assert.equal(blob.size, 44 + 4 * 2 * 2);

  const view = new DataView(await blob.arrayBuffer());
  assert.equal(readString(view, 0, 4), 'RIFF');
  assert.equal(view.getUint32(4, true), 36 + 16);
  assert.equal(readString(view, 8, 4), 'WAVE');
  assert.equal(readString(view, 12, 4), 'fmt ');
  assert.equal(view.getUint32(16, true), 16);
  assert.equal(view.getUint16(20, true), 1);
  assert.equal(view.getUint16(22, true), 2);
  assert.equal(view.getUint32(24, true), 44100);
  assert.equal(view.getUint32(28, true), 44100 * 2 * 2);
  assert.equal(view.getUint16(32, true), 4);
  assert.equal(view.getUint16(34, true), 16);
  assert.equal(readString(view, 36, 4), 'data');
  assert.equal(view.getUint32(40, true), 16);

  assert.equal(view.getInt16(44, true), 0);
  assert.equal(view.getInt16(46, true), 0);
  assert.equal(view.getInt16(48, true), 32767);
  assert.equal(view.getInt16(50, true), -32768);
  assert.equal(view.getInt16(52, true), -32768);
});

test('WAV encoder can stop at a cropped frame count', async () => {
  const audioBuffer = {
    numberOfChannels: 2,
    sampleRate: 44100,
    length: 4,
    getChannelData(channel) {
      return channel === 0 ? [0, 1, -1, 0.5] : [0, -1, 1, 0];
    },
  };

  const blob = encodeWavBlob(audioBuffer, 2);
  assert.equal(blob.size, 44 + 2 * 2 * 2);
  const view = new DataView(await blob.arrayBuffer());
  assert.equal(view.getUint32(40, true), 8);
  assert.equal(view.getInt16(48, true), 32767);
  assert.equal(view.getInt16(50, true), -32768);
});
