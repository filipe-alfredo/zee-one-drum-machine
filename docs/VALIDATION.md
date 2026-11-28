# Validation report

Validation was performed after the refactor, the dynamic-track kit change, the resizable-panel/row-order additions, the Loop Arrangement redesign (vertical pattern rows, painted beat cells, and per-row BPM), the preview/visual refinements, the final maximized-Electron/loop-toolbar polish, the WAV/M4A/MP3 export-format modal, the active-factory-pattern restore button, the grip-only Drum Grid reorder fix, and the no-picker download fallback against a pristine baseline worktree containing the original single-file application (`git` baseline commit `dbdb8a5`). The app was served over HTTP (refactor on port 8765, baseline on 8766) and driven in headless Microsoft Edge through the Chrome DevTools Protocol. All validation servers are started and stopped by `run-all-status.mjs`; no server is left in `LISTENING` state.

Native file pickers cannot be automated in headless Edge, so persistence harnesses inject a small page-level stub for `showSaveFilePicker`, `showOpenFilePicker`, and IndexedDB. The stub writes to `sessionStorage`, which lets harnesses verify file names, overwrite behavior, and reload flows without touching real user files. Each harness launches Edge on a dynamically chosen debugging port so a new run cannot attach to a previous browser that is still shutting down.

## Automated results

| Check | Result |
| --- | --- |
| `node --check` on every `src/**/*.js`, `tests/**/*.js`, `scripts/*.mjs` and `electron/*.cjs` file | All 57 files pass |
| `npm test` (focused Node tests, including the maximized Electron shell, icon bundle, native workspace path bridge, save-target bridge and no-picker download fallback, loop rows/blocks, saved row order, cropped WAV encoding, format descriptors, real MP3 frames and active factory restore with Undo) | **85/85 passed** |
| Baseline browser regression harness (including polished flat toolbar buttons, crisp grid pads, softened BPM badges and slot-safe pad borders) | **29/29 passed** |
| Extended browser harness (checkbox draft, sample removal/Undo) | **16/16 passed** |
| Kit import wizard harness | **16/16 passed** |
| Fixed time signature harness | **10/10 passed** |
| Feature updates harness (grid volumes, Drum Kit/Tracks compact play/pause previews + hidden tracks) | **13/13 passed** |
| Loop panel harness (pattern picker with preview, 32-beat grid, continuous orange-dominant painted blocks, overlap, per-row BPM, clear modals, per-row playback, cropped WAV, graphite/red Loop Mode states, all action buttons beside the right-aligned collapse/maximize controls, orange title accent, collapse from maximized, sidebar layout and eye toggle) | **25/25 passed** |
| Workspace file persistence harness | **11/11 passed** |
| Workspace actions harness (New chooser, named WAV export) | **7/7 passed** |
| Export formats harness (modal options/descriptions, cancel and Escape, WAV/M4A/MP3 file headers and save-dialog metadata, cropped loop MP3) | **9/9 passed** |
| No-picker fallback harness (startup Open via file input, workspace JSON blob download, WAV blob download, no runtime errors) | **5/5 passed** |
| Active factory restore harness (enabled only for factory patterns, confirmation, steps/BPM/signature restored, grid rows unchanged, Undo) | **7/7 passed** |
| Resize + row-order harness (sidebar/loop and kit-name dividers, click-to-fit, keyboard, grip-only drag/drop, volume-drag rejection, saved order) | **21/21 passed** |
| Electron smoke + Windows build | Source shell and packaged `app.asar` load with the ZeeOne icon and native workspace bridge; maximized startup asserted in Node; NSIS installer + portable `.exe` generated in `dist/` |
| Visual/computed-style comparison at 1440×900 | **0 computed-style differences, 0 / 1,296,000 changed pixels** |
| Bundled font loading (Inter, JetBrains Mono, Orbitron, Rajdhani) | All four loaded locally on both pages |
| Synthetic WAV fixture decoding | Two generated 44.1 kHz PCM fixtures decoded by the browser; no dependency on `assets/drumkits/**` |
| Console/runtime errors | None in any browser run |

The browser harnesses generate their own WAV bytes in-page and never read, copy or recreate `assets/drumkits/**`. That folder remains local user content, is gitignored and is excluded from any published or packaged output.

The Node tests cover fixed-preset step counts and timing formulas, the short time-signature error message, grid transforms with arbitrary row keys, workspace defaults/normalization (including the v2 `kits` schema with `trackOrder` and legacy v1 upgrades), BPM/volume clamping, pattern/group CRUD, active factory-pattern restore with snapshot Undo and no kit/visibility changes, loop grid defaults/normalization/legacy migration/limits, painted-block duration, timeline growth, per-row BPM events, clear and row CRUD, workspace persistence, change notification and factory reset, mute/solo/visibility/volume rules, dynamic track derivation, kit replacement/clearing and duplicate labels, hidden-track detection and restoration, synth restoration for factory patterns, saved row reordering (normalization, Undo and unchanged pattern keys), free-label instrument resolution, base64 sample-data round-trips and ZIP path sanitization, pattern/loop WAV filenames, 16-bit PCM WAV headers (including a partial frame count for a cropped loop tail), CRC32, stored/deflated ZIP round-trips, the legacy `kit.json` helpers, the Electron shell order (`show: false` → `maximize()` → `show()` with no native menu), its multi-size icon bundle, and the Electron workspace bridge (native Save/Open, remembered path, native-path auto-save and Open Last after restart, all driven by virtual in-memory paths), and the no-picker workspace/export download fallback.

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
- The compact ▶ button decodes and schedules a buffer source through the shared AudioEngine; it becomes ⏸, clicking it restores ▶ without scheduling more audio, and the handle fades out only that sample. Its accessible label still says `Play`/`Pause <file>`.
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
- The kit dialog has no volume sliders; all 23 Drum Grid rows have a `Vol` slider. Changing the first to 25 % updates its readout and saves `trackVolumes.kick = 0.25`. Its old text **Preview** buttons are now 20 px icon-only ▶/⏸ controls that stop on close.
- The Tracks dialog has one ▶/⏸ button per drum piece; clicking it previews that sample/synth without changing visibility or the local draft. Starting a second preview stops the first, clicking the active button pauses it without scheduling new audio, clicking again resumes, and closing the dialog stops it.
- The Kit Offset control and all global/per-track timing offsets are absent from the DOM and workspace data.
- Clearing the kit leaves zero visible rows. Selecting a pattern with notes on hidden tracks opens a dialog titled `Hidden Tracks in Pattern` with **Restore Tracks** / **Keep As Is**, naming the affected tracks and explaining that hidden rows are silent in playback and WAV export.
- Choosing **Keep As Is** keeps zero rows and schedules zero audio starts during playback.
- Choosing **Restore Tracks** reveals only the three hidden tracks that have notes in `Rock 1` (12 active pads) and schedules audio again.
- Restored visibility plus both saved volume values survive a save/reload cycle; no runtime or console errors occur.

## Resize and row-order coverage

- The sidebar and loop dividers start at the default CSS sizes; dragging the sidebar divider right by 60 px changes only `--sidebar-width` to `375px`, and dragging the loop divider up by 40 px changes only `--loop-height` to `216px` (the loop panel grows toward the top).
- The Drum Grid name column starts at `320px` (280 px below 860 px) so all factory names fit without clipping. Each header has a visible zero-width grip: dragging it right by 60 px widens all headers and the LED bar together to `380px` and grows the name area from 138 px to 198 px; a click or `Enter` fits a custom long name (420 px in the harness), double-click restores `320px`, arrow keys step to `330px`, and `Home` resets. `aria-valuenow` follows the shared size.
- Double-click restores each divider (`315px` / `176px`); focused arrow keys step by 10 px in the panel's natural direction (Shift uses 40 px), and `Home` resets. The collapsed state blocks dragging.
- Neither divider nor the kit-name handle writes to the workspace JSON: the saved file contains no `315px`, `176px` or `320px` visual sizes, matching the collapse behavior.
- A synthetic drag from the first Drum Grid grip (⠿) onto the third row shows a visible orange `drop-after` inset shadow, moves the row, and saves the new `kits.trackOrder` while leaving every pattern grid byte-for-byte unchanged. A synthetic drag from the volume slider sets no private drag type, shows no drop indicator and leaves the row order unchanged; the resized name handle likewise does not start a row reorder.
- All 20 checks run with no console or runtime errors. The Node state tests additionally verify normalization, Undo, legacy workspaces without `trackOrder`, and rejection of unknown/self moves.

## Loop panel coverage

- The bottom panel starts with an empty 32-column beat grid (`0 rows • 0 blocks • 0 beats`), **+ Pattern**, a loop-mode toggle, a File-menu loop export option, and a chevron inside its own toolbar. The old pattern selector, global BPM field and **Remove Pattern** button are absent; no Bars, Loop bars or Lane control exists.
- **+ Pattern** lists all 24 workspace patterns with ✓/⏸ preview buttons and an `Add Selected` action disabled until at least one checkbox is ticked. Clicking ▶ starts audio and switches to ⏸; clicking again stops it and restores ▶ without scheduling further starts.
- Selecting `Rock 2` (4/4, 110 BPM) and `Mathcore 5/4` (158 BPM) creates two silent vertical rows with those inherited BPMs and 64 empty cells. Painting beat 1 of the first row fills 4 cells and renders one 88 px strip; painting beat 9 of the second fills 5 cells and renders one 110 px strip at 176 px, for `2 rows • 2 blocks • 13 beats`. The strip gradient is orange-dominant (`#ff9a24` → `#ff7a00` → `#e84b00` → `#a82806`): no pale highlight and no burgundy base. Clicking a painted cell removes its whole strip/block.
- Each row keeps an editable BPM (`240`, `120` in the harness), rows may overlap at beat 1, and the values plus both blocks survive save/reload with no global `arrangement.bpm`.
- **Loop Mode** is a real two-state control: off is graphite (`#19191d`) with a gray dot, on is a muted red tint (`rgba(220, 38, 38, 0.16)`) with a `#dc2626` dot, `aria-pressed` follows the state, and the title explains the next action. Playback with it on schedules audio from both painted rows, highlights both active blocks at the start and then only the longer 5/4 row, and reports `Loop Mode: On`.
- Both the panel button and the File menu ask for a destination and write a valid `zeeone_loop_2rows_5beats.wav` (RIFF/WAVE) through the save chooser. The loop renderer keeps the last audible frame plus a 20 ms guard and encodes only that prefix, so the exported cycle is about 1.85 s / 325 KB instead of the old ~3.5 s / 617 KB with a silent tail; both export paths produce the same cropped audio. **Clear Loop** offers `Cancel`, `Clear cells` and `Clear rows and cells` with an explanation that workspace patterns are never deleted; the first action keeps rows/BPM and the second restores the 32-beat empty grid.
- The main toolbar keeps its 66 × 52 px geometry but uses near-flat dark panels (`#1f1f24`) with neutral `#34343d` borders, a 1 px highlight and a soft shadow. Orange is reserved for state: hover, `:focus-visible`, `:active` and the `active-playing` playback style; no permanent top accent or metallic texture remains. Save alone is the primary action (soft `rgba(255, 107, 0, 0.14)` fill and bright icon), New/Open stay neutral with orange icons, and Clear All/Stop are muted with gray icons.
- Pattern BPM badges changed from solid `--orange-primary` to a discreet `#19191d` graphite pill with a `#aeb4bd` label, `var(--border-subtle)` outline and weight 600. The selected pattern only gets a faint orange-tinted border, so the list no longer competes with the grid.
- Active grid pads keep the orange-dominant 3D gradient but dropped the outer `0 0 8px` / `0 0 12px` blur. Their top/right border uses the loop block's crisp `rgba(255, 160, 60, 0.9)` (2 px on beat dividers, `#ffb347` while playing), while the left/bottom edges are drawn as inset shadows so the pad keeps the same outer width as its slot; the harness confirms active and inactive cells are identical widths and no columns shift.
- The sidebar title and chevron share the top row (title left, chevron right), while + Group, + Pattern and the eye button stay together on one lower line; collapsing it leaves a 42 px rail containing only the chevron at the top and widens the matrix. The eye toggles between open/closed icons, a dynamic label and `aria-pressed`. The top-bar chevron sits after the workspace status at the far right, hides the toolbar while keeping toggle/logo/File/Help; the loop chevron shrinks the bottom panel into a 40 px rail with only its own button aligned at the far right and preserves Loop Mode. All three expand back and write no visual state into the workspace JSON.
- The loop toolbar shows a 3 px × 14 px `rgb(255, 107, 0)` accent line before **Loop Arrangement**. **Loop Mode**, **+ Pattern**, **Clear Loop** and **Export Loop** are grouped at the far right immediately beside maximize and the chevron (gap ≤ 12 px), with maximize immediately to the left of the chevron and the whole group within 12 px of the toolbar edge.
- Maximizing sets `body.loop-maximized`, hides `.workspace` and the horizontal splitter, grows the panel by more than 200 px over the patterns/grid area, swaps maximize/restore icons, and changes the label to `Restore the loop arrangement`. Clicking again restores the original height and workspace. Collapsing from the maximized state restores first and then enters rail mode; the maximize button is hidden in that rail.

## Electron startup coverage

- `tests/electron-shell.test.js` reads `electron/main.cjs` and asserts that the native menu is removed, the window is created with `show: false`, and `maximize()` happens after `ready-to-show` but before `show()`. This keeps the full-screen start verifiable without opening a visible desktop window in CI.
- The renderer still has no Node/Electron imports; the maximize behavior lives only in the shell and the loop maximize toggle stays a visual-only body class.
- `assets/icons/favicon.svg` is rasterized to a multi-size `app-icon.ico` (16–256 px) used by the window, installer and portable build, with a copy in `resources/` outside `app.asar`; the default Electron icon is gone.
- The smoke renderer reports `desktopOpen`/`lastWorkspace` bridge methods, and the Node tests assert the native open/read/write/last-path IPC plus the icon bundle. In Electron, **Open Last Workspace** reads the path from `userData/last-workspace.json` (validated with `fs.access`) instead of origin-bound IndexedDB, so it still resolves after the random-port restart.

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
- The File menu and loop panel both route every chosen format through the same save chooser; no runtime or console errors occur.
- With neither the Electron bridge nor `showSaveFilePicker()` available, `requestSaveTarget()` returns a download target and `writeSaveTarget()` writes the exact blob through a temporary `<a download>`. Unit tests assert the suggested file name, blob bytes and success toast; the native/picker paths are unchanged and still allow choosing a folder.

## Electron desktop coverage

- `npm run electron:smoke` starts `electron/main.cjs`, serves the ES Modules from a random loopback port, loads the renderer and exits cleanly. The main process calls `Menu.setApplicationMenu(null)` before creating the window, so no native menu bar or menu buttons are drawn.
- The packaged renderer was smoke-tested with `npx electron dist/win-unpacked/resources/app.asar --smoke`, confirming the built app loads. A direct launch of the freshly rebuilt unsigned `.exe` is blocked by this machine's Application Control policy, so the source Electron binary was used to load the packaged archive instead.
- `npm run build:win` produced `dist/ZeeOne Drum Machine Setup 1.0.0.exe` and `dist/ZeeOne-Drum-Machine-Portable-1.0.0.exe`. No signing certificate is configured, so Windows signing is skipped.
- `electron/preload.cjs` exposes only `chooseSavePath()` and `writeFile()`; the chosen path is kept in a main-process request map and never returned to the renderer.

## Visual parity method

The comparison navigated both servers at the same viewport, captured computed styles and layout geometry for representative elements, and compared rendered screenshots. The refactored startup layer was hidden directly (without triggering a toast or status change) so only the long-lived UI was compared. The new master-volume toolbar box was hidden on the refactored page and the now-removed kit/global offset boxes were removed from the baseline page, since these are intentional changes. The new Drum Grid volume controls were hidden on the refactored page and the baseline offset controls removed, so the grid geometry still matches. The renamed `Mathcore 5/4` label was hidden on both pages. The new **New** button (`#btnNew`), the three collapse buttons (`#btnToggleSidebar`, `#btnToggleTopbar`, `#btnToggleLoopPanel`) and the bottom loop panel were removed from the comparison page so the first `.tb-btn` and the workspace geometry still match the baseline. The new row drag grips (`.track-drag-grip`) and layout dividers (`.layout-splitter`) were hidden on the comparison page because they are intentional additions to a previously unchanged layout. The renamed **Hide Tracks** label was normalized back to **Clear Kit** for this long-lived layout comparison. The intentional active-pad 3D gradient, the polished flat toolbar buttons and the softened BPM badges are also normalized back to their long-lived flat/orange baseline styles in the comparison page only. Everything else was compared unchanged. Because `StartupDialog.open()` is asynchronous (it reads the last handle from IndexedDB), the harness waits for the `open` class, removes it, and applies an inline `display: none` so a late IndexedDB callback cannot reopen the layer. Result: identical computed styles/layout and a pixel diff of `0 / 1,296,000` pixels. Tracks and kit dialog lists are populated lazily on open, matching the original DOM shape at initial load.

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
- Replaced the unsupported-browser save-API error with an explicit `<a download>` fallback: exports and workspace JSON still download with the suggested name, while Electron/picker paths keep their native chooser.
- Added an Electron main process with a random-port local server and a narrow native-save preload bridge, plus Windows installer/portable build scripts.
- Moved the **Patterns** title to the left with its collapse chevron at the far right, put the pattern actions on their own line, replaced the Hidden label with an open/closed eye button, moved the top-bar chevron after the workspace status, and removed the four preset buttons from the Tracks dialog.
- Replaced the lane/bar block timeline with one eternal pattern sequence: rows are added with **+ Pattern**, removed with ✕/**Remove Pattern**, reordered by drag/drop, and played once at their natural beats (so 8/4 is no longer compressed into 4/4). The Bars, Loop bars and Lane controls were removed; loop WAV now exports one cycle named in beats/BPM, and legacy workspaces are migrated on load.
- Added drag-to-resize dividers for the pattern sidebar, loop arrangement and Drum Grid kit-name column with keyboard and double-click reset; all remain visual-only and are excluded from the workspace JSON.
- Added Drum Grid row drag/drop with drop indicators and a saved `kits.trackOrder`, keeping pattern keys stable so factory notes still play on the same tracks.
- Redesigned that sequence into a vertical-row/horizontal-timeline loop grid: **+ Pattern** now opens a multi-select workspace picker with ▶/⏸ preview; rows start silent until cells are painted; one cell is a beat and painting covers the pattern's full natural length; clicking a painted cell removes the block; rows may overlap and carry their own BPM; ✕ removes a row; **Clear Loop** separates cells from rows; the timeline grows in 8-beat pages; the clock and WAV renderer use absolute events per row BPM; and the WAV name became `zeeone_loop_<rows>rows_<beats>beats.wav`. The pattern selector, global loop BPM, Remove Pattern button and reorder-by-drag were removed, with legacy sequence/lane workspaces still migrated.
- Made the Tracks, Drum Kit, ZIP-import and loop-picker previews true ▶/⏸ toggles backed by a stoppable `AudioEngine` audition handle; previews stop when replaced, when the dialog closes, and when their sound ends. Kit dialog previews dropped the word **Preview** for a 20 px icon button. Painted loop blocks are now a single beveled strip spanning their beats, and active Drum Grid pads received the same 3D treatment. The final palette keeps orange across most of the height, removes pale highlights, and reduces the old dark-red/burgundy base to a shallow warm-red edge. The grid pads later lost their outer glow and gained the loop block's crisp inset border without changing column widths; toolbar buttons became flat with Save as the only primary, BPM badges became graphite, and Loop Mode became graphite-off / muted-red-on. The kit-name column now defaults wide enough for factory names, with a visible grip, click-to-fit and keyboard controls. Loop WAV exports now crop the silent tail after the last audible hit while active-pattern WAV export still renders its full pattern. Electron now uses the SVG-derived ZeeOne icon and a main-process last-workspace path so **Open Last Workspace** survives restarts; the collapsed sidebar expander stays at the top and the collapsed loop expander stays at the far right. All four icon previews now share one `.preview-btn` style (20 × 20, graphite idle, orange hover/focus, muted-red playing), and every collapse chevron rotates around its own bounding box instead of a fixed SVG point, so the arrow no longer drifts during or after the animation. The top-bar and loop chevrons were also moved two viewBox units upward, leaving a clear gap below the divider and above the panel outline instead of touching its lower edge.

## Export format validation

- Capability probes in Edge 158 and Electron 45 (Chromium 156) report `audio/mp4;codecs=mp4a.40.2` as supported and `audio/mpeg` / `audio/ogg;codecs=opus` as unsupported. A probe recording produced a valid MP4 `ftyp` box and an `mp4a` track, which is the M4A shape accepted by WhatsApp Web.
- The format harness opens the modal from both the File menu and the loop toolbar, verifies Cancel and Escape, and exports the same active pattern in all three formats. It observed `zeeone_rock_1_100bpm.wav` with `RIFF`/`WAVE`, `.m4a` with an MP4 `ftyp` box and `audio/mp4` blob type, and `.mp3` with an MPEG frame sync (`ff fb`) and `audio/mpeg` type. Each save picker received the matching MIME type and single extension.
- A painted loop row exported as `zeeone_loop_1rows_4beats.mp3` in about 49 KB, confirming that the silent-tail crop is applied to MP3 as well as WAV.
- Unit tests encode real mono and stereo MP3 frames with the vendored encoder and verify the format descriptors, file-name extension replacement and `trimAudioBuffer()`.

## Known limitations

- Time signatures are fixed quarter-note presets only; there is no custom `N/D` input and no legacy 6/8 or 7/8 subdivision.
- No swing control; “Swing” patterns are names only.
- The loop is a beat grid starting at 32 columns, growing in 8-beat pages up to 512, with at most 64 rows and 512 blocks. Rows run at their own BPM and can drift; older `sequence[]`/`lanes[].blocks[]` workspaces are migrated to painted rows. There are no bars or lanes.
- All three collapse states and both resized panel sizes are visual only and reset on reload; only the Drum Grid row order is saved.
- No pan or effects chain; mixing is visibility, mute/solo, per-track gain, and master gain.
- M4A encoding runs in real time, so a long loop takes roughly its own duration to export. MP3 relies on a vendored LGPL LAME module instead of a browser-native encoder.
- Only one sample is stored per track; importing a ZIP replaces all tracks and clears the active pattern's steps. Individual samples can be removed with **Use Synth / Remove**, and the whole kit with **Unload All Samples**, both undoable.
- Workspace files with embedded samples can become large.
- Auto-save to an existing file still requires Chrome/Edge or the Electron build. Other browsers download a fresh workspace JSON on **Save** and can reopen it through the toolbar **Open** button, but there is no writable handle to update in place.
- Opening `index.html` directly via `file://` is blocked by ES Module CORS rules; use `npm start` or the Electron app.

## Electron status

Electron is now an enabled dev-tooling phase, not a future plan. The renderer remains browser-only, uses relative paths, has no remote resources, and does not import Node or Electron modules. `electron/main.cjs` supplies the local origin and native save dialogs; `electron/preload.cjs` exposes only a narrow save bridge. Windows artifacts were generated and smoke-tested. If sample files eventually move next to the workspace instead of living inside its JSON, `WorkspaceFileController` and the `kits.samples[].data` payload remain the natural seams.
