/**
 * One render pipeline for all export formats. The offline render is shared;
 * only the final encoder changes. Loop exports use the same cropped frame
 * range for WAV, M4A and MP3.
 */

import { encodeWavBlob } from './audio-utils.js';
import { getExportFormat } from './export-formats.js';
import { encodeM4aBlob } from './m4a-export.js';
import { encodeMp3Blob } from './mp3-export.js';
import {
  renderArrangementToAudioBuffer,
  renderPatternToAudioBuffer,
  trimAudioBuffer,
} from './wav-export.js';

export async function renderAudioExport({
  kind,
  format: formatId,
  pattern = null,
  arrangement = null,
  patterns = [],
  workspace,
  tracks = null,
  customBuffers = null,
  onProgress = null,
}) {
  const format = getExportFormat(formatId);
  if (!format) throw new Error(`Unknown export format: ${formatId}`);

  const options = { workspace, tracks, customBuffers };
  const rendered = kind === 'loop'
    ? await renderArrangementToAudioBuffer({ arrangement, patterns, ...options })
    : await renderPatternToAudioBuffer({ pattern, ...options });
  const audioBuffer = trimAudioBuffer(rendered.audioBuffer, rendered.frameCount);

  if (format.id === 'm4a') return encodeM4aBlob(audioBuffer, { onProgress });
  if (format.id === 'mp3') return encodeMp3Blob(audioBuffer, { onProgress });
  if (typeof onProgress === 'function') onProgress(1);
  return encodeWavBlob(audioBuffer);
}
