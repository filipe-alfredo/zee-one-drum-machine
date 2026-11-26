import { createElement } from '../utils/dom.js';

/**
 * The kit dialog mirrors the grid: one row per imported file/track. Each row
 * can be previewed, replaced with another file, or removed (restoring the
 * built-in synth when one exists). Bulk unload is delegated to app.js so it
 * shares the same confirmation and Undo path as the File menu.
 */
export class KitPanel {
  constructor({
    kitManager,
    state,
    toast,
    onSamplesChanged,
    onPreview,
    onImportKit,
    onRemoveSample,
    onUnloadSamples,
  }) {
    this.kitManager = kitManager;
    this.state = state;
    this.toast = toast;
    this.onSamplesChanged = onSamplesChanged;
    this.onPreview = onPreview;
    this.onImportKit = onImportKit;
    this.onRemoveSample = onRemoveSample || (() => {});
    this.onUnloadSamples = onUnloadSamples || (() => {});

    this.modal = document.getElementById('kitModal');
    this.slotList = document.getElementById('kitSlotList');

    document.getElementById('closeKitModalBtn').addEventListener('click', () => this.close());
    document.getElementById('doneKitModalBtn').addEventListener('click', () => this.close());
    document.getElementById('importKitBtn').addEventListener('click', () => this.onImportKit());
    document.getElementById('clearCustomSamplesBtn').addEventListener('click', () => {
      this.onUnloadSamples();
    });
  }

  open() {
    this.renderSlots();
    this.modal.classList.add('open');
  }

  isOpen() {
    return this.modal.classList.contains('open');
  }

  refreshIfOpen() {
    if (this.isOpen()) this.renderSlots();
  }

  close() {
    this.modal.classList.remove('open');
  }

  renderSlots() {
    this.slotList.replaceChildren();

    for (const track of this.state.tracks) {
      const sample = this.kitManager.getSample(track.id);
      const row = createElement('div', { className: 'sample-slot-row' });

      const info = createElement('div', { className: 'kit-slot-info' });
      info.append(
        createElement('strong', { className: 'kit-slot-name', text: track.name }),
        createElement('span', {
          className: 'kit-slot-status' + (sample ? ' is-custom' : ''),
          text: sample ? `● ${sample.label || sample.fileName}` : '○ Built-in Web Audio Synth',
        }),
      );

      const actions = createElement('div', { className: 'kit-slot-actions' });

      const previewButton = createElement('button', {
        className: 'btn-secondary btn-small',
        text: 'Preview',
      });
      previewButton.addEventListener('click', () => this.onPreview(track));

      const assignButton = createElement('button', {
        className: 'btn-accent btn-small btn-small--assign',
        text: 'Assign File',
      });
      assignButton.addEventListener('click', () => this.assignFile(track));
      actions.append(previewButton, assignButton);

      if (sample) {
        const hasSynth = Boolean(track.legacyInstrumentId);
        const removeButton = createElement('button', {
          className: 'btn-danger btn-small btn-small--remove',
          text: hasSynth ? 'Use Synth' : 'Remove',
          title: hasSynth
            ? `Remove ${track.name} and restore its built-in synth track`
            : `Remove ${track.name}; it has no built-in synth counterpart`,
        });
        removeButton.addEventListener('click', () => this.onRemoveSample(track));
        actions.appendChild(removeButton);
      }

      row.append(info, actions);
      this.slotList.appendChild(row);
    }
  }

  assignFile(track) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.hidden = true;
    document.body.appendChild(input);

    input.addEventListener('change', async () => {
      const file = input.files && input.files[0];
      if (!file) {
        input.remove();
        return;
      }

      try {
        const metadata = await this.kitManager.loadFile(track, file);
        this.state.setTrackSample(track.id, metadata);
        this.renderSlots();
        this.onSamplesChanged();
        this.toast.show(`Loaded "${file.name}" into ${track.name}`);
      } catch (_) {
        this.toast.show('Could not decode audio file');
      } finally {
        input.remove();
      }
    });

    input.click();
  }

  useSynth(track) {
    this.onRemoveSample(track);
  }

  clearSamples() {
    this.onUnloadSamples();
  }
}
