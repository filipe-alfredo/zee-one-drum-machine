/**
 * Audio helpers shared by the live engine and the offline WAV renderer.
 */

export function createNoiseBuffer(audioContext) {
  const length = audioContext.sampleRate * 2;
  const buffer = audioContext.createBuffer(1, length, audioContext.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < length; index += 1) {
    data[index] = Math.random() * 2 - 1;
  }
  return buffer;
}

/**
 * Encode an AudioBuffer as a 16-bit PCM WAV Blob. `frameCount` can be shorter
 * than the buffer to drop a silent tail without rebuilding the AudioBuffer.
 */
export function encodeWavBlob(audioBuffer, frameCount = audioBuffer.length) {
  const numberOfChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const bytesPerSample = 2;
  const frames = Math.max(0, Math.min(Math.floor(frameCount), audioBuffer.length));
  const dataLength = frames * numberOfChannels * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  const writeString = (offset, string) => {
    for (let index = 0; index < string.length; index += 1) {
      view.setUint8(offset + index, string.charCodeAt(index));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numberOfChannels * bytesPerSample, true);
  view.setUint16(32, numberOfChannels * bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataLength, true);

  let position = 44;
  for (let index = 0; index < frames; index += 1) {
    for (let channel = 0; channel < numberOfChannels; channel += 1) {
      const sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(channel)[index]));
      view.setInt16(position, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      position += 2;
    }
  }

  return new Blob([buffer], { type: 'audio/wav' });
}
