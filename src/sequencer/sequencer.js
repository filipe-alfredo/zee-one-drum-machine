import {
  getArrangementNotesAtStep,
  getArrangementSteps,
  getArrangementStepDuration,
} from './arrangement.js';
import { SchedulerClock } from './clock.js';
import { getStepDurationSec } from './pattern.js';
import { getChannelVolume, isChannelAudible } from './mixer.js';

/**
 * Coordinates the lookahead clock, the active pattern or the bottom loop
 * arrangement, mixer rules, and the audio engine. It does not render UI; the
 * playhead callback is supplied by the application.
 */
export class Sequencer {
  constructor({ audioEngine, state, kitManager, onStep = null, getScheduleSource = null }) {
    this.audioEngine = audioEngine;
    this.state = state;
    this.kitManager = kitManager;
    this.onStep = onStep;
    this.getScheduleSourceOverride = getScheduleSource;
    this.playbackGeneration = 0;

    this.clock = new SchedulerClock({
      getCurrentTime: () => this.audioEngine.currentTime,
      getStepDuration: () => this.getScheduleSource().stepDuration(),
      getTotalSteps: () => this.getScheduleSource().totalSteps(),
      onStep: (stepIndex, nominalTime) => this.scheduleStep(stepIndex, nominalTime),
    });
  }

  get isPlaying() {
    return this.clock.isRunning;
  }

  get currentStep() {
    return this.clock.currentStep;
  }

  /**
   * A source supplies the step grid and the notes for each absolute step.
   * The active-pattern source preserves the original behavior; the arrangement
   * source lets the bottom playlist take over when Loop Mode is enabled.
   */
  getScheduleSource() {
    if (typeof this.getScheduleSourceOverride === 'function') {
      return this.getScheduleSourceOverride();
    }

    const arrangement = this.state.workspace && this.state.workspace.arrangement;
    if (arrangement && arrangement.enabled) {
      const patterns = this.state.workspace.patterns;
      return {
        totalSteps: () => getArrangementSteps(arrangement),
        stepDuration: () => getArrangementStepDuration(arrangement),
        notesAtStep: step => getArrangementNotesAtStep(arrangement, patterns, step),
      };
    }

    const patternStepDuration = () => {
      const pattern = this.state.activePattern;
      return getStepDurationSec(pattern ? pattern.bpm : 100);
    };

    return {
      totalSteps: () => this.state.totalSteps,
      stepDuration: patternStepDuration,
      notesAtStep: step => {
        const pattern = this.state.activePattern;
        return pattern ? [{ pattern, stepIndex: step }] : [];
      },
    };
  }

  async start() {
    if (this.isPlaying) return false;

    // AudioContext creation/resume is asynchronous. Re-check after awaiting so
    // two rapid clicks cannot start two scheduler timers.
    await this.audioEngine.ensureStarted();
    if (this.isPlaying) return false;

    this.playbackGeneration += 1;
    return this.clock.start();
  }

  stop() {
    this.clock.stop();
    this.playbackGeneration += 1;
    if (typeof this.onStep === 'function') this.onStep(0, true);
  }

  async toggle() {
    if (this.isPlaying) {
      this.stop();
      return false;
    }
    await this.start();
    return true;
  }

  ensureValidStep() {
    this.clock.ensureValidStep();
  }

  scheduleStep(stepIndex, nominalStepTime) {
    const source = this.getScheduleSource();
    const workspace = this.state.workspace;

    for (const note of source.notesAtStep(stepIndex)) {
      const pattern = note.pattern;
      if (!pattern) continue;

      for (const track of this.state.tracks) {
        const row = pattern.grid[track.patternKey];
        if (!row || !row[note.stepIndex]) continue;
        if (!isChannelAudible(workspace, track.id)) continue;

        const buffer = this.kitManager.getBuffer(track.id);
        if (!buffer && !track.legacyInstrumentId) continue;

        const actualAudioTime = Math.max(this.audioEngine.currentTime, nominalStepTime);
        this.audioEngine.play(
          track.id,
          actualAudioTime,
          buffer,
          track.legacyInstrumentId,
          getChannelVolume(workspace, track.id),
        );
      }
    }

    const generation = this.playbackGeneration;
    const visualDelayMs = Math.max(
      0,
      (nominalStepTime - this.audioEngine.currentTime) * 1000,
    );

    setTimeout(() => {
      if (this.isPlaying && generation === this.playbackGeneration && this.onStep) {
        this.onStep(stepIndex);
      }
    }, visualDelayMs);
  }
}
