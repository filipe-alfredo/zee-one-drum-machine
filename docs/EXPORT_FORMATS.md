# Export formats

Both export entry points — **File → Export Active Pattern...**, **File → Export Loop Arrangement...** and the loop toolbar's **Export Loop...** button — open the same modal before anything is rendered. The modal explains each format and then calls the existing save-target flow.

## Why WAV was rejected by WhatsApp Web

`encodeWavBlob()` produces a valid RIFF/WAVE file: PCM signed 16-bit, stereo, 44.1 kHz, 44-byte header with coherent `fmt ` and `data` chunks. The rejection is a **codec policy**, not corruption, size or sample rate. WhatsApp Web accepts AAC/M4A, MP3, AMR and mono OGG/Opus as audio; WAV is not in that list.

## Formats offered

| Format | Encoder | Cost | WhatsApp Web | Notes |
| --- | --- | --- | --- | --- |
| WAV | `encodeWavBlob()` on the offline render | Instant | No | Lossless 16-bit stereo PCM at 44.1 kHz; active pattern keeps its full length |
| M4A | `MediaRecorder` with `audio/mp4;codecs=mp4a.40.2` | Real time | Yes | AAC-LC in an MP4 container; no library involved |
| MP3 | Vendored LAME `@breezystack/lamejs` 1.2.7 | Fast, local | Yes | 192 kbps, mono/stereo; encoder module is imported only when selected |

Capability probes confirmed `audio/mp4;codecs=mp4a.40.2` in Edge 158 and Electron 45 (Chromium 156). `audio/mpeg` and `audio/ogg;codecs=opus` are not supported by MediaRecorder there; Opus is only available in WebM, which WhatsApp does not accept. MP3 therefore needs a JavaScript encoder, vendored under `src/vendor/lamejs.js` with its LGPL notice in `src/vendor/LICENSE-lamejs.txt`.

MP3 encoding uses [LAME](https://lame.sourceforge.net/) through `@breezystack/lamejs` 1.2.7, licensed under the LGPL. The encoder is unmodified apart from a provenance comment, and the license text ships with the app.

## Pipeline

1. The modal returns a format id (`wav`, `m4a`, `mp3`).
2. `requestSaveTarget()` is called **immediately**, while the modal click is still an active user gesture. Electron shows a native dialog with `filters` for that extension; Chromium uses `showSaveFilePicker()` with the matching MIME type. There is no silent download fallback.
3. `renderAudioExport()` runs the existing `OfflineAudioContext` render once, then `trimAudioBuffer()` applies the loop's silent-tail crop for **all** formats.
4. The chosen encoder turns that buffer into a Blob, and `writeSaveTarget()` writes it to the exact file selected in step 2.

M4A records the buffer through a live `AudioContext` and `MediaStreamDestination`; `sourceNode.onended` stops the recorder when the buffer finishes, because a `MediaStreamDestination` track stays live after playback. A safety timeout reports a clear error instead of hanging. Progress is reported through a toast while encoding.

## File names and filters

- Active pattern: `zeeone_<pattern>_<bpm>bpm.<ext>`
- Loop: `zeeone_loop_<rows>rows_<beats>beats.<ext>`

The stem is unchanged from the previous WAV export; only the extension follows the chosen format. Save dialogs use `audio/wav`, `audio/mp4` and `audio/mpeg` with the corresponding single extension.

## Validation

- Node unit tests cover the format descriptors, extension replacement, `trimAudioBuffer()` and real MP3 frames from the vendored encoder.
- The `export-formats.mjs` browser harness covers modal options and cancel/Escape, all three active-pattern exports, save-dialog MIME metadata, and a loop MP3 export with cropped tail. Header checks are `RIFF` for WAV, an MP4 `ftyp` box for M4A and an MPEG frame sync for MP3.
- The pre-existing browser harnesses were updated to pick WAV in the new modal and still pass unchanged in their assertions.
