# Audio engine

## Web Audio implementation

`src/audio/audio-engine.js` owns the single live `AudioContext` for the page:

- The context is created lazily on the first user gesture (Play, pad audition, or sample load) via `ensureStarted()`. A pending `initialization` promise prevents duplicate contexts when several actions arrive at once.
- A suspended context (autoplay policy) is resumed before use. `resumeIfSuspended()` is called on every `ensureStarted()`.
- One master `GainNode` connects to `audioContext.destination`. Its value is `workspace.globalVolume` (default `0.85`) and can be changed at any time with `setMasterVolume()`, including before the context exists. There are **no** other persistent routing nodes, and no effects (no reverb/delay/filter chain).
- Every scheduled note creates a short-lived per-track `GainNode` (value from `workspace.trackVolumes[trackId]`, default `1`) connected to the master gain. It is disconnected after the sound ends (at least 2 s, or the sample duration + 0.5 s). This is the only per-note routing node.
- A shared two-second noise `AudioBuffer` (`createNoiseBuffer()` in `audio-utils.js`) is generated once and reused by noise-based instruments.
- The context is never closed during a session; Stop ends scheduling, not the context itself.

If `AudioContext`/`webkitAudioContext` is unavailable, `ensureStarted()` throws a descriptive error. `app.togglePlayback()` catches initialization errors and shows a toast instead of leaving the UI in a playing state.

## Volume model

| Setting | Storage | Range / default | Where it applies |
| --- | --- | --- | --- |
| Master volume | `workspace.globalVolume`, `AudioEngine.globalVolume` | 0–1, default `0.85` | Playback, audition, all export formats |
| Per-track volume | `workspace.trackVolumes[trackId]` | 0–1, default `1` | Playback, audition, all export formats |

- `clampVolume()` in `utils/helpers.js` is the single normalization rule: non-finite values use the fallback, other values are clamped to 0–1. `mixer.js` exposes `getGlobalVolume()` / `getChannelVolume()` so the pure mixer rules stay reusable in Node tests.
- The toolbar slider and numeric field are 0–100 %; the kit dialog has one `Vol` slider per row with a live percentage readout. Both are persisted with the workspace.
- Master changes call `AudioEngine.setMasterVolume()`, which updates the current gain node if the context is already running. Track changes are read by `Sequencer.scheduleEvent()` at the moment a note is scheduled; no node graph rebuild is needed.
- Volume does not affect mute/solo or visibility: a hidden track is never scheduled, and solo still takes precedence over mute for audible rows.

## Instrument synthesis

`src/audio/sample-player.js` implements all 23 legacy instruments procedurally with oscillators, noise bursts, gain envelopes, and short frequency sweeps. `renderInstrumentSound(context, destination, noiseBuffer, instrumentId, startTime, customBuffer)`:

- uses the supplied `customBuffer` in a `BufferSource` when one has been assigned to the track, otherwise runs the matching synthesis branch for `instrumentId`;
- clamps the start time with `Math.max(context.currentTime, startTime)`;
- schedules Web Audio nodes only — it never uses timers to produce sound.

Common patterns are combined in the switch statement (kick variants, snare variants, hats/cymbals, toms, percussion), keeping the original timbres and envelopes intact. A sample row with no legacy instrument plays only when its own buffer is available. The `destination` node is the per-track gain, so synthesis and samples follow the same volume path.

## Sample loading and caching

`KitManager` (`src/kits/kit-manager.js`) keeps a `samples` map keyed by **track id**: `trackId → { raw bytes, metadata, decoded AudioBuffer }`. There is no `active` map; one track holds at most one sample.

1. `KitPanel` opens a file input (`accept="audio/*"`) for **Assign File**, or opens the ZIP import wizard.
2. `KitManager.loadFile(track, file)` calls `audioEngine.ensureStarted()`, reads `file.arrayBuffer()`, decodes it with `audioContext.decodeAudioData()`, and stores the raw bytes (base64 data URL) plus buffer under `track.id`. The sample's `instrumentId` is the track's legacy hint. A second assignment to the same track replaces the first sample.
3. `KitImportDialog` decodes every audio entry in a ZIP, builds one sample per file, then calls `state.replaceKitSamples()` and `kitManager.replaceSamples()`. The old kit is discarded, playback is stopped, the active pattern is cleared, and per-track volumes are reset to `1` (master volume is preserved).
4. **Use Synth** calls `state.removeTrackSample()` and `kitManager.removeSample(trackId)`, restoring the built-in synth for that legacy instrument.
5. `clear()` / “Unload Custom Samples” empties the map, restores the default 23 synth tracks, and clears the workspace `kits` section.

The wizard's ▶ Play / ⏸ Pause preview uses the same `ensureStarted()` + `decodeAudioData()` path. `AudioEngine.play()` returns a short-lived handle for every note; `stopAudition(handle)` fades that one gain to zero and releases it, so preview buttons can interrupt long custom samples without stopping sequencer notes. A handle notifies `onEnded` after its buffer (or the short synth envelope) finishes, which restores the ▶ label automatically. Decoded buffers and raw bytes are kept in memory while the wizard is open and are applied to the live kit on **Import Kit**.

`AudioBuffer`s themselves are never serialized. `src/kits/sample-data.js` converts the original bytes to/from base64 data URLs, so `app.restoreKitSamples()` can rebuild the buffers after **Open Workspace / Open Last Workspace** by decoding `kits.samples[].data` and rekeying them by sample/track id. Samples that cannot be decoded are skipped with a summary toast.

## Playback scheduling

`Sequencer` uses `SchedulerClock` (`src/sequencer/clock.js`):

- `setInterval` fires every **25 ms** only to wake the scheduler; it never triggers sound directly.
- Each tick schedules all events whose AudioContext time is within **0.12 s** ahead (`scheduleAheadSec`), then advances to the next repeat of the cycle.
- The first event starts **0.105 s** after `start()` (`startDelaySec`), leaving headroom for scheduling.
- Events come from the active source. The active pattern and the picker preview emit 16th steps with `(60 / bpm) / 4` duration. The loop emits one event per step of every painted block: a beat on row *r* lasts `60 / row.bpm` seconds and a step is one quarter of that beat, so an 8/4 row uses all 32 steps and rows at different BPMs can drift.
- For each event, `scheduleEvent()` walks `state.tracks`, reads `pattern.grid[track.patternKey]` at `event.stepIndex`, applies **visibility** first, then mute/solo rules, reads the track gain, clamps the audio time to `currentTime`, and calls `audioEngine.play(track.id, time, buffer, track.legacyInstrumentId, trackVolume)`. Tracks without a buffer or a legacy instrument are skipped.
- `isChannelAudible()` checks `visibleTracks[trackId] === false` before evaluating solo/mute, so a hidden track stays silent even if it is soloed.

A `setTimeout` is used only to align the visual playhead with the scheduled audio time. A `playbackGeneration` counter discards visual updates from a previous playback after Stop/Start, and `Sequencer.start()` re-checks `isPlaying` after the asynchronous `AudioContext` setup so rapid double-clicks cannot create two timers.

## Offline render and export encoders

`src/audio/wav-export.js` uses one shared `OfflineAudioContext` renderer for both exports:

- stereo, 44.1 kHz, duration = `cycle events + 1 s` tail;
- an absolute `events[]` array supplies `{ time, stepIndex, pattern }`: 16th steps for **Export Active Pattern**, or `getArrangementEvents()` for **Export Loop Arrangement** (every painted block at its row BPM in one cycle);
- the same master gain (from `getGlobalVolume(workspace)`), per-track gain (from `getChannelVolume()`), visibility, and mute/solo rules as live playback, using the runtime `tracks` and buffers keyed by track id;
- the resulting `AudioBuffer` is handed to `src/audio/export-audio.js`, which applies the loop's silent-tail crop (`trimAudioBuffer()`) before choosing an encoder.

`defaultTracks()` is only a fallback for the 23 legacy instruments when no runtime tracks are supplied (for example in unit tests).

The format modal in `src/ui/export-format-dialog.js` selects one of three encoders; see [EXPORT_FORMATS.md](EXPORT_FORMATS.md) for the full rationale:

- **WAV**: `encodeWavBlob()` writes 16-bit stereo PCM at 44.1 kHz immediately.
- **M4A**: `MediaRecorder` records the rendered buffer into a live `AudioContext` as `audio/mp4;codecs=mp4a.40.2`; the recorder is stopped by `sourceNode.onended`, and progress is shown in a toast.
- **MP3**: the lazily imported LAME module converts both channels to 16-bit PCM and encodes them at 192 kbps.

File stems keep the previous shape — `zeeone_<pattern>_<bpm>bpm` and `zeeone_loop_<rows>rows_<beats>beats` — with the extension following the chosen format.

Export errors (missing pattern/arrangement, unsupported `OfflineAudioContext`, unsupported M4A recorder, decode/render failure) are caught in `app.exportAudio()` and reported via toast. `app.exportWav()` and `app.exportLoopWav()` remain as direct WAV wrappers.

## Known limitations

- Solo takes precedence over mute; visibility takes precedence over both: hidden rows never sound.
- Note starts are not shifted by per-track or global timing controls.
- Loop rows with different BPMs intentionally drift: each row converts its painted timeline beats with its own tempo instead of being quantised to one global clock.
- Audio times above/below timing boundaries are clamped to `currentTime` at scheduling time, so a very late step may play immediately rather than in the past.
- Only one sample per track is stored; assigning a new file replaces the old one.
- There is no pan or effects chain; mixing is visibility, mute/solo, per-track gain, and master gain.
- M4A encoding runs in real time, so a long exported loop takes roughly its own duration. MP3 uses a vendored LGPL encoder loaded only on demand.
