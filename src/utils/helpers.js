/**
 * Small, dependency-free helpers shared across the application.
 * Keep this module free of audio, sequencer, and DOM-rendering concerns.
 */

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function clampBpm(value) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return 100;
  return clamp(parsed, 40, 240);
}

/** Volume is stored as a 0–1 linear gain. Invalid values use the fallback. */
export function clampVolume(value, fallback = 1) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return clamp(parsed, 0, 1);
}

export function createId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = event => resolve(event.target.result);
    reader.onerror = () => reject(reader.error || new Error('Could not read file'));
    reader.readAsText(file);
  });
}
