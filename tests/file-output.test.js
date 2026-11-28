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

function withDownload(run) {
  const previousDocument = globalThis.document;
  const previousCreate = URL.createObjectURL;
  const previousRevoke = URL.revokeObjectURL;
  const downloads = [];
  const blobs = [];

  globalThis.document = {
    createElement(tag) {
      assert.equal(tag, 'a');
      const link = {
        hidden: false,
        appendChild() {},
        remove() {},
      };
      link.click = () => downloads.push({ name: link.download, href: link.href });
      return link;
    },
    body: { appendChild() {} },
  };
  URL.createObjectURL = blob => {
    blobs.push(blob);
    return 'blob:test';
  };
  URL.revokeObjectURL = () => {};

  return Promise.resolve(run({ downloads, blobs })).finally(() => {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
    if (previousCreate === undefined) delete URL.createObjectURL;
    else URL.createObjectURL = previousCreate;
    if (previousRevoke === undefined) delete URL.revokeObjectURL;
    else URL.revokeObjectURL = previousRevoke;
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

test('requestSaveTarget falls back to a download without a save API', async () => {
  await withWindow({}, async () => {
    const target = await requestSaveTarget({ suggestedName: 'zeeone_loop_4bars_100bpm.wav' });
    assert.deepEqual(target, {
      method: 'download',
      name: 'zeeone_loop_4bars_100bpm.wav',
    });
  });
});

test('writeSaveTarget downloads the rendered bytes without a save API', async () => {
  const messages = [];
  const blob = new Blob([new Uint8Array([82, 73, 70, 70])], { type: 'audio/wav' });
  await withDownload(async ({ downloads, blobs }) => {
    const saved = await writeSaveTarget(
      { method: 'download', name: 'zeeone_loop_4bars_100bpm.wav' },
      blob,
      {
        toast: { show: message => messages.push(message) },
        successMessage: name => `Exported WAV: ${name}`,
      },
    );

    assert.equal(saved, true);
    assert.equal(downloads.length, 1);
    assert.equal(downloads[0].name, 'zeeone_loop_4bars_100bpm.wav');
    assert.equal(downloads[0].href, 'blob:test');
    assert.deepEqual(blobs, [blob]);
    assert.deepEqual(messages, ['Exported WAV: zeeone_loop_4bars_100bpm.wav']);
  });
});
