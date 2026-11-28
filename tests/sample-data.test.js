import assert from 'node:assert/strict';
import test from 'node:test';
import { bytesToDataUrl, dataUrlToBytes, mimeTypeForFileName, sanitizeRelativePath } from '../src/kits/sample-data.js';

test('sample bytes round-trip through a base64 data URL', () => {
  const bytes = new Uint8Array([0, 1, 2, 250, 251, 255]);
  const url = bytesToDataUrl(bytes, 'audio/wav');
  assert.equal(url.startsWith('data:audio/wav;base64,'), true);
  assert.deepEqual(dataUrlToBytes(url), bytes);
});

test('large sample data is encoded without exhausting the call stack', () => {
  const bytes = new Uint8Array(100000);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = (index * 31) & 0xff;
  assert.deepEqual(dataUrlToBytes(bytesToDataUrl(bytes)), bytes);
});

test('invalid data URLs are rejected', () => {
  assert.throws(() => dataUrlToBytes('not-a-data-url'), /Invalid sample data URL/);
});

test('ZIP paths keep folders but remove traversal', () => {
  assert.equal(sanitizeRelativePath('Demo Kit/ALL MICS/KD_D_Demo_01.wav'), 'Demo_Kit/ALL_MICS/KD_D_Demo_01.wav');
  assert.equal(sanitizeRelativePath('../../etc/passwd'), 'etc/passwd');
  assert.equal(sanitizeRelativePath('\\kit\\samples\\snare.wav'), 'kit/samples/snare.wav');
});

test('mime type follows the sample extension', () => {
  assert.equal(mimeTypeForFileName('kick.WAV'), 'audio/wav');
  assert.equal(mimeTypeForFileName('snare.mp3'), 'audio/mpeg');
  assert.equal(mimeTypeForFileName('unknown'), 'application/octet-stream');
});
