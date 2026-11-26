import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AppState,
  createDefaultKits,
  createDefaultWorkspace,
  normalizeWorkspace,
} from '../src/state/app-state.js';
import { INSTRUMENTS } from '../src/kits/instruments.js';
import { createDefaultArrangement } from '../src/sequencer/arrangement.js';

test('default workspace matches the shipped application', () => {
  const workspace = createDefaultWorkspace();
  assert.equal(workspace.patterns.length, 24);
  assert.equal(workspace.groups.length, 2);
  assert.equal(workspace.activePatternId, 'pat_rock_1');
  assert.equal(Object.keys(workspace.visibleTracks).length, INSTRUMENTS.length);
  assert.equal(workspace.patterns[0].name, 'Reggae Rockers');
  assert.equal(workspace.patterns.find(pattern => pattern.id === 'pat_rock_1').bpm, 100);
  assert.deepEqual(workspace.kits, createDefaultKits());
});

test('BPM is clamped to the existing 40–240 range', () => {
  const state = new AppState();
  assert.equal(state.setBpm(10), 40);
  assert.equal(state.setBpm(999), 240);
  assert.equal(state.setBpm('not a number'), 100);
  assert.equal(state.activePattern.bpm, 100);
});

test('changing time signature resizes the active grid', () => {
  const state = new AppState();
  state.selectPattern('pat_rock_1');
  const result = state.setTimeSignature('3/4');
  assert.deepEqual(result, { timeSignature: '3/4', totalSteps: 12 });
  assert.equal(state.totalSteps, 12);
  assert.equal(state.activePattern.grid.kick.length, 12);
  assert.equal(state.activePattern.grid.kick[8], true);
});

test('fixed time signatures resize the grid and invalid values fall back to 4/4', () => {
  const state = new AppState();
  state.selectPattern('pat_rock_1');
  assert.deepEqual(state.setTimeSignature('6/4'), { timeSignature: '6/4', totalSteps: 24 });
  assert.equal(state.activePattern.grid.kick.length, 24);
  assert.equal(state.activePattern.grid.kick[8], true);

  assert.deepEqual(state.setTimeSignature('2/4'), { timeSignature: '2/4', totalSteps: 8 });
  assert.equal(state.totalSteps, 8);
  assert.equal(state.activePattern.grid.kick.length, 8);

  assert.deepEqual(state.setTimeSignature('12/4'), { timeSignature: '12/4', totalSteps: 48 });
  assert.equal(state.totalSteps, 48);
  assert.equal(state.activePattern.grid.kick.length, 48);

  assert.deepEqual(state.setTimeSignature('7/8'), { timeSignature: '4/4', totalSteps: 16 });
  assert.equal(state.activePattern.timeSignature, '4/4');
  assert.equal(state.activePattern.grid.kick.length, 16);
});

test('pattern CRUD keeps the active pattern valid', () => {
  const state = new AppState();
  const group = state.addGroup('Ideas');
  const created = state.addPattern({ name: 'New Beat', groupId: group.id, bpm: 128 });
  assert.equal(created.bpm, 128);
  assert.equal(state.getGroup(group.id).collapsed, false);

  state.updatePattern(created.id, { name: 'Renamed', groupId: 'grp_default' });
  assert.equal(state.getPattern(created.id).name, 'Renamed');
  assert.equal(state.getPattern(created.id).groupId, 'grp_default');

  const copy = state.duplicatePattern(created.id);
  assert.equal(copy.name, 'Renamed (Copy)');
  assert.notEqual(copy.id, created.id);
  copy.grid.kick[0] = !copy.grid.kick[0];
  assert.notDeepEqual(copy.grid.kick, state.getPattern(created.id).grid.kick);

  state.selectPattern(created.id);
  assert.equal(state.deletePattern(created.id).id, created.id);
  assert.notEqual(state.workspace.activePatternId, created.id);

  const last = state.workspace.patterns[0];
  state.workspace.patterns = [last];
  assert.equal(state.deletePattern(last.id), null);
});

test('visibility presets, mutes, solos, and volumes update independently', () => {
  const state = new AppState();
  state.applyVisibilityPreset(['kick', 'snare']);
  assert.equal(state.workspace.visibleTracks.kick, true);
  assert.equal(state.workspace.visibleTracks.snare, true);
  assert.equal(state.workspace.visibleTracks.close_hat, false);
  assert.equal(state.visibleInstruments.length, 2);

  const previous = { ...state.workspace.visibleTracks };
  state.applyVisibilityPreset([]);
  assert.equal(state.visibleInstruments.length, 0);
  state.replaceVisibility(previous);
  assert.equal(state.visibleInstruments.length, 2);

  assert.equal(state.toggleMute('kick'), true);
  assert.equal(state.toggleSolo('snare'), true);
  assert.equal(state.setTrackVolume('kick', 0.5), 0.5);
  assert.equal(state.setStep('snare', 4, true), true);
  assert.equal(state.activePattern.grid.snare[4], true);
});

test('invalid workspaces are rejected and valid ones normalized', () => {
  assert.equal(normalizeWorkspace(null), null);
  assert.equal(normalizeWorkspace({ groups: [], patterns: [] }), null);

  const normalized = normalizeWorkspace({
    groups: [{ id: 'g1', name: 'Custom' }],
    patterns: [{
      id: 'p1',
      groupId: 'missing',
      name: 'One',
      bpm: 9999,
      timeSignature: '9/9',
      grid: { kick: [true] },
    }],
    activePatternId: 'missing',
    trackVolumes: { kick: 999 },
  });
  assert.ok(normalized);
  assert.equal(normalized.groups[0].id, 'g1');
  assert.equal(normalized.patterns[0].groupId, 'g1');
  assert.equal(normalized.patterns[0].bpm, 240);
  assert.equal(normalized.patterns[0].timeSignature, '4/4');
  assert.equal(normalized.patterns[0].grid.kick.length, 16);
  assert.equal(normalized.activePatternId, 'p1');
  assert.equal(normalized.trackVolumes.kick, 1);
});

test('workspace normalization keeps valid samples and drops invalid kit data', () => {
  const data = createDefaultWorkspace();
  data.kits = {
    version: 1,
    samples: [
      {
        id: 'smp_1',
        instrumentId: 'snare',
        label: 'snare 1',
        fileName: 'snare 1.wav',
        path: '../../unsafe/snare.wav',
        kitId: 'vortex',
        kitName: 'Vortex',
        mimeType: 'audio/wav',
        data: 'data:audio/wav;base64,AAAA',
      },
      { id: 'smp_2', instrumentId: 'not_a_track', data: 'not-a-data-url' },
      { data: 'data:audio/mpeg;base64,AAAA' },
    ],
    active: { snare: 'smp_1', kick: 'smp_missing', not_a_track: 'smp_1' },
  };

  const normalized = normalizeWorkspace(data);
  assert.equal(normalized.kits.samples.length, 2);
  assert.equal(normalized.kits.samples[0].path, 'unsafe/snare.wav');
  assert.equal(normalized.kits.samples[0].instrumentId, 'snare');
  assert.equal(normalized.kits.samples[1].instrumentId, '');
  assert.equal(normalized.kits.samples[1].mimeType, 'application/octet-stream');
  assert.deepEqual(normalized.kits.active, {});
  // Legacy workspaces keep a synth row for instruments without samples.
  assert.equal(normalized.kits.synthTracks.includes('snare'), false);
  assert.equal(normalized.kits.synthTracks.includes('kick'), true);

  assert.deepEqual(normalizeWorkspace({ ...createDefaultWorkspace(), kits: 'broken' }).kits, createDefaultKits());
});

test('import replaces the kit, clears the active pattern, and suffixes duplicate names', () => {
  const state = new AppState();
  state.setStep('kick', 0, true);
  assert.equal(state.activePattern.grid.kick[0], true);

  const base = {
    data: 'data:audio/wav;base64,AAAA',
    mimeType: 'audio/wav',
    fileName: 'snare.wav',
    path: 'kits/vortex/snare.wav',
    kitId: 'vortex',
    kitName: 'Vortex',
  };

  const result = state.replaceKitSamples([
    { ...base, id: 'smp_one', instrumentId: 'snare', label: 'snare 1' },
    { ...base, id: 'smp_two', instrumentId: 'snare', label: 'snare 1' },
  ]);

  assert.equal(result.samples.length, 2);
  assert.deepEqual(result.samples.map(sample => sample.label), ['snare 1', 'snare 1 (2)']);
  assert.equal(state.workspace.kits.samples.length, 2);
  assert.equal(state.workspace.kits.synthTracks.length, 0);
  assert.deepEqual(state.tracks.map(track => track.patternKey), ['snare', 'smp_two']);
  assert.equal(state.tracks[0].name, 'snare 1');
  assert.equal(state.tracks[1].name, 'snare 1 (2)');

  assert.equal(state.activePattern.grid.kick, undefined);
  assert.equal(state.activePattern.grid.snare[0], false);
  assert.equal(state.activePattern.grid.smp_two.every(value => value === false), true);

  assert.equal(state.setTrackSample('smp_two', {
    ...base,
    fileName: 'replacement.wav',
    data: 'data:audio/mpeg;base64,BBBB',
  }), true);
  assert.equal(state.workspace.kits.samples.find(sample => sample.id === 'smp_two').fileName, 'replacement.wav');

  state.clearKitSamples();
  assert.deepEqual(state.workspace.kits, createDefaultKits());
  assert.equal(state.tracks.length, INSTRUMENTS.length);
});

test('kit snapshots restore samples, synth rows and mixer maps for Undo', () => {
  const state = new AppState();
  const data = 'data:audio/wav;base64,AAAA';
  state.replaceKitSamples([
    { id: 'smp_kick', instrumentId: 'kick', label: 'kick 1', data },
    { id: 'smp_mystery', instrumentId: '', label: 'mystery', data },
  ]);
  state.setTrackVolume('smp_kick', 0.4);
  state.setTrackVisible('smp_mystery', false);
  const snapshot = state.captureKitsState();

  assert.equal(state.removeTrackSample('smp_kick'), true);
  assert.equal(state.removeTrackSample('smp_mystery'), true);
  assert.deepEqual(state.trackIds, ['kick']);
  assert.deepEqual(state.workspace.kits.samples, []);

  assert.equal(state.restoreKitsState(snapshot), true);
  assert.deepEqual(state.trackIds, ['smp_kick', 'smp_mystery']);
  assert.equal(state.getTrackVolume('smp_kick'), 0.4);
  assert.equal(state.workspace.visibleTracks.smp_mystery, false);
  assert.equal(state.workspace.kits.samples[0].data, data);

  state.clearKitSamples();
  state.restoreKitsState(snapshot);
  assert.equal(state.tracks.length, 2);
});

test('selecting a factory pattern restores only the missing synth tracks', () => {
  const state = new AppState();
  state.replaceKitSamples([{
    id: 'smp_snare',
    instrumentId: 'snare',
    label: 'snare 1',
    data: 'data:audio/wav;base64,AAAA',
    mimeType: 'audio/wav',
  }]);
  assert.equal(state.tracks.length, 1);

  state.selectPattern('pat_rock_2');
  const names = state.tracks.map(track => track.name);
  assert.deepEqual(names, ['snare 1', 'Kick', 'Close Hat']);
  assert.deepEqual(state.workspace.kits.synthTracks, ['kick', 'close_hat']);
  assert.equal(state.workspace.visibleTracks.kick, true);
  assert.equal(state.activePattern.grid.kick[0], true);
  assert.equal(state.activePattern.grid.snare[4], true);
});

test('master and per-track volumes are stored, clamped, and normalized', () => {
  const state = new AppState();
  assert.equal(state.getGlobalVolume(), 0.85);
  assert.equal(state.getTrackVolume('kick'), 1);
  assert.equal(state.setGlobalVolume('0.5'), 0.5);
  assert.equal(state.setTrackVolume('kick', 0.25), 0.25);
  assert.equal(state.setTrackVolume('snare', 12), 1);
  assert.equal(state.setTrackVolume('missing', 0.5), null);

  const data = createDefaultWorkspace();
  data.globalVolume = -4;
  data.trackVolumes = { kick: 0.4, snare: 'not-a-number' };
  data.visibleTracks = { kick: false };
  const normalized = normalizeWorkspace(data);
  assert.equal(normalized.globalVolume, 0);
  assert.equal(normalized.trackVolumes.kick, 0.4);
  assert.equal(normalized.trackVolumes.snare, 1);
  assert.equal(normalized.visibleTracks.kick, false);
});

test('importing a kit resets track volumes but keeps the master volume', () => {
  const state = new AppState();
  state.setTrackVolume('kick', 0.2);
  state.setGlobalVolume(0.6);

  state.replaceKitSamples([{
    id: 'smp_one',
    instrumentId: 'kick',
    label: 'kick sample',
    data: 'data:audio/wav;base64,AAAA',
  }]);

  assert.equal(state.getTrackVolume('smp_one'), 1);
  assert.equal(state.getGlobalVolume(), 0.6);
});

test('selecting a pattern reports hidden tracks without changing visibility', () => {
  const state = new AppState();
  state.applyVisibilityPreset(['snare']);
  const pattern = state.getPattern('pat_rock_1');

  const hidden = state.getHiddenTracksForPattern(pattern);
  assert.ok(hidden.some(track => track.id === 'kick'));
  assert.equal(hidden.some(track => track.id === 'snare'), false);

  state.selectPattern('pat_rock_1');
  assert.equal(state.workspace.visibleTracks.kick, false);
  assert.equal(state.setTracksVisible(hidden.map(track => track.id), true), true);
  assert.equal(state.workspace.visibleTracks.kick, true);
  assert.equal(state.getHiddenTracksForPattern(pattern).length, 0);
});

test('persist notifies the file controller without touching browser storage', () => {
  let notifications = 0;
  const state = new AppState({ onPersist: () => { notifications += 1; } });
  state.setBpm(175);
  state.toggleMute('snare');
  assert.equal(notifications, 2);
  assert.equal(state.persist(), true);
  assert.equal(notifications, 3);
  assert.equal(state.activePattern.bpm, 175);
});

test('a new AppState always starts from the factory workspace', () => {
  const first = new AppState();
  first.setBpm(175);
  first.setStep('kick', 15, true);

  const second = new AppState();
  assert.equal(second.activePattern.bpm, 100);
  assert.equal(second.activePattern.grid.kick[15], false);
});

test('the arrangement is exported with the workspace and survives normalization', () => {
  const state = new AppState();
  assert.deepEqual(state.arrangement, createDefaultArrangement());

  state.setLoopEnabled(true);
  assert.equal(state.setArrangementBpm(150), 150);
  assert.equal(state.setLoopBars(4), 4);
  const block = state.addArrangementBlock({
    laneId: state.arrangement.lanes[0].id,
    patternId: 'pat_rock_1',
    startBar: 2,
    lengthBars: 2,
  });
  assert.ok(block);

  const saved = JSON.parse(JSON.stringify(state.getExportData()));
  assert.equal(saved.arrangement.enabled, true);
  assert.equal(saved.arrangement.bpm, 150);
  assert.equal(saved.arrangement.loopBars, 4);
  assert.equal(saved.arrangement.lanes[0].blocks.length, 1);

  const normalized = normalizeWorkspace(saved);
  assert.deepEqual(normalized.arrangement, saved.arrangement);
});

test('arrangement CRUD notifies persistence and unlinks deleted patterns', () => {
  let notifications = 0;
  const state = new AppState({ onPersist: () => { notifications += 1; } });
  const lane = state.arrangement.lanes[0];

  const block = state.addArrangementBlock({
    laneId: lane.id,
    patternId: 'pat_rock_1',
    startBar: 0,
    lengthBars: 2,
  });
  assert.ok(block);
  assert.equal(notifications, 1);
  assert.equal(state.addArrangementBlock({
    laneId: lane.id,
    patternId: 'pat_rock_2',
    startBar: 1,
    lengthBars: 1,
  }), null);
  assert.equal(notifications, 1);

  assert.equal(state.moveArrangementBlock(block.id, lane.id, 4), true);
  assert.equal(state.getPattern('pat_rock_2') && state.getPattern('pat_rock_2').id, 'pat_rock_2');
  assert.equal(state.deletePattern('pat_rock_2').id, 'pat_rock_2');
  assert.equal(state.arrangement.lanes[0].blocks.some(item => item.id === block.id), true);

  const lastPattern = state.workspace.patterns[state.workspace.patterns.length - 1];
  const linkedBlock = state.addArrangementBlock({
    laneId: state.arrangement.lanes[1].id,
    patternId: lastPattern.id,
    startBar: 5,
    lengthBars: 1,
  });
  assert.ok(linkedBlock);
  assert.equal(state.deletePattern(lastPattern.id).id, lastPattern.id);
  assert.equal(state.arrangement.lanes[1].blocks.some(item => item.id === linkedBlock.id), false);

  const addedLane = state.addArrangementLane();
  assert.equal(state.removeArrangementLane(addedLane.id), true);
  assert.equal(state.clearArrangementBlocks(), true);
  assert.equal(state.arrangement.lanes[0].blocks.length, 0);
  assert.ok(notifications > 5);
});
