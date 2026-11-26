/**
 * Factory patterns shipped with the application.
 * `hits` lists active step indexes per instrument for readability; the state
 * layer converts them into the boolean grid used by the sequencer.
 */
export const FACTORY_PATTERNS = [
  { id: 'pat_reggae', name: 'Reggae Rockers', bpm: 82, timeSignature: '4/4', hits: { kick: [0, 4, 8, 12], snare_stick: [2, 6, 10, 14], snare: [8], close_hat: [0, 2, 4, 6, 8, 10, 12, 14], open_hat: [15] } },
  { id: 'pat_rock_slow', name: 'Rock Slow 1', bpm: 81, timeSignature: '4/4', hits: { kick: [0, 7, 8], snare: [4, 12], close_hat: [0, 2, 4, 6, 8, 10, 12, 14] } },
  { id: 'pat_rock_1', name: 'Rock 1', bpm: 100, timeSignature: '4/4', hits: { kick: [0, 8], snare: [4, 12], close_hat: [0, 2, 4, 6, 8, 10, 12, 14] } },
  { id: 'pat_rock_2', name: 'Rock 2', bpm: 110, timeSignature: '4/4', hits: { kick: [0, 6, 8], snare: [4, 12], close_hat: [0, 2, 4, 6, 8, 10, 12, 14] } },
  { id: 'pat_rock_3', name: 'Rock 3', bpm: 110, timeSignature: '4/4', hits: { kick: [0, 3, 8, 10], snare: [4, 12], close_hat: [0, 2, 4, 6, 8, 10, 12, 14], open_hat: [14] } },
  { id: 'pat_rock_4', name: 'Rock 4', bpm: 120, timeSignature: '4/4', hits: { kick: [0, 4, 8, 12], snare: [4, 12], close_hat: [0, 2, 4, 6, 8, 10, 12, 14], crash: [0] } },
  { id: 'pat_rock_5', name: 'Rock 5', bpm: 100, timeSignature: '4/4', hits: { kick: [0, 7, 10], snare: [4, 12], ride: [0, 2, 4, 6, 8, 10, 12, 14] } },
  { id: 'pat_rock_6', name: 'Rock 6', bpm: 140, timeSignature: '4/4', hits: { kick: [0, 2, 8, 10], snare: [4, 12], close_hat: [0, 2, 4, 6, 8, 10, 12, 14] } },
  { id: 'pat_rock_7', name: 'Rock 7', bpm: 110, timeSignature: '4/4', hits: { kick: [0, 8, 11], snare: [4, 12, 15], close_hat: [0, 2, 4, 6, 8, 10, 12, 14] } },
  { id: 'pat_rock_8', name: 'Rock 8', bpm: 110, timeSignature: '4/4', hits: { kick: [0, 6, 8, 14], snare: [4, 12], open_hat: [2, 6, 10, 14], close_hat: [0, 4, 8, 12] } },
  { id: 'pat_rb_slap', name: 'Rockabilly Slap', bpm: 176, timeSignature: '4/4', hits: { kick_dry: [0, 4, 8, 12], snare: [4, 12], snare_stick: [2, 6, 10, 14], ride: [0, 3, 4, 7, 8, 11, 12, 15] } },
  { id: 'pat_rb_bounce', name: 'Rockabilly Bounce', bpm: 186, timeSignature: '4/4', hits: { kick_dry: [0, 6, 8, 14], snare: [4, 12], close_hat: [0, 3, 4, 7, 8, 11, 12, 15] } },
  { id: 'pat_rb_wild', name: 'Rockabilly Wild', bpm: 196, timeSignature: '4/4', hits: { kick: [0, 4, 8, 12], snare: [4, 12, 14, 15], crash: [0], ride: [0, 2, 4, 6, 8, 10, 12, 14] } },
  { id: 'pat_metal', name: 'Modern Metal', bpm: 145, timeSignature: '4/4', hits: { kick_dry: [0, 2, 3, 6, 8, 10, 11, 14, 15], snare: [4, 12], crash: [0, 8], ride: [2, 4, 6, 10, 12, 14], tom_low: [15] } },
  { id: 'pat_mathcore', name: 'Mathcore 5/4', bpm: 158, timeSignature: '5/4', hits: { kick_dry: [0, 3, 4, 7, 10, 12], snare: [2, 6, 9, 13], crash: [0, 7], open_hat: [4, 11], rimshot: [5, 12] } },
  { id: 'pat_sample_1', name: 'Sample 1', bpm: 90, timeSignature: '4/4', hits: { kick_boom: [0, 7, 10], snare: [4, 12], close_hat: [0, 2, 4, 6, 8, 10, 12, 14], shaker: [1, 3, 5, 7, 9, 11, 13, 15] } },
  { id: 'pat_sample_2', name: 'Sample 2', bpm: 100, timeSignature: '4/4', hits: { kick_boom: [0, 3, 10], clap: [4, 12], close_hat: [0, 2, 4, 6, 8, 10, 12, 14], cowbell: [2, 11] } },
  { id: 'pat_sample_3', name: 'Sample 3', bpm: 120, timeSignature: '4/4', hits: { kick: [0, 4, 8, 12], clap: [4, 12], open_hat: [2, 6, 10, 14], tambourine: [0, 4, 8, 12] } },
  { id: 'pat_sample_4', name: 'Sample 4', bpm: 100, timeSignature: '4/4', hits: { kick_boom: [0, 6, 9], rimshot: [4, 12], maracas: [0, 2, 4, 6, 8, 10, 12, 14], bongo_low: [3, 11], bongo_high: [7, 15] } },
  { id: 'pat_ska_1', name: 'Ska 1', bpm: 168, timeSignature: '4/4', hits: { kick: [0, 6], snare: [4, 12], close_hat: [0, 2, 4, 6, 8, 10, 12, 14], clap: [1, 3] } },
  { id: 'pat_ska_2', name: 'Ska 2', bpm: 168, timeSignature: '4/4', hits: { kick: [0, 4, 8, 12], snare: [4, 12], open_hat: [2, 6, 10, 14], close_hat: [0, 4, 8, 12], rimshot: [2, 6, 10, 14] } },
  { id: 'pat_swing_1', name: 'Swing 1', bpm: 111, timeSignature: '4/4', hits: { kick: [0, 8], snare_brush: [4, 12], ride: [0, 3, 4, 7, 8, 11, 12, 15], close_hat: [4, 12] } },
  { id: 'pat_swing_2', name: 'Swing 2', bpm: 111, timeSignature: '4/4', hits: { kick: [0, 4, 8, 12], snare_brush: [2, 4, 10, 12], ride: [0, 3, 4, 7, 8, 11, 12, 15] } },
  { id: 'pat_swing_3', name: 'Swing 3', bpm: 168, timeSignature: '4/4', hits: { kick: [0, 8], snare: [4, 12], ride: [0, 3, 4, 7, 8, 11, 12, 15], open_hat: [7, 15] } },
];
