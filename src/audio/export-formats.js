/**
 * Export format descriptors shared by the format dialog and the audio renderers.
 *
 * WAV is written directly from the offline render. M4A is encoded by the
 * browser's MediaRecorder (AAC-LC in an MP4 container). MP3 is encoded by the
 * vendored LAME module, which is imported only when that format is chosen.
 */

export const EXPORT_FORMATS = Object.freeze([
  Object.freeze({
    id: 'wav',
    label: 'WAV',
    subtitle: 'PCM 16-bit · instant',
    description: 'Lossless and instant, but WhatsApp Web does not accept WAV as audio. Best for archiving and editing.',
    extension: 'wav',
    mimeType: 'audio/wav',
    saveDescription: 'WAV audio',
  }),
  Object.freeze({
    id: 'm4a',
    label: 'M4A',
    subtitle: 'AAC · WhatsApp Web',
    description: 'Accepted by WhatsApp Web. Encoded in real time by the browser, so export takes about as long as the audio.',
    extension: 'm4a',
    mimeType: 'audio/mp4',
    saveDescription: 'M4A audio (AAC)',
  }),
  Object.freeze({
    id: 'mp3',
    label: 'MP3',
    subtitle: '192 kbps · WhatsApp Web',
    description: 'Accepted by WhatsApp Web and the most widely supported player format. Encoded locally with LAME.',
    extension: 'mp3',
    mimeType: 'audio/mpeg',
    saveDescription: 'MP3 audio',
  }),
]);

export function getExportFormat(id) {
  return EXPORT_FORMATS.find(format => format.id === id) || null;
}

/** Replace (or append) the final extension of a suggested file name. */
export function withExportExtension(fileName, extension) {
  const base = String(fileName || 'zeeone_export').replace(/\.[a-z0-9]+$/i, '');
  return `${base}.${extension}`;
}

export function buildExportFileName(wavFileName, format) {
  return withExportExtension(wavFileName, format ? format.extension : 'wav');
}
