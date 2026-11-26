import { TIME_SIGNATURE_PRESETS } from '../sequencer/pattern.js';

export class Controls {
  constructor({
    onPlayToggle,
    onStop,
    onTempoChange,
    onTimeSignatureChange,
    onGlobalVolumeChange,
    onClearKit,
    onClearAll,
    onOpenWorkspaceFile,
    onOpenWorkspacePicker,
    onSaveWorkspace,
    onSaveWorkspaceAs,
    onExportWav,
    onExportLoop,
    onToggleSidebar,
    onToggleTopbar,
    onOpenKit,
    onUnloadSamples,
    onResetWorkspace,
  }) {
    this.onPlayToggle = onPlayToggle;
    this.onStop = onStop;
    this.onTempoChange = onTempoChange;
    this.onTimeSignatureChange = onTimeSignatureChange;
    this.onGlobalVolumeChange = onGlobalVolumeChange || (() => {});
    this.onClearKit = onClearKit;
    this.onClearAll = onClearAll;
    this.onOpenWorkspaceFile = onOpenWorkspaceFile;
    this.onOpenWorkspacePicker = onOpenWorkspacePicker;
    this.onSaveWorkspace = onSaveWorkspace;
    this.onSaveWorkspaceAs = onSaveWorkspaceAs;
    this.onExportWav = onExportWav;
    this.onExportLoop = onExportLoop || (() => {});
    this.onToggleSidebar = onToggleSidebar || (() => {});
    this.onToggleTopbar = onToggleTopbar || (() => {});
    this.onOpenKit = onOpenKit;
    this.onUnloadSamples = onUnloadSamples;
    this.onResetWorkspace = onResetWorkspace;

    this.playButton = document.getElementById('btnPlay');
    this.tempoSlider = document.getElementById('tempoSlider');
    this.tempoNumber = document.getElementById('tempoNumber');
    this.timeSignatureSelect = document.getElementById('timeSigSelect');
    this.globalVolumeSlider = document.getElementById('globalVolumeSlider');
    this.globalVolumeNumber = document.getElementById('globalVolumeNum');
    this.globalVolumeBox = document.getElementById('globalVolumeBox');
    this.workspaceStatusText = document.getElementById('workspaceStatusText');
    this.workspaceFileInput = document.getElementById('workspaceFileInput');

    this.bindFileMenu();
    this.bindHelpModal();
    this.bindToolbar();
    this.bindTempoAndTimeSignature();
    this.bindGlobalVolume();
    this.bindWorkspaceFileInput();
    this.bindKeyboardShortcuts();
  }

  bindFileMenu() {
    const fileButton = document.getElementById('menuFileBtn');
    const fileMenu = document.getElementById('menuFileDropdown');

    fileButton.addEventListener('click', event => {
      event.stopPropagation();
      fileMenu.classList.toggle('open');
      fileButton.classList.toggle('active', fileMenu.classList.contains('open'));
    });

    document.addEventListener('click', () => {
      fileMenu.classList.remove('open');
      fileButton.classList.remove('active');
    });

    document.getElementById('optOpenWorkspace').addEventListener('click', () => this.openWorkspace());
    document.getElementById('optSaveWorkspace').addEventListener('click', () => {
      this.onSaveWorkspace();
    });
    document.getElementById('optSaveWorkspaceAs').addEventListener('click', () => {
      this.onSaveWorkspaceAs();
    });
    document.getElementById('optExportWav').addEventListener('click', () => {
      this.onExportWav();
    });
    document.getElementById('optExportLoop').addEventListener('click', () => {
      this.onExportLoop();
    });
    document.getElementById('optLoadKit').addEventListener('click', () => {
      this.onOpenKit();
    });
    document.getElementById('optUnloadSamples').addEventListener('click', () => {
      this.onUnloadSamples();
    });
    document.getElementById('optResetWorkspace').addEventListener('click', () => {
      this.onResetWorkspace();
    });
  }

  bindHelpModal() {
    const helpModal = document.getElementById('helpModal');
    document.getElementById('menuHelpBtn').addEventListener('click', () => {
      helpModal.classList.add('open');
    });
    document.getElementById('closeHelpModalBtn').addEventListener('click', () => {
      helpModal.classList.remove('open');
    });
    document.getElementById('okHelpModalBtn').addEventListener('click', () => {
      helpModal.classList.remove('open');
    });
  }

  openWorkspace() {
    if (typeof window !== 'undefined' && typeof window.showOpenFilePicker === 'function') {
      this.onOpenWorkspacePicker();
    } else {
      this.workspaceFileInput.click();
    }
  }

  bindToolbar() {
    this.sidebarButton = document.getElementById('btnToggleSidebar');
    this.topbarButton = document.getElementById('btnToggleTopbar');
    this.sidebarButton.addEventListener('click', () => this.onToggleSidebar());
    this.topbarButton.addEventListener('click', () => this.onToggleTopbar());
    document.getElementById('btnOpen').addEventListener('click', () => this.openWorkspace());
    document.getElementById('btnSave').addEventListener('click', () => {
      this.onSaveWorkspace();
    });
    document.getElementById('btnClearKit').addEventListener('click', () => {
      this.onClearKit();
    });
    document.getElementById('btnClearAll').addEventListener('click', () => {
      this.onClearAll();
    });
    this.playButton.addEventListener('click', () => this.onPlayToggle());
    document.getElementById('btnStop').addEventListener('click', () => this.onStop());
  }

  bindTempoAndTimeSignature() {
    this.tempoSlider.addEventListener('input', event => {
      this.onTempoChange(event.target.value);
    });
    this.tempoNumber.addEventListener('change', event => {
      this.onTempoChange(event.target.value);
    });
    this.timeSignatureSelect.addEventListener('change', event => {
      this.onTimeSignatureChange(event.target.value);
    });
  }

  bindGlobalVolume() {
    this.globalVolumeSlider.addEventListener('input', event => {
      this.onGlobalVolumeChange(Number(event.target.value) / 100);
    });
    this.globalVolumeNumber.addEventListener('change', event => {
      this.onGlobalVolumeChange(Number(event.target.value) / 100);
    });
  }

  bindWorkspaceFileInput() {
    this.workspaceFileInput.addEventListener('change', event => {
      const file = event.target.files && event.target.files[0];
      event.target.value = '';
      if (file) this.onOpenWorkspaceFile(file);
    });
  }

  bindKeyboardShortcuts() {
    window.addEventListener('keydown', event => {
      const activeElement = document.activeElement;
      const tagName = activeElement ? activeElement.tagName : '';
      const isEditable = activeElement && activeElement.isContentEditable;
      if (tagName === 'INPUT' || tagName === 'SELECT' || tagName === 'TEXTAREA' || isEditable) {
        return;
      }

      if (event.code === 'Space') {
        event.preventDefault();
        this.onPlayToggle();
      } else if (event.key === 'c' || event.key === 'C') {
        event.preventDefault();
        this.onClearAll();
      }
    });
  }

  setTempo(bpm) {
    this.tempoSlider.value = bpm;
    this.tempoNumber.value = bpm;
  }

  setTimeSignature(timeSignature) {
    this.timeSignatureSelect.value = TIME_SIGNATURE_PRESETS.includes(timeSignature)
      ? timeSignature
      : '4/4';
  }

  setGlobalVolume(volume) {
    const percent = Math.round(Number(volume) * 100);
    this.globalVolumeSlider.value = percent;
    this.globalVolumeNumber.value = percent;
    this.globalVolumeBox.classList.toggle('volume-active', Number(volume) < 1);
  }

  setPlaying(isPlaying) {
    this.playButton.classList.toggle('active-playing', Boolean(isPlaying));
  }

  setCollapseButton(button, collapsed, expandLabel, collapseLabel) {
    if (!button) return;
    const isCollapsed = Boolean(collapsed);
    button.setAttribute('aria-pressed', String(isCollapsed));
    button.title = isCollapsed ? expandLabel : collapseLabel;
    button.setAttribute('aria-label', isCollapsed ? expandLabel : collapseLabel);
  }

  setSidebarCollapsed(collapsed) {
    this.setCollapseButton(
      this.sidebarButton,
      collapsed,
      'Expand the pattern sidebar',
      'Collapse the pattern sidebar',
    );
  }

  setTopbarCollapsed(collapsed) {
    this.setCollapseButton(
      this.topbarButton,
      collapsed,
      'Expand the top toolbar',
      'Collapse the top toolbar',
    );
  }

  setStatus(text) {
    this.workspaceStatusText.textContent = text;
  }
}
