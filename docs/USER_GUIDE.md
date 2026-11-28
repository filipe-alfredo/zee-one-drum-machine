# User guide

The long-form companion to the README. Nothing here is required to get started — it is just the detail behind the short feature list.

## First launch

The app opens on a small **Start** dialog. Pick **New Project** to keep the factory state, **Open Workspace…** to load a `.json` file, or **Open Last Workspace** if one is remembered. The toolbar **New** button later offers **Blank Grid** (no visible tracks) or **Default Kit** (the 23 synth tracks). Factory patterns are available in both cases. See [WORKSPACE.md](WORKSPACE.md) for the save/open rules.

## Patterns and the Drum Grid

- There are **24 factory patterns** in two groups, plus groups and patterns you create yourself.
- **BPM** runs from 40 to 240, with a slider and a number field. The time signature is chosen from fixed presets: 2/4 (8 steps), 3/4 (12), 4/4 (16), 5/4 (20), 6/4 (24), 8/4 (32) and 12/4 (48). Every preset uses four 16th-note steps per beat. An invalid value shows a short message listing the presets.
- **Play / Stop** uses lookahead scheduling and a playhead that follows the audio time.
- The `↺` button beside **+ Pattern** restores the **active factory pattern** — its steps, BPM and signature. It is disabled for custom patterns, asks for confirmation, leaves imported samples, visible rows, row order and other patterns untouched, and offers **Undo** in the toast.
- **Clear All** empties only the active pattern grid; it does not touch tracks or samples.
- Each Drum Grid row has mute, solo, a preview button and a **Vol** slider (0–100 %). **Master Volume** sits in the top toolbar. Both are saved and applied to playback, audition and every export format.
- **Hide Tracks** hides rows without deleting them. If you select a pattern with notes on hidden rows, a dialog offers **Restore Tracks** or **Keep As Is**. Hidden rows stay silent in playback and export either way.
- Active pads use a crisp orange border drawn inside the cell, so the grid never shifts width. Toolbar buttons stay neutral until hover, focus, press or the active playing state; **Save** is the single softly filled primary action.

## Tracks and samples

- Importing a ZIP replaces the kit. Every supported audio file becomes its own row; labels such as `snare 1` or `tom grave` can inherit a legacy instrument's factory notes, and unrecognized names simply get their own row. Duplicate labels receive a suffix.
- Drag a row by its grip (**⠿**) to reorder it. Only the grip starts a drag — the volume slider and mixer buttons do not. The new order is saved in `kits.trackOrder[]` and restored when the workspace is reopened, while pattern notes stay tied to each track's original key.
- **Assign File** replaces the sample on one row. **Use Synth / Remove** removes it and restores the built-in synth when a legacy instrument exists. **Unload All Samples** clears the whole kit. Every removal offers **Undo**.
- The Tracks dialog uses a local draft: checkboxes change only the dialog until **Apply**; **Cancel** discards them. Its ▶/⏸ button auditions one piece at a time and stops when the dialog closes. The Drum Kit dialog uses the same compact preview icons.
- Selecting a factory pattern adds back synth rows only for instruments that have notes but no sample covering them. It never changes visibility.
- Imported bytes are embedded in the workspace JSON and decoded again when the file is opened. See [DRUMKITS.md](DRUMKITS.md) for the full track model and import rules.

## Loop Arrangement

The bottom panel is a vertical list of pattern rows against a horizontal timeline.

- **+ Pattern** opens a modal with every workspace pattern, multiple selection and a ▶/⏸ preview per pattern. Added rows are silent until you paint cells.
- One **☐** cell is one quarter beat. Painting a 2/4 pattern fills 2 cells, 4/4 fills 4 and 12/4 fills 12; the painted block appears as one continuous orange strip. Clicking the strip removes the whole block.
- Rows may overlap in the same column. Each row has its own BPM — there is no global loop BPM. **✕** removes a row.
- **Clear Loop** asks whether to clear only the cells or both cells and rows.
- The timeline starts at 32 beats and grows in pages of 8, up to 512. There are caps of 64 rows and 512 blocks.
- **Loop Mode** repeats the painted cycle while the selected pattern stays editable. The toggle is graphite with a gray dot when off and a quiet red tint when on.
- Older `sequence[]` and `lanes[].blocks[]` workspaces are migrated to painted rows when opened. See [SEQUENCER.md](SEQUENCER.md).

## Export

**Export Active Pattern** and **Export Loop Arrangement** (or the loop toolbar's **Export Loop**) open a format chooser:

| Format | Best for | Cost |
| --- | --- | --- |
| WAV | Lossless 16-bit PCM | Instant |
| MP3 | WhatsApp Web, broad support | A few seconds, local LAME encoder |
| M4A | WhatsApp Web, AAC | About the length of the audio |

The export respects current volumes, visibility, mute and solo. The loop file name reports its size, for example `zeeone_loop_2rows_5beats.m4a`. The loop export trims the silent tail; the active pattern keeps its full length. Electron shows a native Save dialog, Chrome/Edge use the file picker, and Firefox/Safari download the file with the suggested name. Full details in [EXPORT_FORMATS.md](EXPORT_FORMATS.md).

## Layout tips

- Three chevrons collapse the pattern sidebar, the top toolbar and the bottom loop panel into rails. The loop panel can also be maximized so it fills the workspace; maximizing hides the pattern sidebar and Drum Grid.
- The dividers beside the sidebar, above the loop and between a kit name and its volume can be dragged. The kit-name column starts at 320 px (280 px on narrow windows): click its grip or press `Enter` to fit a longer name, double-click or press `Home` to reset, or use arrows (with `Shift` for bigger steps).
- All collapse and resize states are visual only. They reset on reload and are never written to the workspace. Track order, by contrast, **is** saved.

## Keyboard shortcuts

- `Space` — toggle playback.
- `C` — clear all steps (ignored while typing in a field).

## Limitations

- No swing control. Patterns named “Swing” are just names.
- Rows in the loop with different BPMs intentionally drift relative to each other.
- Only fixed quarter-note signatures are offered; `N/D` input and legacy 6/8 or 7/8 timing are gone.
- No pan or effects chain — mixing is mute/solo plus per-track and master gain.
- One sample per track. Assigning another replaces it; importing a ZIP replaces the whole kit.
- Workspaces can grow large because raw audio is embedded as base64.
- `assets/drumkits/**` is gitignored and is never published. Browsers cannot write into it, so licensed packs must be imported locally by each user.
- ES Modules cannot run from `file://`; a static HTTP server is required.
- `file://` is also why Electron serves the renderer over a random loopback port.
