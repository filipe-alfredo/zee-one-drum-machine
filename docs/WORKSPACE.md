# Workspaces

A workspace is a single `.json` file. There is no `localStorage` autosave: every launch starts from the factory workspace until you choose a file.

## Startup dialog

| Choice | What happens |
| --- | --- |
| **New Project** | Keeps the clean 24-pattern factory workspace. |
| **Open Workspace…** | Picks a `.json` file. Chrome/Edge and Electron also keep a writable handle or path. |
| **Open Last Workspace** | Reopens the remembered file, if there is one. |

The toolbar **New** button opens a second chooser: **Blank Grid** hides all 23 tracks while keeping the factory patterns; **Default Kit** shows the synth tracks. Both clear the current file handle.

## Saving

- **File → Save Workspace** asks for a name and destination the first time (suggested name `zeeone_drum_workspace.json`), then writes to that same file. Numbered copies such as `... (6).json` are not created.
- **Save Workspace As…** picks another file.
- After a file has been saved or opened, edits are written back after a short debounce. Before that, nothing is persisted.
- Where no save API exists, **Save** downloads `zeeone_drum_workspace.json` through a normal browser link and tells you to open it. That file is fully usable, but there is no writable handle, so auto-save is unavailable until it is opened in a picker-capable browser.

## Remembering the last file

- Browsers keep the last `FileSystemFileHandle` in IndexedDB. Handles cannot be stored in `localStorage`, and opening them asks for permission again on a later visit.
- Electron uses a random loopback port each session, which would make IndexedDB a new origin every time. The main process therefore stores only the chosen path in `userData/last-workspace.json` and exposes native open/read/write calls through the preload bridge. **Open Last Workspace** survives restarts there.
- The renderer code is identical in all three environments: it checks for `window.zeeoneDesktop`, then the Chrome/Edge picker, then falls back to download plus `<input type="file">`.

## What is inside the file

```text
workspace
  ├── activePatternId, showHiddenGroups, globalVolume
  ├── visibleTracks{}, trackVolumes{}, muted{}, solo{}
  ├── groups[], patterns[]      // ids, names, BPM, signature, step grids
  ├── kits                      // version 2
  │   ├── samples[]             // includes raw audio as base64 data URLs
  │   ├── synthTracks[]
  │   ├── active: {}            // kept for compatibility
  │   └── trackOrder[]          // saved Drum Grid row order
  └── arrangement               // loop rows, blocks, per-row BPM, timeline size
```

Imported sample bytes, track names, visibility, volumes, mute/solo and row order all travel in this one file. Collapse states, resize sizes and loop maximization are visual only and are **not** saved.

Opening a workspace rebuilds decoded audio buffers from the embedded bytes. Samples that fail to decode are skipped with a summary toast; the rest of the workspace still loads. See [ARCHITECTURE.md](ARCHITECTURE.md#state-management) for validation and normalization rules, and [DRUMKITS.md](DRUMKITS.md) for why the audio lives in the JSON rather than in `assets/drumkits/`.
