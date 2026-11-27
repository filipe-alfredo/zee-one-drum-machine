import {
  countArrangementBlocks,
  countArrangementRows,
  getArrangementBeats,
  getArrangementRow,
  getArrangementRowsAtTime,
  getBeatsForPattern,
  getBlockAtBeat,
  getTimelineBeats,
} from '../sequencer/arrangement.js';
import { createElement } from '../utils/dom.js';

/**
 * Bottom-of-screen loop arranger. Each workspace pattern added to the loop
 * becomes a vertical row; the horizontal timeline is a grid of quarter-beats.
 * Painting a cell adds one complete occurrence of that row's pattern.
 */
export class LoopPanel {
  constructor({
    state,
    toast,
    onLoopModeChanged,
    onExportWav,
    onToggleCollapse,
    onToggleMaximize,
    onPreviewPattern,
  }) {
    this.state = state;
    this.toast = toast;
    this.onLoopModeChanged = onLoopModeChanged || (() => {});
    this.onExportWav = onExportWav || (() => {});
    this.onToggleCollapse = onToggleCollapse || (() => {});
    this.onToggleMaximize = onToggleMaximize || (() => {});
    this.onPreviewPattern = onPreviewPattern || (() => Promise.resolve(false));

    this.panel = document.getElementById('loopPanel');
    this.toggleButton = document.getElementById('btnToggleLoopPanel');
    this.maximizeButton = document.getElementById('btnMaximizeLoopPanel');
    this.modeButton = document.getElementById('btnLoopMode');
    this.addButton = document.getElementById('btnAddLoopPattern');
    this.clearButton = document.getElementById('btnClearLoop');
    this.exportButton = document.getElementById('btnExportLoop');
    this.grid = document.getElementById('loopGrid');
    this.meta = document.getElementById('loopMeta');

    this.pickerModal = document.getElementById('loopPatternModal');
    this.pickerList = document.getElementById('loopPatternList');
    this.pickerSummary = document.getElementById('loopPatternDraftSummary');
    this.pickerAccept = document.getElementById('addLoopPatternsBtn');
    this.clearModal = document.getElementById('clearLoopModal');
    this.previewPatternId = null;
    this.pickerSelection = new Set();
    this.currentKey = '';

    this.bindEvents();
  }

  bindEvents() {
    this.toggleButton.addEventListener('click', () => this.onToggleCollapse());
    this.maximizeButton.addEventListener('click', () => this.onToggleMaximize());

    this.modeButton.addEventListener('click', () => {
      const enabled = !this.state.arrangement.enabled;
      this.state.setLoopEnabled(enabled);
      this.render();
      this.onLoopModeChanged(enabled);
    });

    this.addButton.addEventListener('click', () => this.openPicker());
    document.getElementById('closeLoopPatternModalBtn').addEventListener('click', () => this.closePicker());
    document.getElementById('cancelLoopPatternModalBtn').addEventListener('click', () => this.closePicker());
    this.pickerAccept.addEventListener('click', () => this.addSelectedPatterns());

    this.clearButton.addEventListener('click', () => {
      this.clearModal.classList.add('open');
    });
    document.getElementById('closeClearLoopBtn').addEventListener('click', () => this.closeClearLoop());
    document.getElementById('cancelClearLoopBtn').addEventListener('click', () => this.closeClearLoop());
    document.getElementById('clearLoopCellsBtn').addEventListener('click', () => {
      const cleared = this.state.clearLoopBlocks();
      this.closeClearLoop();
      this.render();
      this.toast.show(cleared ? 'Loop cells cleared' : 'No cells to clear');
    });
    document.getElementById('clearLoopAllBtn').addEventListener('click', () => {
      const cleared = this.state.clearLoopRows();
      this.closeClearLoop();
      this.render();
      this.toast.show(cleared ? 'Loop rows and cells cleared' : 'The loop is already empty');
    });

    this.exportButton.addEventListener('click', () => this.onExportWav());
  }

  closeClearLoop() {
    this.clearModal.classList.remove('open');
  }

  openPicker() {
    const arrangement = this.state.arrangement;
    const existingIds = new Set(arrangement.rows.map(row => row.patternId));
    this.pickerSelection = new Set(
      [...this.pickerSelection].filter(id => !existingIds.has(id) && this.state.getPattern(id)),
    );
    this.renderPicker();
    this.pickerModal.classList.add('open');
  }

  closePicker() {
    this.pickerModal.classList.remove('open');
    this.pickerSelection.clear();
    if (this.previewPatternId) {
      this.previewPatternId = null;
      this.onPreviewPattern(null, false);
      this.renderPicker();
    }
  }

  renderPicker() {
    const arrangement = this.state.arrangement;
    const existingIds = new Set(arrangement.rows.map(row => row.patternId));
    this.pickerList.replaceChildren();

    for (const pattern of this.state.workspace.patterns) {
      const exists = existingIds.has(pattern.id);
      const selected = this.pickerSelection.has(pattern.id);
      const item = createElement('div', {
        className: `loop-picker-item${selected ? ' is-selected' : ''}${exists ? ' is-existing' : ''}`,
        dataset: { patternId: pattern.id },
      });

      const check = createElement('input', {
        className: 'loop-picker-check',
        attributes: {
          type: 'checkbox',
          checked: selected,
          disabled: exists,
          'aria-label': `Add ${pattern.name} to the loop`,
        },
      });
      check.addEventListener('change', () => {
        if (check.checked) this.pickerSelection.add(pattern.id);
        else this.pickerSelection.delete(pattern.id);
        this.renderPicker();
      });
      item.appendChild(check);

      item.appendChild(createElement('span', {
        className: 'loop-picker-name',
        text: pattern.name,
        title: pattern.name,
      }));
      item.appendChild(createElement('span', {
        className: 'loop-picker-meta',
        text: exists ? 'in loop' : `${pattern.timeSignature} • ${pattern.bpm} BPM`,
      }));

      const isPreviewing = this.previewPatternId === pattern.id;
      const previewLabel = `${isPreviewing ? 'Pause' : 'Play'} ${pattern.name}`;
      const preview = createElement('button', {
        className: 'preview-btn loop-picker-preview' + (isPreviewing ? ' is-playing' : ''),
        text: isPreviewing ? '⏸' : '▶',
        title: previewLabel,
        attributes: {
          type: 'button',
          'aria-label': previewLabel,
        },
      });
      preview.addEventListener('click', async () => {
        const shouldPlay = this.previewPatternId !== pattern.id;
        this.previewPatternId = shouldPlay ? pattern.id : null;
        const playing = await this.onPreviewPattern(pattern, shouldPlay);
        if (!playing) this.previewPatternId = null;
        this.renderPicker();
      });
      item.appendChild(preview);
      this.pickerList.appendChild(item);
    }

    const count = this.pickerSelection.size;
    this.pickerSummary.textContent = `${count} pattern${count === 1 ? '' : 's'} selected`;
    this.pickerAccept.disabled = count === 0;
  }

  async addSelectedPatterns() {
    const ids = [...this.pickerSelection];
    const added = this.state.addLoopRows(ids);
    this.pickerSelection.clear();
    this.closePicker();
    this.render();
    if (added.length > 0) {
      this.toast.show(`Added ${added.length} pattern${added.length === 1 ? '' : 's'} to the loop`);
    } else {
      this.toast.show('No new patterns were added');
    }
  }

  setCollapsed(collapsed) {
    const isCollapsed = Boolean(collapsed);
    const label = isCollapsed ? 'Expand the loop arrangement' : 'Collapse the loop arrangement';
    this.toggleButton.setAttribute('aria-pressed', String(isCollapsed));
    this.toggleButton.title = label;
    this.toggleButton.setAttribute('aria-label', label);
  }

  setMaximized(maximized) {
    const isMaximized = Boolean(maximized);
    const label = isMaximized ? 'Restore the loop arrangement' : 'Maximize the loop arrangement';
    this.maximizeButton.setAttribute('aria-pressed', String(isMaximized));
    this.maximizeButton.title = label;
    this.maximizeButton.setAttribute('aria-label', label);
    this.maximizeButton.classList.toggle('is-maximized', isMaximized);
  }

  render() {
    const arrangement = this.state.arrangement;
    const patterns = this.state.workspace.patterns;
    const patternById = new Map(patterns.map(pattern => [pattern.id, pattern]));

    this.modeButton.textContent = arrangement.enabled ? 'Loop Mode: On' : 'Loop Mode: Off';
    this.modeButton.classList.toggle('is-active', arrangement.enabled);
    this.modeButton.setAttribute('aria-pressed', String(arrangement.enabled));
    const modeTitle = arrangement.enabled
      ? 'Loop Mode on: click to return to the active pattern'
      : 'Loop Mode off: click to play the painted loop';
    this.modeButton.title = modeTitle;
    this.modeButton.setAttribute('aria-label', modeTitle);
    this.panel.classList.toggle('loop-active', arrangement.enabled);
    this.addButton.disabled = patterns.length === 0;

    const rows = countArrangementRows(arrangement);
    const blocks = countArrangementBlocks(arrangement);
    const beats = getArrangementBeats(arrangement);
    this.meta.textContent = `${rows} rows • ${blocks} blocks • ${beats} beats`;

    this.renderTimeline(arrangement, patternById);
  }

  renderTimeline(arrangement, patternById) {
    const timelineBeats = getTimelineBeats(arrangement);
    const timeline = createElement('div', { className: 'loop-timeline' });
    timeline.style.setProperty('--loop-cols', String(timelineBeats));

    const head = createElement('div', { className: 'loop-timeline-head' });
    head.appendChild(createElement('div', {
      className: 'loop-head-label',
      text: 'PATTERN ROWS',
    }));
    const ticks = createElement('div', { className: 'loop-head-cells' });
    for (let beat = 0; beat < timelineBeats; beat += 1) {
      ticks.appendChild(createElement('span', {
        className: `loop-beat-tick${beat % 4 === 0 ? ' is-bar' : ''}`,
        text: beat % 4 === 0 ? String(beat / 4 + 1) : '·',
      }));
    }
    head.appendChild(ticks);
    timeline.appendChild(head);

    if (arrangement.rows.length === 0) {
      timeline.appendChild(createElement('div', {
        className: 'loop-empty',
        text: 'No pattern rows yet. Click + Pattern to choose patterns, then paint their cells to build the loop.',
      }));
      this.grid.replaceChildren(timeline);
      return;
    }

    arrangement.rows.forEach((row, index) => {
      const pattern = patternById.get(row.patternId);
      const name = pattern ? pattern.name : 'Missing pattern';
      const signature = pattern ? pattern.timeSignature : '—';
      const beats = pattern ? getBeatsForPattern(pattern) : 0;

      const rowElement = createElement('div', {
        className: 'loop-row',
        dataset: { rowId: row.id, patternId: row.patternId },
      });

      const label = createElement('div', { className: 'loop-row-label' });
      label.appendChild(createElement('span', {
        className: 'loop-row-index',
        text: String(index + 1),
      }));
      label.appendChild(createElement('span', {
        className: 'loop-row-name',
        text: name,
        title: `${name} — ${signature}, ${beats} beats`,
      }));
      label.appendChild(createElement('span', {
        className: 'loop-row-signature',
        text: signature,
      }));

      const bpm = createElement('input', {
        className: 'loop-row-bpm',
        attributes: {
          type: 'number',
          min: '40',
          max: '240',
          value: String(row.bpm),
          title: `BPM for ${name}`,
          'aria-label': `BPM for ${name}`,
        },
      });
      bpm.addEventListener('change', event => {
        const value = this.state.setLoopRowBpm(row.id, event.target.value);
        event.target.value = String(value);
        this.render();
      });
      label.appendChild(bpm);

      const remove = createElement('button', {
        className: 'loop-row-remove',
        text: '✕',
        title: `Remove ${name} from the loop`,
        attributes: { type: 'button', 'aria-label': `Remove ${name} from the loop` },
      });
      remove.addEventListener('click', () => this.removeRow(row.id, name));
      label.appendChild(remove);
      rowElement.appendChild(label);

      const cells = createElement('div', { className: 'loop-row-cells' });
      for (let beat = 0; beat < timelineBeats; beat += 1) {
        const block = getBlockAtBeat(row, beat);
        const cell = createElement('button', {
          className: `loop-cell${block ? ' is-painted' : ''}${block && block.start === beat ? ' is-block-start' : ''}`,
          dataset: {
            rowId: row.id,
            beat: String(beat),
            ...(block ? { blockId: block.id } : {}),
          },
          attributes: {
            type: 'button',
            'aria-label': block
              ? `Remove ${name} block starting at beat ${block.start + 1}`
              : `Paint ${name} starting at beat ${beat + 1}`,
            title: block
              ? `Click to remove this ${block.beats}-beat block`
              : `Click to place ${name} (${beats || 1} beats)`,
          },
        });
        cell.addEventListener('click', () => this.toggleCell(row.id, beat));
        cells.appendChild(cell);
      }
      const blockLayer = createElement('div', { className: 'loop-block-layer' });
      for (const block of row.blocks) {
        const strip = createElement('div', {
          className: 'loop-block',
          dataset: { blockId: block.id, start: String(block.start) },
        });
        strip.style.left = `calc(${block.start} * var(--loop-cell-size))`;
        strip.style.width = `calc(${block.beats} * var(--loop-cell-size))`;
        strip.title = `${name} • ${block.beats} beats from beat ${block.start + 1}`;
        blockLayer.appendChild(strip);
      }
      cells.appendChild(blockLayer);

      rowElement.appendChild(cells);
      timeline.appendChild(rowElement);
    });

    this.grid.replaceChildren(timeline);
    this.applyPlayhead();
  }

  toggleCell(rowId, beat) {
    const result = this.state.toggleLoopBlock(rowId, beat);
    if (!result) {
      this.toast.show('That cell could not be painted');
      return;
    }
    this.render();
    const row = getArrangementRow(this.state.arrangement, rowId);
    const pattern = row ? this.state.getPattern(row.patternId) : null;
    const name = pattern ? pattern.name : 'pattern';
    this.toast.show(result.action === 'added'
      ? `Placed ${name} at beat ${beat + 1}`
      : `Removed ${name} block`);
  }

  removeRow(rowId, name) {
    if (!this.state.removeLoopRow(rowId)) return;
    this.render();
    this.toast.show(`Removed ${name} from the loop`);
  }

  updatePlayhead(timeSec, resetOnly = false, event = null) {
    if (resetOnly || !event || event.source !== 'loop') {
      this.currentKey = '';
      this.applyPlayhead();
      return;
    }
    const active = getArrangementRowsAtTime(
      this.state.arrangement,
      this.state.workspace.patterns,
      timeSec,
    );
    const key = active.map(item => item.blockId).sort().join(',');
    if (key === this.currentKey) return;
    this.currentKey = key;
    this.applyPlayhead(active);
  }

  applyPlayhead(active = []) {
    const activeRows = new Set(active.map(item => item.rowId));
    const activeBlocks = new Set(active.map(item => item.blockId));
    for (const row of this.grid.querySelectorAll('.loop-row')) {
      row.classList.toggle('is-current', activeRows.has(row.dataset.rowId));
      for (const cell of row.querySelectorAll('.loop-cell')) {
        cell.classList.toggle('is-current', activeBlocks.has(cell.dataset.blockId));
      }
      for (const strip of row.querySelectorAll('.loop-block')) {
        strip.classList.toggle('is-current', activeBlocks.has(strip.dataset.blockId));
      }
    }
  }
}
