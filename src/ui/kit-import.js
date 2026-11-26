import { sanitizeKitId } from '../kits/kit-format.js';
import { decodeAudioFile, resolveInstrumentFromLabel } from '../kits/kit-loader.js';
import { bytesToDataUrl, mimeTypeForFileName, sanitizeRelativePath } from '../kits/sample-data.js';
import { readZip } from '../kits/zip.js';
import { INSTRUMENTS, INSTRUMENT_BY_ID } from '../kits/instruments.js';
import { createElement } from '../utils/dom.js';
import { createId } from '../utils/helpers.js';

const AUDIO_EXTENSIONS = /\.(wav|mp3|ogg|m4a|aac|flac)$/i;
const EXAMPLE_LABELS = ['kick 1', 'snare 1', 'snare 2', 'tom grave', 'tom médio', 'tom agudo', 'caixa 1'];

function baseName(name) {
  return String(name).split(/[\\/]/).pop() || name;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Import wizard: reads every supported audio file in a ZIP (including nested
 * folders), lets the user type a free-form name for each one, and resolves that
 * name to a legacy instrument so factory patterns can still drive the sample.
 * Every file becomes its own grid row; duplicate names get a numeric suffix.
 * Raw bytes are stored in the workspace so Save writes them to JSON.
 */
export class KitImportDialog {
  constructor({ audioEngine, toast, state, kitManager, onKitImported }) {
    this.audioEngine = audioEngine;
    this.toast = toast;
    this.state = state;
    this.kitManager = kitManager;
    this.onKitImported = onKitImported || (() => {});
    this.entries = [];
    this.sourceName = '';
    this.importing = false;

    this.modal = document.getElementById('kitImportModal');
    this.fileInput = document.getElementById('kitZipInput');
    this.nameInput = document.getElementById('kitImportName');
    this.status = document.getElementById('kitImportStatus');
    this.list = document.getElementById('kitImportList');
    this.confirmButton = document.getElementById('importKitConfirmBtn');

    const suggestions = document.getElementById('kitLabelSuggestions');
    for (const instrument of INSTRUMENTS) {
      suggestions.appendChild(createElement('option', { attributes: { value: instrument.name } }));
    }
    for (const example of EXAMPLE_LABELS) {
      suggestions.appendChild(createElement('option', { attributes: { value: example } }));
    }

    document.getElementById('closeKitImportBtn').addEventListener('click', () => this.close());
    document.getElementById('importKitCancelBtn').addEventListener('click', () => this.close());
    document.getElementById('chooseKitZipBtn').addEventListener('click', () => this.fileInput.click());
    this.confirmButton.addEventListener('click', () => this.importKit());

    this.fileInput.addEventListener('change', event => {
      const file = event.target.files && event.target.files[0];
      event.target.value = '';
      if (file) this.loadZip(file);
    });
    this.nameInput.addEventListener('input', () => this.updateStatus());
  }

  open() {
    this.reset();
    this.modal.classList.add('open');
  }

  close() {
    if (this.importing) return;
    this.modal.classList.remove('open');
    this.reset();
  }

  reset() {
    this.entries = [];
    this.sourceName = '';
    this.importing = false;
    this.fileInput.value = '';
    this.nameInput.value = '';
    this.list.replaceChildren();
    this.status.textContent = 'Choose a .zip file to start.';
    this.confirmButton.disabled = true;
    this.confirmButton.textContent = 'Import Kit';
  }

  async loadZip(file) {
    this.status.textContent = `Reading "${file.name}"…`;
    this.entries = [];
    this.list.replaceChildren();
    this.confirmButton.disabled = true;

    try {
      const archive = await readZip(await file.arrayBuffer());
      const audioEntries = archive.filter(entry => AUDIO_EXTENSIONS.test(entry.name));
      if (audioEntries.length === 0) throw new Error('No supported audio files found in the ZIP.');

      this.sourceName = file.name.replace(/\.zip$/i, '') || 'drumkit';
      this.nameInput.value = this.sourceName;
      this.entries = audioEntries.map(entry => {
        const fileName = baseName(entry.name);
        const label = fileName.replace(/\.[^.]+$/, '') || fileName;
        const match = resolveInstrumentFromLabel(label);
        return {
          fileName,
          label,
          relativePath: sanitizeRelativePath(entry.name),
          instrumentId: match ? match.id : '',
          data: entry.data,
          mimeType: mimeTypeForFileName(fileName),
          buffer: null,
        };
      });
      this.render();
    } catch (error) {
      this.status.textContent = `Could not read kit: ${error.message}`;
      this.toast.show(`Could not read kit: ${error.message}`);
    }
  }

  render() {
    this.list.replaceChildren();

    for (const entry of this.entries) {
      const row = createElement('div', { className: 'kit-import-row' });

      const info = createElement('div', { className: 'kit-import-info' });
      info.append(
        createElement('strong', { className: 'kit-import-name', text: entry.relativePath }),
        createElement('span', { className: 'kit-import-size', text: formatBytes(entry.data.length) }),
      );

      const playButton = createElement('button', {
        className: 'btn-secondary btn-small',
        text: '▶ Play',
      });
      playButton.addEventListener('click', () => this.audition(entry));

      const labelInput = createElement('input', {
        className: 'kit-import-label',
        attributes: {
          type: 'text',
          list: 'kitLabelSuggestions',
          value: entry.label,
          placeholder: 'Ex.: snare 1, tom grave',
          maxlength: '160',
        },
      });
      labelInput.addEventListener('input', event => {
        entry.label = event.target.value;
        entry.instrumentId = resolveInstrumentFromLabel(entry.label)?.id || '';
        entry.hint.textContent = this.instrumentHint(entry);
        this.updateStatus();
      });

      const hint = createElement('span', {
        className: 'kit-import-hint',
        text: this.instrumentHint(entry),
      });
      entry.hint = hint;

      const removeButton = createElement('button', {
        className: 'btn-secondary btn-small',
        text: 'Remove',
        title: 'Remove this file from the kit',
      });
      removeButton.addEventListener('click', () => {
        this.entries = this.entries.filter(item => item !== entry);
        this.render();
      });

      row.append(info, playButton, labelInput, hint, removeButton);
      this.list.appendChild(row);
    }

    this.updateStatus();
  }

  instrumentHint(entry) {
    const instrument = INSTRUMENT_BY_ID.get(entry.instrumentId);
    return instrument ? `→ herda ${instrument.name}` : '→ faixa própria (sem legado)';
  }

  updateStatus() {
    if (this.entries.length === 0) {
      this.status.textContent = this.sourceName
        ? 'No audio files left. Choose another ZIP.'
        : 'Choose a .zip file to start.';
      this.confirmButton.disabled = true;
      return;
    }

    const mapped = this.entries.filter(entry => entry.instrumentId).length;
    const unmapped = this.entries.length - mapped;
    this.confirmButton.disabled = !this.nameInput.value.trim() || this.importing;
    this.status.textContent = `${this.entries.length} file(s): ${mapped} mapped, ${unmapped} as their own row(s).`;
  }

  async audition(entry) {
    try {
      await this.audioEngine.ensureStarted();
      if (!entry.buffer) {
        // decodeAudioData consumes its ArrayBuffer; keep the original bytes for import.
        entry.buffer = await decodeAudioFile(this.audioEngine.context, new Blob([entry.data.slice()]));
      }
      const instrumentId = entry.instrumentId || 'kick';
      this.audioEngine.play(instrumentId, this.audioEngine.currentTime + 0.01, entry.buffer);
    } catch (_) {
      this.toast.show(`Could not preview "${entry.fileName}"`);
    }
  }

  async importKit() {
    if (this.importing || this.entries.length === 0) return;

    this.importing = true;
    this.confirmButton.disabled = true;
    this.confirmButton.textContent = 'Importing…';
    this.status.textContent = `Importing ${this.entries.length} file(s)…`;

    try {
      await this.audioEngine.ensureStarted();
      const rawName = this.nameInput.value.trim() || this.sourceName || 'drumkit';
      const kitId = sanitizeKitId(rawName);
      const samples = [];
      const buffers = new Map();
      let failed = 0;

      // Every audio file becomes a track. Unmapped labels are kept too; they
      // simply have no legacy instrument to inherit factory-pattern notes.
      for (const entry of this.entries) {
        try {
          const buffer = entry.buffer || await decodeAudioFile(this.audioEngine.context, new Blob([entry.data.slice()]));
          const sample = {
            id: createId('smp'),
            instrumentId: entry.instrumentId,
            label: entry.label.trim() || entry.fileName,
            fileName: entry.fileName,
            path: `kits/${kitId}/${entry.relativePath}`,
            kitId,
            kitName: rawName,
            mimeType: entry.mimeType,
            data: bytesToDataUrl(entry.data, entry.mimeType),
          };
          samples.push(sample);
          buffers.set(sample.id, buffer);
        } catch (_) {
          failed += 1;
        }
      }

      if (samples.length === 0) throw new Error('No sample could be decoded');

      const result = this.state.replaceKitSamples(samples);
      const decodedSamples = result.samples.map(sample => ({
        ...sample,
        buffer: buffers.get(sample.id),
      }));
      this.kitManager.replaceSamples(decodedSamples);

      this.onKitImported();
      const unmapped = samples.filter(sample => !sample.instrumentId).length;
      const details = ['grid rebuilt', 'active pattern cleared'];
      if (unmapped > 0) details.push(`${unmapped} without a legacy track`);
      const suffix = ` (${details.join(', ')})`;
      this.toast.show(
        failed > 0
          ? `Imported ${samples.length} sample(s); ${failed} failed to decode${suffix}`
          : `Imported ${samples.length} sample(s) into "${rawName}"${suffix}`,
      );
      // Allow close() to run after a successful import.
      this.importing = false;
      this.close();
    } catch (error) {
      this.toast.show(`Could not import kit: ${error.message}`);
      this.status.textContent = `Could not import kit: ${error.message}`;
      this.importing = false;
      this.confirmButton.textContent = 'Import Kit';
      this.updateStatus();
    }
  }
}
