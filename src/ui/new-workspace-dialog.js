/** Choice dialog behind the toolbar's first button (New). */
export class NewWorkspaceDialog {
  constructor({ onBlank, onDefaultKit }) {
    this.modal = document.getElementById('newWorkspaceModal');

    document.getElementById('btnNew').addEventListener('click', () => this.open());
    document.getElementById('optNewWorkspace').addEventListener('click', () => this.open());
    document.getElementById('closeNewWorkspaceBtn').addEventListener('click', () => this.close());
    document.getElementById('cancelNewWorkspaceBtn').addEventListener('click', () => this.close());
    document.getElementById('newBlankWorkspaceBtn').addEventListener('click', () => {
      this.close();
      onBlank();
    });
    document.getElementById('newDefaultKitBtn').addEventListener('click', () => {
      this.close();
      onDefaultKit();
    });
  }

  open() {
    this.modal.classList.add('open');
  }

  close() {
    this.modal.classList.remove('open');
  }
}
