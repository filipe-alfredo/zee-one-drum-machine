# Sequencer

## Architecture

| File | Responsibility |
| --- | --- |
| `sequencer/clock.js` | Lookahead scheduler; converts AudioContext time into step numbers |
| `sequencer/sequencer.js` | Starts/stops playback, selects the pattern or arrangement source, applies mixer rules, schedules sounds for runtime tracks |
| `sequencer/arrangement.js` | Loop lanes, blocks, limits, step mapping, and notes at each timeline step |
| `sequencer/pattern.js` | Step counts, beat grouping, step duration, signature validation messages, grid transformations |
| `sequencer/factory-patterns.js` | The 24 shipped patterns as readable hit lists |
| `sequencer/mixer.js` | Visibility, mute/solo, and volume rules |
| `ui/grid.js` | Renders visible tracks/steps, handles pad edits and playhead display |
| `ui/loop-panel.js` | Renders the bottom timeline, block drag/drop, Loop Mode, and loop export action |
| `ui/patterns-panel.js` | Group/pattern sidebar, search, CRUD dialogs, hidden-track detection |
| `state/app-state.js` | Derives runtime tracks, maps legacy pattern rows, restores missing synth tracks, stores volumes |
| `ui/modals.js` | Confirm dialog with independent cancel label/callback |

`SchedulerClock` is created by `Sequencer` with four callbacks: current audio time, step duration, total steps, and `onStep`. The clock knows nothing about instruments, tracks, or UI.

## Timing and clock

The dropdown offers seven fixed quarter-note presets: `2/4`, `3/4`, `4/4`, `5/4`, `6/4`, `8/4`, and `12/4`. The sequencer uses a 16th-note grid with four steps per beat, capped at 128 steps. There is no custom `N/D` input and no legacy 6/8 or 7/8 timing.

| Signature | Grid steps | Beat group size | Step duration formula |
| --- | ---: | ---: | --- |
| 2/4 | 8 | 4 | `(60 / bpm) / 4` |
| 3/4 | 12 | 4 | `(60 / bpm) / 4` |
| 4/4 | 16 | 4 | `(60 / bpm) / 4` |
| 5/4 | 20 | 4 | `(60 / bpm) / 4` |
| 6/4 | 24 | 4 | `(60 / bpm) / 4` |
| 8/4 | 32 | 4 | `(60 / bpm) / 4` |
| 12/4 | 48 | 4 | `(60 / bpm) / 4` |

Invalid values are rejected without changing the grid or the saved signature. `getTimeSignatureError()` from `sequencer/pattern.js` returns a short message that simply lists the available presets; it no longer describes `N/D` rules.

Scheduling parameters: 25 ms wake-up interval, 120 ms scheduling horizon, 105 ms initial delay. Audio times come from `AudioContext.currentTime`; JavaScript timers only wake the scheduler and update visuals.

## Bottom loop arrangement

The panel at the bottom of the page is a fixed 16th-note timeline: **16 steps per bar**, independent BPM (40–240, default 100), and 1–32 bars (default 8). Each lane holds blocks `{ id, patternId, startBar, lengthBars }`; a block repeats its pattern once per covered bar, mapping the pattern's own steps proportionally onto the 16 timeline steps (for example, an 8-step pattern uses every other timeline step). Patterns stay short and reusable; editing one updates every block that references it.

- Up to 8 lanes and 16 bars per block. Blocks may be placed by clicking an empty cell, dragged to another lane/bar, selected, and deleted with the button, **Delete**, **Backspace**, or double-click. Blocks cannot overlap in the same lane; a covered cell selects the existing block instead of adding another.
- `normalizeArrangement()` drops unknown pattern ids, regenerates duplicate ids, clamps values, and resolves overlaps by keeping the earliest block. Shortening the loop trims or removes blocks that no longer fit.
- **Loop Mode** makes the arrangement the playback source (`getScheduleSource()`), so the active pattern remains editable but does not play along. Turning Loop Mode on/off stops playback first; the next Play starts at bar 1 of the chosen source.
- The loop playhead highlights the current bar on the timeline. The active pattern grid keeps its own playhead only when Loop Mode is off.
- The panel and the File menu both expose **Export Loop Arrangement (.wav)**, rendered from the same timeline notes and mixer rules as live playback.

## BPM and swing

- BPM range is 40–240 via slider or numeric field. `clampBpm()` parses integers and falls back to 100.
- BPM is stored per pattern; changing patterns changes tempo with the pattern. The selected pattern's BPM badge updates on change.
- **Swing is not implemented.** The patterns named `Swing 1/2/3` are factory pattern names with swung-style note placement, not a global groove/shuffle control.

## Patterns and steps

- A pattern has `{ id, groupId, name, bpm, timeSignature, grid }`. `grid` maps a **row key** to a boolean array of length `steps`; factory patterns use legacy instrument IDs, while imported kit rows may use sample IDs.
- `buildGridFromHits()` converts the compact `hits` lists in `factory-patterns.js` into that grid; `normalizeGrid()`/`resizeGrid()` pad or truncate rows when importing or changing time signature; `cloneGrid()` gives copies independent arrays. Unknown row keys are preserved.
- Changing the time signature resizes the active pattern's grid in place, retaining steps that still exist and dropping steps beyond the new length. An existing step is never silently moved.
- `state.trackPatternKeys` is the set of row keys the current kit can play. The first sample carrying a legacy instrument claims that instrument's row; duplicate/unmapped samples use their own sample id as row key.
- Selecting a pattern calls `syncPatternTracks()`: legacy rows with active notes get a synth track when no sample claims them. **Visibility is never changed automatically.** A hidden track stays hidden and silent.
- Before selecting, `getHiddenTracksForPattern()` returns hidden tracks with at least one active note in that pattern. `app.afterPatternSelected()` then opens a dialog: **Restore Tracks** reveals exactly those rows, while **Keep As Is** leaves them hidden and silent during playback and WAV export.
- The sidebar supports group collapse/hide, search, new/rename/delete group, new/rename/duplicate/delete pattern, and hidden-group toggling. The factory group cannot be deleted; deleting a group moves its patterns to another group. Deleting the last pattern is rejected.
- Every edit notifies the workspace-file controller. Nothing is written until a workspace file is saved/opened; while that file is active, changes are debounced back to it. “Clear All” empties only the active grid and offers Undo via the toast; it does not remove tracks. “Hide All” hides every track (notes preserved) and also offers Undo.
- Importing a ZIP replaces the kit and clears the active pattern's grid, so imported samples start with an empty pattern. The pattern name, BPM, signature, and other patterns are untouched.

## Playback lifecycle

1. **Start**: `app.togglePlayback()` increments a request token, then `Sequencer.start()` awaits `AudioEngine.ensureStarted()` and starts the clock only if no clock is already running. The token prevents a late start from overriding a subsequent Stop.
2. **Scheduling**: each clock tick asks `getScheduleSource()` for the total steps, step duration, and notes at that step. With Loop Mode off the source is the active pattern; with it on, `getArrangementNotesAtStep()` returns every pattern/step pair active on that timeline step. For each runtime track with an active pad at `pattern.grid[track.patternKey]`, `isChannelAudible()` checks visibility, mute and solo; the step time is `max(currentTime, stepTime)`, then the sample or synth is rendered through the track gain into the master gain.
3. **Visuals**: a delayed callback updates `.step-pad.playhead`, the LED pips, the loop bar highlight, and the transport button. The generation counter prevents stale playheads after restart, source switches, or time-signature changes (`ensureValidStep()`).
4. **Stop**: `Sequencer.stop()` clears the interval, bumps the generation, resets the playhead to step 0, and the transport returns to its idle state. The AudioContext stays ready for the next start.
5. **Pattern/selection changes** while playing read the current `state.activePattern` at each scheduled step, so edits take effect on the next loop.

## Grid interaction

- Each visible track row has an audition button, mute (`M`), solo (`S`), a 0–100% volume slider, and step pads. The pad state writes straight to `state.setStep()`.
- Auditioning uses the same per-track volume as scheduled playback and is silent when the context cannot start (an error toast is shown). The Tracks dialog has a ▶ button per drum piece that uses the same audition path.
- The header shows the active pattern name and step count; a 0-track empty state offers kit presets.
- Track visibility presets: Standard (8), Metal/Rock (11), All (all current tracks), Hide All. They work on runtime track ids, falling back to legacy instrument ids, so imported rows can be shown/hidden too. Visibility is stored in the same workspace file as note data.
- Keyboard shortcuts are handled in `ui/controls.js`: Space toggles play/stop and C clears all steps, except while an input/select/textarea or editable element is focused.

## Validation

See [VALIDATION.md](VALIDATION.md) for the recorded browser regression checks and the focused Node tests covering timing formulas, grid transformations, arrangement limits/normalization/CRUD/step mapping, state CRUD, dynamic tracks and import, mixer rules (including hidden tracks and volumes), filename matching, and WAV encoding.
