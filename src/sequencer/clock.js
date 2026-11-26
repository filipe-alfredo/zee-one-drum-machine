/**
 * Lookahead scheduler. JavaScript timers are only used to wake up and schedule
 * audio slightly ahead of time; all audio start times are based on the
 * AudioContext clock supplied by the sequencer.
 */
export class SchedulerClock {
  constructor({
    getCurrentTime,
    getStepDuration,
    getTotalSteps,
    onStep,
    lookaheadMs = 25,
    scheduleAheadSec = 0.12,
    startDelaySec = 0.105,
  }) {
    this.getCurrentTime = getCurrentTime;
    this.getStepDuration = getStepDuration;
    this.getTotalSteps = getTotalSteps;
    this.onStep = onStep;
    this.lookaheadMs = lookaheadMs;
    this.scheduleAheadSec = scheduleAheadSec;
    this.startDelaySec = startDelaySec;
    this.timerId = null;
    this.currentStep = 0;
    this.nextStepTime = 0;
  }

  get isRunning() {
    return this.timerId !== null;
  }

  start() {
    if (this.timerId !== null) return false;
    this.currentStep = 0;
    this.nextStepTime = this.getCurrentTime() + this.startDelaySec;
    this.timerId = setInterval(() => this.tick(), this.lookaheadMs);
    return true;
  }

  tick() {
    if (this.timerId === null) return;

    const horizon = this.getCurrentTime() + this.scheduleAheadSec;
    let safetyCounter = 0;

    while (this.nextStepTime < horizon) {
      this.onStep(this.currentStep, this.nextStepTime);

      const stepDuration = this.getStepDuration();
      if (!(stepDuration > 0)) break;

      this.nextStepTime += stepDuration;
      const totalSteps = Math.max(1, this.getTotalSteps());
      this.currentStep = (this.currentStep + 1) % totalSteps;

      safetyCounter += 1;
      if (safetyCounter > 10000) break;
    }
  }

  stop() {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.currentStep = 0;
  }

  ensureValidStep() {
    if (this.currentStep >= Math.max(1, this.getTotalSteps())) {
      this.currentStep = 0;
    }
  }
}
