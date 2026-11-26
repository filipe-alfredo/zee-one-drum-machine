export class ConfirmDialog {
  constructor() {
    this.modal = document.getElementById('confirmModal');
    this.titleElement = document.getElementById('confirmModalTitle');
    this.messageElement = document.getElementById('confirmModalMessage');
    this.acceptButton = document.getElementById('acceptConfirmBtn');
    this.cancelButton = document.getElementById('cancelConfirmBtn');
    this.callback = null;
    this.cancelCallback = null;

    document.getElementById('closeConfirmBtn').addEventListener('click', () => this.close());
    this.cancelButton.addEventListener('click', () => this.cancel());
    this.acceptButton.addEventListener('click', () => {
      const callback = this.callback;
      this.close();
      if (typeof callback === 'function') callback();
    });
  }

  open({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false, onConfirm, onCancel }) {
    this.titleElement.textContent = title;
    this.messageElement.textContent = message;
    this.acceptButton.textContent = confirmLabel || 'Confirm';
    this.cancelButton.textContent = cancelLabel || 'Cancel';
    this.acceptButton.className = danger ? 'btn-danger' : 'btn-accent';
    this.callback = onConfirm;
    this.cancelCallback = onCancel;
    this.modal.classList.add('open');
  }

  cancel() {
    const callback = this.cancelCallback;
    this.close();
    if (typeof callback === 'function') callback();
  }

  close() {
    this.modal.classList.remove('open');
    this.callback = null;
    this.cancelCallback = null;
  }
}

export class ItemEditorDialog {
  constructor({ getGroups, toast }) {
    this.getGroups = getGroups;
    this.toast = toast;
    this.modal = document.getElementById('itemEditorModal');
    this.titleElement = document.getElementById('itemEditorTitle');
    this.nameInput = document.getElementById('itemEditorNameInput');
    this.groupWrap = document.getElementById('itemEditorGroupWrap');
    this.groupSelect = document.getElementById('itemEditorGroupSelect');
    this.saveHandler = null;

    document.getElementById('closeItemEditorBtn').addEventListener('click', () => this.close());
    document.getElementById('cancelItemEditorBtn').addEventListener('click', () => this.close());
    document.getElementById('saveItemEditorBtn').addEventListener('click', () => this.save());
    this.nameInput.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        this.save();
      }
    });
  }

  open({ title, defaultName, showGroupSelect, defaultGroupId, onSave }) {
    this.titleElement.textContent = title;
    this.nameInput.value = defaultName || '';

    if (showGroupSelect) {
      this.groupWrap.hidden = false;
      this.groupSelect.replaceChildren();
      for (const group of this.getGroups()) {
        const option = document.createElement('option');
        option.value = group.id;
        option.textContent = group.name;
        if (group.id === defaultGroupId) option.selected = true;
        this.groupSelect.appendChild(option);
      }
    } else {
      this.groupWrap.hidden = true;
    }

    this.saveHandler = () => {
      const cleanName = this.nameInput.value.trim();
      if (!cleanName) {
        this.toast.show('Please enter a name');
        return;
      }
      onSave(cleanName, this.groupSelect.value);
      this.close();
    };

    this.modal.classList.add('open');
    setTimeout(() => {
      this.nameInput.focus();
      this.nameInput.select();
    }, 30);
  }

  save() {
    if (typeof this.saveHandler === 'function') this.saveHandler();
  }

  close() {
    this.modal.classList.remove('open');
    this.saveHandler = null;
  }
}
