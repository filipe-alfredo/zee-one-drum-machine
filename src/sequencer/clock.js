/**
 * Lookahead scheduler. JavaScript timers are only used to wake up and schedule
 * audio slightly ahead of time; all audio start times are based on the
 * AudioContext clock supplied by the sequencer. The clock schedules absolute
 * events inside a repeating cycle, so rows with different BPMs can drift while
 * still sharing one loop.
 */
export class SchedulerClock {
  constructor({
    getCurrentTime,
    getEvents,
    getCycleDuration,
    onEvent,
    lookaheadMs = 25,
    scheduleAheadSec = 0.12,
    startDelaySec = 0.105,
  }) {
    this.getCurrentTime = getCurrentTime;
    this.getEvents = getEvents;
    this.getCycleDuration = getCycleDuration;
    this.onEvent = onEvent;
    this.lookaheadMs = lookaheadMs;
    this.scheduleAheadSec = scheduleAheadSec;
    this.startDelaySec = startDelaySec;
    this.timerId = null;
    this.currentStep = 0;
    this.cycleStart = 0;
    this.cursor = 0;
  }

  get isRunning() {
    return this.timerId !== null;
  }

  start() {
    if (this.timerId !== null) return false;
    this.currentStep = 0;
    this.cycleStart = this.getCurrentTime() + this.startDelaySec;
    this.cursor = 0;
    this.timerId = setInterval(() => this.tick(), this.lookaheadMs);
    return true;
  }

  tick() {
    if (this.timerId === null) return;

    const events = this.getEvents() || [];
    const horizon = this.getCurrentTime() + this.scheduleAheadSec;
    const duration = Math.max(0.05, Number(this.getCycleDuration()) || 0);
    let safetyCounter = 0;

    while (safetyCounter < 10000) {
      safetyCounter += 1;
      const event = events[this.cursor];
      if (!event) {
        // Empty cycles advance quietly; active cycles restart from event 0.
        if (this.cursor === 0 && events.length === 0) {
          this.cycleStart = horizon;
          break;
        }
        const nextStart = this.cycleStart + duration;
        if (nextStart + (events[0] ? events[0].time : 0) >= horizon) break;
        this.cycleStart = nextStart;
        this.cursor = 0;
        continue;
      }

      const nominalTime = this.cycleStart + event.time;
      if (nominalTime >= horizon) break;

      this.onEvent(event, nominalTime);
      this.currentStep = Number.isFinite(event.stepIndex) ? event.stepIndex : this.currentStep;
      this.cursor += 1;
    }
  }

  stop() {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.currentStep = 0;
    this.cursor = 0;
  }

  ensureValidStep() {
    if (!Number.isFinite(this.currentStep) || this.currentStep < 0) this.currentStep = 0;
  }
}
