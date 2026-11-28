import assert from 'node:assert/strict';
import test from 'node:test';
import { WorkspaceFileController } from '../src/state/workspace-file.js';

function withDownload(run) {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const previousCreate = URL.createObjectURL;
  const previousRevoke = URL.revokeObjectURL;
  const downloads = [];
  const blobs = [];
  const revoked = [];

  globalThis.window = { };
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
    return 'blob:workspace';
  };
  URL.revokeObjectURL = url => revoked.push(url);

  return Promise.resolve(run({ downloads, blobs, revoked })).finally(() => {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
    if (previousCreate === undefined) delete URL.createObjectURL;
    else URL.createObjectURL = previousCreate;
    if (previousRevoke === undefined) delete URL.revokeObjectURL;
    else URL.revokeObjectURL = previousRevoke;
  });
}

// The Electron bridge is fully stubbed below. These are virtual keys used to
// assert path handling; no test touches the machine's real filesystem.
function createDesktop(overrides = {}) {
  const calls = {
    reads: [],
    writes: [],
    setLast: [],
    saveOptions: null,
    openOptions: null,
  };
  const files = overrides.files || {};
  const last = overrides.last || null;

  const api = {
    async chooseSavePath(options) {
      calls.saveOptions = options;
      return overrides.saveChoice || {
        canceled: false,
        filePath: 'virtual/saved.json',
        name: 'saved.json',
      };
    },
    async chooseOpenPath(options) {
      calls.openOptions = options;
      return overrides.openChoice || {
        canceled: false,
        filePath: 'virtual/opened.json',
        name: 'opened.json',
      };
    },
    async readFile(options) {
      calls.reads.push(options.filePath);
      if (!(options.filePath in files)) throw new Error('Missing test workspace');
      return files[options.filePath];
    },
    async writeFile(options) {
      calls.writes.push({
        filePath: options.filePath,
        text: new TextDecoder().decode(options.data),
      });
      return { saved: true };
    },
    async getLastWorkspace() {
      return last ? { ...last } : null;
    },
    async setLastWorkspace(options) {
      calls.setLast.push(options.filePath);
      return { filePath: options.filePath };
    },
  };

  return { api, calls };
}

function createController(api) {
  globalThis.window = { zeeoneDesktop: api };
  const messages = [];
  const statuses = [];
  const state = {
    imported: null,
    importWorkspace(data) {
      this.imported = data;
      return true;
    },
    getExportData() {
      return { marker: 'saved' };
    },
  };
  const controller = new WorkspaceFileController({
    state,
    toast: { show: message => messages.push(message) },
    onStatus: status => statuses.push(status),
  });
  return { controller, state, messages, statuses };
}

test('save downloads a workspace file when no picker API is available', async () => {
  await withDownload(async ({ downloads, blobs }) => {
    const messages = [];
    const statuses = [];
    const state = {
      getExportData() {
        return { marker: 'saved' };
      },
    };
    const controller = new WorkspaceFileController({
      state,
      toast: { show: message => messages.push(message) },
      onStatus: status => statuses.push(status),
    });

    assert.equal(await controller.save(), true);
    assert.equal(downloads.length, 1);
    assert.equal(downloads[0].name, 'zeeone_drum_workspace.json');
    assert.equal(downloads[0].href, 'blob:workspace');
    assert.equal(blobs.length, 1);
    assert.equal(blobs[0].type, 'application/json');
    assert.deepEqual(messages, [
      'Workspace downloaded: zeeone_drum_workspace.json (open it to enable auto-save)',
    ]);
    assert.equal(controller.handle, null);
    assert.deepEqual(JSON.parse(await blobs[0].text()), { marker: 'saved' });
  });
});

test('Electron Open Last restores the native path remembered by the main process', async () => {
  const filePath = 'virtual/last.json';
  const { api, calls } = createDesktop({
    last: { filePath, name: 'last.json' },
    files: { [filePath]: JSON.stringify({ bpm: 123 }) },
  });
  const { controller, state, messages, statuses } = createController(api);

  assert.deepEqual(await controller.getLastInfo(), { name: 'last.json' });
  assert.equal(await controller.openLast(), true);
  assert.equal(state.imported.bpm, 123);
  assert.deepEqual(calls.reads, [filePath]);
  assert.deepEqual(calls.setLast, [filePath]);
  assert.deepEqual(messages, ['Workspace loaded: last.json']);
  assert.equal(statuses.at(-1), 'Saved: last.json');

  delete globalThis.window;
});

test('Electron Save remembers the chosen path and auto-save reuses it', async () => {
  const filePath = 'virtual/saved.json';
  const { api, calls } = createDesktop();
  const { controller, messages } = createController(api);

  assert.equal(await controller.save(), true);
  assert.equal(calls.saveOptions.suggestedName, 'zeeone_drum_workspace.json');
  assert.equal(calls.writes.length, 1);
  assert.equal(calls.writes[0].filePath, filePath);
  assert.match(calls.writes[0].text, /"marker": "saved"/);
  assert.deepEqual(calls.setLast, [filePath]);
  assert.deepEqual(messages, [`Workspace saved: saved.json`]);

  await controller.flush();
  assert.equal(calls.writes.length, 2);
  assert.equal(calls.writes[1].filePath, filePath);
  assert.equal(calls.setLast.length, 1);

  delete globalThis.window;
});

test('Electron Open uses the native picker and keeps the selected file writable', async () => {
  const filePath = 'virtual/opened.json';
  const { api, calls } = createDesktop({
    files: { [filePath]: JSON.stringify({ name: 'opened' }) },
  });
  const { controller, state } = createController(api);

  assert.equal(await controller.open(), true);
  assert.equal(calls.openOptions.title, 'Open workspace');
  assert.equal(state.imported.name, 'opened');
  assert.deepEqual(calls.setLast, [filePath]);

  await controller.flush();
  assert.equal(calls.writes[0].filePath, filePath);

  delete globalThis.window;
});
