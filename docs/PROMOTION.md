# Promotion record — Eternal Loop Sequence

This document records the complete scope, decisions and validation for promoting
`feature/eternal-loop-sequence` to `main`.

## Branch and base

- Feature branch: `feature/eternal-loop-sequence`, created from `develop` at `6efbcb6`.
- `main` was at `c8adf92` (`feat(electron): remove native menu bar`), one commit behind `develop`.
- The promotion brings the export fix from `develop` plus the full loop-arrangement work into `main`.
- No commit was pushed. `stash@{0}` (`wip: resizable panels and row order`) was left untouched.

## Scope delivered

### Loop Arrangement

- Replaced the old sequence/lane model with vertical pattern rows against a 32-beat horizontal timeline, paged in 8-beat columns.
- One `☐` cell is a quarter beat; painting fills the pattern's natural length as one continuous beveled orange block.
- Clicking a painted block removes it; rows can overlap in the same column; `✕` removes a row.
- Each row carries its own BPM. There is no global loop BPM and no pattern selector, `Remove Pattern` button or drag reordering.
- **Clear Loop** offers `Clear cells` and `Clear rows and cells`, with copy that explicitly states workspace patterns are never deleted.
- **Loop Mode** is a clear on/off toggle: graphite with a gray dot when off, quiet red tint with a red dot when on.
- **Export Loop (.wav)** renders one full painted cycle and crops the silent tail after the last audible hit. The file name is `zeeone_loop_<rows>rows_<beats>beats.wav`.
- Legacy sequence/lane workspaces are migrated on load; limits are 512 beats, 64 rows and 512 blocks.

### Audio and previews

- `AudioEngine.play()` / `audition()` expose a stoppable handle; `stopAudition(handle)` fades only the selected sound.
- Tracks, Drum Kit, ZIP-import and Loop-picker previews are true `▶`/`⏸` toggles. They stop when replaced, when the dialog closes, and when the sound ends.
- The Kit dialog dropped the word **Preview** for a compact icon button. All four previews now share `.preview-btn`: 20 × 20 px, graphite idle, orange hover/focus, muted red while playing, no glow. Their accessible labels follow `Play <name>` → `Pause <name>`.

### Interface and visual polish

- Toolbar: nearly flat dark buttons, `Save` as the single primary action. New/Open keep orange icons; Clear All/Stop stay muted. BPM badges are graphite pills.
- Active pads and loop blocks share a predominantly orange gradient with a crisp inset border and no outer glow; column widths never shift.
- Block palette keeps orange across most of the height, removes pale highlights and reduces burgundy to a restrained lower edge.
- The kit-name column defaults to 320 px (280 px on narrow windows), with a visible grip, click-to-fit, double-click/Home reset and arrow-key sizing.
- Three visual-only collapse controls: sidebar rail (expander at the top), topbar rail (logo/File/Help only), loop rail (expander at the far right). Loop maximize is mutually exclusive with the rail. None of these states are written to the workspace.
- Loop actions sit together at the far right beside maximize/restore and the chevron.
- Collapse chevrons rotate around their own bounding box (`transform-box: fill-box; transform-origin: center`) instead of a fixed SVG point, so the arrow no longer drifts during or after the animation. The top-bar and loop chevrons were moved two viewBox units upward so they clear both the divider and the panel outline.

### Resize and row order

- Zero-width, keyboard-accessible dividers resize the sidebar, loop panel and kit-name column via CSS custom properties. Drag, arrows and double-click reset are visual only.
- Drum Grid rows can be dragged by their grip; the order is saved in `kits.trackOrder` and restored without changing which pattern row each track plays.

### Desktop shell

- The window starts hidden, is maximized on `ready-to-show`, then shown; the native menu bar is removed.
- Electron uses `assets/icons/app-icon.ico` (multi-size, rasterized from `assets/icons/favicon.svg`) for the window, installer and portable build, with a copy in `resources/` outside `app.asar`.
- **Open Last Workspace** no longer depends on origin-bound IndexedDB: the main process stores only the selected path in `userData/last-workspace.json` and validates it with `fs.access`. The preload bridge exposes native Save/Open/Read/Write and last-path IPC; the renderer adapts those paths to a `FileSystemFileHandle`-shaped object.
- WAV exports never fall back to a silent download when no native picker or File System Access API is available.

## Validation record

| Check | Result |
| --- | --- |
| `node --check` on all `src`, `tests`, `scripts` and `electron` JavaScript files | 49/49 |
| `npm test` | 75/75 |
| Baseline browser harness | 29/29 |
| Extended browser harness | 16/16 |
| Kit import harness | 16/16 |
| Time signature harness | 10/10 |
| Feature updates harness | 13/13 |
| Resize + row-order harness | 20/20 |
| Loop panel harness | 25/25 |
| Workspace persistence harness | 11/11 |
| Workspace actions harness | 7/7 |
| Chevron fit harness (topbar/loop/sidebar, before and after animation) | Identical arrow offsets; 1.42 px bottom gap and 2.13 px divider gap on topbar/loop |
| Preview style harness (Tracks/Kit/ZIP/Loop picker) | 1 distinct idle style, 1 distinct playing style, identical after restore |
| Visual/computed-style comparison | 0 differences, 0 / 1,296,000 changed pixels |
| `npm run electron:smoke` | Renderer loaded; `desktopBridge`, `desktopOpen`, `lastWorkspace` present |
| `npm run build:win` | NSIS installer and portable `.exe` regenerated in `dist/` |
| Ports 8765/8766/8777 and temporary analysis ports | No `LISTENING` entries |

## Generated artifacts

- `dist/ZeeOne Drum Machine Setup 1.0.0.exe`
- `dist/ZeeOne-Drum-Machine-Portable-1.0.0.exe`
- `dist/win-unpacked/resources/app.asar`
- `dist/win-unpacked/resources/app-icon.ico`

## Intentional behaviour retained

- Different row BPMs can drift out of sync; this is accepted because each row is independent.
- Collapse, maximize, resize and keyboard grid settings remain visual-only and are excluded from workspace JSON.
- Active-pattern WAV export renders the full pattern; only loop export crops the silent tail.
- Browsers without File System Access can import JSON via a plain file input but cannot write back to it.

## Rollback

Revert the merge commit on `main`. The feature branch remains available for inspection, and `stash@{0}` remains independent of this promotion.
