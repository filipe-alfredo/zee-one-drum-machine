import assert from 'node:assert/strict';
import test from 'node:test';
import { WorkspaceFileController } from '../src/state/workspace-file.js';

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
        filePath: 'C:\\projects\\saved.json',
        name: 'saved.json',
      };
    },
    async chooseOpenPath(options) {
      calls.openOptions = options;
      return overrides.openChoice || {
        canceled: false,
        filePath: 'C:\\projects\\opened.json',
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

test('Electron Open Last restores the native path remembered by the main process', async () => {
  const filePath = 'C:\\projects\\last.json';
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
  const filePath = 'C:\\projects\\saved.json';
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
  const filePath = 'C:\\projects\\opened.json';
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
