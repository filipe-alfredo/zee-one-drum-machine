# ZeeOne Drum Machine

A browser-based drum sequencer built with vanilla JavaScript, ES Modules, Web Audio API, HTML5, and CSS3. This project is the modular refactoring of the original single-file `index.html` application. The **appearance, 24 factory patterns, and synthesis are unchanged**; kit management was extended so each imported sample becomes its own track.

> The renderer still uses only browser APIs and has no runtime dependencies. Electron and electron-builder are **dev dependencies** used only to run/build the desktop shell; Node is not referenced by application code.

## Features

- The first toolbar button, **New**, starts either a blank grid (no visible tracks) or the 23-track default synth kit; the factory patterns remain available in both cases.
- Dynamic tracks: every imported ZIP file is one row with its own sample, name, mute/solo, volume, and pattern row.
- 24 factory patterns in two groups, plus user-created groups and patterns.
- Fixed time signature presets: 2/4 (8 steps), 3/4 (12), 4/4 (16), 5/4 (20), 6/4 (24), 8/4 (32), and 12/4 (48). All presets use four 16th-note steps per beat; invalid values get a short message listing the presets.
- BPM control (40–240) with slider and numeric input.
- Transport with Play / Stop, lookahead scheduling, and a synchronized playhead.
- Bottom **Loop Arrangement**: a FL-style playlist timeline with lanes, draggable pattern blocks, its own BPM, loop length, and a **Loop Mode** that lets the arrangement take over playback while the selected pattern stays editable.
- **Export Active Pattern** and **Export Loop Arrangement** ask for folder and file name first, then render the WAV with the current volumes, visibility, mute, and solo settings. Electron uses a native Save dialog; Chrome/Edge use the File System Access API.
- Three matching chevron buttons collapse the pattern sidebar (into a narrow rail), the top toolbar (leaving toggle, logo, File and Help), and the bottom loop panel (into a rail). In the sidebar the **Patterns** title and chevron share the top row, while + Group, + Pattern and an eye button (show/hide hidden groups) stay on one line below; in the top bar the chevron sits after the workspace status. These states are visual only and are never written to the workspace.
- The Tracks dialog uses a local draft: checkboxes only change the dialog until **Apply**; **Cancel** discards everything and the grid behind never changes mid-edit. The ▶ button auditions each drum piece.
- Per-track visibility, mute, solo, and a 0–100% volume slider on every Drum Grid row. **Hide Tracks** hides all rows without deleting samples or notes.
- Master volume (0–100%) in the top toolbar beside Time Signature, applied to live playback, audition, and WAV export.
- Hidden tracks are silent. Selecting a pattern that has notes on hidden tracks asks whether to **Restore Tracks** or **Keep As Is**; keeping them hidden plays/export only the visible rows.
- Free-form sample labels (`snare 1`, `tom grave`, …) can inherit a legacy instrument's factory-pattern notes; unrecognized names simply get their own row. Duplicate names receive a unique suffix.
- Imported samples can be removed after import: **Use Synth / Remove** per row or **Unload All Samples** from the kit dialog or File menu, both with confirmation for bulk unload and Undo for every removal.
- Imported sample bytes, synth-track choices, visibility, and volumes are embedded in the workspace JSON and restored when the workspace is reopened.
- File-based workspace save/open with explicit filename and destination (native dialog in Electron, File System Access API in Chrome/Edge), plus JSON import fallback.
- Offline WAV export of the active pattern or the whole loop, both written to a user-chosen path, respecting visibility, mute/solo, and both volume settings.
- Keyboard shortcuts: **Space** toggles playback, **C** clears all steps (ignored while typing in an input).

## Requirements

- A modern browser with Web Audio API and ES Module support (Chrome/Edge/Firefox/Safari), or the packaged Electron app.
- No renderer runtime dependencies. Bundled fonts are included locally.
- Node.js 18+ for the test suite; Electron and electron-builder are installed as dev dependencies for desktop run/build.

## Running locally

The app runs in a browser, not directly in Node (`node index.html` will not work: there is no DOM or Web Audio in Node). Node can serve the files, though. A zero-dependency static server is included:

```bat
npm start
```

Then open <http://127.0.0.1:8765/index.html>. Set `PORT=9000` to use another port.

Alternatively, with Python:

```bat
python -m http.server 8765
```

Any static file server works; the app has no build step and no server-specific paths. The server script in `scripts/` is development-only and is **not imported by the application**.

Run the focused logic tests with:

```bat
npm test
```

## Electron desktop app / executable build

Install dev tooling once (`npm install` also works from a clean clone):

```bat
npm install
```

Run the desktop app from source:

```bat
npm run electron
```

Build Windows executables into `dist/`:

```bat
npm run build:win
```

That produces:

- `dist/ZeeOne Drum Machine Setup 1.0.0.exe` — NSIS installer (optional install folder, desktop/start-menu shortcuts).
- `dist/ZeeOne-Drum-Machine-Portable-1.0.0.exe` — standalone portable executable.
- `dist/win-unpacked/ZeeOne Drum Machine.exe` — unpacked app, useful for a quick smoke test.

A non-interactive load check is available with `npm run electron:smoke`; it starts the Electron shell from source, waits for the renderer, then exits. The Electron main process serves the ES Modules over a random loopback port because `file://` blocks module loading. It never uses ports 8765/8766/8777. Save dialogs are native: `electron/preload.cjs` exposes only `chooseSavePath()` and `writeFile()` through `contextBridge`; the renderer has no Node access. The native menu bar is removed (`Menu.setApplicationMenu(null)`), so the app shows only its own toolbar and in-app menus.

## Workspace files

There is no `localStorage` auto-save. Every launch starts from the factory workspace and shows a small **Start** dialog:

- **New Project** — keeps the clean 24-pattern factory state with 23 synth tracks.
- The toolbar **New** button (and File → New Workspace) opens a chooser: **Blank Grid** hides all tracks, while **Default Kit** shows the 23 synth tracks. Both clear the current file handle; factory patterns stay available.
- **Open Workspace…** — picks a `.json` file; in Chrome/Edge or Electron this also keeps a writable handle.
- **Open Last Workspace** — enabled when a previous file handle is remembered.

**File → Save Workspace** asks for the name and destination on the first save (suggested name `zeeone_drum_workspace.json`). Later saves write to that same file, so numbered copies such as `... (6).json` are never created. **Save Workspace As…** picks another file. After a file is saved/opened, edits are written back to it automatically after a short debounce; before that, nothing is persisted.

The last file handle is remembered in IndexedDB (handles cannot be stored in `localStorage`). Browsers without the picker API can still use **Open Workspace** via the plain file input, but cannot save back to it; the app reports that saving requires Chrome/Edge. Imported sample bytes, track names, visibility, and volumes are part of this same file.

## Project structure

```text
drum-machine/
├── index.html                  # Static markup and single ES Module entry point
├── electron/
│   ├── main.cjs                # Desktop shell: loopback server, native save IPC
│   └── preload.cjs             # Narrow contextBridge for save dialog/writes
├── src/
│   ├── app.js                  # Composition root: wiring and high-level actions
│   ├── audio/
│   │   ├── audio-engine.js     # AudioContext lifecycle, master gain, per-note gain
│   │   ├── audio-utils.js      # Noise buffer and WAV encoding helpers
│   │   ├── sample-player.js    # Procedural synthesis, or a supplied sample buffer
│   │   └── wav-export.js       # Shared offline render of patterns/arrangements to WAV
│   ├── sequencer/
│   │   ├── clock.js            # Lookahead scheduler driven by AudioContext time
│   │   ├── sequencer.js        # Pattern/arrangement sources, mixer rules, playhead callback
│   │   ├── arrangement.js      # Loop lanes, blocks, limits, and timeline notes
│   │   ├── pattern.js          # Step counts, timing, validation, grid transforms
│   │   ├── factory-patterns.js # The 24 factory patterns
│   │   └── mixer.js            # Visibility, mute/solo, and volume rules
│   ├── kits/
│   │   ├── instruments.js      # Legacy instrument IDs, names, and label keywords
│   │   ├── kit-loader.js       # Free-label resolution and file decoding
│   │   ├── kit-manager.js      # Per-track sample buffer cache and raw bytes
│   │   ├── kit-format.js       # Filename/kit-id sanitizers (legacy helpers)
│   │   ├── sample-data.js      # Base64 data URLs and ZIP path sanitization
│   │   └── zip.js              # Dependency-free ZIP read/write (native streams)
│   ├── state/
│   │   ├── app-state.js        # Workspace model, validation, dynamic tracks, CRUD
│   │   └── workspace-file.js   # File System Access persistence + last-handle memory
│   ├── ui/
│   │   ├── controls.js         # Toolbar, menus, tempo, volumes, shortcuts
│   │   ├── startup-dialog.js   # New / Open / Open Last picker
│   │   ├── new-workspace-dialog.js # Blank vs default-kit chooser
│   │   ├── grid.js             # Sequencer matrix, track controls, playhead display
│   │   ├── patterns-panel.js   # Pattern/group sidebar
│   │   ├── loop-panel.js       # Bottom loop timeline editor and Loop Mode toggle
│   │   ├── tracks-panel.js     # Track visibility and preview dialog
│   │   ├── kit-panel.js        # One preview/assign row per sample
│   │   ├── kit-import.js       # ZIP import wizard UI
│   │   ├── modals.js           # Confirm and item-editor dialogs
│   │   └── toast.js            # Non-blocking notifications with undo
│   └── utils/
│       ├── dom.js              # Safe DOM element creation
│       ├── helpers.js          # Clamping, IDs, file/download helpers
│       └── file-output.js      # Native picker / File System Access save target
├── styles/
│   ├── fonts.css               # Local @font-face declarations
│   ├── themes.css              # Design tokens (colors, variables)
│   ├── main.css                # Page shell, menubar, dialogs
│   ├── controls.css            # Transport and slider controls
│   ├── sequencer.css           # Grid, pads, LED bar, sidebar
│   └── loop.css                # Bottom loop timeline, blocks, collapse rails
├── assets/
│   ├── drumkits/               # Optional local sample folders (gitignored, not auto-loaded)
│   ├── fonts/                  # Locally bundled web fonts (OFL)
│   └── icons/favicon.svg
├── docs/                       # Architecture and subsystem documentation
├── tests/                      # Focused Node.js logic tests
├── scripts/serve.mjs           # Optional dev-only static server (`npm start`)
└── package.json                # ESM marker, start/test/electron/build scripts
```

## Adding drumkits and samples

- **Import Kit (.zip)** reads every WAV/MP3/OGG/etc. in the ZIP, including nested folders. Type a free-form label for each file (for example `snare 1` or `tom grave`), preview with ▶ Play, remove unwanted files, then click **Import Kit**. Every file becomes a row; unrecognized names become rows of their own, and duplicate names are suffixed. The import **replaces** the previous kit, clears the active pattern's steps, and stops playback. There is no ZIP export or `kit.json` step.
- **Assign File** decodes a chosen browser-supported audio file and replaces the sample on the clicked row. **Use Synth / Remove** deletes that sample and restores the built-in synth when a legacy instrument exists; rows without one are simply removed. **Unload All Samples (Restore Synth Kit)** removes the whole imported set; every removal offers **Undo**.
- Each Drum Grid row has a **Vol** slider (0–100%). **Master Volume** is in the top toolbar. Both are saved with the workspace and applied to live playback, audition, and WAV export.
- Selecting a factory pattern adds back synth rows for instruments that have notes in that pattern but no sample covering them. If existing tracks with notes are hidden, a dialog offers **Restore Tracks** or **Keep As Is**; hidden rows stay silent in either playback or export.
- Imported/assigned bytes are written into the workspace JSON on save and decoded again when the workspace is opened later.

See [docs/DRUMKITS.md](docs/DRUMKITS.md) for details.

## Current limitations

- No swing control exists. The factory patterns named “Swing” are only pattern names.
- The loop timeline uses a fixed 16th-note grid (16 steps per bar): a block repeats its pattern once per covered bar, mapping the pattern's steps proportionally. It supports up to 8 lanes, 32 loop bars, and 16 bars per block; blocks cannot overlap in the same lane.
- Time signatures are fixed quarter-note presets only; `N/D` input and legacy 6/8 or 7/8 timing are no longer offered.
- There is no pan or effects chain. Mixing is mute/solo, per-track gain, and master gain.
- Only one sample is kept per track. Assigning another file replaces it; importing a ZIP replaces the whole kit.
- Workspace files with many or large samples can become big because raw audio is embedded as base64.
- Loading arbitrary local files is subject to browser security rules; see [docs/DRUMKITS.md](docs/DRUMKITS.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
- The browser cannot write into `assets/drumkits/`; samples are stored in the workspace JSON instead. A future Electron phase could write them beside the workspace as real files.
- `file://` operation of ES Modules is blocked by browsers; a static HTTP server is required in this phase.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Audio engine](docs/AUDIO_ENGINE.md)
- [Sequencer](docs/SEQUENCER.md)
- [Drumkits and samples](docs/DRUMKITS.md)
- [Validation report](docs/VALIDATION.md)
