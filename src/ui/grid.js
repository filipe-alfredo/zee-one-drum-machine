import { METAL_KIT_IDS, STANDARD_KIT_IDS } from '../kits/instruments.js';
import { getBeatGroupSize } from '../sequencer/pattern.js';
import { getChannelVolume, isChannelAudible } from '../sequencer/mixer.js';
import { createElement } from '../utils/dom.js';

export class SequencerGrid {
  constructor({
    state,
    kitManager,
    audioEngine,
    toast,
    onOpenTracks,
    onOpenKit,
    onApplyVisibilityPreset,
    onRequestSample,
  }) {
    this.state = state;
    this.kitManager = kitManager;
    this.audioEngine = audioEngine;
    this.toast = toast;
    this.onOpenTracks = onOpenTracks;
    this.onOpenKit = onOpenKit;
    this.onApplyVisibilityPreset = onApplyVisibilityPreset;
    this.onRequestSample = onRequestSample;

    this.matrix = document.getElementById('sequencerMatrix');
    this.padsByStep = [];
    this.ledElements = [];
    this.currentPlayheadStep = null;

    document.getElementById('openTracksModalBtn').addEventListener('click', () => {
      this.onOpenTracks();
    });
    document.getElementById('openKitModalBtn').addEventListener('click', () => {
      this.onOpenKit();
    });
  }

  render() {
    this.matrix.replaceChildren();
    this.padsByStep = [];
    this.ledElements = [];
    this.currentPlayheadStep = null;

    const pattern = this.state.activePattern;
    this.updateHeaderMeta();
    if (!pattern) return;

    const visibleTracks = this.state.visibleTracks;
    if (visibleTracks.length === 0) {
      this.matrix.appendChild(this.buildEmptyState());
      return;
    }

    const totalSteps = this.state.totalSteps;
    const groupSize = getBeatGroupSize();
    this.padsByStep = Array.from({ length: totalSteps }, () => []);

    for (const track of visibleTracks) {
      const row = createElement('div', { className: 'seq-row' });
      row.append(this.buildTrackHeader(track), this.buildPadsRow(track, pattern, totalSteps, groupSize));
      this.matrix.appendChild(row);
    }

    const ledsBar = createElement('div', { className: 'leds-bar' });
    for (let step = 0; step < totalSteps; step += 1) {
      const cell = createElement('div', { className: 'led-cell' });
      const pip = createElement('div', {
        className: 'led-pip' + (step === 0 ? ' on' : ''),
        dataset: { led: step },
      });
      this.ledElements.push(pip);
      cell.appendChild(pip);
      ledsBar.appendChild(cell);
    }
    this.matrix.appendChild(ledsBar);
  }

  buildEmptyState() {
    const total = this.state.tracks.length;
    const card = createElement('div', { className: 'empty-kit-card' });
    card.append(
      createElement('h3', { text: `DRUM GRID CLEARED (0/${total} TRACKS)` }),
      createElement('p', {
        text: 'All drum kit rows are currently hidden so you can build a clean custom layout from scratch or load a kit preset below.',
      }),
    );

    const actions = createElement('div', { className: 'empty-kit-actions' });
    const addPiecesButton = createElement('button', {
      className: 'btn-accent',
      text: '+ Select Pieces',
    });
    addPiecesButton.addEventListener('click', () => this.onOpenTracks());

    const standardButton = createElement('button', {
      className: 'btn-secondary',
      text: 'Standard Kit (8)',
    });
    standardButton.addEventListener('click', () => {
      this.onApplyVisibilityPreset('standard');
    });

    const metalButton = createElement('button', {
      className: 'btn-secondary',
      text: 'Metal / Rock Kit (11)',
    });
    metalButton.addEventListener('click', () => {
      this.onApplyVisibilityPreset('metal');
    });

    const restoreButton = createElement('button', {
      className: 'btn-secondary',
      text: `Restore All (${total})`,
    });
    restoreButton.addEventListener('click', () => {
      this.onApplyVisibilityPreset('all');
    });

    actions.append(addPiecesButton, standardButton, metalButton, restoreButton);
    card.appendChild(actions);
    return card;
  }

  buildTrackHeader(track) {
    const hasSample = this.kitManager.hasSample(track.id);
    const isMuted = Boolean(this.state.workspace.muted[track.id]);
    const isSolo = Boolean(this.state.workspace.solo[track.id]);
    const volumePercent = Math.round(getChannelVolume(this.state.workspace, track.id) * 100);

    const header = createElement('div', {
      className: 'track-header' + (hasSample ? ' has-sample' : ''),
    });

    const nameWrap = createElement('div', {
      className: 'track-name-wrap',
      title: `Click to audition ${track.name}`,
    });
    nameWrap.append(
      createElement('span', { className: 'custom-dot', title: 'Custom sample loaded' }),
      createElement('span', { text: track.name }),
    );

    const controls = createElement('div', { className: 'track-controls' });
    const volumeWrap = createElement('div', {
      className: 'track-volume-wrap',
      title: `Volume for ${track.name}`,
    });
    const volumeSlider = createElement('input', {
      className: 'track-volume-slider',
      attributes: {
        type: 'range',
        min: '0',
        max: '100',
        step: '1',
        value: String(volumePercent),
        'aria-label': `Volume for ${track.name}`,
      },
    });
    const volumeValue = createElement('span', {
      className: 'track-volume-value',
      text: `${volumePercent}%`,
    });
    volumeWrap.append(volumeSlider, volumeValue);

    const muteButton = createElement('button', {
      className: 'track-mini-btn' + (isMuted ? ' muted-active' : ''),
      text: 'M',
      title: `Mute ${track.name}`,
      dataset: { act: 'mute' },
    });
    const soloButton = createElement('button', {
      className: 'track-mini-btn' + (isSolo ? ' solo-active' : ''),
      text: 'S',
      title: `Solo ${track.name}`,
      dataset: { act: 'solo' },
    });
    const loadButton = createElement('button', {
      className: 'track-mini-btn',
      text: '+',
      title: `Load WAV/MP3 for ${track.name}`,
      dataset: { act: 'load' },
    });
    const hideButton = createElement('button', {
      className: 'track-mini-btn hide-btn',
      text: '×',
      title: `Hide ${track.name} from grid`,
      dataset: { act: 'hide' },
    });

    controls.append(volumeWrap, muteButton, soloButton, loadButton, hideButton);
    header.append(nameWrap, controls);

    volumeWrap.addEventListener('click', event => event.stopPropagation());
    volumeSlider.addEventListener('click', event => event.stopPropagation());
    volumeSlider.addEventListener('input', event => {
      const volume = this.state.setTrackVolume(track.id, Number(event.target.value) / 100);
      volumeValue.textContent = `${Math.round(volume * 100)}%`;
    });

    header.addEventListener('click', event => {
      const actionButton = event.target.closest('[data-act]');
      if (actionButton) {
        event.stopPropagation();
        this.handleTrackAction(track, actionButton.dataset.act);
        return;
      }
      this.auditionInstrument(track, header);
    });

    return header;
  }

  buildPadsRow(track, pattern, totalSteps, groupSize) {
    const padsRow = createElement('div', { className: 'pads-row' });
    const rowKey = track.patternKey;
    if (!Array.isArray(pattern.grid[rowKey])) {
      pattern.grid[rowKey] = new Array(totalSteps).fill(false);
    }

    for (let step = 0; step < totalSteps; step += 1) {
      const beatGroup = Math.floor(step / groupSize);
      const isAlt = beatGroup % 2 === 1;
      const isDivider = (step + 1) % groupSize === 0 && step !== totalSteps - 1;
      const isActive = Boolean(pattern.grid[rowKey][step]);

      const pad = createElement('div', {
        className: 'step-pad'
          + (isAlt ? ' beat-alt' : '')
          + (isDivider ? ' beat-divider' : '')
          + (isActive ? ' active' : ''),
        dataset: { step },
      });

      pad.addEventListener('click', () => {
        const nextActive = !pattern.grid[rowKey][step];
        this.state.setStep(rowKey, step, nextActive);
        pad.classList.toggle('active', nextActive);
        if (nextActive && isChannelAudible(this.state.workspace, track.id)) {
          this.auditionInstrument(track);
        }
      });

      this.padsByStep[step].push(pad);
      padsRow.appendChild(pad);
    }

    return padsRow;
  }

  handleTrackAction(track, action) {
    if (action === 'mute') {
      this.state.toggleMute(track.id);
      this.render();
      return;
    }
    if (action === 'solo') {
      this.state.toggleSolo(track.id);
      this.render();
      return;
    }
    if (action === 'load') {
      this.onRequestSample(track);
      return;
    }
    if (action === 'hide') {
      this.state.setTrackVisible(track.id, false);
      this.render();
    }
  }

  async auditionInstrument(trackOrId, flashElement = null) {
    const track = typeof trackOrId === 'string'
      ? this.state.getTrack(trackOrId)
      : trackOrId;
    if (!track) return;

    try {
      await this.audioEngine.audition(
        track.id,
        this.kitManager.getBuffer(track.id),
        track.legacyInstrumentId,
        getChannelVolume(this.state.workspace, track.id),
      );
      if (flashElement) {
        flashElement.classList.add('flash-audition');
        setTimeout(() => flashElement.classList.remove('flash-audition'), 110);
      }
    } catch (error) {
      this.toast.show(`Audio could not start: ${error.message}`);
    }
  }

  updateHeaderMeta() {
    const pattern = this.state.activePattern;
    const totalSteps = this.state.totalSteps;
    const visibleCount = this.state.visibleTracks.length;
    const totalTracks = this.state.tracks.length;

    const meta = document.getElementById('patternMetaDisplay');
    const strong = createElement('strong', { text: pattern ? pattern.name : 'None' });
    meta.replaceChildren(
      document.createTextNode('Pattern: '),
      strong,
      document.createTextNode(` • ${totalSteps} steps`),
    );

    document.getElementById('openTracksModalBtn').textContent =
      `Tracks (${visibleCount}/${totalTracks})`;
  }

  updatePlayhead(stepIndex, resetOnly = false) {
    if (resetOnly) {
      for (const pads of this.padsByStep) {
        for (const pad of pads) pad.classList.remove('playhead');
      }
      for (const led of this.ledElements) led.classList.remove('on');
      if (this.ledElements[0]) this.ledElements[0].classList.add('on');
      this.currentPlayheadStep = null;
      return;
    }

    if (this.currentPlayheadStep !== null) {
      const previousPads = this.padsByStep[this.currentPlayheadStep] || [];
      for (const pad of previousPads) pad.classList.remove('playhead');
      const previousLed = this.ledElements[this.currentPlayheadStep];
      if (previousLed) previousLed.classList.remove('on');
    } else {
      // After a reset or a re-render the step-0 LED is already lit; clear the
      // LEDs so exactly one indicator is active at a time.
      for (const led of this.ledElements) led.classList.remove('on');
    }

    const currentPads = this.padsByStep[stepIndex] || [];
    for (const pad of currentPads) pad.classList.add('playhead');
    const currentLed = this.ledElements[stepIndex];
    if (currentLed) currentLed.classList.add('on');
    this.currentPlayheadStep = stepIndex;
  }
}
