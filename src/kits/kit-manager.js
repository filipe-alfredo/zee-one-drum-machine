import { bytesToDataUrl, mimeTypeForFileName } from './sample-data.js';
import { decodeAudioFile } from './kit-loader.js';
import { sanitizeFileName } from './kit-format.js';

/**
 * Runtime mirror of the kit stored in AppState. Each imported file is its own
 * track and its id is the track id, so buffers/bytes are looked up directly by
 * track id. AudioBuffers are kept only for this session; raw bytes live in the
 * workspace so they can be written to JSON.
 */
export class KitManager {
  constructor(audioEngine) {
    this.audioEngine = audioEngine;
    this.samples = new Map();
  }

  getSample(trackId) {
    return this.samples.get(trackId) || null;
  }

  getBuffer(trackId) {
    const sample = this.getSample(trackId);
    return sample ? sample.buffer : null;
  }

  getFileName(trackId) {
    const sample = this.getSample(trackId);
    return sample ? sample.label || sample.fileName : null;
  }

  hasSample(trackId) {
    return Boolean(this.getBuffer(trackId));
  }

  /** Map keyed by track id, compatible with the offline WAV renderer. */
  getBuffers() {
    const buffers = new Map();
    for (const [trackId, sample] of this.samples) {
      if (sample.buffer) buffers.set(trackId, sample.buffer);
    }
    return buffers;
  }

  getAllSamples() {
    return [...this.samples.values()];
  }

  addSample(sample) {
    if (!sample || !sample.id) return null;
    this.samples.set(sample.id, sample);
    return sample;
  }

  replaceSamples(samples) {
    this.samples.clear();
    for (const sample of Array.isArray(samples) ? samples : []) this.addSample(sample);
  }

  removeSample(trackId) {
    return this.samples.delete(trackId);
  }

  async loadFile(track, file, { path = '' } = {}) {
    await this.audioEngine.ensureStarted();
    const bytes = new Uint8Array(await file.arrayBuffer());
    const buffer = await decodeAudioFile(this.audioEngine.context, new Blob([bytes.slice()]));
    const fileName = file.name || 'sample.wav';
    const mimeType = mimeTypeForFileName(fileName);
    const trackId = track.id;
    const instrumentId = track.legacyInstrumentId || '';
    const sample = {
      id: trackId,
      instrumentId,
      label: track.name || fileName,
      fileName,
      path: path || `manual/${trackId}/${sanitizeFileName(fileName)}`,
      kitId: 'manual',
      kitName: 'Manual',
      mimeType,
      data: bytesToDataUrl(bytes, mimeType),
      buffer,
    };
    this.addSample(sample);
    const { buffer: _buffer, ...metadata } = sample;
    return metadata;
  }

  clear() {
    this.samples.clear();
  }
}
