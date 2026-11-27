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
    this.activePreview = null;

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
    this.stopActivePreview();
    this.modal.classList.remove('open');
  }

  setPreviewState(button, playing, name) {
    if (!button) return;
    const label = playing ? `Pause ${name}` : `Play ${name}`;
    button.textContent = playing ? '⏸' : '▶';
    button.title = label;
    button.setAttribute('aria-label', label);
    button.classList.toggle('is-playing', playing);
  }

  stopActivePreview() {
    const preview = this.activePreview;
    if (!preview) return;
    this.activePreview = null;
    if (preview.handle && typeof preview.handle.stop === 'function') preview.handle.stop();
    this.setPreviewState(preview.button, false, preview.name);
  }

  async togglePreview(track, button) {
    if (this.activePreview && this.activePreview.key === track.id) {
      this.stopActivePreview();
      return;
    }

    this.stopActivePreview();
    const preview = { key: track.id, name: track.name, button, handle: null };
    this.activePreview = preview;
    this.setPreviewState(button, true, track.name);

    try {
      const handle = await this.onPreview(track);
      if (this.activePreview !== preview) {
        if (handle && typeof handle.stop === 'function') handle.stop();
        return;
      }
      if (!handle || typeof handle !== 'object') {
        this.stopActivePreview();
        return;
      }
      preview.handle = handle;
      handle.onEnded = () => {
        if (this.activePreview !== preview) return;
        this.activePreview = null;
        this.setPreviewState(preview.button, false, preview.name);
      };
    } catch (_) {
      if (this.activePreview === preview) this.stopActivePreview();
    }
  }

  renderSlots() {
    this.stopActivePreview();
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
        className: 'preview-btn kit-preview-btn',
        text: '▶',
        title: `Play ${track.name}`,
        attributes: {
          type: 'button',
          'aria-label': `Play ${track.name}`,
        },
      });
      previewButton.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        this.togglePreview(track, previewButton);
      });

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
