import {
  getArrangementDurationSec,
  getArrangementEvents,
} from './arrangement.js';
import { SchedulerClock } from './clock.js';
import { getStepCountForSig, getStepDurationSec } from './pattern.js';
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
      getEvents: () => this.getScheduleSource().events(),
      getCycleDuration: () => this.getScheduleSource().duration(),
      onEvent: (event, nominalTime) => this.scheduleEvent(event, nominalTime),
    });
  }

  get isPlaying() {
    return this.clock.isRunning;
  }

  get currentStep() {
    return this.clock.currentStep;
  }

  /**
   * A source supplies the repeating cycle: absolute event times plus a total
   * duration. The active pattern source keeps the original step grid; the
   * arrangement source lets each pattern row run at its own BPM.
   */
  getScheduleSource() {
    if (typeof this.getScheduleSourceOverride === 'function') {
      return this.getScheduleSourceOverride();
    }

    const arrangement = this.state.workspace && this.state.workspace.arrangement;
    if (arrangement && arrangement.enabled) {
      const patterns = this.state.workspace.patterns;
      return {
        events: () => getArrangementEvents(arrangement, patterns),
        duration: () => getArrangementDurationSec(arrangement, patterns),
      };
    }

    return {
      events: () => {
        const pattern = this.state.activePattern;
        if (!pattern) return [];
        const count = getStepCountForSig(pattern.timeSignature);
        const stepDuration = getStepDurationSec(pattern.bpm);
        return Array.from({ length: count }, (_, stepIndex) => ({
          source: 'pattern',
          time: stepIndex * stepDuration,
          stepIndex,
          pattern,
        }));
      },
      duration: () => {
        const pattern = this.state.activePattern;
        if (!pattern) return 1;
        return getStepCountForSig(pattern.timeSignature) * getStepDurationSec(pattern.bpm);
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

  scheduleEvent(event, nominalStepTime) {
    const workspace = this.state.workspace;
    const pattern = event.pattern;

    if (pattern) {
      for (const track of this.state.tracks) {
        const row = pattern.grid[track.patternKey];
        if (!row || !row[event.stepIndex]) continue;
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
        this.onStep(event.stepIndex, false, event);
      }
    }, visualDelayMs);
  }
}
