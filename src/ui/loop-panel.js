import {
  ARRANGEMENT_STEPS_PER_BAR,
  MAX_BLOCK_BARS,
  countArrangementBlocks,
  getArrangementDurationSec,
} from '../sequencer/arrangement.js';
import { createElement } from '../utils/dom.js';

/**
 * Bottom-of-screen pattern arranger: lanes of draggable pattern blocks laid
 * out over a bar grid. This class owns the arrangement editor, Loop Mode and
 * the visual-only collapse button inside its own toolbar.
 */
export class LoopPanel {
  constructor({ state, toast, confirmDialog, onLoopModeChanged, onExportWav, onToggleCollapse }) {
    this.state = state;
    this.toast = toast;
    this.confirmDialog = confirmDialog;
    this.onLoopModeChanged = onLoopModeChanged || (() => {});
    this.onExportWav = onExportWav || (() => {});
    this.onToggleCollapse = onToggleCollapse || (() => {});

    this.panel = document.getElementById('loopPanel');
    this.toggleButton = document.getElementById('btnToggleLoopPanel');
    this.patternSelect = document.getElementById('loopPatternSelect');
    this.blockBarsInput = document.getElementById('loopBlockBars');
    this.bpmInput = document.getElementById('loopBpmInput');
    this.loopBarsInput = document.getElementById('loopBarsInput');
    this.modeButton = document.getElementById('btnLoopMode');
    this.addLaneButton = document.getElementById('btnAddLoopLane');
    this.clearButton = document.getElementById('btnClearLoop');
    this.deleteButton = document.getElementById('btnDeleteLoopBlock');
    this.exportButton = document.getElementById('btnExportLoop');
    this.grid = document.getElementById('loopGrid');
    this.meta = document.getElementById('loopMeta');

    this.selectedBlockId = null;
    this.selectedPatternId = null;
    this.currentBar = null;

    this.bindEvents();
  }

  bindEvents() {
    this.toggleButton.addEventListener('click', () => this.onToggleCollapse());
    this.patternSelect.addEventListener('change', event => {
      this.selectedPatternId = event.target.value;
    });

    this.blockBarsInput.addEventListener('change', event => {
      const max = Math.min(MAX_BLOCK_BARS, this.state.arrangement.loopBars);
      const value = Number.parseInt(event.target.value, 10);
      event.target.value = String(Number.isFinite(value) ? Math.min(max, Math.max(1, value)) : 1);
    });

    this.bpmInput.addEventListener('change', event => {
      const bpm = this.state.setArrangementBpm(event.target.value);
      this.bpmInput.value = String(bpm);
      this.toast.show(`Loop tempo: ${bpm} BPM`);
    });

    this.loopBarsInput.addEventListener('change', event => {
      const bars = this.state.setLoopBars(event.target.value);
      this.loopBarsInput.value = String(bars);
      this.selectedBlockId = null;
      this.render();
      this.toast.show(`Loop length: ${bars} bars`);
    });

    this.modeButton.addEventListener('click', () => {
      const enabled = !this.state.arrangement.enabled;
      this.state.setLoopEnabled(enabled);
      this.render();
      this.onLoopModeChanged(enabled);
    });

    this.addLaneButton.addEventListener('click', () => {
      this.state.addArrangementLane();
      this.render();
    });

    this.deleteButton.addEventListener('click', () => {
      if (this.selectedBlockId) this.deleteBlock(this.selectedBlockId);
    });

    this.clearButton.addEventListener('click', () => {
      this.confirmDialog.open({
        title: 'Clear Loop Arrangement',
        message: 'Remove every pattern block from the bottom timeline? The patterns themselves are not deleted.',
        confirmLabel: 'Clear Loop',
        danger: true,
        onConfirm: () => {
          this.state.clearArrangementBlocks();
          this.selectedBlockId = null;
          this.render();
          this.toast.show('Loop arrangement cleared');
        },
      });
    });

    this.exportButton.addEventListener('click', () => this.onExportWav());

    window.addEventListener('keydown', event => {
      const active = document.activeElement;
      const tag = active ? active.tagName : '';
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || (active && active.isContentEditable)) return;
      if ((event.key === 'Delete' || event.key === 'Backspace') && this.selectedBlockId) {
        event.preventDefault();
        this.deleteBlock(this.selectedBlockId);
      }
    });
  }

  deleteBlock(blockId) {
    if (!this.state.removeArrangementBlock(blockId)) return;
    this.selectedBlockId = null;
    this.render();
    this.toast.show('Removed pattern block from loop');
  }

  setCollapsed(collapsed) {
    const isCollapsed = Boolean(collapsed);
    const label = isCollapsed ? 'Expand the loop arrangement' : 'Collapse the loop arrangement';
    this.toggleButton.setAttribute('aria-pressed', String(isCollapsed));
    this.toggleButton.title = label;
    this.toggleButton.setAttribute('aria-label', label);
  }

  findBlockAtBar(lane, bar) {
    return lane.blocks.find(block => bar >= block.startBar && bar < block.startBar + block.lengthBars) || null;
  }

  selectBlock(blockId) {
    this.selectedBlockId = blockId;
    for (const node of this.grid.querySelectorAll('.loop-block')) {
      node.classList.toggle('is-selected', node.dataset.blockId === blockId);
    }
    this.deleteButton.disabled = false;
  }

  render() {
    const arrangement = this.state.arrangement;
    const patterns = this.state.workspace.patterns;
    const activePattern = this.state.activePattern;

    const previousSelection = this.selectedPatternId;
    const hasPrevious = patterns.some(pattern => pattern.id === previousSelection);
    this.selectedPatternId = hasPrevious
      ? previousSelection
      : (activePattern ? activePattern.id : (patterns[0] ? patterns[0].id : null));

    this.patternSelect.replaceChildren(...patterns.map(pattern => createElement('option', {
      text: pattern.name,
      attributes: { value: pattern.id, selected: pattern.id === this.selectedPatternId },
    })));

    if (document.activeElement !== this.bpmInput) this.bpmInput.value = String(arrangement.bpm);
    if (document.activeElement !== this.loopBarsInput) this.loopBarsInput.value = String(arrangement.loopBars);
    if (document.activeElement !== this.blockBarsInput) {
      this.blockBarsInput.value = String(Math.min(
        Number.parseInt(this.blockBarsInput.value, 10) || 1,
        MAX_BLOCK_BARS,
        arrangement.loopBars,
      ));
    }

    this.modeButton.textContent = arrangement.enabled ? 'Loop Mode: On' : 'Loop Mode: Off';
    this.modeButton.classList.toggle('is-active', arrangement.enabled);
    this.modeButton.setAttribute('aria-pressed', String(arrangement.enabled));
    this.deleteButton.disabled = !this.selectedBlockId;
    this.panel.classList.toggle('loop-active', arrangement.enabled);

    const seconds = getArrangementDurationSec(arrangement);
    this.meta.textContent = `${arrangement.lanes.length} lanes • ${countArrangementBlocks(arrangement)} blocks • ${arrangement.loopBars} bars • ${seconds.toFixed(1)}s`;

    this.currentBar = null;
    this.renderGrid(arrangement, patterns);
  }

  renderGrid(arrangement, patterns) {
    const patternNames = new Map(patterns.map(pattern => [pattern.id, pattern.name]));
    const rows = [];

    const header = createElement('div', { className: 'loop-row loop-row--header' });
    header.appendChild(createElement('div', { className: 'loop-lane-label', text: 'Bar' }));
    for (let bar = 0; bar < arrangement.loopBars; bar += 1) {
      header.appendChild(createElement('div', {
        className: 'loop-bar-head',
        text: String(bar + 1),
        dataset: { bar: String(bar) },
      }));
    }
    rows.push(header);

    for (const lane of arrangement.lanes) {
      const row = createElement('div', { className: 'loop-row' });
      const label = createElement('div', { className: 'loop-lane-label' });
      label.appendChild(createElement('span', {
        className: 'loop-lane-name',
        text: lane.name,
        title: lane.name,
      }));
      if (arrangement.lanes.length > 1) {
        const remove = createElement('button', {
          className: 'loop-lane-remove',
          text: '✕',
          title: `Remove ${lane.name}`,
        });
        remove.addEventListener('click', () => {
          this.state.removeArrangementLane(lane.id);
          if (!this.state.arrangement.lanes.some(item => item.blocks.some(block => block.id === this.selectedBlockId))) {
            this.selectedBlockId = null;
          }
          this.render();
        });
        label.appendChild(remove);
      }
      row.appendChild(label);

      for (let bar = 0; bar < arrangement.loopBars; bar += 1) {
        const cell = createElement('div', {
          className: 'loop-cell',
          dataset: { laneId: lane.id, bar: String(bar) },
        });

        const block = this.findBlockAtBar(lane, bar);
        if (block && block.startBar === bar) {
          cell.classList.add('has-block');
          const node = createElement('div', {
            className: 'loop-block',
            text: patternNames.get(block.patternId) || 'Pattern',
            title: `${patternNames.get(block.patternId) || 'Pattern'} • ${block.lengthBars} bar(s) • drag to move, double-click to remove`,
            dataset: { blockId: block.id },
            attributes: { draggable: 'true' },
          });
          node.style.setProperty('--loop-block-span', String(block.lengthBars));
          node.classList.toggle('is-selected', block.id === this.selectedBlockId);
          node.addEventListener('click', event => {
            event.stopPropagation();
            this.selectBlock(block.id);
          });
          node.addEventListener('dblclick', event => {
            event.stopPropagation();
            this.deleteBlock(block.id);
          });
          node.addEventListener('dragstart', event => {
            event.stopPropagation();
            event.dataTransfer.setData('text/plain', block.id);
            event.dataTransfer.effectAllowed = 'move';
          });
          cell.appendChild(node);
        } else if (block) {
          cell.classList.add('is-covered');
        }

        cell.addEventListener('click', () => {
          if (block) {
            this.selectBlock(block.id);
            return;
          }
          if (!this.selectedPatternId) {
            this.toast.show('Create a pattern before adding loop blocks');
            return;
          }
          const length = Number.parseInt(this.blockBarsInput.value, 10) || 1;
          const added = this.state.addArrangementBlock({
            laneId: lane.id,
            patternId: this.selectedPatternId,
            startBar: bar,
            lengthBars: length,
          });
          if (!added) {
            this.toast.show('Blocks cannot overlap in the same lane');
            return;
          }
          this.selectedBlockId = added.id;
          this.render();
        });

        cell.addEventListener('dragover', event => {
          if (Array.from(event.dataTransfer.types || []).includes('text/plain')) {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
            cell.classList.add('is-drop-target');
          }
        });
        cell.addEventListener('dragleave', () => cell.classList.remove('is-drop-target'));
        cell.addEventListener('drop', event => {
          event.preventDefault();
          cell.classList.remove('is-drop-target');
          const blockId = event.dataTransfer.getData('text/plain');
          if (!blockId) return;
          if (this.state.moveArrangementBlock(blockId, lane.id, bar)) {
            this.selectedBlockId = blockId;
            this.render();
          } else {
            this.toast.show('Blocks cannot overlap in the same lane');
          }
        });

        row.appendChild(cell);
      }

      rows.push(row);
    }

    this.grid.replaceChildren(...rows);
  }

  updatePlayhead(stepIndex, resetOnly = false) {
    const bar = resetOnly || !Number.isFinite(stepIndex)
      ? null
      : Math.floor(stepIndex / ARRANGEMENT_STEPS_PER_BAR);
    if (bar === this.currentBar) return;
    this.currentBar = bar;
    for (const node of this.grid.querySelectorAll('.is-current')) node.classList.remove('is-current');
    if (bar === null) return;
    for (const node of this.grid.querySelectorAll(`[data-bar="${bar}"]`)) node.classList.add('is-current');
  }
}
