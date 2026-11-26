/**
 * The 23 drum instruments supported by the application.
 *
 * `keywords` help resolve free-form sample labels to instruments. Matching is
 * intentionally simple (lowercase substring match on normalized text).
 */
export const INSTRUMENTS = [
  { id: 'kick', name: 'Kick', keywords: ['kick', 'bd', 'bassdrum'] },
  { id: 'kick_dry', name: 'Kick (Dry)', keywords: ['dry', 'kick2', 'tight'] },
  { id: 'kick_boom', name: 'Kick (Boom)', keywords: ['boom', '808', 'sub'] },
  { id: 'snare', name: 'Snare', keywords: ['snare', 'sd'] },
  { id: 'snare_stick', name: 'Snare side stick', keywords: ['stick', 'sidestick', 'cross'] },
  { id: 'snare_brush', name: 'Snare (Brush)', keywords: ['brush', 'swish'] },
  { id: 'close_hat', name: 'Close Hat', keywords: ['close', 'closed', 'ch', 'hihat', 'hh'] },
  { id: 'open_hat', name: 'Open Hat', keywords: ['open', 'oh'] },
  { id: 'ride', name: 'Ride', keywords: ['ride'] },
  { id: 'crash', name: 'Crash', keywords: ['crash', 'cymbal'] },
  { id: 'tom_low', name: 'Tom Low', keywords: ['low', 'floor'] },
  { id: 'tom_mid', name: 'Tom Mid', keywords: ['mid', 'tom2'] },
  { id: 'tom_high', name: 'Tom High', keywords: ['high', 'hi', 'tom1'] },
  { id: 'clap', name: 'Clap', keywords: ['clap', 'cp'] },
  { id: 'cowbell', name: 'Cowbell', keywords: ['cowbell', 'cb'] },
  { id: 'wood_low', name: 'Woodblock (Low)', keywords: ['wood', 'block'] },
  { id: 'wood_hi', name: 'Woodblock (Hi)', keywords: ['woodhi', 'clave'] },
  { id: 'maracas', name: 'Maracas', keywords: ['maraca'] },
  { id: 'tambourine', name: 'Tambourine', keywords: ['tamb'] },
  { id: 'shaker', name: 'Shaker', keywords: ['shaker'] },
  { id: 'rimshot', name: 'Rimshot', keywords: ['rim'] },
  { id: 'bongo_low', name: 'Bongo (Low)', keywords: ['bongo'] },
  { id: 'bongo_high', name: 'Bongo (High)', keywords: ['bongohi'] },
];

export const STANDARD_KIT_IDS = [
  'kick',
  'snare',
  'close_hat',
  'open_hat',
  'ride',
  'crash',
  'tom_mid',
  'tom_low',
];

export const METAL_KIT_IDS = [
  'kick',
  'kick_dry',
  'snare',
  'rimshot',
  'close_hat',
  'open_hat',
  'ride',
  'crash',
  'tom_high',
  'tom_mid',
  'tom_low',
];

export const ALL_INSTRUMENT_IDS = INSTRUMENTS.map(instrument => instrument.id);

export const INSTRUMENT_BY_ID = new Map(
  INSTRUMENTS.map(instrument => [instrument.id, instrument]),
);
