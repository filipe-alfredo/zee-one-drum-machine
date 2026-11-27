import { createElement } from '../utils/dom.js';

/**
 * Visibility dialog with a local draft. Checkboxes never touch the grid behind
 * the modal; only Apply commits the draft in one state change.
 */
export class TracksPanel {
  constructor({ state, toast, onVisibilityChanged, onPreview }) {
    this.state = state;
    this.toast = toast || null;
    this.onVisibilityChanged = onVisibilityChanged || (() => {});
    this.onPreview = onPreview || (() => {});
    this.modal = document.getElementById('tracksModal');
    this.checklist = document.getElementById('tracksChecklist');
    this.summary = document.getElementById('tracksDraftSummary');
    this.draftVisibility = null;
    this.activePreview = null;

    document.getElementById('closeTracksModalBtn').addEventListener('click', () => this.close());
    document.getElementById('cancelTracksModalBtn').addEventListener('click', () => this.close());
    document.getElementById('doneTracksModalBtn').addEventListener('click', () => this.applyDraft());
  }

  open() {
    this.stopActivePreview();
    this.resetDraft();
    this.renderChecklist();
    this.modal.classList.add('open');
  }

  isOpen() {
    return this.modal.classList.contains('open');
  }

  refreshIfOpen() {
    if (!this.isOpen()) return;
    this.stopActivePreview();
    this.resetDraft();
    this.renderChecklist();
  }

  close() {
    this.stopActivePreview();
    this.draftVisibility = null;
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

  resetDraft() {
    this.draftVisibility = {};
    for (const track of this.state.tracks) {
      this.draftVisibility[track.id] = Boolean(this.state.workspace.visibleTracks[track.id]);
    }
  }

  renderChecklist() {
    if (!this.draftVisibility) this.resetDraft();
    this.checklist.replaceChildren();

    for (const track of this.state.tracks) {
      const checked = Boolean(this.draftVisibility[track.id]);
      const label = createElement('label', {
        className: 'track-check-item' + (checked ? '' : ' is-hidden-track'),
        dataset: { trackId: track.id },
      });

      const checkbox = createElement('input', {
        attributes: {
          type: 'checkbox',
          checked,
        },
      });
      checkbox.addEventListener('change', event => {
        this.draftVisibility[track.id] = event.target.checked;
        label.classList.toggle('is-hidden-track', !event.target.checked);
        this.updateDraftSummary();
      });

      const name = createElement('span', {
        className: 'track-check-name',
        text: track.name,
      });
      const previewButton = createElement('button', {
        className: 'preview-btn track-preview-btn',
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

      label.append(checkbox, name, previewButton);
      this.checklist.appendChild(label);
    }

    this.updateDraftSummary();
  }

  updateDraftSummary() {
    if (!this.summary || !this.draftVisibility) return;
    const tracks = this.state.tracks;
    const visible = tracks.filter(track => Boolean(this.draftVisibility[track.id])).length;
    const changed = tracks.some(track =>
      Boolean(this.draftVisibility[track.id]) !== Boolean(this.state.workspace.visibleTracks[track.id]));

    this.summary.textContent = `${visible} of ${tracks.length} tracks shown · ${changed ? 'Not applied yet' : 'No pending changes'}`;
    this.summary.classList.toggle('is-dirty', changed);
  }

  applyDraft() {
    if (!this.draftVisibility) return;
    const tracks = this.state.tracks;
    const visibility = {};
    for (const track of tracks) visibility[track.id] = Boolean(this.draftVisibility[track.id]);

    const changed = tracks.some(track =>
      Boolean(this.draftVisibility[track.id]) !== Boolean(this.state.workspace.visibleTracks[track.id]));
    const visible = tracks.filter(track => Boolean(this.draftVisibility[track.id])).length;

    this.close();
    if (!changed) return;

    this.state.replaceVisibility(visibility);
    this.onVisibilityChanged();
    if (this.toast) this.toast.show(`Tracks updated: ${visible} of ${tracks.length} visible`);
  }
}
