import assert from 'node:assert/strict';
import test from 'node:test';
import { requestSaveTarget, writeSaveTarget } from '../src/utils/file-output.js';

function withWindow(value, run) {
  const previous = globalThis.window;
  globalThis.window = value;
  return Promise.resolve(run()).finally(() => {
    if (previous === undefined) delete globalThis.window;
    else globalThis.window = previous;
  });
}

test('export targets use the native Electron dialog when available', async () => {
  let requested = null;
  await withWindow({
    zeeoneDesktop: {
      chooseSavePath: async options => {
        requested = options;
        return { canceled: false, requestId: 'save_1', name: 'chosen.wav' };
      },
      writeFile: async () => {},
    },
    showSaveFilePicker: async () => { throw new Error('browser picker must not be used'); },
  }, async () => {
    const target = await requestSaveTarget({
      suggestedName: 'zeeone_beat_100bpm.wav',
      description: 'WAV audio',
      mimeType: 'audio/wav',
      extensions: ['wav'],
    });

    assert.deepEqual(target, {
      method: 'desktop',
      requestId: 'save_1',
      name: 'chosen.wav',
    });
    assert.equal(requested.suggestedName, 'zeeone_beat_100bpm.wav');
    assert.deepEqual(requested.filters, [{ name: 'WAV audio', extensions: ['wav'] }]);
  });
});

test('writeSaveTarget sends the rendered bytes through the desktop bridge', async () => {
  const writes = [];
  const messages = [];
  await withWindow({
    zeeoneDesktop: {
      writeFile: async options => writes.push(options),
    },
  }, async () => {
    const blob = new Blob([new Uint8Array([82, 73, 70, 70])], { type: 'audio/wav' });
    const saved = await writeSaveTarget(
      { method: 'desktop', requestId: 'save_1', name: 'chosen.wav' },
      blob,
      {
        toast: { show: message => messages.push(message) },
        successMessage: name => `Exported WAV: ${name}`,
      },
    );

    assert.equal(saved, true);
    assert.equal(writes.length, 1);
    assert.equal(writes[0].requestId, 'save_1');
    assert.equal(writes[0].data.byteLength, 4);
    assert.deepEqual(messages, ['Exported WAV: chosen.wav']);
  });
});

test('writeSaveTarget uses the browser File System Access API without Electron', async () => {
  let closed = false;
  const written = [];
  await withWindow({
    showSaveFilePicker: async options => ({
      name: options.suggestedName,
      createWritable: async () => ({
        write: async blob => written.push(blob),
        close: async () => { closed = true; },
      }),
    }),
  }, async () => {
    const target = await requestSaveTarget({
      suggestedName: 'zeeone_loop_8bars_100bpm.wav',
      description: 'WAV audio',
      mimeType: 'audio/wav',
      extensions: ['wav'],
    });
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/wav' });
    const saved = await writeSaveTarget(target, blob);

    assert.equal(target.method, 'picker');
    assert.equal(saved, true);
    assert.equal(written.length, 1);
    assert.equal(written[0], blob);
    assert.equal(closed, true);
  });
});

test('requestSaveTarget rejects instead of downloading without a save API', async () => {
  await withWindow({}, async () => {
    await assert.rejects(
      requestSaveTarget({ suggestedName: 'zeeone_loop_4bars_100bpm.wav' }),
      /requires the ZeeOne Electron app or a Chromium browser/,
    );
  });
});

test('writeSaveTarget reports unsupported targets without downloading', async () => {
  const messages = [];
  await withWindow({}, async () => {
    const saved = await writeSaveTarget(
      { method: 'download', name: 'zeeone_loop_4bars_100bpm.wav' },
      new Blob([new Uint8Array([1])]),
      { toast: { show: message => messages.push(message) } },
    );

    assert.equal(saved, false);
    assert.equal(messages.length, 1);
    assert.match(messages[0], /Unsupported save target: download/);
  });
});
