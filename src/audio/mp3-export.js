/**
 * MP3 export through the vendored LAME encoder.
 *
 * The encoder module is imported only when MP3 is selected, so WAV/M4A users
 * never pay for it. It is plain JavaScript and runs entirely in the renderer.
 */

let encoderModulePromise = null;

function loadEncoder() {
  if (!encoderModulePromise) {
    encoderModulePromise = import(new URL('../vendor/lamejs.js', import.meta.url).href);
  }
  return encoderModulePromise;
}

function toPcm16(channelData, start, end) {
  const pcm = new Int16Array(end - start);
  for (let index = start; index < end; index += 1) {
    const sample = Math.max(-1, Math.min(1, channelData[index]));
    pcm[index - start] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return pcm;
}

export async function encodeMp3Blob(audioBuffer, { bitrate = 192, onProgress = null } = {}) {
  const { Mp3Encoder } = await loadEncoder();
  const channels = audioBuffer.numberOfChannels;
  if (channels !== 1 && channels !== 2) {
    throw new Error(`MP3 export supports mono or stereo audio, not ${channels} channels.`);
  }

  const encoder = new Mp3Encoder(channels, audioBuffer.sampleRate, bitrate);
  const left = audioBuffer.getChannelData(0);
  const right = channels === 2 ? audioBuffer.getChannelData(1) : null;
  const blockSize = 1152;
  const parts = [];
  let totalLength = 0;

  for (let offset = 0; offset < left.length; offset += blockSize) {
    const end = Math.min(offset + blockSize, left.length);
    const leftChunk = toPcm16(left, offset, end);
    const rightChunk = right ? toPcm16(right, offset, end) : undefined;
    const encoded = encoder.encodeBuffer(leftChunk, rightChunk);
    if (encoded && encoded.length) {
      parts.push(encoded);
      totalLength += encoded.length;
    }
    if (typeof onProgress === 'function') {
      onProgress(Math.min(1, end / Math.max(1, left.length)));
    }
  }

  const tail = encoder.flush();
  if (tail && tail.length) {
    parts.push(tail);
    totalLength += tail.length;
  }

  const bytes = new Uint8Array(totalLength);
  let cursor = 0;
  for (const part of parts) {
    bytes.set(part, cursor);
    cursor += part.length;
  }
  if (typeof onProgress === 'function') onProgress(1);
  return new Blob([bytes], { type: 'audio/mpeg' });
}
