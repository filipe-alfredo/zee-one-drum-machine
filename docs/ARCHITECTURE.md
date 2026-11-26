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
  ├── ui/loop-panel.js ──────> bottom arrangement editor, Loop Mode, loop WAV action,
  │                             its own collapse toggle
  ├── ui/kit-panel.js ───────> per-row assignment/removal, delegated bulk unload
  └── ui/* ───────────────────> state, utils/{dom,helpers}.js
                                 (all dependencies injected through constructors)
```

- **Low-level helpers** (`utils/`) have no application dependencies. `createElement` builds UI nodes with `textContent` instead of `innerHTML`, so pattern/group names and sample filenames cannot inject markup. `clampVolume()` is the single 0–1 normalization rule for master and per-track gain.
- **Pure logic** (`sequencer/pattern.js`, `sequencer/arrangement.js`, `sequencer/mixer.js`, `sequencer/clock.js`, `kits/kit-loader.js`) can be unit-tested in Node; none of them use DOM APIs. `getTimeSignatureError()` produces the detailed `N/D` guidance shown in toasts and field tooltips.
- **UI classes** keep a reference to their DOM element(s) and receive callbacks. They never reach into another UI module directly. `app.js` is the only place that knows the whole object graph.
- There are **no globals** in application code. Browser globals (`window`, `document`) are used only where needed.

## Initialization sequence

1. The browser parses `index.html`, applies stylesheets, and evaluates `src/app.js`.
2. `new DrumMachineApp()` constructs, in order: `AudioEngine`, `Toast`, `AppState` (with a change-notification callback), `WorkspaceFileController`, `KitManager`, `ConfirmDialog`, `ItemEditorDialog`, `Sequencer`, `SequencerGrid`, `PatternsPanel`, `LoopPanel`, `TracksPanel`, `KitImportDialog`, `KitPanel`, `Controls`, and `StartupDialog`. Constructor event listeners are attached at this point. The engine's master gain is initialized from `workspace.globalVolume` before any context exists.
3. `app.init()` renders the factory workspace with `refreshAllUI()` and opens the startup dialog. Nothing is restored automatically.
4. The user chooses **New Project** (keep the factory state), **Open Workspace…** (file picker), or **Open Last Workspace** (reopen the remembered handle after requesting permission). `afterWorkspaceLoaded()` stops playback, applies the loaded master volume, rebuilds decoded buffers, and re-renders.

The `AudioContext` is deliberately **not** created during initialization. It is created lazily on the first user gesture (Play, audition, or sample loading), at which point the current master volume is applied to its gain node.

## State management

`AppState` owns one plain `workspace` object:

```text
workspace
  ├── activePatternId, showHiddenGroups, globalVolume
  ├── visibleTracks{}, trackVolumes{}, muted{}, solo{}  // keyed by track id
  ├── groups[]    // id, name, collapsed, hidden, isFactory
  ├── patterns[]  // id, groupId, name, bpm, timeSignature, grid{rowKey: boolean[]}
  ├── kits        // version 2: { samples[], synthTracks[], active: {} }
  └── arrangement // enabled, bpm, loopBars, lanes[{ id, name, blocks[] }]
                  // block: { id, patternId, startBar, lengthBars }
```

- `tracksFromKits(kits)` builds the runtime track list. Each sample is a `kind: 'sample'` track whose `id` is the sample id; `synthTracks[]` produces `kind: 'synth'` tracks whose `id` is the legacy instrument id. `patternKey` is the legacy instrument id for the first sample claiming it, or the sample id for duplicate/unmapped rows. `state.tracks`, `state.trackIds`, `state.trackPatternKeys`, and `state.visibleTracks` all derive from this list.
- `normalizeWorkspace()` validates imported data: unknown/falsy fields get defaults, duplicate IDs are regenerated, BPM is clamped, volumes are clamped to 0–1 (default `0.85` master, `1` per track), grids are padded/truncated to the signature's step count, and unknown grid rows are preserved. Sample metadata is normalized and duplicate labels are suffixed. Older `kits.version: 1` workspaces are upgraded by adding a synth track for every legacy instrument without a sample.
- `normalizeArrangement()` validates the saved loop: unknown pattern ids are dropped, duplicate ids are regenerated, out-of-range BPM/bar/block values are clamped, and overlapping blocks in one lane are resolved by keeping the earliest one. `AppState` exposes CRUD for lanes/blocks, Loop Mode, loop BPM and length; deleting a pattern also removes its blocks.
- `replaceKitSamples()` normalizes the imported samples, writes `synthTracks: []`, resets the mixer maps (including per-track volumes) while keeping `globalVolume`, and rebuilds the active grid as empty rows for the new track keys. `addKitSamples()` is a compatibility alias; the wizard always replaces the whole kit.
- `setTrackSample()` replaces the sample on one track (manual **Assign File**), while `removeTrackSample()` removes it and restores a legacy synth row when possible (**Use Synth / Remove**). `captureKitsState()` / `restoreKitsState()` snapshot the kit plus visibility/volume/mute/solo maps so `app.js` can offer Undo after a removal. `syncPatternTracks()` adds synth rows for factory-pattern instruments that have notes but no covering sample; it never changes visibility. `ensureTracksForPattern()` persists those changes when a pattern is selected.
- `getHiddenTracksForPattern(pattern)` lists runtime tracks that are hidden **and** have at least one active step in the pattern. `setTracksVisible(ids, true)` reveals them when the user confirms the restore dialog.
- `setGlobalVolume()` / `setTrackVolume()` clamp and persist gains. Both are mirrored by `mixer.js` getters used by playback, audition, and WAV export.
- Every mutating method (`setBpm`, `setStep`, CRUD, presets, etc.) calls `persist()`, which only notifies the file controller. `AppState` never writes to disk or browser storage.
- `WorkspaceFileController` serializes `state.getExportData()` to a `.json` file. On the first save the user picks the name and destination; later saves reuse the same handle, so numbered duplicates are never created. **Save As** switches to a new handle.
- While a handle is active, `notifyChanged()` schedules a debounced writeback to that same file. Without a handle (including a plain JSON import in browsers without pickers), there is no persistence.
- The last handle is kept in IndexedDB so the startup dialog can offer **Open Last Workspace**; `FileSystemFileHandle` objects cannot be stored in `localStorage`.
- `importWorkspace()` returns `true` on success and `false` on invalid input. `AppState` does not know about audio or DOM; the UI re-renders through callbacks supplied by `app.js`.
- Custom sample `AudioBuffer`s are not serialized, but their original bytes are: `app.restoreKitSamples()` decodes `kits.samples[].data` and hands `KitManager.replaceSamples()` a map keyed by track id.

## UI update flow

- A user action in a UI class calls an injected callback → a method on `DrumMachineApp` → a state mutation and/or audio action → a targeted UI refresh (`grid.render()`, `patternsPanel.render()`, etc.).
- Importing a kit calls `state.replaceKitSamples()`, `kitManager.replaceSamples()`, and `app.afterKitImported()`, which stops playback and refreshes the grid and dialogs.
- Selecting a pattern calls `PatternsPanel` → `onPatternSelected(pattern, hiddenTracks)` → `app.afterPatternSelected()`. If hidden tracks contain notes, `ConfirmDialog` offers **Restore Tracks** / **Keep As Is**. Restoring reveals only those rows; keeping them leaves playback and export silent for them.
- Changing master volume calls `app.changeGlobalVolume()`, which updates state, the live `AudioEngine.setMasterVolume()`, and the toolbar readout. Per-track sliders in the Drum Grid call `setTrackVolume()` directly; the mixer reads the new value at the next scheduled note. The Tracks dialog's ▶ button calls `grid.auditionInstrument()` without changing visibility. Its checkboxes write only to `TracksPanel.draftVisibility`; `applyDraft()` commits through `replaceVisibility()` and calls `onVisibilityChanged()` exactly once, so the grid never changes behind the open dialog.
- During playback the sequencer invokes one `onStep` callback; the grid and loop panel update their playheads/LED pips. Playhead updates are delayed to match scheduled audio time and are guarded by a playback generation counter so a rapid Stop/Start cannot move a stale playhead.
- `Sequencer.getScheduleSource()` chooses the active pattern or the bottom arrangement. Enabling/disabling Loop Mode stops playback first so the chosen source always restarts at step 0.
- `LoopPanel` owns block placement, drag/drop, selection, deletion, loop BPM/length, and loop WAV export. Its blocks reference pattern ids, so editing a pattern updates every block that uses it.
- Three collapse buttons are owned by `app.js` via body classes: `body.sidebar-collapsed` leaves a 42 px rail inside the sidebar, `body.topbar-collapsed` hides `.main-toolbar` while keeping logo/File/Help, and `body.loop-collapsed` shrinks the bottom panel to a rail. No `AppState` mutation occurs, so none of these visual states are saved in the workspace.
- Dialog lists are rendered when opened (`open()`), while external state changes use `refreshIfOpen()` to avoid adding hidden DOM nodes that the original application did not have.
- `ConfirmDialog` supports independent accept/cancel labels and callbacks. Cancel runs only for the explicit **Cancel** button; the ✕ close button dismisses without side effects.

## Browser and desktop shell

- All paths are relative (`assets/...`, `styles/...`, `src/...`); there are no remote resources (fonts are local).
- Renderer/application code still contains no Node.js or direct Electron imports. Node/Electron code lives only in `scripts/serve.mjs`, `electron/main.cjs`, and `electron/preload.cjs`; none of it is imported by the app.
- `assets/drumkits/**` remains gitignored: user-provided sample folders are treated as user content. Imported samples are still embedded in the workspace JSON.
- Workspace save/open uses `showSaveFilePicker()` / `showOpenFilePicker()` and `FileSystemWritableFileStream` in Chrome/Edge. Other browsers retain the `<input type="file">` import fallback but cannot write back. In Electron the same renderer code detects `window.zeeoneDesktop`, so saves use a native `dialog.showSaveDialog()` through the preload bridge while `AppState` stays unchanged.
- WAV exports call `requestSaveTarget()` **before** the offline render, preserving the browser's transient user activation. `writeSaveTarget()` then writes through the Electron bridge, a `FileSystemWritableFileStream`, or (as a last resort) a normal download. The user always sees a suggested name based on the pattern/loop and can change it and the folder.
- `electron/main.cjs` serves the ES Modules from a random loopback port because `file://` blocks module loading. It never binds 8765/8766/8777. The preload exposes only `chooseSavePath()` and `writeFile()`; `nodeIntegration` is off and `contextIsolation`/`sandbox` are on. Chosen paths stay in a main-process map keyed by an opaque request id, so the renderer cannot write to an arbitrary path.
- `NewWorkspaceDialog` is the first toolbar button and File-menu action. It calls `app.createWorkspace('blank')` (factory patterns, no visible tracks) or `app.createWorkspace('default')` (23 synth tracks), clears the file handle, and reuses the same `resetWorkspace()` path as the startup dialog.
- `npm run electron` starts the shell from source; `npm run build:win` produces installer and portable executables in `dist/`; `npm run electron:smoke` loads and closes it non-interactively.

See [AUDIO_ENGINE.md](AUDIO_ENGINE.md), [SEQUENCER.md](SEQUENCER.md), and [DRUMKITS.md](DRUMKITS.md) for subsystem details.
