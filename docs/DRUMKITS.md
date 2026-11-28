# Drumkits and samples

## Track model

A new project has the original 23 fixed instrument IDs defined in `src/kits/instruments.js`:

`kick`, `kick_dry`, `kick_boom`, `snare`, `snare_stick`, `snare_brush`, `close_hat`, `open_hat`, `ride`, `crash`, `tom_low`, `tom_mid`, `tom_high`, `clap`, `cowbell`, `wood_low`, `wood_hi`, `maracas`, `tambourine`, `shaker`, `rimshot`, `bongo_low`, `bongo_high`.

These IDs survive as **legacy instrument IDs** so the 24 factory patterns keep working. Runtime tracks are now dynamic: `state.tracks` is derived from `kits.samples` plus `kits.synthTracks` by `tracksFromKits()`.

- Every imported sample has `id === track.id`; a track holds **one** sample or the built-in synth. There is no active-sample selector.
- The first sample with a given `instrumentId` claims that instrument's factory-pattern row: `patternKey === instrumentId`.
- Later samples with the same `instrumentId`, and all samples with no legacy match, use their own sample `id` as `patternKey`. They are independent rows whose pads can be programmed normally.
- Synth tracks use `id === instrumentId === patternKey`.
- Sample labels are de-duplicated with a numeric suffix (`snare 1`, `snare 1 (2)`, …), so two files with the same name still produce two rows.

`resolveInstrumentFromLabel()` is only a hint used for factory-pattern compatibility. It never merges tracks.

Each instrument has a display name and lowercase `keywords`. Matching is case-insensitive, ignores accents/hyphens/underscores, and understands a few Portuguese aliases (`caixa`, `bumbo`, `chimbal`, `tom grave`, `tom médio`, `tom agudo`, etc.).

## User sample folders on disk

`assets/drumkits/**` is in `.gitignore` and is treated as user content, not source code. Any sample files kept there are available for manual assignment or for building a ZIP, but they are **not** loaded automatically at startup: the default project synthesizes all drum sounds procedurally. The browser cannot read arbitrary paths either — a user must pick files explicitly.

## Import wizard (ZIP → new kit)

Open **File → Load Custom Drum Kit → Import Kit (.zip)**. The wizard (`src/ui/kit-import.js`):

1. Reads the whole ZIP with `src/kits/zip.js` — no third-party library. Stored and deflated entries are supported through `DecompressionStream('deflate-raw')`; archives larger than 300 MB of uncompressed data are rejected.
2. Lists **every** supported audio file (`wav`, `mp3`, `ogg`, `m4a`, `aac`, `flac`) found in the archive root **and in any subdirectory**. Folder structure is kept as a sanitized relative path; traversal segments (`..`) and unsafe characters are removed. Non-audio files are ignored.
3. Shows a free-text field for each file. Suggestions (instrument names and examples such as `snare 1`, `tom grave`) are offered through a `<datalist>`. A live hint shows `→ herda <instrument>` when the text resolves to a legacy instrument, or `→ faixa própria (sem legado)` when it does not. **Every** label is importable; the button is enabled as soon as a kit name is present.
4. Lets you **▶ Play** each file, **Remove** a file from the batch, and edit the kit name.
5. On **Import Kit**, decodes the audio and calls `state.replaceKitSamples()`. Playback is stopped, the whole kit is replaced, mixer maps (including per-track volumes) are reset to their defaults, and every step of the active pattern is cleared. The master volume is preserved. Files with no legacy match are kept as their own tracks. Decode failures are counted and reported; other files still import.

There is **no ZIP export** and no `kit.json` installation step. `src/kits/kit-format.js` is kept for filename/kit-id sanitizers and the legacy format helpers; no runtime code reads or writes `kit.json`.

## Factory patterns after an import

Factory patterns store notes by legacy instrument ID. When a pattern is selected, `syncPatternTracks()` checks every instrument that has at least one active step:

- if a sample track claims that instrument, it is **not** automatically revealed;
- otherwise a synth track is added for that instrument.

Only missing rows are added. Visibility is left untouched. If the selected pattern has notes on rows that are currently hidden, a dialog offers **Restore Tracks** or **Keep As Is**. Restoring reveals only those hidden rows with notes; keeping them hidden means they are excluded from playback and WAV export. “Clear All” empties only the active pattern grid; it does not touch tracks. The `↺` button in the Patterns panel restores the active factory pattern's notes without adding synth rows, changing row order or changing visibility; unmapped sample rows remain as empty rows, and Undo is offered in the toast.

## Kit dialog: assign, remove, unload and preview

The kit dialog lists one slot per runtime track:

- **Assign File** decodes a chosen file, replaces that row's sample (keeping the row's label/legacy hint), and updates playback, WAV export, and the saved workspace.
- **Use Synth** (for a row with a legacy instrument) or **Remove** (for an unmapped row) deletes just that sample. Legacy rows return as built-in synth tracks; unmapped rows disappear, while their steps remain in the patterns. Both actions are undoable from the toast.
- **Unload All Samples (Restore Synth Kit)** removes every sample at once after confirmation. The File menu offers the same **Unload Custom Samples (Synth)** action. Both paths snapshot kits, mixer maps and decoded buffers so **Undo** brings back the exact previous kit.
- **Preview** auditions a slot at that track's volume. Audio decode failures are reported with a toast and leave other rows untouched.
- Per-track **Vol** sliders (0–100 %) now live on every Drum Grid row, not in this dialog. They are saved with the workspace and applied to playback, audition, and WAV export. The **Master Volume** control lives in the top toolbar beside Time Signature and scales the whole mix.
- The Tracks dialog lists every available drumkit/sample and has a **▶** button per row for quick audition. Its checkboxes build a **local draft**: the grid behind the modal does not change until **Apply**, and **Cancel** (or ✕) discards the draft. Imported rows with no legacy instrument are listed like any other track.

There is no multi-sample list and no active-sample selector: assigning a second file to the same row replaces the first one. **Hide Tracks** in the toolbar only changes visibility; it never deletes a kit.

### Manual assignment details

`KitManager.loadFile()` calls `audioEngine.ensureStarted()`, reads the bytes with `file.arrayBuffer()`, decodes them with `AudioContext.decodeAudioData()`, and stores both the raw bytes (as a base64 data URL) and the decoded buffer under the **track id**. The row status changes from `Built-in Web Audio Synth` to the label/file name, or to `● <name>` for a loaded sample.

### Removed behavior

**Bulk Auto-Match Files** and its `loadFilesAutomatically()` batch loader were removed. There is no button, no hidden file input, and no keyword-only bulk assignment path. Filename/label matching now happens only in the import wizard as a convenience; the user can always type any name.

## Persistence and reload

Raw sample bytes are embedded in the workspace JSON, not just kept in memory:

```text
workspace
  ├── globalVolume: 0.85
  ├── trackVolumes{}  // track id -> 0..1, default 1
  ├── visibleTracks{} // track id -> boolean
  └── kits
      ├── version: 2
      ├── samples[]      // id, instrumentId, label, fileName, path, kitId, kitName, mimeType, data
      ├── synthTracks[]  // legacy instrument ids still rendered with the built-in synth
      └── active: {}     // kept for compatibility; the current flow does not use it
```

- `data` is a `data:<mime>;base64,...` URL created by `src/kits/sample-data.js`. `AudioBuffer`s themselves are never serialized.
- `path` preserves the ZIP folder structure under `kits/<kit-id>/...` for reference; the JSON is the actual storage, so no companion folder is required.
- `normalizeWorkspace()` accepts older `version: 1` workspaces and creates a synth track for every legacy instrument that has no sample. Volumes are clamped to 0–1 with the defaults above. Patterns may keep arbitrary grid row keys; unknown rows are preserved.
- Saving is explicit: **File → Save Workspace** (or the debounced writeback once a file handle exists). Workspaces with samples can become large.
- **Open Workspace / Open Last Workspace** rebuilds decoded buffers from the stored bytes, keyed by sample/track id, and restores visibility and both volume settings. Samples that fail to decode are skipped with a summary toast; the rest of the workspace still loads.
- `New Project`, **Reset Workspace**, and **Unload All Samples / Unload Custom Samples** clear the stored samples, so the next save writes the default kit with 23 synth tracks. Undo restores both the serialized kit and the in-memory decoded buffers for the current session.
- Nothing is written to `localStorage`.

## Adding a new drumkit

1. Zip your samples, keeping whatever folder structure you want.
2. Run **Import Kit (.zip)**, type a label for each file, remove unwanted files, and confirm the import.
3. Save the workspace (or keep saving to the already-open file). The samples travel inside that JSON file.
4. Reopen the workspace later; the samples are decoded and the dynamic track list is restored, along with each row's Drum Grid volume and visibility. No code changes are required and nothing needs to be copied into `assets/drumkits/`.

Files with short abbreviations can be zipped and imported the same way; their names simply need typed labels such as `kick 1`, `snare 1`, `tom grave`.

## Browser security / future Electron notes

- File access uses only user-selected `<input type="file">` elements and browser decoding APIs. The app never reads arbitrary filesystem paths and has no Node.js `fs` usage.
- Browsers do not expose real filesystem paths for security; only file names and contents are available. This is also true in a renderer process unless a preload bridge is added in a later phase.
- Because a browser cannot reliably write a sample folder next to the workspace file, the bytes are embedded in the JSON. A future Electron phase could store them as real files under a combined directory and keep only relative paths in the workspace, without changing the per-track sample model.
- Opening `index.html` from `file://` blocks ES Module imports in Chromium/Firefox. Use a static HTTP server now; a future Electron build should use an appropriate origin/custom scheme while keeping the renderer code browser-only.
- Audio decoding requires a user gesture to create/resume the `AudioContext`; keep the lazy `ensureStarted()` design when adding Electron.
