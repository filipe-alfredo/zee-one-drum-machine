import { createElement } from '../utils/dom.js';

export class PatternsPanel {
  constructor({
    state,
    toast,
    confirmDialog,
    itemEditor,
    onPatternSelected,
    onChange,
  }) {
    this.state = state;
    this.toast = toast;
    this.confirmDialog = confirmDialog;
    this.itemEditor = itemEditor;
    this.onPatternSelected = onPatternSelected;
    this.onChange = onChange;

    this.container = document.getElementById('patternsList');
    this.searchInput = document.getElementById('patternSearch');
    this.hiddenToggle = document.getElementById('btnToggleHiddenGroups');
    this.restoreButton = document.getElementById('btnRestoreActivePattern');

    this.searchInput.addEventListener('input', () => this.render());
    document.getElementById('btnNewGroup').addEventListener('click', () => this.createGroup());
    document.getElementById('btnNewPattern').addEventListener('click', () => {
      const activePattern = this.state.activePattern;
      this.createPatternInGroup(activePattern ? activePattern.groupId : null);
    });
    this.restoreButton.addEventListener('click', () => this.restoreActivePattern());
    this.hiddenToggle.addEventListener('click', () => {
      this.state.setShowHiddenGroups(!this.state.workspace.showHiddenGroups);
      this.onChange();
    });
  }

  render() {
    this.container.replaceChildren();
    const query = (this.searchInput.value || '').trim().toLowerCase();

    for (const group of this.state.workspace.groups) {
      if (group.hidden && !this.state.workspace.showHiddenGroups) continue;

      const groupPatterns = this.state.workspace.patterns.filter(
        pattern => pattern.groupId === group.id,
      );
      const groupMatches = group.name.toLowerCase().includes(query);
      const matchingPatterns = query && !groupMatches
        ? groupPatterns.filter(pattern => pattern.name.toLowerCase().includes(query))
        : groupPatterns;

      if (query && !groupMatches && matchingPatterns.length === 0) continue;

      const block = createElement('div', {
        className: 'group-block' + (group.hidden ? ' is-hidden-group' : ''),
      });

      const header = createElement('div', { className: 'group-header' });
      const headerLeft = createElement('div', {
        className: 'group-header-left',
        title: 'Click to expand or collapse group',
      });
      headerLeft.append(
        createElement('span', {
          className: 'group-chevron',
          text: group.collapsed ? '▶' : '▼',
        }),
        createElement('span', { className: 'group-name', text: group.name }),
        createElement('span', {
          className: 'group-count',
          text: String(groupPatterns.length),
        }),
      );

      const actions = createElement('div', { className: 'group-actions' });
      actions.append(
        createElement('button', {
          className: 'icon-micro-btn',
          text: '+',
          title: `Add pattern to ${group.name}`,
          dataset: { gact: 'add' },
        }),
        createElement('button', {
          className: 'icon-micro-btn',
          text: '✎',
          title: 'Rename group',
          dataset: { gact: 'rename' },
        }),
        createElement('button', {
          className: 'icon-micro-btn',
          text: group.hidden ? '◉' : '👁',
          title: group.hidden ? 'Unhide group' : 'Hide group from view',
          dataset: { gact: 'hide' },
        }),
      );
      if (!group.isFactory) {
        actions.append(createElement('button', {
          className: 'icon-micro-btn danger',
          text: '✕',
          title: 'Delete group',
          dataset: { gact: 'delete' },
        }));
      }

      header.append(headerLeft, actions);
      header.addEventListener('click', event => {
        const actionButton = event.target.closest('[data-gact]');
        if (actionButton) {
          event.stopPropagation();
          this.handleGroupAction(group, actionButton.dataset.gact);
          return;
        }
        this.state.toggleGroupCollapsed(group.id);
        this.onChange();
      });

      const itemsWrap = createElement('div', {
        className: 'group-items' + (group.collapsed && !query ? ' collapsed' : ''),
      });

      for (const pattern of matchingPatterns) {
        itemsWrap.appendChild(this.buildPatternItem(pattern));
      }

      block.append(header, itemsWrap);
      this.container.appendChild(block);
    }

    this.updateHiddenToggle();
    this.updateRestoreButton();
  }

  buildPatternItem(pattern) {
    const isActive = this.state.workspace.activePatternId === pattern.id;
    const item = createElement('div', {
      className: 'pattern-item' + (isActive ? ' selected' : ''),
    });

    const name = createElement('span', {
      className: 'pattern-item-name',
      text: pattern.name,
      title: pattern.name,
    });

    const right = createElement('div', { className: 'pattern-item-right' });
    const hoverActions = createElement('div', { className: 'pat-hover-actions' });
    hoverActions.append(
      createElement('button', {
        className: 'icon-micro-btn',
        text: '⧉',
        title: 'Duplicate pattern',
        dataset: { pact: 'dup' },
      }),
      createElement('button', {
        className: 'icon-micro-btn',
        text: '⇄',
        title: 'Rename or move pattern',
        dataset: { pact: 'edit' },
      }),
    );
    if (this.state.workspace.patterns.length > 1) {
      hoverActions.append(createElement('button', {
        className: 'icon-micro-btn danger',
        text: '✕',
        title: 'Delete pattern',
        dataset: { pact: 'del' },
      }));
    }

    right.append(
      hoverActions,
      createElement('span', { className: 'bpm-badge', text: String(pattern.bpm) }),
    );
    item.append(name, right);

    item.addEventListener('click', event => {
      const actionButton = event.target.closest('[data-pact]');
      if (actionButton) {
        event.stopPropagation();
        this.handlePatternAction(pattern, actionButton.dataset.pact);
        return;
      }
      const hiddenTracks = this.state.getHiddenTracksForPattern(pattern);
      const selected = this.state.selectPattern(pattern.id);
      if (selected) this.onPatternSelected(selected, hiddenTracks);
    });

    return item;
  }

  handleGroupAction(group, action) {
    if (action === 'add') {
      this.createPatternInGroup(group.id);
      return;
    }

    if (action === 'rename') {
      this.itemEditor.open({
        title: 'Rename Pattern Group',
        defaultName: group.name,
        showGroupSelect: false,
        onSave: newName => {
          this.state.renameGroup(group.id, newName);
          this.onChange();
        },
      });
      return;
    }

    if (action === 'hide') {
      this.state.toggleGroupHidden(group.id);
      this.onChange();
      this.toast.show(
        group.hidden ? `Group "${group.name}" hidden` : `Group "${group.name}" visible`,
      );
      return;
    }

    if (action === 'delete') {
      this.confirmDialog.open({
        title: 'Delete Pattern Group',
        message: `Delete group "${group.name}"? Its patterns will be moved to the Default group.`,
        confirmLabel: 'Delete Group',
        danger: true,
        onConfirm: () => {
          const result = this.state.deleteGroup(group.id);
          this.onChange();
          if (result) this.toast.show(`Deleted group "${group.name}"`);
        },
      });
    }
  }

  handlePatternAction(pattern, action) {
    if (action === 'dup') {
      const copy = this.state.duplicatePattern(pattern.id);
      if (copy) {
        this.state.selectPattern(copy.id);
        this.onChange();
        this.toast.show(`Duplicated "${pattern.name}"`);
      }
      return;
    }

    if (action === 'edit') {
      this.itemEditor.open({
        title: 'Edit / Move Pattern',
        defaultName: pattern.name,
        showGroupSelect: true,
        defaultGroupId: pattern.groupId,
        onSave: (newName, newGroupId) => {
          this.state.updatePattern(pattern.id, { name: newName, groupId: newGroupId });
          this.onChange();
        },
      });
      return;
    }

    if (action === 'del') {
      this.confirmDialog.open({
        title: 'Delete Pattern',
        message: `Are you sure you want to delete "${pattern.name}"?`,
        confirmLabel: 'Delete',
        danger: true,
        onConfirm: () => {
          const deleted = this.state.deletePattern(pattern.id);
          this.onChange();
          if (deleted) this.toast.show(`Deleted "${pattern.name}"`);
        },
      });
    }
  }

  createGroup() {
    this.itemEditor.open({
      title: 'Create Pattern Group',
      defaultName: `Group ${this.state.workspace.groups.length + 1}`,
      showGroupSelect: false,
      onSave: name => {
        this.state.addGroup(name);
        this.onChange();
        this.toast.show(`Created group "${name}"`);
      },
    });
  }

  createPatternInGroup(groupId) {
    const targetGroupId = groupId
      || (this.state.workspace.groups[1]
        ? this.state.workspace.groups[1].id
        : this.state.workspace.groups[0].id);

    this.itemEditor.open({
      title: 'Create New Pattern',
      defaultName: `Custom Pattern ${this.state.workspace.patterns.length + 1}`,
      showGroupSelect: true,
      defaultGroupId: targetGroupId,
      onSave: (name, chosenGroupId) => {
        const currentPattern = this.state.activePattern;
        const timeSignature = currentPattern ? currentPattern.timeSignature : '4/4';
        const bpm = currentPattern ? currentPattern.bpm : 120;
        const newPattern = this.state.addPattern({
          name,
          groupId: chosenGroupId,
          bpm,
          timeSignature,
        });
        this.state.selectPattern(newPattern.id);
        this.onChange();
        this.toast.show(`Created "${name}"`);
      },
    });
  }

  updateActivePatternBpm(bpm) {
    const badge = this.container.querySelector('.pattern-item.selected .bpm-badge');
    if (badge) badge.textContent = String(bpm);
  }

  updateHiddenToggle() {
    const showing = Boolean(this.state.workspace.showHiddenGroups);
    this.hiddenToggle.classList.toggle('active-toggle', showing);
    this.hiddenToggle.setAttribute('aria-pressed', String(showing));
    const label = showing ? 'Hide hidden pattern groups' : 'Show hidden pattern groups';
    this.hiddenToggle.title = label;
    this.hiddenToggle.setAttribute('aria-label', label);
  }

  updateRestoreButton() {
    const pattern = this.state.activePattern;
    const isFactory = Boolean(pattern) && this.state.isFactoryPattern(pattern.id);
    this.restoreButton.disabled = !isFactory;
    this.restoreButton.title = isFactory
      ? `Restore "${pattern.name}" to its factory steps, BPM and time signature`
      : 'The active pattern is not a factory pattern';
    this.restoreButton.setAttribute('aria-label', this.restoreButton.title);
  }

  restoreActivePattern() {
    const pattern = this.state.activePattern;
    if (!pattern || !this.state.isFactoryPattern(pattern.id)) return;

    this.confirmDialog.open({
      title: 'Restore Factory Pattern',
      message: `Replace "${pattern.name}" with its shipped steps, BPM and time signature? Custom patterns, imported samples and the visible grid rows stay exactly as they are.`,
      confirmLabel: 'Restore Pattern',
      danger: true,
      onConfirm: () => {
        const { restored, snapshot } = this.state.restoreActiveFactoryPattern();
        this.onChange();
        if (!restored) return;
        this.toast.show(`Restored "${pattern.name}" to factory settings`, () => {
          this.state.restorePatternState(snapshot);
          this.onChange();
        });
      },
    });
  }
}
