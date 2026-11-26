/**
 * First-run dialog. The app always constructs a fresh, factory-default
 * workspace; the user chooses whether to keep it, open a file, or continue
 * with the last saved workspace.
 */
export class StartupDialog {
  constructor({ onNewProject, onOpenFile, onOpenLast, getLastInfo }) {
    this.onNewProject = onNewProject;
    this.onOpenFile = onOpenFile;
    this.onOpenLast = onOpenLast;
    this.getLastInfo = getLastInfo;

    this.modal = document.getElementById('startupModal');
    this.lastButton = document.getElementById('startupLastBtn');
    this.lastLabel = document.getElementById('startupLastLabel');

    document.getElementById('startupNewBtn').addEventListener('click', () => {
      this.close();
      this.onNewProject();
    });
    document.getElementById('startupOpenBtn').addEventListener('click', () => {
      this.close();
      this.onOpenFile();
    });
    this.lastButton.addEventListener('click', () => {
      this.close();
      this.onOpenLast();
    });
  }

  async open() {
    const info = await this.getLastInfo();
    this.lastButton.disabled = !info;
    this.lastLabel.textContent = info ? `Last saved: ${info.name}` : 'No recent workspace saved';
    this.modal.classList.add('open');
  }

  close() {
    this.modal.classList.remove('open');
  }
}
