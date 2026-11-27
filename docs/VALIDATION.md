# Validation report

Validation was performed after the refactor, the dynamic-track kit change, and the latest feature updates against a pristine baseline worktree containing the original single-file application (`git` baseline commit `dbdb8a5`). The app was served over HTTP (refactor on port 8765, baseline on 8766) and driven in headless Microsoft Edge through the Chrome DevTools Protocol. All validation servers are started and stopped by `run-all.mjs`; no server is left in `LISTENING` state.

Native file pickers cannot be automated in headless Edge, so persistence harnesses inject a small page-level stub for `showSaveFilePicker`, `showOpenFilePicker`, and IndexedDB. The stub writes to `sessionStorage`, which lets harnesses verify file names, overwrite behavior, and reload flows without touching real user files. Each harness launches Edge on a dynamically chosen debugging port so a new run cannot attach to a previous browser that is still shutting down.

## Automated results

| Check | Result |
| --- | --- |
| `node --check` on every `src/**/*.js`, `tests/**/*.js` and `electron/*.cjs` file | All 45 files pass |
| `npm test` (focused Node tests, including save-target bridge) | **57/57 passed** |
| Baseline browser regression harness | **25/25 passed** |
| Extended browser harness (checkbox draft, sample removal/Undo) | **16/16 passed** |
| Kit import wizard harness | **15/15 passed** |
| Fixed time signature harness | **10/10 passed** |
| Feature updates harness (grid volumes, Tracks preview + hidden tracks) | **10/10 passed** |
| Loop panel harness (blocks, drag, Loop Mode, WAV, three collapse rails, sidebar layout and eye toggle) | **15/15 passed** |
| Workspace file persistence harness | **11/11 passed** |
| Workspace actions harness (New chooser, named WAV export) | **7/7 passed** |
| Electron smoke + Windows build | Source shell and packaged `app.asar` load; NSIS installer + portable `.exe` generated in `dist/` |
| Visual/computed-style comparison at 1440×900 | **0 computed-style differences, 0 / 1,296,000 changed pixels** |
| Bundled font loading (Inter, JetBrains Mono, Orbitron, Rajdhani) | All four loaded locally on both pages |
| Local WAV fixture decoding | Two fixtures decoded at 44.1 kHz |
| Console/runtime errors | None in any browser run |

The Node tests cover fixed-preset step counts and timing formulas, the short time-signature error message, grid transforms with arbitrary row keys, workspace defaults/normalization (including the v2 `kits` schema and legacy v1 upgrades), BPM/volume clamping, pattern/group CRUD, loop arrangement defaults/normalization/limits/CRUD/overlap handling/step mapping and workspace persistence, change notification and factory reset, mute/solo/visibility/volume rules, dynamic track derivation, kit replacement/clearing and duplicate labels, hidden-track detection and restoration, synth restoration for factory patterns, free-label instrument resolution, base64 sample-data round-trips and ZIP path sanitization, WAV filenames, 16-bit PCM WAV headers, CRC32, stored/deflated ZIP round-trips, and the legacy `kit.json` helpers.

## Browser regression coverage (baseline harness)

- Page load, 23 default synth tracks, 368 pads, 24 factory patterns, 2 groups, default Rock 1 / 16 steps / 100 BPM / 4/4.
- Pad toggle/restore, play/stop with scheduled audio and playhead reset.
- BPM and time-signature changes (including 12-step 3/4), mute, per-track volume, pattern selection.
- Tracks, kit, and help dialogs; workspace save and WAV export; decoding of bundled WAV fixtures.
- Reload always shows the startup dialog with a fresh 4/4 factory project; absence of console errors.

## Extended browser coverage

- Rapid repeated play/stop: exactly one `AudioContext`, idle transport, no stale playheads.
- Space toggles playback; C opens the Clear All confirmation and clears steps after confirmation.
- Clear All and **Hide Tracks** undo actions restore grid notes / 23 rows; hiding tracks never removes imported samples.
- Pattern create, duplicate, and delete through the sidebar.
- Tracks checkboxes build a local draft with no preset buttons: the grid keeps its rows while checkboxes change the dialog. **Apply** commits 8, 11, and 23 visible tracks in one step; **Cancel** discards the draft.
- **Assign File** decodes a WAV into the clicked track; a second assignment replaces the same sample instead of creating a selector or a new track. The saved workspace contains exactly one sample, id `kick`, with the second file's bytes.
- **Use Synth** on that row restores its built-in synth and Undo brings the sample back; **Unload All Samples** asks for confirmation, restores the 23-track synth kit, and Undo reinstates the exact kit and mixer maps.
- The Bulk Auto-Match button and hidden input were removed from the DOM.
- Valid workspace JSON import applies BPM and stops playback; invalid JSON is rejected without changing state.
- No runtime or console errors across the full session.

## Kit import coverage

- Wizard opens from the kit dialog; the old **Export Kit** button is now **Import Kit** and Bulk Auto-Match is gone.
- A deflated ZIP with nested folders is read without dependencies; audio entries in subdirectories are listed with sanitized relative paths and free-text inputs (no instrument `<select>`).
- With zero recognized labels the import is still enabled, and the status reads `5 file(s): 0 mapped, 5 as their own row(s).` with hints `→ faixa própria (sem legado)`.
- ▶ Play decodes and schedules a buffer source through the shared AudioEngine.
- Three typed labels (`kick 1`, `snare 1`, `snare 1`) resolve to Kick/Snare — including the duplicate — while two files remain unmapped; removing one file updates the status.
- Import stops playback, replaces the previous kit, clears the active pattern (12 active steps before, 0 after), and resets per-track volumes to 1 while keeping the master volume.
- The grid then has exactly four rows: `kick 1`, `snare 1`, `snare 1 (2)`, `mystery`. The kit dialog mirrors them with one sample each and no active-sample selector.
- The saved workspace contains four samples with `kits.version === 2`, `synthTracks: []`, `active: {}`, preserved ZIP folder paths, and base64 payloads. `instrumentId` is `kick`/`snare`/`snare`/empty.
- Selecting `Rock 2` adds only the missing `Close Hat` synth row: five rows and 13 notes. That synth track is saved with the pattern.
- **Open Last Workspace** restores all four samples, the synth row, and the 13 notes. No runtime or console errors occur.

## Time signature coverage

- Dropdown exposes only the seven fixed presets `2/4`, `3/4`, `4/4`, `5/4`, `6/4`, `8/4`, `12/4`; there is no Custom option or input.
- `2/4` produces 8 steps, `5/4` 20 steps, `8/4` 32 steps, and `12/4` 48 steps; each selection is written to the saved file and restored on reload.
- An invalid persisted value such as `9/9` falls back to `4/4` without a toast.
- All presets group four 16th notes per beat and use the same `(60 / bpm) / 4` step duration.
- `getTimeSignatureError()` returns a short message listing the presets rather than explaining `N/D`.
- Initial computed styles/layout and pixels remain identical to the baseline except for the intentional UI updates.

## Feature updates coverage

- Master volume starts at 85 % beside the time signature; its slider and numeric field move together and mark the box active when below 100 %.
- Changing master volume writes `globalVolume: 0.5` to the workspace file.
- The kit dialog has no volume sliders; all 23 Drum Grid rows have a `Vol` slider. Changing the first to 25 % updates its readout and saves `trackVolumes.kick = 0.25`.
- The Tracks dialog has one ▶ button per drum piece; clicking it previews that sample/synth without changing visibility or the local draft.
- The Kit Offset control and all global/per-track timing offsets are absent from the DOM and workspace data.
- Clearing the kit leaves zero visible rows. Selecting a pattern with notes on hidden tracks opens a dialog titled `Hidden Tracks in Pattern` with **Restore Tracks** / **Keep As Is**, naming the affected tracks and explaining that hidden rows are silent in playback and WAV export.
- Choosing **Keep As Is** keeps zero rows and schedules zero audio starts during playback.
- Choosing **Restore Tracks** reveals only the three hidden tracks that have notes in `Rock 1` (12 active pads) and schedules audio again.
- Restored visibility plus both saved volume values survive a save/reload cycle; no runtime or console errors occur.

## Loop panel coverage

- The bottom panel starts with four empty lanes, its own 100 BPM / 8-bar timeline, a loop-mode toggle, a File-menu loop export option, and a chevron inside its own toolbar.
- Setting the loop to 4 bars / 240 BPM, selecting `Rock 1`, and clicking an empty cell places a 2-bar block that is saved with the workspace.
- Clicking a covered cell selects the existing block instead of adding an overlapping one.
- Dragging moves a block to another lane/bar; the moved block and its saved coordinates are verified. The selected block is deleted through **Delete Block** and the removal is saved.
- With the active pattern at 40 BPM, pattern playback schedules 3 audio starts; with Loop Mode on, the arrangement schedules 24 starts with ~0.125 s spacing, highlights successive loop bars, and reports `Loop Mode: On`.
- Both the panel button and the File menu ask for a destination and write a valid `zeeone_loop_4bars_240bpm.wav` (RIFF/WAVE, 882,044 bytes) through the save chooser.
- The sidebar title and chevron share the top row (title left, chevron right), while + Group, + Pattern and the eye button stay together on one lower line; collapsing it leaves a 42 px rail containing only the chevron and widens the matrix from 505 px to 738 px. The eye toggles between open/closed icons, a dynamic label and `aria-pressed`. The top-bar chevron sits after the workspace status at the far right, hides the toolbar while keeping toggle/logo/File/Help; the loop chevron shrinks the bottom panel into a rail with only its own button and preserves Loop Mode. All three expand back and write no visual state into the workspace JSON.

## Workspace persistence coverage

- Startup shows the dialog with a fresh factory project and no remembered file; `localStorage` stays empty.
- **New Project** closes the dialog and keeps the 16-step grid.
- **Save Workspace** writes one JSON file through a writable handle and reports its name.
- A BPM change is written back to that same file (debounced) and updates the status to `Auto-Saved: ...`.
- Saving again does not create numbered duplicates such as `... (6).json`.
- **Save Workspace As…** picks another file; later auto-saves follow only the newly selected handle.
- After reload the startup dialog offers the last file instead of restoring it automatically; the visible BPM is still the factory `100`.
- **Open Last Workspace** reloads the saved BPM and reattaches the writable handle.
- No workspace JSON is downloaded to the Downloads folder and no runtime/console errors occur.

## Workspace actions coverage

- The first toolbar `.tb-btn` is `#btnNew`, placed before **Open**; File → New Workspace opens the same chooser and **Cancel** closes it without changes.
- **Blank Grid** leaves 0 rows / 0 pads but keeps all 24 factory patterns; **Default Kit** restores 23 synth rows and 368 pads.
- **Export Active Pattern** requests a destination before rendering and writes `zeeone_rock_1_100bpm.wav` with a RIFF/WAVE header and the reported file name in the toast.
- The File menu and loop panel both route WAV export through the same save chooser; no runtime or console errors occur.
- With neither the Electron bridge nor `showSaveFilePicker()` available, `requestSaveTarget()` rejects with a clear error and `writeSaveTarget()` refuses unsupported targets. No `<a download>` fallback exists, so exports can no longer create `... (2)`, `(3)` copies in `Downloads`.

## Electron desktop coverage

- `npm run electron:smoke` starts `electron/main.cjs`, serves the ES Modules from a random loopback port, loads the renderer and exits cleanly. The main process calls `Menu.setApplicationMenu(null)` before creating the window, so no native menu bar or menu buttons are drawn.
- The packaged renderer was smoke-tested with `npx electron dist/win-unpacked/resources/app.asar --smoke`, confirming the built app loads. A direct launch of the freshly rebuilt unsigned `.exe` is blocked by this machine's Application Control policy, so the source Electron binary was used to load the packaged archive instead.
- `npm run build:win` produced `dist/ZeeOne Drum Machine Setup 1.0.0.exe` and `dist/ZeeOne-Drum-Machine-Portable-1.0.0.exe`. No signing certificate is configured, so Windows signing is skipped.
- `electron/preload.cjs` exposes only `chooseSavePath()` and `writeFile()`; the chosen path is kept in a main-process request map and never returned to the renderer.

## Visual parity method

The comparison navigated both servers at the same viewport, captured computed styles and layout geometry for representative elements, and compared rendered screenshots. The refactored startup layer was hidden directly (without triggering a toast or status change) so only the long-lived UI was compared. The new master-volume toolbar box was hidden on the refactored page and the now-removed kit/global offset boxes were removed from the baseline page, since these are intentional changes. The new Drum Grid volume controls were hidden on the refactored page and the baseline offset controls removed, so the grid geometry still matches. The renamed `Mathcore 5/4` label was hidden on both pages. The new **New** button (`#btnNew`), the three collapse buttons (`#btnToggleSidebar`, `#btnToggleTopbar`, `#btnToggleLoopPanel`) and the bottom loop panel were removed from the comparison page so the first `.tb-btn` and the workspace geometry still match the baseline. The renamed **Hide Tracks** label was normalized back to **Clear Kit** for this long-lived layout comparison. Everything else was compared unchanged. Because `StartupDialog.open()` is asynchronous (it reads the last handle from IndexedDB), the harness waits for the `open` class, removes it, and applies an inline `display: none` so a late IndexedDB callback cannot reopen the layer. Result: identical computed styles/layout and a pixel diff of `0 / 1,296,000` pixels. Tracks and kit dialog lists are populated lazily on open, matching the original DOM shape at initial load.

## Corrected issues found during refactoring

- Extracted ~3,000 lines of inline CSS/JS from `index.html` into stylesheets and ES Modules.
- Added a favicon, removing the original `/favicon.ico` 404 request.
- Removed the remote Google Fonts dependency by bundling the four font families locally.
- Replaced `innerHTML` construction for user-controlled names/filenames with safe `textContent` DOM APIs.
- Removed `localStorage` auto-save; added an explicit startup dialog and file-based persistence with overwrite-in-place behavior.
- Remembered the last file handle in IndexedDB so **Open Last Workspace** works without a new picker.
- Guarded audio init, sample decode, WAV export, and file writes with error handling.
- Prevented duplicate AudioContext creation and duplicate scheduler timers on rapid play clicks; added a playback generation guard for stale visual updates.
- Stopped playback before workspace import/reset so an old pattern cannot keep playing under replaced state (small documented safety improvement).
- Fixed the hidden-modal DOM difference by lazily refreshing dialog lists only when open.
- Added a dependency-free ZIP reader/writer; `assets/drumkits/**` is gitignored and user sample files are left untouched on disk.
- Replaced ZIP export / `kit.json` installation with real in-app import: nested ZIP entries, free-form labels, one sample per dynamic track, and base64 sample bytes in the workspace.
- Removed Bulk Auto-Match and the multi-sample active selector; assignment now replaces one track's sample and ZIP import replaces the whole kit.
- Added unique suffixes for duplicate sample names, kept unmapped labels as playable rows of their own, and restored missing synth rows when factory patterns are selected.
- Replaced the custom time-signature input with seven fixed presets and a short error listing the accepted values.
- Stopped auto-revealing hidden tracks when a pattern is selected; the user now chooses **Restore Tracks** or **Keep As Is**, and hidden rows are silent in playback and export.
- Added master and per-track volume controls, persisted with the workspace and applied to playback, audition, and WAV export.
- Added a bottom FL-style loop arrangement with lanes, draggable pattern blocks, its own BPM/length, and persisted workspace data.
- Made the arrangement take over playback in Loop Mode while the selected pattern remains editable, and stopped playback when the source changes.
- Added WAV export for the whole arrangement from both the loop panel and the File menu, using the shared offline renderer and mixer rules.
- Added visual-only collapse buttons for the pattern sidebar, top toolbar and bottom loop panel; each lives inside its own panel, collapses to a rail with only that button visible, and writes no state to the workspace.
- Moved per-sample volume sliders from the kit dialog to every Drum Grid row, replaced custom time signatures with seven fixed presets and a short error, added ▶ preview buttons in the Tracks dialog, and removed the confusing Kit Offset controls entirely.
- Prevented cross-harness browser collisions by giving each headless Edge instance its own debugging port.
- Added a toolbar/File-menu **New** chooser for blank-grid or default-kit workspaces, distinct from the startup dialog.
- Changed both WAV exports to ask for folder and file name first, then write through Electron/native or File System Access APIs instead of silently downloading.
- Removed the silent `<a download>` fallback entirely: unsupported browsers now show an explicit save-API error instead of creating numbered duplicates in `Downloads`.
- Added an Electron main process with a random-port local server and a narrow native-save preload bridge, plus Windows installer/portable build scripts.
- Moved the **Patterns** title to the left with its collapse chevron at the far right, put the three pattern actions on their own line, replaced the Hidden label with an open/closed eye button, moved the top-bar chevron after the workspace status, and removed the four preset buttons from the Tracks dialog.

## Known limitations

- Time signatures are fixed quarter-note presets only; there is no custom `N/D` input and no legacy 6/8 or 7/8 subdivision.
- No swing control; “Swing” patterns are names only.
- The loop timeline is a fixed 16-step-per-bar grid: blocks repeat their pattern once per covered bar, with up to 8 lanes, 32 bars, and 16 bars per block; overlapping blocks in one lane are rejected.
- All three collapse states are visual only and reset on reload.
- No pan or effects chain; mixing is visibility, mute/solo, per-track gain, and master gain.
- Only one sample is stored per track; importing a ZIP replaces all tracks and clears the active pattern's steps. Individual samples can be removed with **Use Synth / Remove**, and the whole kit with **Unload All Samples**, both undoable.
- Workspace files with embedded samples can become large.
- Workspace write-back still requires Chrome/Edge or the Electron build; other browsers keep the JSON import fallback but cannot write back.
- Opening `index.html` directly via `file://` is blocked by ES Module CORS rules; use `npm start` or the Electron app.

## Electron status

Electron is now an enabled dev-tooling phase, not a future plan. The renderer remains browser-only, uses relative paths, has no remote resources, and does not import Node or Electron modules. `electron/main.cjs` supplies the local origin and native save dialogs; `electron/preload.cjs` exposes only a narrow save bridge. Windows artifacts were generated and smoke-tested. If sample files eventually move next to the workspace instead of living inside its JSON, `WorkspaceFileController` and the `kits.samples[].data` payload remain the natural seams.
