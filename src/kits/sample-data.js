import { sanitizeFileName } from './kit-format.js';

/**
 * Helpers for storing raw sample bytes inside the workspace JSON file.
 * AudioBuffers cannot be serialized, but the original WAV/MP3 bytes can.
 */

// Multiple of 3 so each chunk except possibly the last has no base64 padding.
const BASE64_CHUNK = 0x7ffe;

export function mimeTypeForFileName(fileName) {
  const extension = String(fileName || '').toLowerCase().split('.').pop();
  const types = {
    wav: 'audio/wav',
    mp3: 'audio/mpeg',
    ogg: 'audio/ogg',
    m4a: 'audio/mp4',
    aac: 'audio/aac',
    flac: 'audio/flac',
  };
  return types[extension] || 'application/octet-stream';
}

export function bytesToDataUrl(bytes, mimeType = 'application/octet-stream') {
  let encoded = '';
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let offset = 0; offset < view.length; offset += BASE64_CHUNK) {
    const chunk = view.subarray(offset, offset + BASE64_CHUNK);
    encoded += btoa(String.fromCharCode(...chunk));
  }
  return `data:${mimeType};base64,${encoded}`;
}

export function dataUrlToBytes(dataUrl) {
  const text = String(dataUrl || '');
  const comma = text.indexOf(',');
  if (!text.startsWith('data:') || comma === -1) throw new Error('Invalid sample data URL');
  const binary = atob(text.slice(comma + 1));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

/** Keep ZIP folder structure, but remove traversal and unsafe characters. */
export function sanitizeRelativePath(rawPath, fallback = 'sample.wav') {
  const parts = String(rawPath || '')
    .split(/[\\/]+/)
    .filter(part => part && part !== '.' && part !== '..')
    .map(part => sanitizeFileName(part, ''))
    .filter(Boolean);
  return parts.join('/') || fallback;
}
