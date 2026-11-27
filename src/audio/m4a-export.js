/**
 * M4A/AAC export using the browser's own MediaRecorder.
 *
 * Chromium and Edge encode AAC-LC into an MP4 container with
 * `audio/mp4;codecs=mp4a.40.2`. No encoder library or Node API is involved.
 * MediaRecorder runs in real time, so the UI reports progress while it records.
 */

const M4A_MIME_TYPES = [
  'audio/mp4;codecs=mp4a.40.2',
  'audio/mp4',
];

function pickMimeType() {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    throw new Error('This browser cannot encode M4A audio.');
  }
  return M4A_MIME_TYPES.find(type => MediaRecorder.isTypeSupported(type)) || null;
}

/** Copy an AudioBuffer-like carrier into a real buffer for the live context. */
function createPlayableBuffer(context, source) {
  const buffer = context.createBuffer(
    source.numberOfChannels,
    Math.max(1, source.length),
    source.sampleRate,
  );
  for (let channel = 0; channel < source.numberOfChannels; channel += 1) {
    buffer.copyToChannel(source.getChannelData(channel), channel, 0);
  }
  return buffer;
}

export async function encodeM4aBlob(audioBuffer, { onProgress = null } = {}) {
  const mimeType = pickMimeType();
  if (!mimeType) {
    throw new Error('M4A/AAC encoding is not available in this browser or app version.');
  }

  const AudioContextClass = typeof window !== 'undefined'
    ? (window.AudioContext || window.webkitAudioContext)
    : null;
  if (!AudioContextClass || typeof MediaStream === 'undefined') {
    throw new Error('M4A encoding requires a browser with Web Audio and MediaStream support.');
  }

  let context;
  try {
    context = new AudioContextClass({ sampleRate: audioBuffer.sampleRate });
  } catch (_) {
    // Some platforms reject an explicit rate; the encoder resamples for us.
    context = new AudioContextClass();
  }

  const buffer = createPlayableBuffer(context, audioBuffer);
  const destination = context.createMediaStreamDestination();
  const sourceNode = context.createBufferSource();
  sourceNode.buffer = buffer;
  sourceNode.connect(destination);

  const recorder = new MediaRecorder(destination.stream, {
    mimeType,
    audioBitsPerSecond: 192000,
  });
  const chunks = [];
  let recorderError = null;
  let timedOut = false;

  // A MediaStreamDestination track stays live after the buffer ends, so the
  // recorder has to be stopped explicitly when playback finishes.
  sourceNode.onended = () => {
    if (recorder.state !== 'inactive') recorder.stop();
  };

  const stopped = new Promise(resolve => {
    recorder.addEventListener('dataavailable', event => {
      if (event.data && event.data.size) chunks.push(event.data);
    });
    recorder.addEventListener('stop', resolve, { once: true });
    recorder.addEventListener('error', event => {
      recorderError = event.error || new Error('MediaRecorder failed.');
      resolve();
    }, { once: true });
  });

  const durationSec = buffer.duration;
  const timeoutMs = Math.max(15000, Math.ceil(durationSec * 1000) + 15000);
  const timeout = setTimeout(() => {
    timedOut = true;
    if (recorder.state !== 'inactive') recorder.stop();
  }, timeoutMs);

  const progressTimer = typeof onProgress === 'function'
    ? setInterval(() => {
      onProgress(Math.min(1, context.currentTime / Math.max(0.001, durationSec)));
    }, 120)
    : null;

  try {
    recorder.start();
    if (context.state === 'suspended') await context.resume();
    sourceNode.start();
    await stopped;
    if (recorderError) throw recorderError;
    if (timedOut) throw new Error('M4A encoding took too long. Try WAV or a shorter loop.');
    if (typeof onProgress === 'function') onProgress(1);
    // Normalize the MIME type: MediaRecorder may append ;codecs=mp4a.40.2,
    // while the saved file and its picker filter use plain audio/mp4.
    return new Blob(chunks, { type: 'audio/mp4' });
  } finally {
    clearTimeout(timeout);
    if (progressTimer) clearInterval(progressTimer);
    try { sourceNode.stop(); } catch (_) { /* already stopped */ }
    try { sourceNode.disconnect(); } catch (_) { /* already disconnected */ }
    try { await context.close(); } catch (_) { /* context already closed */ }
  }
}
