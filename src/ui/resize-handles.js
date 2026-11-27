/**
 * Pointer-driven panel resizing. Sizes are visual only: they change CSS
 * custom properties on <body> and are intentionally not written to the
 * workspace, just like the collapse buttons.
 */

const DEFAULTS = { sidebar: 315, loop: 176 };

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function installResizeHandles() {
  const sidebarSplitter = document.getElementById('sidebarSplitter');
  const loopSplitter = document.getElementById('loopSplitter');
  if (!sidebarSplitter || !loopSplitter) return () => {};

  const cleanups = [];

  function bind({ handle, name, axis, bodyClass, collapsedClass, min, max, invert = false, apply: setSize }) {
    let current = DEFAULTS[name];
    let active = null;
    const update = value => {
      current = clamp(value, min(), max());
      setSize(current);
    };

    const onPointerDown = event => {
      if (event.button !== 0 || document.body.classList.contains(collapsedClass)) return;
      event.preventDefault();
      active = {
        pointerId: event.pointerId,
        start: axis === 'x' ? event.clientX : event.clientY,
        size: current,
      };
      handle.setPointerCapture(event.pointerId);
      document.body.classList.add(bodyClass);
    };

    const onPointerMove = event => {
      if (!active || event.pointerId !== active.pointerId) return;
      const position = axis === 'x' ? event.clientX : event.clientY;
      const delta = position - active.start;
      update(active.size + (invert ? -delta : delta));
    };

    const onPointerEnd = event => {
      if (!active || event.pointerId !== active.pointerId) return;
      active = null;
      document.body.classList.remove(bodyClass);
      if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
    };

    const onDoubleClick = () => update(DEFAULTS[name]);

    const onKeyDown = event => {
      const decrease = axis === 'x' ? 'ArrowLeft' : (invert ? 'ArrowDown' : 'ArrowUp');
      const increase = axis === 'x' ? 'ArrowRight' : (invert ? 'ArrowUp' : 'ArrowDown');
      if (event.key !== decrease && event.key !== increase && event.key !== 'Home') return;
      event.preventDefault();
      if (event.key === 'Home') {
        update(DEFAULTS[name]);
        return;
      }
      const step = event.shiftKey ? 40 : 10;
      update(current + (event.key === increase ? step : -step));
    };

    handle.addEventListener('pointerdown', onPointerDown);
    handle.addEventListener('pointermove', onPointerMove);
    handle.addEventListener('pointerup', onPointerEnd);
    handle.addEventListener('pointercancel', onPointerEnd);
    handle.addEventListener('dblclick', onDoubleClick);
    handle.addEventListener('keydown', onKeyDown);
    cleanups.push(() => {
      handle.removeEventListener('pointerdown', onPointerDown);
      handle.removeEventListener('pointermove', onPointerMove);
      handle.removeEventListener('pointerup', onPointerEnd);
      handle.removeEventListener('pointercancel', onPointerEnd);
      handle.removeEventListener('dblclick', onDoubleClick);
      handle.removeEventListener('keydown', onKeyDown);
      document.body.classList.remove(bodyClass);
    });
  }

  bind({
    handle: sidebarSplitter,
    name: 'sidebar',
    axis: 'x',
    bodyClass: 'resizing-sidebar',
    collapsedClass: 'sidebar-collapsed',
    min: () => 245,
    max: () => Math.max(245, Math.min(600, window.innerWidth - 420)),
    apply: value => {
      document.body.style.setProperty('--sidebar-width', `${Math.round(value)}px`);
      sidebarSplitter.setAttribute('aria-valuenow', String(Math.round(value)));
    },
  });

  bind({
    handle: loopSplitter,
    name: 'loop',
    axis: 'y',
    bodyClass: 'resizing-loop',
    collapsedClass: 'loop-collapsed',
    invert: true,
    min: () => 120,
    max: () => Math.max(150, Math.min(440, window.innerHeight - 280)),
    apply: value => {
      document.body.style.setProperty('--loop-height', `${Math.round(value)}px`);
      loopSplitter.setAttribute('aria-valuenow', String(Math.round(value)));
    },
  });

  return () => {
    for (const cleanup of cleanups) cleanup();
  };
}

/**
 * Resizes the shared track-name column in the Drum Grid. The handles live in
 * dynamically rebuilt rows, so events are delegated from the matrix instead of
 * bound once. Like the panel splitters, the size is visual only.
 */
export function installTrackNameResize() {
  const matrix = document.getElementById('sequencerMatrix');
  if (!matrix) return () => {};

  const defaultWidth = () => window.innerWidth <= 860 ? 280 : 320;
  const minWidth = () => 180;
  const maxWidth = () => Math.max(defaultWidth(), Math.min(520, window.innerWidth - 420));
  let current = null;
  let active = null;

  const update = value => {
    current = clamp(value, minWidth(), maxWidth());
    document.body.style.setProperty('--track-header-width', `${Math.round(current)}px`);
    for (const handle of matrix.querySelectorAll('.track-name-resizer')) {
      handle.setAttribute('aria-valuenow', String(Math.round(current)));
    }
  };

  /** Widens the column just enough to show every currently rendered name. */
  const fitTrackNames = () => {
    const headers = [...matrix.querySelectorAll('.track-header')];
    if (headers.length === 0) return;
    let needed = current ?? defaultWidth();
    for (const header of headers) {
      const wrap = header.querySelector('.track-name-wrap');
      const name = wrap?.lastElementChild;
      if (!wrap || !name) continue;
      const overflow = name.getBoundingClientRect().right - wrap.getBoundingClientRect().right;
      if (overflow > 0) {
        needed = Math.max(needed, Math.round(header.getBoundingClientRect().width + overflow + 8));
      }
    }
    update(needed);
  };

  const handleFrom = event => event.target.closest?.('.track-name-resizer');

  const onPointerDown = event => {
    const handle = handleFrom(event);
    if (!handle || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    active = {
      pointerId: event.pointerId,
      start: event.clientX,
      size: current ?? defaultWidth(),
      handle,
      moved: false,
    };
    handle.setPointerCapture(event.pointerId);
    document.body.classList.add('resizing-track-name');
  };

  const onPointerMove = event => {
    if (!active || event.pointerId !== active.pointerId) return;
    const delta = event.clientX - active.start;
    if (Math.abs(delta) > 2) active.moved = true;
    update(active.size + delta);
  };

  const onPointerEnd = event => {
    if (!active || event.pointerId !== active.pointerId) return;
    const { handle, moved } = active;
    active = null;
    document.body.classList.remove('resizing-track-name');
    if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
    if (event.type === 'pointerup' && !moved) fitTrackNames();
  };

  const onDoubleClick = event => {
    if (handleFrom(event)) update(defaultWidth());
  };

  const onKeyDown = event => {
    if (!handleFrom(event) || !['ArrowLeft', 'ArrowRight', 'Home', 'Enter'].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.key === 'Home') {
      update(defaultWidth());
      return;
    }
    if (event.key === 'Enter') {
      fitTrackNames();
      return;
    }
    const step = event.shiftKey ? 40 : 10;
    update((current ?? defaultWidth()) + (event.key === 'ArrowRight' ? step : -step));
  };

  const onDragStart = event => {
    if (!handleFrom(event)) return;
    event.preventDefault();
    event.stopPropagation();
  };

  const onClick = event => {
    if (handleFrom(event)) event.stopPropagation();
  };

  matrix.addEventListener('pointerdown', onPointerDown);
  matrix.addEventListener('pointermove', onPointerMove);
  matrix.addEventListener('pointerup', onPointerEnd);
  matrix.addEventListener('pointercancel', onPointerEnd);
  matrix.addEventListener('dblclick', onDoubleClick);
  matrix.addEventListener('keydown', onKeyDown);
  matrix.addEventListener('dragstart', onDragStart);
  matrix.addEventListener('click', onClick, true);

  return () => {
    matrix.removeEventListener('pointerdown', onPointerDown);
    matrix.removeEventListener('pointermove', onPointerMove);
    matrix.removeEventListener('pointerup', onPointerEnd);
    matrix.removeEventListener('pointercancel', onPointerEnd);
    matrix.removeEventListener('dblclick', onDoubleClick);
    matrix.removeEventListener('keydown', onKeyDown);
    matrix.removeEventListener('dragstart', onDragStart);
    matrix.removeEventListener('click', onClick, true);
    document.body.classList.remove('resizing-track-name');
  };
}
