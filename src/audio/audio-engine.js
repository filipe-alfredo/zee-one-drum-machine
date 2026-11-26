import { clampVolume } from '../utils/helpers.js';
import { createNoiseBuffer } from './audio-utils.js';
import { renderInstrumentSound } from './sample-player.js';

/**
 * Owns the live AudioContext, the user-controlled master gain, and shared noise
 * buffer. Each scheduled note gets a short-lived gain node for its track's
 * volume before reaching the master gain.
 *
 * The context is created lazily from a user gesture (play, audition, or sample
 * load). Audio is always scheduled against AudioContext.currentTime; no audio
 * is triggered directly from a JavaScript interval.
 */
export class AudioEngine {
  constructor() {
    this.audioContext = null;
    this.masterGain = null;
    this.noiseBuffer = null;
    this.initialization = null;
    this.globalVolume = 0.85;
  }

  get context() {
    return this.audioContext;
  }

  get currentTime() {
    return this.audioContext ? this.audioContext.currentTime : 0;
  }

  get isReady() {
    return Boolean(this.audioContext);
  }

  setMasterVolume(value) {
    this.globalVolume = clampVolume(value, 0.85);
    if (this.masterGain) this.masterGain.gain.value = this.globalVolume;
    return this.globalVolume;
  }

  async ensureStarted() {
    if (this.audioContext) {
      await this.resumeIfSuspended();
      return this.audioContext;
    }

    if (!this.initialization) {
      this.initialization = this.createContext().catch(error => {
        this.initialization = null;
        throw error;
      });
    }

    await this.initialization;
    await this.resumeIfSuspended();
    return this.audioContext;
  }

  async createContext() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      throw new Error('Web Audio API is not supported in this environment.');
    }

    this.audioContext = new AudioContextClass();
    this.masterGain = this.audioContext.createGain();
    this.masterGain.gain.value = this.globalVolume;
    this.masterGain.connect(this.audioContext.destination);
    this.noiseBuffer = createNoiseBuffer(this.audioContext);
  }

  async resumeIfSuspended() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  play(trackId, when, customBuffer = null, synthInstrumentId = trackId, trackVolume = 1) {
    if (!this.audioContext || !this.masterGain) return false;

    const trackGain = this.audioContext.createGain();
    trackGain.gain.value = clampVolume(trackVolume, 1);
    trackGain.connect(this.masterGain);

    renderInstrumentSound(
      this.audioContext,
      trackGain,
      this.noiseBuffer,
      synthInstrumentId,
      when,
      customBuffer,
    );

    // Synth envelopes are shorter; a custom sample may be longer. Disconnect
    // the temporary gain after the longest realistic source has finished.
    const tailSeconds = Math.max(2, customBuffer ? customBuffer.duration + 0.5 : 0);
    setTimeout(() => {
      try { trackGain.disconnect(); } catch (_) { /* already disconnected */ }
    }, tailSeconds * 1000);

    return true;
  }

  async audition(trackId, customBuffer = null, synthInstrumentId = trackId, trackVolume = 1) {
    await this.ensureStarted();
    return this.play(trackId, this.audioContext.currentTime, customBuffer, synthInstrumentId, trackVolume);
  }

  async decodeAudioFile(file) {
    await this.ensureStarted();
    const arrayBuffer = await file.arrayBuffer();
    return this.audioContext.decodeAudioData(arrayBuffer);
  }
}
