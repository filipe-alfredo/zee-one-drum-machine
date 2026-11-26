export class Toast {
  constructor() {
    this.element = document.getElementById('toastEl');
    this.textElement = document.getElementById('toastText');
    this.undoButton = document.getElementById('toastUndoBtn');
    this.undoAction = null;
    this.timerId = null;

    this.undoButton.addEventListener('click', () => this.runUndo());
  }

  show(message, onUndo = null) {
    this.textElement.textContent = message;

    if (typeof onUndo === 'function') {
      this.undoAction = onUndo;
      this.undoButton.hidden = false;
    } else {
      this.undoAction = null;
      this.undoButton.hidden = true;
    }

    this.element.classList.add('show');
    clearTimeout(this.timerId);
    this.timerId = setTimeout(() => {
      this.element.classList.remove('show');
      this.undoAction = null;
    }, 4200);
  }

  hide() {
    this.element.classList.remove('show');
    this.undoAction = null;
  }

  runUndo() {
    if (typeof this.undoAction !== 'function') return;
    const action = this.undoAction;
    this.undoAction = null;
    this.hide();
    action();
  }
}
