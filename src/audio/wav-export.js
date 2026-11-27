import { createNoiseBuffer, encodeWavBlob } from './audio-utils.js';
import {
  getArrangementBeats,
  getArrangementDurationSec,
  getArrangementEvents,
} from '../sequencer/arrangement.js';
import { renderInstrumentSound } from './sample-player.js';
import { INSTRUMENTS } from '../kits/instruments.js';
import { getStepCountForSig, getStepDurationSec } from '../sequencer/pattern.js';
import { getChannelVolume, getGlobalVolume, isChannelAudible } from '../sequencer/mixer.js';

function getCustomBuffer(customBuffers, trackId) {
  if (!customBuffers) return null;
  if (typeof customBuffers.get === 'function') return customBuffers.get(trackId) || null;
  return customBuffers[trackId] || null;
}

/** Last audible frame plus a tiny guard, so decay is kept but silence is not. */
function getTrimmedFrameCount(audioBuffer, sampleRate) {
  const channels = [];
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel += 1) {
    channels.push(audioBuffer.getChannelData(channel));
  }

  const threshold = 0.0005;
  for (let frame = audioBuffer.length - 1; frame >= 0; frame -= 1) {
    for (const data of channels) {
      if (Math.abs(data[frame]) >= threshold) {
        return Math.min(
          audioBuffer.length,
          frame + 1 + Math.ceil(sampleRate * 0.02),
        );
      }
    }
  }
  return Math.min(audioBuffer.length, Math.ceil(sampleRate * 0.05));
}

function defaultTracks() {
  return INSTRUMENTS.map(instrument => ({
    id: instrument.id,
    name: instrument.name,
    kind: 'synth',
    sampleId: null,
    legacyInstrumentId: instrument.id,
    patternKey: instrument.id,
  }));
}

/**
 * Shared offline renderer. `events` are absolute { time, pattern, stepIndex }
 * entries, so multiple pattern rows with different BPMs can overlap in one
 * exported loop cycle.
 */
async function renderEventsToWav({
  events,
  duration,
  workspace,
  customBuffers = null,
  tracks = null,
  cropSilentTail = false,
}) {
  const OfflineAudioContextClass = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!OfflineAudioContextClass) {
    throw new Error('Offline audio rendering is not supported in this environment.');
  }

  const totalDuration = Math.max(0.05, duration || 0) + 1.0;
  const sampleRate = 44100;
  const offlineContext = new OfflineAudioContextClass(
    2,
    Math.ceil(sampleRate * totalDuration),
    sampleRate,
  );
  const masterGain = offlineContext.createGain();
  masterGain.gain.value = getGlobalVolume(workspace);
  masterGain.connect(offlineContext.destination);
  const noiseBuffer = createNoiseBuffer(offlineContext);

  const activeTracks = Array.isArray(tracks) ? tracks : defaultTracks();
  for (const event of Array.isArray(events) ? events : []) {
    const pattern = event.pattern;
    if (!pattern) continue;

    for (const track of activeTracks) {
      if (!isChannelAudible(workspace, track.id)) continue;
      const row = pattern.grid[track.patternKey];
      if (!row || !row[event.stepIndex]) continue;

      const buffer = getCustomBuffer(customBuffers, track.id);
      if (!buffer && !track.legacyInstrumentId) continue;

      const trackGain = offlineContext.createGain();
      trackGain.gain.value = getChannelVolume(workspace, track.id);
      trackGain.connect(masterGain);
      renderInstrumentSound(
        offlineContext,
        trackGain,
        noiseBuffer,
        track.legacyInstrumentId,
        Math.max(0, event.time),
        buffer,
      );
    }
  }

  const renderedBuffer = await offlineContext.startRendering();
  const frameCount = cropSilentTail
    ? getTrimmedFrameCount(renderedBuffer, sampleRate)
    : renderedBuffer.length;
  return encodeWavBlob(renderedBuffer, frameCount);
}

/** Render the active pattern with OfflineAudioContext and return a WAV Blob. */
export async function renderPatternToWav({ pattern, workspace, customBuffers = null, tracks = null }) {
  if (!pattern) throw new Error('No active pattern to export.');

  const count = getStepCountForSig(pattern.timeSignature);
  const stepDuration = getStepDurationSec(pattern.bpm);
  return renderEventsToWav({
    events: Array.from({ length: count }, (_, stepIndex) => ({
      time: stepIndex * stepDuration,
      stepIndex,
      pattern,
    })),
    duration: count * stepDuration,
    workspace,
    customBuffers,
    tracks,
  });
}

/** Render one full cycle of the painted loop grid and return a WAV Blob. */
export async function renderArrangementToWav({
  arrangement,
  patterns,
  workspace,
  customBuffers = null,
  tracks = null,
}) {
  if (!arrangement) throw new Error('No loop arrangement to export.');

  return renderEventsToWav({
    events: getArrangementEvents(arrangement, patterns),
    duration: getArrangementDurationSec(arrangement, patterns),
    workspace,
    customBuffers,
    tracks,
    cropSilentTail: true,
  });
}

export function buildWavFileName(pattern) {
  const safeName = pattern.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  return `zeeone_${safeName}_${pattern.bpm}bpm.wav`;
}

export function buildLoopWavFileName(arrangement, patterns = []) {
  const beats = Math.max(1, getArrangementBeats(arrangement));
  const rows = arrangement && Array.isArray(arrangement.rows) ? arrangement.rows.length : 0;
  return `zeeone_loop_${rows}rows_${beats}beats.wav`;
}
