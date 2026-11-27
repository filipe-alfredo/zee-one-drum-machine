import assert from 'node:assert/strict';
import test from 'node:test';
import { encodeMp3Blob } from '../src/audio/mp3-export.js';

function sineBuffer({ channels = 2, frames = 8820, sampleRate = 44100 } = {}) {
  const data = Array.from({ length: channels }, () => {
    const values = new Float32Array(frames);
    for (let index = 0; index < frames; index += 1) {
      values[index] = 0.4 * Math.sin((2 * Math.PI * 440 * index) / sampleRate);
    }
    return values;
  });
  return {
    numberOfChannels: channels,
    sampleRate,
    length: frames,
    getChannelData: channel => data[channel],
  };
}

test('MP3 encoder produces MPEG audio frames from stereo PCM', async () => {
  const blob = await encodeMp3Blob(sineBuffer());
  assert.equal(blob.type, 'audio/mpeg');
  assert.ok(blob.size > 1000, `Expected real MP3 frames, got ${blob.size} bytes`);

  const bytes = new Uint8Array(await blob.arrayBuffer());
  const firstFrame = [bytes[0], bytes[1], bytes[2]];
  assert.equal(firstFrame[0], 0xff, 'MPEG frame sync byte');
  assert.equal(firstFrame[1] & 0xe0, 0xe0, 'MPEG frame sync + layer bits');
  assert.ok(bytes.length % 1 === 0);
});

test('MP3 encoder supports mono and reports progress', async () => {
  const progress = [];
  const blob = await encodeMp3Blob(sineBuffer({ channels: 1 }), {
    onProgress: value => progress.push(value),
  });
  assert.equal(blob.type, 'audio/mpeg');
  assert.ok(blob.size > 1000);
  assert.equal(progress.at(-1), 1);
  assert.ok(progress.length > 1);
});
