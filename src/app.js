import { AudioEngine } from './audio/audio-engine.js';
import { renderAudioExport } from './audio/export-audio.js';
import {
  buildExportFileName,
  getExportFormat,
} from './audio/export-formats.js';
import {
  buildLoopWavFileName,
  buildWavFileName,
} from './audio/wav-export.js';
import { METAL_KIT_IDS, STANDARD_KIT_IDS } from './kits/instruments.js';
import { KitManager } from './kits/kit-manager.js';
import { dataUrlToBytes } from './kits/sample-data.js';
import { cloneGrid, getStepCountForSig } from './sequencer/pattern.js';
import { Sequencer } from './sequencer/sequencer.js';
import { AppState } from './state/app-state.js';
import { WorkspaceFileController } from './state/workspace-file.js';
import { Controls } from './ui/controls.js';
import { ExportFormatDialog } from './ui/export-format-dialog.js';
import { SequencerGrid } from './ui/grid.js';
import { KitImportDialog } from './ui/kit-import.js';
import { KitPanel } from './ui/kit-panel.js';
import { LoopPanel } from './ui/loop-panel.js';
import { NewWorkspaceDialog } from './ui/new-workspace-dialog.js';
import { ConfirmDialog, ItemEditorDialog } from './ui/modals.js';
import { PatternsPanel } from './ui/patterns-panel.js';
import { installResizeHandles, installTrackNameResize } from './ui/resize-handles.js';
import { StartupDialog } from './ui/startup-dialog.js';
import { Toast } from './ui/toast.js';
import { TracksPanel } from './ui/tracks-panel.js';
import { requestSaveTarget, writeSaveTarget } from './utils/file-output.js';

class DrumMachineApp {
  constructor() {
    this.playRequestToken = 0;
    this.sidebarCollapsed = false;
    this.topbarCollapsed = false;
    this.loopCollapsed = false;
    this.loopMaximized = false;
    this.previewPatternId = null;

    this.audioEngine = new AudioEngine();
    this.toast = new Toast();
    this.state = new AppState({
      onPersist: () => this.workspaceFiles && this.workspaceFiles.notifyChanged(),
    });
    this.audioEngine.setMasterVolume(this.state.workspace.globalVolume);
    this.workspaceFiles = new WorkspaceFileController({
      state: this.state,
      toast: this.toast,
      onStatus: text => this.controls && this.controls.setStatus(text),
      onWorkspaceLoaded: () => this.afterWorkspaceLoaded(),
    });
    this.kitManager = new KitManager(this.audioEngine);
    this.confirmDialog = new ConfirmDialog();
    this.exportFormatDialog = new ExportFormatDialog();
    this.itemEditor = new ItemEditorDialog({
      getGroups: () => this.state.workspace.groups,
      toast: this.toast,
    });

    this.sequencer = new Sequencer({
      audioEngine: this.audioEngine,
      state: this.state,
      kitManager: this.kitManager,
      onStep: (stepIndex, resetOnly, event) => {
        if (event && event.source === 'loop') {
          if (this.loopPanel) this.loopPanel.updatePlayhead(event.time, false, event);
          return;
        }
        this.grid.updatePlayhead(stepIndex, resetOnly);
        if (this.loopPanel) this.loopPanel.updatePlayhead(stepIndex, resetOnly);
      },
    });

    this.grid = new SequencerGrid({
      state: this.state,
      kitManager: this.kitManager,
      audioEngine: this.audioEngine,
      toast: this.toast,
      onOpenTracks: () => this.tracksPanel.open(),
      onOpenKit: () => this.kitPanel.open(),
      onApplyVisibilityPreset: preset => this.applyGridVisibilityPreset(preset),
      onRequestSample: track => this.kitPanel.assignFile(track),
    });

    this.patternsPanel = new PatternsPanel({
      state: this.state,
      toast: this.toast,
      confirmDialog: this.confirmDialog,
      itemEditor: this.itemEditor,
      onPatternSelected: (pattern, hiddenTracks) => this.afterPatternSelected(pattern, hiddenTracks),
      onChange: () => this.refreshWorkspaceUI(),
    });

    this.loopPanel = new LoopPanel({
      state: this.state,
      toast: this.toast,
      confirmDialog: this.confirmDialog,
      onLoopModeChanged: () => this.afterLoopModeChanged(),
      onExportWav: () => this.promptExport('loop'),
      onToggleCollapse: () => this.toggleLoopPanel(),
      onToggleMaximize: () => this.toggleLoopMaximize(),
      onPreviewPattern: (pattern, shouldPlay) => this.setPatternPreview(pattern, shouldPlay),
    });

    this.tracksPanel = new TracksPanel({
      state: this.state,
      toast: this.toast,
      onVisibilityChanged: () => this.grid.render(),
      onPreview: track => this.grid.auditionInstrument(track),
    });

    this.kitImport = new KitImportDialog({
      audioEngine: this.audioEngine,
      toast: this.toast,
      state: this.state,
      kitManager: this.kitManager,
      onKitImported: () => this.afterKitImported(),
    });

    this.kitPanel = new KitPanel({
      kitManager: this.kitManager,
      state: this.state,
      toast: this.toast,
      onSamplesChanged: () => this.grid.render(),
      onPreview: track => this.grid.auditionInstrument(track),
      onImportKit: () => this.kitImport.open(),
      onRemoveSample: track => this.removeSample(track),
      onUnloadSamples: () => this.unloadSamples(),
    });

    this.controls = new Controls({
      onPlayToggle: () => this.togglePlayback(),
      onStop: () => this.stopPlayback(),
      onTempoChange: value => this.changeTempo(value),
      onTimeSignatureChange: value => this.changeTimeSignature(value),
      onGlobalVolumeChange: value => this.changeGlobalVolume(value),
      onClearKit: () => this.clearKit(),
      onClearAll: () => this.clearAll(),
      onOpenWorkspaceFile: file => this.openWorkspaceFile(file),
      onOpenWorkspacePicker: () => this.workspaceFiles.open(),
      onSaveWorkspace: () => this.saveWorkspace(),
      onSaveWorkspaceAs: () => this.workspaceFiles.save({ saveAs: true }),
      onExportWav: () => this.promptExport('pattern'),
      onExportLoop: () => this.promptExport('loop'),
      onToggleSidebar: () => this.toggleSidebar(),
      onToggleTopbar: () => this.toggleTopbar(),
      onOpenKit: () => this.kitPanel.open(),
      onUnloadSamples: () => this.unloadSamples(),
      onResetWorkspace: () => this.resetWorkspace(),
    });

    this.startup = new StartupDialog({
      onNewProject: () => this.startNewProject(),
      onOpenFile: () => this.workspaceFiles.open(),
      onOpenLast: () => this.workspaceFiles.openLast(),
      getLastInfo: () => this.workspaceFiles.getLastInfo(),
    });

    this.newWorkspaceDialog = new NewWorkspaceDialog({
      onBlank: () => this.startBlankWorkspace(),
      onDefaultKit: () => this.startDefaultWorkspace(),
    });
  }

  init() {
    installResizeHandles();
    installTrackNameResize();
    this.refreshAllUI();
    this.startup.open();
  }

  async afterWorkspaceLoaded() {
    this.stopPlayback();
    await this.restoreKitSamples();
    this.refreshAllUI();
  }

  startNewProject() {
    this.createWorkspace('default');
  }

  startBlankWorkspace() {
    this.createWorkspace('blank');
  }

  startDefaultWorkspace() {
    this.createWorkspace('default');
  }

  createWorkspace(mode) {
    this.stopPlayback();
    this.workspaceFiles.clearHandle();
    this.state.resetWorkspace();
    this.kitManager.clear();

    if (mode === 'blank') {
      const hidden = {};
      for (const trackId of this.state.trackIds) hidden[trackId] = false;
      this.state.replaceVisibility(hidden);
    }

    this.refreshAllUI();
    this.toast.show(mode === 'blank'
      ? 'Started a blank workspace (no visible tracks)'
      : 'Started a new workspace with the default synth kit');
  }

  afterKitImported() {
    this.stopPlayback();
    this.tracksPanel.refreshIfOpen();
    this.kitPanel.refreshIfOpen();
    this.grid.render();
  }

  /**
   * Rebuild decoded AudioBuffers from the raw bytes stored in the workspace.
   * Samples that cannot be decoded are skipped with a single summary toast.
   */
  async restoreKitSamples() {
    this.kitManager.clear();
    const { samples } = this.state.workspace.kits;
    if (!samples || samples.length === 0) return;

    let failed = 0;
    try {
      await this.audioEngine.ensureStarted();
    } catch (_) {
      // Decoding can still work on a suspended context; continue regardless.
    }

    const decoded = [];
    for (const sample of samples) {
      try {
        const bytes = dataUrlToBytes(sample.data);
        const buffer = await this.audioEngine.context.decodeAudioData(bytes.buffer.slice(0));
        decoded.push({ ...sample, buffer });
      } catch (_) {
        failed += 1;
      }
    }
    // One sample per track: a sample's id is also its track id.
    this.kitManager.replaceSamples(decoded);

    if (failed > 0) this.toast.show(`${failed} saved sample(s) could not be decoded`);
  }

  afterPatternSelected(pattern, hiddenTracks = []) {
    this.refreshWorkspaceUI();
    if (!pattern || !Array.isArray(hiddenTracks) || hiddenTracks.length === 0) return;

    const names = hiddenTracks.map(track => track.name).join(', ');
    const count = hiddenTracks.length;
    this.confirmDialog.open({
      title: 'Hidden Tracks in Pattern',
      message: `"${pattern.name}" has notes on ${count} hidden track${count === 1 ? '' : 's'}: ${names}. Hidden tracks are silent during playback and WAV export. Restore them to hear the full pattern, or keep the current visibility.`,
      confirmLabel: 'Restore Tracks',
      cancelLabel: 'Keep As Is',
      danger: false,
      onConfirm: () => {
        this.state.setTracksVisible(hiddenTracks.map(track => track.id), true);
        this.grid.render();
        this.tracksPanel.refreshIfOpen();
        this.toast.show(`Restored ${count} hidden track${count === 1 ? '' : 's'}`);
      },
      onCancel: () => {
        this.toast.show(`Kept ${count} track${count === 1 ? '' : 's'} hidden; only visible tracks will sound`);
      },
    });
  }

  refreshWorkspaceUI() {
    const pattern = this.state.activePattern;
    this.controls.setTempo(pattern ? pattern.bpm : 100);
    this.controls.setTimeSignature(pattern ? pattern.timeSignature : '4/4');
    this.controls.setGlobalVolume(this.state.workspace.globalVolume);
    this.controls.setPlaying(this.sequencer.isPlaying);
    this.patternsPanel.render();
    this.grid.render();
    this.loopPanel.render();
  }

  refreshAllUI() {
    this.refreshWorkspaceUI();
    this.tracksPanel.refreshIfOpen();
    this.kitPanel.refreshIfOpen();
  }

  async togglePlayback() {
    if (this.previewPatternId) this.clearPatternPreview();
    if (this.sequencer.isPlaying) {
      this.stopPlayback();
      return;
    }

    const requestToken = ++this.playRequestToken;
    try {
      await this.sequencer.start();
      if (requestToken !== this.playRequestToken) {
        this.sequencer.stop();
        return;
      }
      this.controls.setPlaying(this.sequencer.isPlaying);
    } catch (error) {
      this.controls.setPlaying(false);
      this.toast.show(`Audio could not start: ${error.message}`);
    }
  }

  stopPlayback() {
    this.playRequestToken += 1;
    this.clearPatternPreview();
    this.sequencer.stop();
    this.controls.setPlaying(false);
  }

  clearPatternPreview() {
    if (!this.previewPatternId) return;
    this.previewPatternId = null;
    this.sequencer.getScheduleSourceOverride = null;
  }

  /** Preview one workspace pattern at its own BPM without changing the loop. */
  async setPatternPreview(pattern, shouldPlay = true) {
    const active = Boolean(pattern) && Boolean(shouldPlay);

    this.stopPlayback();
    this.clearPatternPreview();
    if (!active) return false;

    this.previewPatternId = pattern.id;
    const previewPattern = pattern;
    this.sequencer.getScheduleSourceOverride = () => {
      const count = getStepCountForSig(previewPattern.timeSignature);
      const stepDuration = (60 / previewPattern.bpm) / 4;
      return {
        events: () => Array.from({ length: count }, (_, stepIndex) => ({
          source: 'preview',
          time: stepIndex * stepDuration,
          stepIndex,
          pattern: previewPattern,
        })),
        duration: () => count * stepDuration,
      };
    };

    try {
      await this.sequencer.start();
      if (this.previewPatternId !== previewPattern.id) return false;
      this.controls.setPlaying(true);
      return true;
    } catch (error) {
      this.clearPatternPreview();
      this.toast.show(`Preview could not start: ${error.message}`);
      return false;
    }
  }

  afterLoopModeChanged() {
    // Switching sources mid-playback would mix the two timelines; restart is
    // explicit so the next Play always begins at bar 1 of the chosen source.
    this.clearPatternPreview();
    this.stopPlayback();
    const enabled = this.state.arrangement.enabled;
    this.toast.show(enabled
      ? 'Loop Mode on: the bottom arrangement will play'
      : 'Loop Mode off: the active pattern will play');
  }

  toggleSidebar() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
    document.body.classList.toggle('sidebar-collapsed', this.sidebarCollapsed);
    this.controls.setSidebarCollapsed(this.sidebarCollapsed);
  }

  toggleTopbar() {
    this.topbarCollapsed = !this.topbarCollapsed;
    document.body.classList.toggle('topbar-collapsed', this.topbarCollapsed);
    this.controls.setTopbarCollapsed(this.topbarCollapsed);
  }

  toggleLoopPanel() {
    // The rail and the maximized view are mutually exclusive. Collapsing from
    // the maximized view first restores the normal panel, then collapses it.
    if (this.loopMaximized) this.setLoopMaximized(false);
    this.loopCollapsed = !this.loopCollapsed;
    document.body.classList.toggle('loop-collapsed', this.loopCollapsed);
    this.loopPanel.setCollapsed(this.loopCollapsed);
  }

  toggleLoopMaximize() {
    this.setLoopMaximized(!this.loopMaximized);
  }

  setLoopMaximized(maximized) {
    this.loopMaximized = Boolean(maximized);
    document.body.classList.toggle('loop-maximized', this.loopMaximized);
    this.loopPanel.setMaximized(this.loopMaximized);
    if (this.loopMaximized && this.loopCollapsed) {
      this.loopCollapsed = false;
      document.body.classList.remove('loop-collapsed');
      this.loopPanel.setCollapsed(false);
    }
  }

  applyGridVisibilityPreset(preset) {
    const presetIds = preset === 'standard'
      ? new Set(STANDARD_KIT_IDS)
      : (preset === 'metal' ? new Set(METAL_KIT_IDS) : null);
    const requestedIds = preset === 'all'
      ? this.state.trackIds
      : (presetIds ? this.state.tracks
        .filter(track => presetIds.has(track.patternKey))
        .map(track => track.id) : []);

    if (requestedIds.length === 0) return;
    this.state.applyVisibilityPreset(requestedIds);
    this.grid.render();
    this.tracksPanel.refreshIfOpen();
    this.toast.show(`Showing ${this.state.visibleTracks.length} of ${this.state.tracks.length} tracks`);
  }

  changeTempo(value) {
    const bpm = this.state.setBpm(value);
    this.controls.setTempo(bpm);
    this.patternsPanel.updateActivePatternBpm(bpm);
  }

  changeTimeSignature(value) {
    const result = this.state.setTimeSignature(value);
    if (!result) return;

    this.sequencer.ensureValidStep();
    this.controls.setTimeSignature(result.timeSignature);
    this.grid.render();
    this.loopPanel.render();
    this.toast.show(`Time Signature: ${result.timeSignature} (${result.totalSteps} steps)`);
  }

  changeGlobalVolume(value) {
    const volume = this.state.setGlobalVolume(value);
    this.audioEngine.setMasterVolume(volume);
    this.controls.setGlobalVolume(volume);
    return volume;
  }

  clearKit() {
    this.confirmDialog.open({
      title: 'Hide All Drum Tracks',
      message: 'Hide all drum tracks on the right grid to start with a clean screen? Imported samples and recorded notes are preserved and can be restored anytime via Tracks or Undo.',
      confirmLabel: 'Hide Tracks',
      danger: false,
      onConfirm: () => {
        const previousVisibility = { ...this.state.workspace.visibleTracks };
        this.state.applyVisibilityPreset([]);
        this.grid.render();
        this.tracksPanel.refreshIfOpen();
        this.toast.show('All drum tracks hidden from grid', () => {
          this.state.replaceVisibility(previousVisibility);
          this.grid.render();
          this.tracksPanel.refreshIfOpen();
        });
      },
    });
  }

  clearAll() {
    const pattern = this.state.activePattern;
    if (!pattern) return;

    this.confirmDialog.open({
      title: 'Clear All Steps',
      message: `Erase all active steps in "${pattern.name}"?`,
      confirmLabel: 'Clear All',
      danger: true,
      onConfirm: () => {
        const previousGrid = cloneGrid(pattern.grid);
        this.state.clearPattern(pattern.id);
        this.grid.render();
        this.toast.show(`Cleared all steps in "${pattern.name}"`, () => {
          this.state.replacePatternGrid(pattern.id, previousGrid);
          this.grid.render();
        });
      },
    });
  }

  saveWorkspace() {
    this.workspaceFiles.save();
  }

  async openWorkspaceFile(file) {
    await this.workspaceFiles.openFile(file);
  }

  /** Open the shared format picker for either the active pattern or the loop. */
  promptExport(kind) {
    const isLoop = kind === 'loop';
    this.exportFormatDialog.open({
      title: isLoop ? 'Export Loop Arrangement' : 'Export Active Pattern',
      message: isLoop
        ? 'Choose the audio format for one full cycle of the painted loop. The silent tail is cropped in every format.'
        : 'Choose the audio format for the active pattern. Hidden tracks stay silent.',
      onSelect: formatId => this.exportAudio(kind, formatId),
    });
  }

  /**
   * Ask for the destination first (while the click gesture is still active),
   * then render with the chosen encoder and write to that exact file.
   */
  async exportAudio(kind, formatId) {
    const format = getExportFormat(formatId);
    if (!format) return;

    const pattern = this.state.activePattern;
    if (kind !== 'loop' && !pattern) return;

    const wavName = kind === 'loop'
      ? buildLoopWavFileName(this.state.arrangement, this.state.workspace.patterns)
      : buildWavFileName(pattern);

    let target;
    try {
      target = await requestSaveTarget({
        suggestedName: buildExportFileName(wavName, format),
        description: format.saveDescription,
        mimeType: format.mimeType,
        extensions: [format.extension],
      });
    } catch (error) {
      this.toast.show(`Could not choose a ${format.label} file: ${error.message}`);
      return;
    }
    if (!target) return;

    try {
      if (format.id !== 'wav') this.toast.show(`Encoding ${format.label}... please wait`);
      const blob = await renderAudioExport({
        kind,
        format: format.id,
        pattern,
        arrangement: this.state.arrangement,
        patterns: this.state.workspace.patterns,
        workspace: this.state.workspace,
        tracks: this.state.tracks,
        customBuffers: this.kitManager.getBuffers(),
      });
      await writeSaveTarget(target, blob, {
        toast: this.toast,
        successMessage: name => `Exported ${format.label}: ${name}`,
      });
    } catch (error) {
      this.toast.show(`Could not export ${format.label}: ${error.message}`);
    }
  }

  /** Kept as small wrappers for direct callers and compatibility. */
  exportWav() {
    return this.exportAudio('pattern', 'wav');
  }

  exportLoopWav() {
    return this.exportAudio('loop', 'wav');
  }

  removeSample(track) {
    if (!track || !this.kitManager.getSample(track.id)) return;

    const snapshot = this.state.captureKitsState();
    const runtimeSamples = this.kitManager.getAllSamples().map(sample => ({ ...sample }));
    const hadSynth = Boolean(track.legacyInstrumentId);
    this.kitManager.removeSample(track.id);

    if (!this.state.removeTrackSample(track.id)) {
      this.kitManager.replaceSamples(runtimeSamples);
      return;
    }

    this.grid.render();
    this.kitPanel.refreshIfOpen();
    this.tracksPanel.refreshIfOpen();
    const message = hadSynth
      ? `${track.name} restored to the built-in synth`
      : `${track.name} removed (no built-in synth counterpart)`;
    this.toast.show(`${message} — Undo available`, () => {
      this.restoreCustomSamples(snapshot, runtimeSamples, `${track.name} sample restored`);
    });
  }

  restoreCustomSamples(snapshot, runtimeSamples, message) {
    this.state.restoreKitsState(snapshot);
    this.kitManager.replaceSamples(Array.isArray(runtimeSamples) ? runtimeSamples : []);
    this.grid.render();
    this.kitPanel.refreshIfOpen();
    this.tracksPanel.refreshIfOpen();
    this.toast.show(message);
  }

  unloadSamples() {
    const count = this.state.workspace.kits.samples.length;
    if (count === 0) {
      this.toast.show('No custom samples are loaded');
      return;
    }

    this.confirmDialog.open({
      title: 'Unload All Custom Samples',
      message: `Remove all ${count} imported/assigned sample${count === 1 ? '' : 's'} and restore the 23-track built-in synth kit? Recorded steps are kept, and Undo is available after unloading.`,
      confirmLabel: 'Unload Samples',
      cancelLabel: 'Keep Samples',
      danger: true,
      onConfirm: () => {
        const snapshot = this.state.captureKitsState();
        const runtimeSamples = this.kitManager.getAllSamples().map(sample => ({ ...sample }));
        this.kitManager.clear();
        this.state.clearKitSamples();
        this.grid.render();
        this.kitPanel.refreshIfOpen();
        this.tracksPanel.refreshIfOpen();
        this.toast.show(`${count} custom sample${count === 1 ? '' : 's'} unloaded — Undo available`, () => {
          this.restoreCustomSamples(snapshot, runtimeSamples, 'Custom samples restored');
        });
      },
    });
  }

  resetWorkspace() {
    this.confirmDialog.open({
      title: 'Reset Factory Workspace',
      message: 'Reset all groups, custom patterns, and settings back to factory defaults?',
      confirmLabel: 'Reset Workspace',
      danger: true,
      onConfirm: () => {
        this.stopPlayback();
        this.workspaceFiles.clearHandle();
        this.state.resetWorkspace();
        this.kitManager.clear();
        this.refreshAllUI();
        this.toast.show('Workspace reset to factory defaults');
      },
    });
  }
}

try {
  const app = new DrumMachineApp();
  app.init();
} catch (error) {
  console.error(error);
  const status = document.getElementById('workspaceStatusText');
  if (status) status.textContent = 'Initialization Error';
}
