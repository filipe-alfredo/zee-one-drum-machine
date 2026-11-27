import { EXPORT_FORMATS } from '../audio/export-formats.js';

/** Modal that lets the user pick WAV, M4A or MP3 before an export starts. */
export class ExportFormatDialog {
  constructor() {
    this.modal = document.getElementById('exportFormatModal');
    this.titleElement = document.getElementById('exportFormatTitle');
    this.messageElement = document.getElementById('exportFormatMessage');
    this.list = document.getElementById('exportFormatList');
    this.callback = null;
    this.optionButtons = [];

    for (const format of EXPORT_FORMATS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'export-format-option';
      button.dataset.format = format.id;
      button.setAttribute('aria-label', `${format.label}: ${format.description}`);

      const label = document.createElement('span');
      label.className = 'export-format-label';
      label.textContent = format.label;
      const subtitle = document.createElement('span');
      subtitle.className = 'export-format-subtitle';
      subtitle.textContent = format.subtitle;
      const description = document.createElement('span');
      description.className = 'export-format-description';
      description.textContent = format.description;

      button.append(label, subtitle, description);
      button.addEventListener('click', () => this.select(format.id));
      this.list.appendChild(button);
      this.optionButtons.push(button);
    }

    document.getElementById('closeExportFormatBtn').addEventListener('click', () => this.close());
    document.getElementById('cancelExportFormatBtn').addEventListener('click', () => this.close());
    this.modal.addEventListener('click', event => {
      if (event.target === this.modal) this.close();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && this.modal.classList.contains('open')) this.close();
    });
  }

  open({ title, message, onSelect }) {
    this.titleElement.textContent = title || 'Export Format';
    this.messageElement.textContent = message || 'Choose the audio format for this export.';
    this.callback = typeof onSelect === 'function' ? onSelect : null;
    this.modal.classList.add('open');
    setTimeout(() => {
      if (this.optionButtons[0]) this.optionButtons[0].focus();
    }, 30);
  }

  select(formatId) {
    const callback = this.callback;
    this.close();
    if (callback) callback(formatId);
  }

  close() {
    this.modal.classList.remove('open');
    this.callback = null;
  }
}
