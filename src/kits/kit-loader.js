import { INSTRUMENTS, INSTRUMENT_BY_ID } from './instruments.js';

/**
 * Map a free-form sample name to one of the 23 fixed instrument tracks.
 * Matching is deliberately conservative: a short word such as "hi" does not
 * match inside unrelated words, and unknown names stay unassigned.
 */
const SYNONYMS = [
  ['tom grave', 'tom_low'],
  ['tom medio', 'tom_mid'],
  ['tom agudo', 'tom_high'],
  ['tom 1', 'tom_high'],
  ['tom 2', 'tom_mid'],
  ['tom 3', 'tom_low'],
  ['caixa', 'snare'],
  ['bumbo', 'kick'],
  ['bass drum', 'kick'],
  ['chimbal', 'close_hat'],
  ['prato', 'crash'],
  ['ferrinho', 'rimshot'],
  ['palmas', 'clap'],
  ['ganza', 'tambourine'],
];

function normalizeLabel(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function keywordScore(instrument, normalized) {
  let best = 0;
  for (const keyword of instrument.keywords) {
    const value = normalizeLabel(keyword);
    if (value.length >= 2 && normalized.includes(value)) best = Math.max(best, value.length);
  }
  return best;
}

/**
 * Resolve a user-typed label such as "snare 1" or "tom grave" to an
 * instrument id. Returns null when the label cannot be mapped safely.
 */
export function resolveInstrumentFromLabel(label) {
  const normalized = normalizeLabel(label);
  if (!normalized) return null;

  for (const [phrase, instrumentId] of SYNONYMS) {
    if (normalized.includes(phrase) && INSTRUMENT_BY_ID.has(instrumentId)) {
      return INSTRUMENT_BY_ID.get(instrumentId);
    }
  }

  let best = null;
  let bestScore = 0;
  for (const instrument of INSTRUMENTS) {
    const name = normalizeLabel(instrument.name);
    const score = Math.max(
      keywordScore(instrument, normalized),
      name.length >= 2 && normalized.includes(name) ? name.length : 0,
    );
    if (score > bestScore) {
      best = instrument;
      bestScore = score;
    }
  }
  return best;
}

export function matchInstrumentByFilename(fileName) {
  return resolveInstrumentFromLabel(fileName);
}

export async function decodeAudioFile(audioContext, file) {
  const buffer = await file.arrayBuffer();
  return audioContext.decodeAudioData(buffer);
}
