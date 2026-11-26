import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultWorkspace } from '../src/state/app-state.js';
import {
  getChannelVolume,
  getGlobalVolume,
  isChannelAudible,
} from '../src/sequencer/mixer.js';

test('without solos, mute controls audibility', () => {
  const workspace = createDefaultWorkspace();
  assert.equal(isChannelAudible(workspace, 'kick'), true);
  workspace.muted.kick = true;
  assert.equal(isChannelAudible(workspace, 'kick'), false);
  assert.equal(isChannelAudible(workspace, 'snare'), true);
});

test('solo takes precedence over mute', () => {
  const workspace = createDefaultWorkspace();
  workspace.muted.kick = true;
  workspace.solo.snare = true;
  assert.equal(isChannelAudible(workspace, 'snare'), true);
  assert.equal(isChannelAudible(workspace, 'kick'), false);
  assert.equal(isChannelAudible(workspace, 'close_hat'), false);

  workspace.solo.kick = true;
  assert.equal(isChannelAudible(workspace, 'kick'), true);
});

test('hidden tracks are silent even when soloed', () => {
  const workspace = createDefaultWorkspace();
  workspace.visibleTracks.kick = false;
  assert.equal(isChannelAudible(workspace, 'kick'), false);
  assert.equal(isChannelAudible(workspace, 'snare'), true);

  workspace.solo.kick = true;
  assert.equal(isChannelAudible(workspace, 'kick'), false);
  assert.equal(isChannelAudible(workspace, 'snare'), false);

  workspace.visibleTracks.kick = true;
  assert.equal(isChannelAudible(workspace, 'kick'), true);
});

test('channel and global volumes are clamped with sane defaults', () => {
  const workspace = createDefaultWorkspace();
  assert.equal(getChannelVolume(workspace, 'kick'), 1);
  assert.equal(getGlobalVolume(workspace), 0.85);

  workspace.trackVolumes.kick = 0.25;
  workspace.trackVolumes.snare = 9;
  workspace.globalVolume = -2;
  assert.equal(getChannelVolume(workspace, 'kick'), 0.25);
  assert.equal(getChannelVolume(workspace, 'snare'), 1);
  assert.equal(getGlobalVolume(workspace), 0);
  assert.equal(getChannelVolume({}, 'kick'), 1);
  assert.equal(getGlobalVolume(null), 0.85);
});
