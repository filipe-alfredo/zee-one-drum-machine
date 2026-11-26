import { createNoiseBuffer, encodeWavBlob } from './audio-utils.js';
import {
  getArrangementNotesAtStep,
  getArrangementSteps,
  getArrangementStepDuration,
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
 * Shared offline renderer. `notesAtStep(step)` returns the pattern/step pairs
 * supplied by either the active-pattern or the loop-arrangement source.
 */
async function renderNotesToWav({
  totalSteps,
  stepDuration,
  notesAtStep,
  workspace,
  customBuffers = null,
  tracks = null,
}) {
  const OfflineAudioContextClass = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!OfflineAudioContextClass) {
    throw new Error('Offline audio rendering is not supported in this environment.');
  }

  const totalDuration = totalSteps * stepDuration + 1.0;
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
  for (let step = 0; step < totalSteps; step += 1) {
    const nominalTime = step * stepDuration;
    for (const note of notesAtStep(step)) {
      const pattern = note.pattern;
      if (!pattern) continue;

      for (const track of activeTracks) {
        if (!isChannelAudible(workspace, track.id)) continue;
        const row = pattern.grid[track.patternKey];
        if (!row || !row[note.stepIndex]) continue;

        const buffer = getCustomBuffer(customBuffers, track.id);
        if (!buffer && !track.legacyInstrumentId) continue;

        const actualTime = nominalTime;
        const trackGain = offlineContext.createGain();
        trackGain.gain.value = getChannelVolume(workspace, track.id);
        trackGain.connect(masterGain);
        renderInstrumentSound(
          offlineContext,
          trackGain,
          noiseBuffer,
          track.legacyInstrumentId,
          actualTime,
          buffer,
        );
      }
    }
  }

  const renderedBuffer = await offlineContext.startRendering();
  return encodeWavBlob(renderedBuffer);
}

/** Render the active pattern with OfflineAudioContext and return a WAV Blob. */
export async function renderPatternToWav({ pattern, workspace, customBuffers = null, tracks = null }) {
  if (!pattern) throw new Error('No active pattern to export.');

  return renderNotesToWav({
    totalSteps: getStepCountForSig(pattern.timeSignature),
    stepDuration: getStepDurationSec(pattern.bpm),
    notesAtStep: step => [{ pattern, stepIndex: step }],
    workspace,
    customBuffers,
    tracks,
  });
}

/** Render the whole bottom timeline once and return a WAV Blob. */
export async function renderArrangementToWav({
  arrangement,
  patterns,
  workspace,
  customBuffers = null,
  tracks = null,
}) {
  if (!arrangement) throw new Error('No loop arrangement to export.');

  return renderNotesToWav({
    totalSteps: getArrangementSteps(arrangement),
    stepDuration: getArrangementStepDuration(arrangement),
    notesAtStep: step => getArrangementNotesAtStep(arrangement, patterns, step),
    workspace,
    customBuffers,
    tracks,
  });
}

export function buildWavFileName(pattern) {
  const safeName = pattern.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  return `zeeone_${safeName}_${pattern.bpm}bpm.wav`;
}

export function buildLoopWavFileName(arrangement) {
  return `zeeone_loop_${arrangement.loopBars}bars_${arrangement.bpm}bpm.wav`;
}
