import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Electron main process starts hidden, maximized and without a native menu', async () => {
  const source = await readFile(new URL('../electron/main.cjs', import.meta.url), 'utf8');

  assert.match(source, /Menu\.setApplicationMenu\(null\)/);
  assert.match(source, /show:\s*false/);

  const readyToShow = source.indexOf("mainWindow.once('ready-to-show'");
  const maximize = source.indexOf('mainWindow.maximize()');
  const show = source.indexOf('mainWindow.show()');
  assert.ok(readyToShow >= 0, 'ready-to-show handler is missing');
  assert.ok(maximize > readyToShow, 'the window must be maximized before it is shown');
  assert.ok(show > maximize, 'show() must follow maximize()');
});

test('Electron uses the ZeeOne icon and a persistent native workspace bridge', async () => {
  const source = await readFile(new URL('../electron/main.cjs', import.meta.url), 'utf8');
  const preload = await readFile(new URL('../electron/preload.cjs', import.meta.url), 'utf8');
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  const icon = await readFile(new URL('../assets/icons/app-icon.ico', import.meta.url));

  assert.match(source, /icon:\s*appIconPath\(\)/);
  assert.match(source, /path\.join\(process\.resourcesPath, 'app-icon\.ico'\)/);
  assert.match(source, /ipcMain\.handle\('zeeone:choose-open-path'/);
  assert.match(source, /ipcMain\.handle\('zeeone:read-file'/);
  assert.match(source, /ipcMain\.handle\('zeeone:get-last-workspace'/);
  assert.match(source, /ipcMain\.handle\('zeeone:set-last-workspace'/);
  assert.match(source, /lastWorkspaceFile\(\)/);

  for (const method of [
    'chooseSavePath', 'chooseOpenPath', 'readFile', 'writeFile',
    'getLastWorkspace', 'setLastWorkspace',
  ]) {
    assert.match(preload, new RegExp(`${method}:`));
  }

  assert.equal(packageJson.build.win.icon, 'assets/icons/app-icon.ico');
  assert.ok(packageJson.build.extraResources.some(resource => resource.to === 'app-icon.ico'));
  assert.equal(icon.readUInt16LE(0), 0);
  assert.equal(icon.readUInt16LE(2), 1);
  assert.ok(icon.readUInt16LE(4) >= 7, 'the icon should contain multiple sizes');
});
