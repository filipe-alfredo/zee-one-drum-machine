# ZeeOne Drum Machine

A friendly, zero-runtime-dependency drum sequencer that runs in the browser and can also be packaged as a Windows desktop app. No build step, no CDN, no backend.

> Vanilla JavaScript ES Modules, Web Audio API and CSS. Electron is just a thin optional shell.

## Start here

```bat
npm start
```

Open <http://127.0.0.1:8765/index.html>. That is all — the app is plain static files.

- No install is needed to use the web app.
- Node 18+ is only needed for the dev server and tests.
- Use `PORT=9000 npm start` for another port, or `python -m http.server 8765` if you prefer.

## The short version

- **24 factory patterns**, 23 synth tracks, BPM 40–240 and fixed signatures from 2/4 to 12/4.
- **Import a ZIP** and every audio file becomes its own track, with volume, mute/solo and its own pattern row.
- **Loop Arrangement** paints patterns on a 32-beat timeline (up to 512 beats), each row with its own BPM.
- **Export** the active pattern or the loop as WAV, MP3 or M4A. MP3 and M4A are accepted by WhatsApp Web.
- **Save/Open** a workspace JSON. Chrome, Edge and Electron keep writing to the same file; Firefox and Safari download it and you re-open it to continue.
- **Undo** covers sample removal and the active factory-pattern restore (`↺` in the Patterns panel).
- Collapse/resize tweaks are visual only; track order and mix are saved.

Want the details? See the [user guide](docs/USER_GUIDE.md).

## Tests

```bat
npm test
```

Focused Node tests for the sequencer, state, ZIP handling and persistence helpers. No `npm install` is needed for them.

## Desktop app (optional)

```bat
npm install
npm run electron        # run from source
npm run build:win       # installer + portable .exe in dist/
npm run electron:smoke  # non-interactive load check
```

The desktop shell serves the modules over a random local port and uses native file dialogs. See [Architecture](docs/ARCHITECTURE.md#browser-and-desktop-shell).

## Workspaces and samples

There is no `localStorage` autosave. Every launch shows a small **Start** dialog:

- **New Project** — keeps the 24 factory patterns. The toolbar **New** then offers **Blank Grid** or **Default Kit**.
- **Open Workspace…** — picks a `.json` file.
- **Open Last Workspace** — reopens the remembered file where the browser or Electron supports it.

Once a file is saved or opened, edits are written back to it after a short debounce. Without a save picker, **Save** downloads a fresh JSON file instead. Imported sample bytes travel inside that JSON, so no companion folder is needed.

More: [Workspaces](docs/WORKSPACE.md) · [Drumkits and samples](docs/DRUMKITS.md).

## Project layout

```text
index.html      markup + single ES Module entry
src/            app, audio, sequencer, kits, state, ui, utils, vendor
styles/         local fonts and stylesheets
assets/         fonts, icons, optional gitignored drumkits
electron/       thin desktop shell
scripts/        dev-only static server
tests/          Node logic tests
docs/           detailed guides
```

Full module map: [Architecture](docs/ARCHITECTURE.md).

## Documentation

| Guide | What it covers |
| --- | --- |
| [User guide](docs/USER_GUIDE.md) | Patterns, grid, loop, shortcuts, limitations |
| [Workspaces](docs/WORKSPACE.md) | Save/Open, autosave, browser vs Electron |
| [Drumkits and samples](docs/DRUMKITS.md) | ZIP import, assignment, track model |
| [Export formats](docs/EXPORT_FORMATS.md) | WAV / MP3 / M4A, WhatsApp, file names |
| [Sequencer](docs/SEQUENCER.md) | Steps, timing, arrangement rules |
| [Audio engine](docs/AUDIO_ENGINE.md) | Synthesis, mixing, playback |
| [Architecture](docs/ARCHITECTURE.md) | Module map, data flow, repository layout |
| [Validation](docs/VALIDATION.md) | Test and browser harness results |
| [Git flow](docs/GIT_FLOW.md) | Branching and pull-request rules |
| [Promotion scope](docs/PROMOTION.md) | What changed in the loop release |
