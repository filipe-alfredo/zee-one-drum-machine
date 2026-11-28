import {
  ALL_INSTRUMENT_IDS,
  INSTRUMENTS,
  INSTRUMENT_BY_ID,
} from '../kits/instruments.js';
import { mimeTypeForFileName, sanitizeRelativePath } from '../kits/sample-data.js';
import {
  addArrangementRow,
  clearArrangementBlocks,
  clearArrangementRows,
  createDefaultArrangement,
  normalizeArrangement,
  removeArrangementRow,
  removePatternFromArrangement,
  setArrangementRowBpm,
  toggleArrangementBlock,
} from '../sequencer/arrangement.js';
import { FACTORY_PATTERNS } from '../sequencer/factory-patterns.js';
import {
  buildEmptyGrid,
  buildGridFromHits,
  cloneGrid,
  getStepCountForSig,
  isValidTimeSignature,
  normalizeGrid,
  resizeGrid,
} from '../sequencer/pattern.js';
import { clampBpm, clampVolume, createId } from '../utils/helpers.js';

const KITS_VERSION = 2;
const DEFAULT_TRACK_VOLUME = 1;
const DEFAULT_GLOBAL_VOLUME = 0.85;

export function createDefaultKits() {
  return {
    version: KITS_VERSION,
    samples: [],
    synthTracks: ALL_INSTRUMENT_IDS.slice(),
    active: {},
    trackOrder: ALL_INSTRUMENT_IDS.slice(),
  };
}

/** Plain-data copy of the kit and its mixer maps, safe to keep for Undo. */
function cloneKitsState(workspace) {
  const kits = workspace.kits || createDefaultKits();
  return {
    kits: {
      version: kits.version,
      samples: (Array.isArray(kits.samples) ? kits.samples : []).map(sample => ({ ...sample })),
      synthTracks: Array.isArray(kits.synthTracks) ? kits.synthTracks.slice() : [],
      active: { ...(kits.active || {}) },
      trackOrder: Array.isArray(kits.trackOrder) ? kits.trackOrder.slice() : [],
    },
    visibleTracks: { ...(workspace.visibleTracks || {}) },
    trackVolumes: { ...(workspace.trackVolumes || {}) },
    muted: { ...(workspace.muted || {}) },
    solo: { ...(workspace.solo || {}) },
  };
}

function uniqueLabels(samples) {
  const used = new Map();
  return samples.map(sample => {
    const base = String(sample.label || sample.fileName || 'Sample').slice(0, 160) || 'Sample';
    const key = base.toLocaleLowerCase();
    const count = used.get(key) || 0;
    used.set(key, count + 1);
    if (count === 0) return { ...sample, label: base };
    const suffix = ` (${count + 1})`;
    return { ...sample, label: `${base.slice(0, 160 - suffix.length)}${suffix}` };
  });
}

function normalizeSample(raw, seenIds, fallbackId = '') {
  if (!raw || typeof raw !== 'object' || typeof raw.data !== 'string' || !raw.data.startsWith('data:')) {
    return null;
  }

  let id = typeof raw.id === 'string' && raw.id ? raw.id : fallbackId || createId('smp');
  if (seenIds.has(id)) id = createId('smp');
  seenIds.add(id);

  const fileName = typeof raw.fileName === 'string' ? raw.fileName.slice(0, 160) : '';
  return {
    id,
    instrumentId: INSTRUMENT_BY_ID.has(raw.instrumentId) ? raw.instrumentId : '',
    label: typeof raw.label === 'string' ? raw.label.slice(0, 160) : fileName || 'Sample',
    fileName,
    path: sanitizeRelativePath(raw.path, `samples/${id}.wav`),
    kitId: typeof raw.kitId === 'string' ? raw.kitId.slice(0, 80) : 'imported',
    kitName: typeof raw.kitName === 'string' ? raw.kitName.slice(0, 120) : 'Imported Kit',
    mimeType: typeof raw.mimeType === 'string' && raw.mimeType.startsWith('audio/')
      ? raw.mimeType
      : mimeTypeForFileName(fileName),
    data: raw.data,
  };
}

function normalizeKits(raw) {
  const kits = createDefaultKits();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return kits;

  const seenIds = new Set();
  const samples = [];
  for (const sample of Array.isArray(raw.samples) ? raw.samples : []) {
    const normalized = normalizeSample(sample, seenIds);
    if (normalized) samples.push(normalized);
  }
  kits.samples = uniqueLabels(samples);

  const sampleInstruments = new Set(kits.samples.map(sample => sample.instrumentId).filter(Boolean));
  const rawVersion = Number(raw.version) || 1;
  if (rawVersion >= KITS_VERSION && Array.isArray(raw.synthTracks)) {
    kits.synthTracks = [...new Set(
      raw.synthTracks
        .map(id => String(id))
        .filter(id => INSTRUMENT_BY_ID.has(id) && !sampleInstruments.has(id)),
    )];
  } else {
    // Legacy workspaces did not have dynamic tracks: keep one row per fixed
    // instrument that is not already represented by an imported sample.
    kits.synthTracks = ALL_INSTRUMENT_IDS.filter(id => !sampleInstruments.has(id));
  }

  const validOrderIds = new Set([
    ...kits.samples.map(sample => sample.id),
    ...kits.synthTracks,
  ]);
  const seenOrderIds = new Set();
  kits.trackOrder = [];
  for (const rawId of Array.isArray(raw.trackOrder) ? raw.trackOrder : []) {
    const id = String(rawId);
    if (validOrderIds.has(id) && !seenOrderIds.has(id)) {
      kits.trackOrder.push(id);
      seenOrderIds.add(id);
    }
  }
  for (const sample of kits.samples) {
    if (!seenOrderIds.has(sample.id)) {
      kits.trackOrder.push(sample.id);
      seenOrderIds.add(sample.id);
    }
  }
  for (const id of kits.synthTracks) {
    if (!seenOrderIds.has(id)) {
      kits.trackOrder.push(id);
      seenOrderIds.add(id);
    }
  }
  return kits;
}

/**
 * Track descriptors derive from the saved kit. A sample is its own track; a
 * label that resolves to a legacy instrument claims that instrument's pattern
 * row, so factory patterns can play on imported samples. Duplicate labels get
 * unique names and their own rows.
 */
export function tracksFromKits(kits) {
  const tracks = [];
  const claimed = new Set();

  for (const sample of kits && Array.isArray(kits.samples) ? kits.samples : []) {
    const legacyInstrumentId = sample.instrumentId && INSTRUMENT_BY_ID.has(sample.instrumentId)
      ? sample.instrumentId
      : '';
    const claimsPattern = legacyInstrumentId && !claimed.has(legacyInstrumentId);
    if (claimsPattern) claimed.add(legacyInstrumentId);
    tracks.push({
      id: sample.id,
      name: sample.label || sample.fileName || 'Sample',
      kind: 'sample',
      sampleId: sample.id,
      legacyInstrumentId,
      patternKey: claimsPattern ? legacyInstrumentId : sample.id,
    });
  }

  for (const instrumentId of kits && Array.isArray(kits.synthTracks) ? kits.synthTracks : []) {
    if (!INSTRUMENT_BY_ID.has(instrumentId) || claimed.has(instrumentId)) continue;
    tracks.push({
      id: instrumentId,
      name: INSTRUMENT_BY_ID.get(instrumentId).name,
      kind: 'synth',
      sampleId: null,
      legacyInstrumentId: instrumentId,
      patternKey: instrumentId,
    });
  }

  // Pattern keys are assigned above in canonical order (samples first), so
  // reordering rows never changes which factory hits a row plays.
  const order = kits && Array.isArray(kits.trackOrder) ? kits.trackOrder : [];
  if (order.length === 0) return tracks;
  const positions = new Map(order.map((id, index) => [id, index]));
  return tracks.slice().sort((a, b) => {
    const left = positions.has(a.id) ? positions.get(a.id) : Number.MAX_SAFE_INTEGER;
    const right = positions.has(b.id) ? positions.get(b.id) : Number.MAX_SAFE_INTEGER;
    return left - right;
  });
}

export function createDefaultWorkspace() {
  const groups = [
    { id: 'grp_default', name: 'Default', collapsed: false, hidden: false, isFactory: true },
    { id: 'grp_my_riffs', name: 'My Riffs & Ideas', collapsed: false, hidden: false, isFactory: false },
  ];

  const patterns = FACTORY_PATTERNS.map(factoryPattern => {
    const timeSignature = factoryPattern.timeSignature || '4/4';
    const totalSteps = getStepCountForSig(timeSignature);
    return {
      id: factoryPattern.id,
      groupId: 'grp_default',
      name: factoryPattern.name,
      bpm: factoryPattern.bpm,
      timeSignature,
      grid: buildGridFromHits(factoryPattern.hits, totalSteps),
    };
  });

  const workspace = {
    version: 1,
    app: 'ZeeOne Drum Machine',
    activePatternId: 'pat_rock_1',
    showHiddenGroups: false,
    globalVolume: DEFAULT_GLOBAL_VOLUME,
    visibleTracks: {},
    trackVolumes: {},
    muted: {},
    solo: {},
    groups,
    patterns,
    kits: createDefaultKits(),
    arrangement: createDefaultArrangement(),
  };

  for (const track of tracksFromKits(workspace.kits)) {
    workspace.visibleTracks[track.id] = true;
    workspace.trackVolumes[track.id] = DEFAULT_TRACK_VOLUME;
    workspace.muted[track.id] = false;
    workspace.solo[track.id] = false;
  }

  return workspace;
}

/**
 * Validate and complete a workspace loaded from a JSON file.
 * Returns null when the input cannot be used safely.
 */
export function normalizeWorkspace(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  if (!Array.isArray(data.groups) || !Array.isArray(data.patterns) || data.patterns.length === 0) {
    return null;
  }

  const fallback = createDefaultWorkspace();
  const usedGroupIds = new Set();
  let groups = [];

  for (const rawGroup of data.groups) {
    if (!rawGroup || typeof rawGroup !== 'object') continue;
    let id = String(rawGroup.id || createId('grp'));
    while (usedGroupIds.has(id)) id = createId('grp');
    usedGroupIds.add(id);
    groups.push({
      id,
      name: String(rawGroup.name || 'Group'),
      collapsed: Boolean(rawGroup.collapsed),
      hidden: Boolean(rawGroup.hidden),
      isFactory: Boolean(rawGroup.isFactory),
    });
  }

  if (groups.length === 0) {
    groups = fallback.groups;
    usedGroupIds.clear();
    for (const group of groups) usedGroupIds.add(group.id);
  }

  const validGroupIds = new Set(groups.map(group => group.id));
  const defaultGroupId = groups[0].id;
  const usedPatternIds = new Set();
  const patterns = [];

  for (const rawPattern of data.patterns) {
    if (!rawPattern || typeof rawPattern !== 'object') continue;

    let id = String(rawPattern.id || createId('pat'));
    while (usedPatternIds.has(id)) id = createId('pat');
    usedPatternIds.add(id);

    const timeSignature = isValidTimeSignature(rawPattern.timeSignature)
      ? rawPattern.timeSignature
      : '4/4';
    const totalSteps = getStepCountForSig(timeSignature);

    patterns.push({
      id,
      groupId: validGroupIds.has(rawPattern.groupId) ? rawPattern.groupId : defaultGroupId,
      name: String(rawPattern.name || 'Pattern'),
      bpm: clampBpm(rawPattern.bpm),
      timeSignature,
      grid: normalizeGrid(rawPattern.grid, totalSteps),
    });
  }

  if (patterns.length === 0) return null;

  const activePatternId = patterns.some(pattern => pattern.id === data.activePatternId)
    ? data.activePatternId
    : patterns[0].id;

  const kits = normalizeKits(data.kits);
  const visibleTracks = {};
  const trackVolumes = {};
  const muted = {};
  const solo = {};

  const readMixerValue = (mapName, track) => {
    const source = data[mapName];
    if (!source || typeof source !== 'object') return undefined;
    if (source[track.id] !== undefined) return source[track.id];
    const fallbackKey = track.legacyInstrumentId || track.patternKey;
    return source[fallbackKey];
  };

  for (const track of tracksFromKits(kits)) {
    const visible = readMixerValue('visibleTracks', track);
    visibleTracks[track.id] = visible === undefined ? true : Boolean(visible);
    trackVolumes[track.id] = clampVolume(readMixerValue('trackVolumes', track), DEFAULT_TRACK_VOLUME);
    muted[track.id] = Boolean(readMixerValue('muted', track));
    solo[track.id] = Boolean(readMixerValue('solo', track));
  }

  return {
    version: 1,
    app: 'ZeeOne Drum Machine',
    activePatternId,
    showHiddenGroups: Boolean(data.showHiddenGroups),
    globalVolume: clampVolume(data.globalVolume, DEFAULT_GLOBAL_VOLUME),
    visibleTracks,
    trackVolumes,
    muted,
    solo,
    groups,
    patterns,
    kits,
    arrangement: normalizeArrangement(data.arrangement, patterns),
  };
}

export class AppState {
  constructor({ onPersist } = {}) {
    this.workspace = createDefaultWorkspace();
    this.onPersist = onPersist;
  }

  get activePattern() {
    let pattern = this.workspace.patterns.find(item => item.id === this.workspace.activePatternId);
    if (!pattern && this.workspace.patterns.length > 0) {
      pattern = this.workspace.patterns[0];
      this.workspace.activePatternId = pattern.id;
    }
    return pattern || null;
  }

  get totalSteps() {
    const pattern = this.activePattern;
    return getStepCountForSig(pattern ? pattern.timeSignature : '4/4');
  }

  get arrangement() {
    if (!this.workspace.arrangement) this.workspace.arrangement = createDefaultArrangement();
    return this.workspace.arrangement;
  }

  get tracks() {
    return tracksFromKits(this.workspace.kits);
  }

  get trackIds() {
    return this.tracks.map(track => track.id);
  }

  get trackPatternKeys() {
    return [...new Set(this.tracks.map(track => track.patternKey))];
  }

  get visibleTracks() {
    const visibility = this.workspace.visibleTracks;
    return this.tracks.filter(track => visibility[track.id]);
  }

  // Kept as an alias for existing callers; entries are track descriptors.
  get visibleInstruments() {
    return this.visibleTracks;
  }

  getTrack(trackId) {
    return this.tracks.find(track => track.id === trackId) || null;
  }

  getGroup(groupId) {
    return this.workspace.groups.find(group => group.id === groupId) || null;
  }

  getPattern(patternId) {
    return this.workspace.patterns.find(pattern => pattern.id === patternId) || null;
  }

  isFactoryPattern(patternId) {
    return FACTORY_PATTERNS.some(pattern => pattern.id === patternId);
  }

  /**
   * Notify the workspace-file controller after a mutation. Persistence is
   * file-based: nothing is written here, and nothing is restored on startup.
   */
  persist() {
    if (typeof this.onPersist === 'function') this.onPersist();
    return true;
  }

  importWorkspace(data) {
    const normalized = normalizeWorkspace(data);
    if (!normalized) return false;
    this.workspace = normalized;
    this.persist();
    return true;
  }

  resetWorkspace() {
    this.workspace = createDefaultWorkspace();
    this.persist();
  }

  initTrackMaps(trackId) {
    if (this.workspace.visibleTracks[trackId] === undefined) this.workspace.visibleTracks[trackId] = true;
    if (this.workspace.trackVolumes[trackId] === undefined) {
      this.workspace.trackVolumes[trackId] = DEFAULT_TRACK_VOLUME;
    }
    if (this.workspace.muted[trackId] === undefined) this.workspace.muted[trackId] = false;
    if (this.workspace.solo[trackId] === undefined) this.workspace.solo[trackId] = false;
  }

  /**
   * Keep the saved row order in sync with the kit. Unknown ids are dropped and
   * newly added tracks are appended so every row has exactly one position.
   */
  ensureTrackOrder() {
    const kits = this.workspace.kits;
    const samples = Array.isArray(kits.samples) ? kits.samples : [];
    const synths = Array.isArray(kits.synthTracks) ? kits.synthTracks : [];
    const validIds = new Set([...samples.map(sample => sample.id), ...synths]);
    const seen = new Set();
    const order = [];
    for (const rawId of Array.isArray(kits.trackOrder) ? kits.trackOrder : []) {
      const id = String(rawId);
      if (validIds.has(id) && !seen.has(id)) {
        order.push(id);
        seen.add(id);
      }
    }
    for (const sample of samples) {
      if (!seen.has(sample.id)) {
        order.push(sample.id);
        seen.add(sample.id);
      }
    }
    for (const id of synths) {
      if (!seen.has(id)) {
        order.push(id);
        seen.add(id);
      }
    }
    kits.trackOrder = order;
    return order;
  }

  /** Move one grid row before or after another; the order is saved with the kit. */
  moveTrack(trackId, targetId, insertAfter = false) {
    const order = this.ensureTrackOrder();
    const sourceIndex = order.indexOf(trackId);
    if (sourceIndex < 0 || trackId === targetId || !order.includes(targetId)) return false;

    order.splice(sourceIndex, 1);
    const targetIndex = order.indexOf(targetId);
    if (targetIndex < 0) return false;
    order.splice(targetIndex + (insertAfter ? 1 : 0), 0, trackId);
    this.workspace.kits.trackOrder = order;
    this.persist();
    return true;
  }

  ensureMixerMaps() {
    this.ensureTrackOrder();
    const validIds = new Set(this.trackIds);
    const maps = [
      this.workspace.visibleTracks,
      this.workspace.trackVolumes,
      this.workspace.muted,
      this.workspace.solo,
    ];
    for (const map of maps) {
      for (const key of Object.keys(map)) {
        if (!validIds.has(key)) delete map[key];
      }
    }
    for (const trackId of validIds) this.initTrackMaps(trackId);
  }

  resetMixerMaps() {
    this.workspace.visibleTracks = {};
    this.workspace.trackVolumes = {};
    this.workspace.muted = {};
    this.workspace.solo = {};
    this.ensureMixerMaps();
  }

  ensurePatternRows(pattern) {
    if (!pattern) return false;
    const totalSteps = getStepCountForSig(pattern.timeSignature);
    let changed = false;
    for (const rowKey of this.trackPatternKeys) {
      if (!Array.isArray(pattern.grid[rowKey])) {
        pattern.grid[rowKey] = new Array(totalSteps).fill(false);
        changed = true;
      }
    }
    return changed;
  }

  /**
   * Rebuild the kit from imported ZIP files: one sample per grid row, no synth
   * rows, and no steps in the currently active pattern.
   */
  replaceKitSamples(samples) {
    const seenIds = new Set();
    const rawSamples = Array.isArray(samples) ? samples : [];
    const normalized = [];
    for (const sample of rawSamples) {
      const result = normalizeSample(sample, seenIds);
      if (result) normalized.push(result);
    }

    this.workspace.kits = {
      version: KITS_VERSION,
      samples: uniqueLabels(normalized),
      synthTracks: [],
      active: {},
    };
    this.resetMixerMaps();

    const pattern = this.activePattern;
    if (pattern) {
      pattern.grid = buildEmptyGrid(getStepCountForSig(pattern.timeSignature), this.trackPatternKeys);
    }
    this.persist();
    return { samples: this.workspace.kits.samples.slice(), tracks: this.tracks };
  }

  // Compatibility alias; the new import flow always replaces the whole kit.
  addKitSamples(samples) {
    return this.replaceKitSamples(samples);
  }

  /** Replace the sample on one existing track (manual Assign File). */
  setTrackSample(trackId, metadata) {
    const track = this.getTrack(trackId);
    if (!track || !metadata || typeof metadata.data !== 'string' || !metadata.data.startsWith('data:')) {
      return false;
    }

    const sample = normalizeSample(
      { ...metadata, id: trackId, instrumentId: track.legacyInstrumentId, label: track.name },
      new Set(),
      trackId,
    );
    const samples = this.workspace.kits.samples.slice();
    const index = samples.findIndex(item => item.id === trackId);
    if (index >= 0) samples[index] = sample;
    else samples.push(sample);
    this.workspace.kits.samples = samples;
    this.workspace.kits.synthTracks = this.workspace.kits.synthTracks.filter(id => id !== trackId);
    this.ensureMixerMaps();
    this.ensurePatternRows(this.activePattern);
    this.persist();
    return true;
  }

  /** Remove one sample and restore its built-in synth track when possible. */
  removeTrackSample(trackId) {
    const track = this.getTrack(trackId);
    if (!track || track.kind !== 'sample') return false;

    this.workspace.kits.samples = this.workspace.kits.samples.filter(sample => sample.id !== trackId);
    const restoredSynth = track.legacyInstrumentId
      && !this.workspace.kits.synthTracks.includes(track.legacyInstrumentId)
      ? track.legacyInstrumentId
      : null;
    if (restoredSynth) this.workspace.kits.synthTracks.push(restoredSynth);
    this.workspace.kits.trackOrder = (this.workspace.kits.trackOrder || [])
      .map(id => (id === trackId ? restoredSynth : id))
      .filter(Boolean);
    this.ensureMixerMaps();
    this.ensurePatternRows(this.activePattern);
    this.persist();
    return true;
  }

  clearKitSamples() {
    this.workspace.kits = createDefaultKits();
    this.resetMixerMaps();
    this.ensurePatternRows(this.activePattern);
    this.persist();
  }

  /** Snapshot used by removable-sample actions so Undo can restore everything. */
  captureKitsState() {
    return cloneKitsState(this.workspace);
  }

  restoreKitsState(snapshot) {
    if (!snapshot || !snapshot.kits) return false;
    const restored = cloneKitsState({ ...this.workspace, ...snapshot });
    this.workspace.kits = restored.kits;
    this.workspace.visibleTracks = restored.visibleTracks;
    this.workspace.trackVolumes = restored.trackVolumes;
    this.workspace.muted = restored.muted;
    this.workspace.solo = restored.solo;
    this.ensureMixerMaps();
    this.ensurePatternRows(this.activePattern);
    this.persist();
    return true;
  }

  /**
   * Factory patterns are stored by legacy instrument id. When one is selected
   * after importing a different kit, restore a synth row for every instrument
   * with notes that no imported sample covers. Visibility is never changed
   * here: hidden tracks stay hidden until the user decides otherwise.
   */
  syncPatternTracks(pattern) {
    if (!pattern) return false;
    let changed = this.ensurePatternRows(pattern);

    for (const instrumentId of ALL_INSTRUMENT_IDS) {
      const row = pattern.grid[instrumentId];
      if (!Array.isArray(row) || !row.some(Boolean)) continue;

      const coveringTrack = this.tracks.find(track => track.patternKey === instrumentId);
      if (coveringTrack) continue;

      if (!this.workspace.kits.synthTracks.includes(instrumentId)) {
        this.workspace.kits.synthTracks.push(instrumentId);
        this.initTrackMaps(instrumentId);
        changed = true;
      }
    }

    if (changed) {
      this.ensureTrackOrder();
      this.ensurePatternRows(pattern);
    }
    return changed;
  }

  /** Runtime tracks that are hidden but have notes in the given pattern. */
  getHiddenTracksForPattern(pattern) {
    if (!pattern) return [];
    return this.tracks.filter(track => {
      if (this.workspace.visibleTracks[track.id] !== false) return false;
      const row = pattern.grid[track.patternKey];
      return Array.isArray(row) && row.some(Boolean);
    });
  }

  setTracksVisible(trackIds, visible = true) {
    const validIds = new Set(this.trackIds);
    let changed = false;
    for (const trackId of Array.isArray(trackIds) ? trackIds : []) {
      if (!validIds.has(trackId)) continue;
      const nextValue = Boolean(visible);
      if (this.workspace.visibleTracks[trackId] === nextValue) continue;
      this.workspace.visibleTracks[trackId] = nextValue;
      changed = true;
    }
    if (changed) this.persist();
    return changed;
  }

  ensureTracksForPattern(patternId = null) {
    const pattern = patternId ? this.getPattern(patternId) : this.activePattern;
    if (!pattern) return false;
    const changed = this.syncPatternTracks(pattern);
    if (changed) this.persist();
    return changed;
  }

  selectPattern(patternId) {
    const pattern = this.getPattern(patternId);
    if (!pattern) return null;
    this.workspace.activePatternId = patternId;
    this.syncPatternTracks(pattern);
    this.persist();
    return pattern;
  }

  setBpm(value) {
    const bpm = clampBpm(value);
    const pattern = this.activePattern;
    if (pattern) pattern.bpm = bpm;
    this.persist();
    return bpm;
  }

  setTimeSignature(value) {
    const pattern = this.activePattern;
    if (!pattern) return null;

    const timeSignature = isValidTimeSignature(value) ? value : '4/4';
    const oldStepCount = getStepCountForSig(pattern.timeSignature);
    const newStepCount = getStepCountForSig(timeSignature);

    pattern.timeSignature = timeSignature;
    pattern.grid = resizeGrid(pattern.grid, oldStepCount, newStepCount);
    this.ensurePatternRows(pattern);
    this.persist();

    return { timeSignature, totalSteps: newStepCount };
  }

  setGlobalVolume(value) {
    const volume = clampVolume(value, DEFAULT_GLOBAL_VOLUME);
    this.workspace.globalVolume = volume;
    this.persist();
    return volume;
  }

  setTrackVolume(trackId, value) {
    if (!this.getTrack(trackId)) return null;
    const volume = clampVolume(value, DEFAULT_TRACK_VOLUME);
    this.initTrackMaps(trackId);
    this.workspace.trackVolumes[trackId] = volume;
    this.persist();
    return volume;
  }

  getGlobalVolume() {
    return clampVolume(this.workspace.globalVolume, DEFAULT_GLOBAL_VOLUME);
  }

  getTrackVolume(trackId) {
    return clampVolume(this.workspace.trackVolumes[trackId], DEFAULT_TRACK_VOLUME);
  }

  toggleMute(trackId) {
    this.workspace.muted[trackId] = !this.workspace.muted[trackId];
    this.persist();
    return this.workspace.muted[trackId];
  }

  toggleSolo(trackId) {
    this.workspace.solo[trackId] = !this.workspace.solo[trackId];
    this.persist();
    return this.workspace.solo[trackId];
  }

  setTrackVisible(trackId, visible) {
    this.workspace.visibleTracks[trackId] = Boolean(visible);
    this.persist();
  }

  applyVisibilityPreset(requestedIds) {
    const requested = new Set(Array.isArray(requestedIds) ? requestedIds : []);
    for (const track of this.tracks) {
      this.workspace.visibleTracks[track.id] =
        requested.has(track.id) || requested.has(track.legacyInstrumentId);
    }
    this.persist();
  }

  replaceVisibility(visibilityMap) {
    const source = visibilityMap || {};
    for (const track of this.tracks) {
      const fallbackKey = track.legacyInstrumentId || track.patternKey;
      const value = source[track.id] !== undefined ? source[track.id] : source[fallbackKey];
      this.workspace.visibleTracks[track.id] = Boolean(value);
    }
    this.persist();
  }

  setShowHiddenGroups(value) {
    this.workspace.showHiddenGroups = Boolean(value);
    this.persist();
  }

  toggleGroupCollapsed(groupId) {
    const group = this.getGroup(groupId);
    if (!group) return null;
    group.collapsed = !group.collapsed;
    this.persist();
    return group;
  }

  toggleGroupHidden(groupId) {
    const group = this.getGroup(groupId);
    if (!group) return null;
    group.hidden = !group.hidden;
    this.persist();
    return group;
  }

  addGroup(name) {
    const group = {
      id: createId('grp'),
      name,
      collapsed: false,
      hidden: false,
      isFactory: false,
    };
    this.workspace.groups.push(group);
    this.persist();
    return group;
  }

  renameGroup(groupId, name) {
    const group = this.getGroup(groupId);
    if (!group) return null;
    group.name = name;
    this.persist();
    return group;
  }

  deleteGroup(groupId) {
    const group = this.getGroup(groupId);
    if (!group) return null;

    let fallbackGroup = this.workspace.groups.find(item => item.id !== groupId);
    if (!fallbackGroup) {
      fallbackGroup = {
        id: createId('grp'),
        name: 'Default',
        collapsed: false,
        hidden: false,
        isFactory: true,
      };
      this.workspace.groups.push(fallbackGroup);
    }

    for (const pattern of this.workspace.patterns) {
      if (pattern.groupId === groupId) pattern.groupId = fallbackGroup.id;
    }

    this.workspace.groups = this.workspace.groups.filter(item => item.id !== groupId);
    this.persist();
    return { deleted: group, fallback: fallbackGroup };
  }

  addPattern({ name, groupId, bpm, timeSignature, grid }) {
    const group = this.getGroup(groupId) || this.workspace.groups[0];
    const signature = isValidTimeSignature(timeSignature) ? timeSignature : '4/4';
    const totalSteps = getStepCountForSig(signature);
    const pattern = {
      id: createId('pat'),
      groupId: group.id,
      name,
      bpm: clampBpm(bpm),
      timeSignature: signature,
      grid: grid
        ? normalizeGrid(grid, totalSteps, [...this.trackPatternKeys, ...Object.keys(grid)])
        : buildEmptyGrid(totalSteps, this.trackPatternKeys),
    };

    this.workspace.patterns.push(pattern);
    group.collapsed = false;
    group.hidden = false;
    this.persist();
    return pattern;
  }

  updatePattern(patternId, { name, groupId }) {
    const pattern = this.getPattern(patternId);
    if (!pattern) return null;
    if (name !== undefined) pattern.name = name;
    if (groupId !== undefined && this.getGroup(groupId)) pattern.groupId = groupId;
    this.persist();
    return pattern;
  }

  duplicatePattern(patternId) {
    const source = this.getPattern(patternId);
    if (!source) return null;

    const copy = {
      id: createId('pat'),
      groupId: source.groupId,
      name: `${source.name} (Copy)`,
      bpm: source.bpm,
      timeSignature: source.timeSignature,
      grid: cloneGrid(source.grid),
    };
    this.workspace.patterns.push(copy);
    this.persist();
    return copy;
  }

  deletePattern(patternId) {
    if (this.workspace.patterns.length <= 1) return null;
    const pattern = this.getPattern(patternId);
    if (!pattern) return null;

    this.workspace.patterns = this.workspace.patterns.filter(item => item.id !== patternId);
    removePatternFromArrangement(this.arrangement, patternId);
    if (this.workspace.activePatternId === patternId) {
      this.workspace.activePatternId = this.workspace.patterns[0].id;
      this.syncPatternTracks(this.activePattern);
    }
    this.persist();
    return pattern;
  }

  clearPattern(patternId) {
    const pattern = this.getPattern(patternId);
    if (!pattern) return null;
    pattern.grid = buildEmptyGrid(getStepCountForSig(pattern.timeSignature), this.trackPatternKeys);
    this.persist();
    return pattern;
  }

  replacePatternGrid(patternId, grid) {
    const pattern = this.getPattern(patternId);
    if (!pattern) return null;
    pattern.grid = normalizeGrid(grid, getStepCountForSig(pattern.timeSignature), [
      ...this.trackPatternKeys,
      ...Object.keys(grid || {}),
    ]);
    this.persist();
    return pattern;
  }

  /** Snapshot of one pattern, used to undo a factory restore. */
  capturePatternState(patternId = null) {
    const pattern = patternId ? this.getPattern(patternId) : this.activePattern;
    if (!pattern) return null;
    return {
      id: pattern.id,
      bpm: pattern.bpm,
      timeSignature: pattern.timeSignature,
      grid: cloneGrid(pattern.grid, [
        ...this.trackPatternKeys,
        ...Object.keys(pattern.grid || {}),
      ]),
    };
  }

  restorePatternState(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return false;
    const pattern = this.getPattern(snapshot.id);
    if (!pattern) return false;

    const timeSignature = isValidTimeSignature(snapshot.timeSignature)
      ? snapshot.timeSignature
      : '4/4';
    pattern.timeSignature = timeSignature;
    pattern.bpm = clampBpm(snapshot.bpm);
    pattern.grid = normalizeGrid(snapshot.grid, getStepCountForSig(timeSignature), [
      ...this.trackPatternKeys,
      ...Object.keys(snapshot.grid || {}),
    ]);
    this.persist();
    return true;
  }

  /**
   * Restore only the active factory pattern's steps, BPM and signature. Kit
   * tracks, row order, visibility, groups and custom patterns are untouched.
   */
  restoreActiveFactoryPattern() {
    const pattern = this.activePattern;
    const factory = pattern
      ? FACTORY_PATTERNS.find(item => item.id === pattern.id)
      : null;
    if (!factory) return { restored: 0, snapshot: null };

    const snapshot = this.capturePatternState(pattern.id);
    const timeSignature = isValidTimeSignature(factory.timeSignature)
      ? factory.timeSignature
      : '4/4';
    const totalSteps = getStepCountForSig(timeSignature);
    pattern.timeSignature = timeSignature;
    pattern.bpm = clampBpm(factory.bpm);
    pattern.grid = normalizeGrid(
      buildGridFromHits(factory.hits, totalSteps),
      totalSteps,
      [
        ...this.trackPatternKeys,
        ...ALL_INSTRUMENT_IDS,
        ...Object.keys(pattern.grid || {}),
      ],
    );
    this.persist();
    return { restored: 1, snapshot };
  }

  setStep(rowKey, stepIndex, active) {
    const pattern = this.activePattern;
    if (!pattern || !Array.isArray(pattern.grid[rowKey])) return false;
    pattern.grid[rowKey][stepIndex] = Boolean(active);
    this.persist();
    return true;
  }

  // ---- Bottom-of-screen loop arrangement ---------------------------------

  setLoopEnabled(enabled) {
    this.arrangement.enabled = Boolean(enabled);
    this.persist();
    return this.arrangement.enabled;
  }

  addLoopRow(patternId, bpm) {
    const row = addArrangementRow(this.arrangement, patternId, this.workspace.patterns, bpm);
    if (row) this.persist();
    return row;
  }

  addLoopRows(patternIds) {
    const added = [];
    for (const patternId of Array.isArray(patternIds) ? patternIds : []) {
      const row = this.addLoopRow(patternId);
      if (row) added.push(row);
    }
    return added;
  }

  removeLoopRow(rowId) {
    const removed = removeArrangementRow(this.arrangement, rowId);
    if (removed) this.persist();
    return removed;
  }

  setLoopRowBpm(rowId, value) {
    const bpm = setArrangementRowBpm(this.arrangement, rowId, value);
    if (bpm !== null) this.persist();
    return bpm;
  }

  toggleLoopBlock(rowId, beat) {
    const result = toggleArrangementBlock(
      this.arrangement,
      rowId,
      beat,
      this.workspace.patterns,
    );
    if (result) this.persist();
    return result;
  }

  clearLoopBlocks() {
    const cleared = clearArrangementBlocks(this.arrangement);
    if (cleared) this.persist();
    return cleared;
  }

  clearLoopRows() {
    const cleared = clearArrangementRows(this.arrangement);
    if (cleared) this.persist();
    return cleared;
  }

  getExportData() {
    return this.workspace;
  }
}
