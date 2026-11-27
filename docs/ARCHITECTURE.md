# Architecture

## Overview

The application is a browser-only ES Module project with a single composition root (`src/app.js`). There is no framework, bundler, build step, or runtime dependency. Modules fall into five layers:

| Layer | Modules | Responsibility |
| --- | --- | --- |
| Composition | `src/app.js` | Creates every object, wires callbacks, implements high-level actions |
| State | `src/state/app-state.js`, `src/state/workspace-file.js` | Workspace model/validation/CRUD, dynamic track derivation, explicit file-based persistence and last-handle memory |
| Audio / timing | `src/audio/*`, `src/sequencer/*` | AudioContext, synthesis, sample playback, lookahead clock, mixer rules, WAV render |
| Kits | `src/kits/*` | Legacy instrument definitions, free-label resolution, decoding, per-track sample cache, ZIP reading, base64 sample data |
| UI | `src/ui/*` | DOM rendering and event handling; startup picker and kit import wizard; no storage logic |

`index.html` contains only static markup. It links the six stylesheets and loads `src/app.js` as `<script type="module">`.

The final promotion scope and validation are recorded in [PROMOTION.md](PROMOTION.md).

## Module responsibilities and dependencies

```text
app.js
  ├── audio/audio-engine.js ──> audio/audio-utils.js, audio/sample-player.js,
  │                             utils/helpers.js (volume clamping)
  ├── audio/wav-export.js ────> audio/audio-utils.js, audio/sample-player.js,
  │                             kits/instruments.js (fallback tracks),
  │                             sequencer/{pattern,arrangement,mixer}.js
  ├── kits/kit-manager.js ────> kits/{kit-loader,kit-format,sample-data}.js,
  │                             audio/audio-engine.js (injected)
  │                             kits/kit-loader.js ──> kits/instruments.js
  │                             kits/sample-data.js ─> kits/kit-format.js (sanitizers)
  │                             kits/zip.js ────────> browser streams (no dependencies)
  ├── sequencer/sequencer.js ─> sequencer/clock.js, sequencer/pattern.js,
  │                             sequencer/arrangement.js, sequencer/mixer.js
  │                             (injected deps)
  ├── state/app-state.js ─────> kits/{instruments,sample-data}.js,
  │                             sequencer/factory-patterns.js, sequencer/pattern.js,
  │                             utils/helpers.js
  ├── state/workspace-file.js ─> File System Access API + IndexedDB,
  │                             state/app-state.js (injected), toast/status callbacks
  ├── ui/startup-dialog.js ───> startup modal DOM + callbacks from app.js
  ├── ui/kit-import.js ───────> kits/{zip,kit-format,kit-loader,instruments,sample-data}.js,
  │                             audio/audio-engine.js (injected), utils/{dom,helpers}.js
  ├── ui/controls.js ────────> sequencer/pattern.js (validation messages), toolbar volumes,
  │                             loop export and sidebar/topbar collapse callbacks
  ├── ui/loop-panel.js ──────> pattern picker modal with per-pattern preview,
  │                             vertical rows + horizontal beat grid, clear modal,
  │                             per-row BPM, cell painting, playhead, Loop Mode,
  │                             loop WAV action and its own collapse toggle
  ├── ui/resize-handles.js ──> visual-only sidebar/loop/kit-name dividers (CSS properties)
  ├── ui/kit-panel.js ───────> per-row assignment/removal, delegated bulk unload
  └── ui/* ───────────────────> state, utils/{dom,helpers}.js
                                 (all dependencies injected through constructors)
```

- **Low-level helpers** (`utils/`) have no application dependencies. `createElement` builds UI nodes with `textContent` instead of `innerHTML`, so pattern/group names and sample filenames cannot inject markup. `clampVolume()` is the single 0–1 normalization rule for master and per-track gain.
- **Pure logic** (`sequencer/pattern.js`, `sequencer/arrangement.js`, `sequencer/mixer.js`, `sequencer/clock.js`, `kits/kit-loader.js`) can be unit-tested in Node; none of them use DOM APIs. `getTimeSignatureError()` produces the short preset list shown in toasts and field tooltips.
- **UI classes** keep a reference to their DOM element(s) and receive callbacks. They never reach into another UI module directly. `app.js` is the only place that knows the whole object graph.
- There are **no globals** in application code. Browser globals (`window`, `document`) are used only where needed.

## Initialization sequence

1. The browser parses `index.html`, applies stylesheets, and evaluates `src/app.js`.
2. `new DrumMachineApp()` constructs, in order: `AudioEngine`, `Toast`, `AppState` (with a change-notification callback), `WorkspaceFileController`, `KitManager`, `ConfirmDialog`, `ItemEditorDialog`, `Sequencer`, `SequencerGrid`, `PatternsPanel`, `LoopPanel`, `TracksPanel`, `KitImportDialog`, `KitPanel`, `Controls`, and `StartupDialog`. Constructor event listeners are attached at this point. The engine's master gain is initialized from `workspace.globalVolume` before any context exists.
3. `app.init()` installs the visual-only sidebar/loop/kit-name resize dividers, renders the factory workspace with `refreshAllUI()`, and opens the startup dialog. Nothing is restored automatically.
4. The user chooses **New Project** (keep the factory state), **Open Workspace…** (file picker), or **Open Last Workspace** (reopen the remembered handle/path; browsers ask for permission again). `afterWorkspaceLoaded()` stops playback, applies the loaded master volume, rebuilds decoded buffers, and re-renders.

The `AudioContext` is deliberately **not** created during initialization. It is created lazily on the first user gesture (Play, audition, or sample loading), at which point the current master volume is applied to its gain node.

## State management

`AppState` owns one plain `workspace` object:

```text
workspace
  ├── activePatternId, showHiddenGroups, globalVolume
  ├── visibleTracks{}, trackVolumes{}, muted{}, solo{}  // keyed by track id
  ├── groups[]    // id, name, collapsed, hidden, isFactory
  ├── patterns[]  // id, groupId, name, bpm, timeSignature, grid{rowKey: boolean[]}
  ├── kits        // version 2: { samples[], synthTracks[], active: {}, trackOrder[] }
  └── arrangement // enabled, timelineBeats,
                  // rows[{ id, patternId, bpm, blocks[{ id, start, beats }] }]
                  // legacy sequence[]/lanes[].blocks[] become painted rows on load
```

- `tracksFromKits(kits)` builds the runtime track list. Each sample is a `kind: 'sample'` track whose `id` is the sample id; `synthTracks[]` produces `kind: 'synth'` tracks whose `id` is the legacy instrument id. `patternKey` is assigned in that canonical order (legacy instrument id for the first sample claiming it, or the sample id for duplicate/unmapped rows). `kits.trackOrder[]` then reorders the displayed rows without changing any `patternKey`, so factory hits keep playing on the same tracks. `state.tracks`, `state.trackIds`, `state.trackPatternKeys`, and `state.visibleTracks` all derive from this ordered list.
- `normalizeWorkspace()` validates imported data: unknown/falsy fields get defaults, duplicate IDs are regenerated, BPM is clamped, volumes are clamped to 0–1 (default `0.85` master, `1` per track), grids are padded/truncated to the signature's step count, and unknown grid rows are preserved. Sample metadata is normalized and duplicate labels are suffixed. `kits.trackOrder[]` is filtered against the current samples/synth tracks, deduplicated, and completed with any missing ids in canonical order. Older `kits.version: 1` workspaces are upgraded by adding a synth track for every legacy instrument without a sample.
- `normalizeArrangement()` validates the saved loop grid: unknown pattern ids are dropped, duplicate row/block ids are regenerated, each row BPM is clamped to 40–240, block lengths follow the pattern signature, and the timeline is clamped to 32–512 beats. Legacy `sequence[]` entries are laid back-to-back as blocks on rows grouped by pattern id (using the old global BPM); legacy `lanes[].blocks[]` keep their saved start beat. `AppState` exposes `addLoopRow`, `addLoopRows`, `removeLoopRow`, `setLoopRowBpm`, `toggleLoopBlock`, `clearLoopBlocks`, `clearLoopRows`, and `setLoopEnabled`; deleting a pattern removes its row from the loop.
- `replaceKitSamples()` normalizes the imported samples, writes `synthTracks: []`, resets the mixer maps (including per-track volumes) while keeping `globalVolume`, and rebuilds the active grid as empty rows for the new track keys. `addKitSamples()` is a compatibility alias; the wizard always replaces the whole kit.
- `setTrackSample()` replaces the sample on one track (manual **Assign File**), while `removeTrackSample()` removes it and restores a legacy synth row when possible (**Use Synth / Remove**), keeping that row's saved position. `moveTrack()` reorders `kits.trackOrder[]` and persists it; unknown ids and self-moves are ignored. `captureKitsState()` / `restoreKitsState()` snapshot the kit (including row order) plus visibility/volume/mute/solo maps so `app.js` can offer Undo after a removal. `syncPatternTracks()` adds synth rows for factory-pattern instruments that have notes but no covering sample; it never changes visibility. `ensureTracksForPattern()` persists those changes when a pattern is selected.
- `getHiddenTracksForPattern(pattern)` lists runtime tracks that are hidden **and** have at least one active step in the pattern. `setTracksVisible(ids, true)` reveals them when the user confirms the restore dialog.
- `setGlobalVolume()` / `setTrackVolume()` clamp and persist gains. Both are mirrored by `mixer.js` getters used by playback, audition, and WAV export.
- Every mutating method (`setBpm`, `setStep`, CRUD, presets, etc.) calls `persist()`, which only notifies the file controller. `AppState` never writes to disk or browser storage.
- `WorkspaceFileController` serializes `state.getExportData()` to a `.json` file. On the first save the user picks the name and destination; later saves reuse the same handle/path, so numbered duplicates are never created. **Save As** switches to a new handle/path.
- While a handle is active, `notifyChanged()` schedules a debounced writeback to that same file. Without a handle (including a plain JSON import in browsers without pickers), there is no persistence.
- In Chrome/Edge the last `FileSystemFileHandle` is kept in IndexedDB, so the startup dialog can offer **Open Last Workspace** (`FileSystemFileHandle` objects cannot be stored in `localStorage`). Electron serves each session on a random port, which would make IndexedDB a new origin on every restart; there the main process stores only the chosen file path under `userData/last-workspace.json` and exposes native open/read/write IPC through the preload bridge.
- `importWorkspace()` returns `true` on success and `false` on invalid input. `AppState` does not know about audio or DOM; the UI re-renders through callbacks supplied by `app.js`.
- Custom sample `AudioBuffer`s are not serialized, but their original bytes are: `app.restoreKitSamples()` decodes `kits.samples[].data` and hands `KitManager.replaceSamples()` a map keyed by track id.

## UI update flow

- A user action in a UI class calls an injected callback → a method on `DrumMachineApp` → a state mutation and/or audio action → a targeted UI refresh (`grid.render()`, `patternsPanel.render()`, etc.).
- Importing a kit calls `state.replaceKitSamples()`, `kitManager.replaceSamples()`, and `app.afterKitImported()`, which stops playback and refreshes the grid and dialogs.
- Selecting a pattern calls `PatternsPanel` → `onPatternSelected(pattern, hiddenTracks)` → `app.afterPatternSelected()`. If hidden tracks contain notes, `ConfirmDialog` offers **Restore Tracks** / **Keep As Is**. Restoring reveals only those rows; keeping them leaves playback and export silent for them.
- Changing master volume calls `app.changeGlobalVolume()`, which updates state, the live `AudioEngine.setMasterVolume()`, and the toolbar readout. Per-track sliders in the Drum Grid call `setTrackVolume()` directly; the mixer reads the new value at the next scheduled note. The Tracks dialog's ▶ button calls `grid.auditionInstrument()` without changing visibility. Its checkboxes write only to `TracksPanel.draftVisibility`; `applyDraft()` commits through `replaceVisibility()` and calls `onVisibilityChanged()` exactly once, so the grid never changes behind the open dialog.
- During playback the sequencer invokes one `onEvent` callback per absolute event; the Drum Grid updates its playhead/LED pips from the event's step index, while loop events (`source: 'loop'`) make the loop panel highlight all blocks active at that audio time. Playhead updates are delayed to match scheduled audio time and guarded by a playback generation counter so a rapid Stop/Start cannot move a stale playhead.
- `Sequencer.getScheduleSource()` chooses the active pattern, the painted loop, or a temporary preview override used by the pattern picker. Enabling/disabling Loop Mode stops playback first so the chosen source always restarts at the beginning of its cycle.
- `LoopPanel` owns the pattern picker (including ▶/⏸ preview), vertical rows, cell painting/removal, per-row BPM, the two Clear Loop actions, Loop Mode, loop WAV export, and its two right-aligned toolbar controls: collapse/expand and maximize/restore. Rows reference pattern ids, so editing a pattern updates every row that uses it. Painting one cell inserts one complete pattern occurrence: its beat length comes from the time signature (four 16th steps per beat). The timeline grows in 8-beat pages when painting reaches the right edge.
- Three collapse buttons are owned by `app.js` via body classes: `body.sidebar-collapsed` leaves a 42 px rail inside the sidebar, `body.topbar-collapsed` hides `.main-toolbar` while keeping logo/File/Help, and `body.loop-collapsed` shrinks the bottom panel to a rail. `body.loop-maximized` hides `.workspace` and the loop splitter so the loop panel takes the full area below the top bars; it is mutually exclusive with the collapsed rail, and clicking either control restores the other state first. `installResizeHandles()` binds the zero-size separators to `--sidebar-width` / `--loop-height` CSS custom properties; `installTrackNameResize()` delegates from `#sequencerMatrix` to the per-row `.track-name-resizer` handles and writes `--track-header-width`, which also drives `.leds-bar`'s left margin. Pointer drag, arrow keys and double-click reset only those properties. No `AppState` mutation occurs for collapse, maximize or resize, so none of these visual states are saved in the workspace.
- Drum Grid row drag/drop is owned by `SequencerGrid`: a `dragstart` on the track header carries the track id, rows show before/after drop indicators, and `drop` calls `state.moveTrack()` followed by `grid.render()`. The `.track-name-resizer` handle stops that drag so resizing the name column never reorders rows. Unlike resize/collapse, the order is saved with `kits.trackOrder[]` and survives reopening the workspace.
- Dialog lists are rendered when opened (`open()`), while external state changes use `refreshIfOpen()` to avoid adding hidden DOM nodes that the original application did not have.
- `ConfirmDialog` supports independent accept/cancel labels and callbacks. Cancel runs only for the explicit **Cancel** button; the ✕ close button dismisses without side effects.

## Browser and desktop shell

- All paths are relative (`assets/...`, `styles/...`, `src/...`); there are no remote resources (fonts are local).
- Renderer/application code still contains no Node.js or direct Electron imports. Node/Electron code lives only in `scripts/serve.mjs`, `electron/main.cjs`, and `electron/preload.cjs`; none of it is imported by the app. `electron/main.cjs` creates the `BrowserWindow` with `show: false`, calls `maximize()` on `ready-to-show`, then `show()`, so the desktop start is already full screen without a resize flash.
- `assets/drumkits/**` remains gitignored: user-provided sample folders are treated as user content. Imported samples are still embedded in the workspace JSON.
- Workspace save/open uses `showSaveFilePicker()` / `showOpenFilePicker()` and `FileSystemWritableFileStream` in Chrome/Edge. Other browsers retain the `<input type="file">` import fallback but cannot write back. In Electron the same renderer code detects `window.zeeoneDesktop`, so **New/Open/Save/Save As/Open Last** all use native dialogs and a path-based handle adapter through the preload bridge while `AppState` stays unchanged.
- WAV exports call `requestSaveTarget()` **before** the offline render, preserving the browser's transient user activation. `writeSaveTarget()` then writes through the Electron bridge or a `FileSystemWritableFileStream`. When neither save API exists, `requestSaveTarget()` rejects with a clear message and the export reports the error instead of silently downloading an auto-numbered file into `Downloads`. The user always sees a suggested name based on the pattern/loop and can change it and the folder.
- `electron/main.cjs` serves the ES Modules from a random loopback port because `file://` blocks module loading. It never binds 8765/8766/8777. The preload exposes `chooseSavePath()`, `chooseOpenPath()`, `readFile()`, `writeFile()`, `getLastWorkspace()` and `setLastWorkspace()`; `nodeIntegration` is off and `contextIsolation`/`sandbox` are on. One-shot save targets stay in a main-process map keyed by an opaque request id, while workspace auto-save reuses the already chosen path; the last path is persisted under `userData` so **Open Last Workspace** survives restarts. The window and installer use `assets/icons/app-icon.ico`, rasterized from `favicon.svg`; the packaged copy lives in `resources/` outside `app.asar`.
- `NewWorkspaceDialog` is the first toolbar button and File-menu action. It calls `app.createWorkspace('blank')` (factory patterns, no visible tracks) or `app.createWorkspace('default')` (23 synth tracks), clears the file handle, and reuses the same `resetWorkspace()` path as the startup dialog.
- `npm run electron` starts the shell from source; `npm run build:win` produces installer and portable executables in `dist/`; `npm run electron:smoke` loads and closes it non-interactively.

See [AUDIO_ENGINE.md](AUDIO_ENGINE.md), [SEQUENCER.md](SEQUENCER.md), and [DRUMKITS.md](DRUMKITS.md) for subsystem details.
