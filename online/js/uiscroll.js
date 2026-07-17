// ===========================================================================
//  UI SCROLL  --  makes the pause menu scrollable so you can always reach the
//  options at the very TOP or BOTTOM, even on a small screen.
//    • Mouse WHEEL and finger DRAG work from the CSS (overflow-y: auto).
//    • This file adds mouse HOLD-and-DRAG, and tells a drag apart from a click
//      so dragging to scroll doesn't accidentally press a button.
// ===========================================================================
(function () {
  const SELECTOR = '#pauseMenu .pauseInner';
  const DRAG_THRESHOLD = 8;   // pixels you must move before it counts as a drag

  let panel = null, startY = 0, startTop = 0, dragging = false, justDragged = false;

  function onDown(e) {
    justDragged = false;
    if (e.pointerType !== 'mouse') return;           // phones already drag-scroll
    const box = e.target.closest(SELECTOR);
    if (!box) return;
    if (e.target.closest('input, textarea, select')) return;
    if (box.scrollHeight <= box.clientHeight) return; // nothing to scroll
    panel = box; startY = e.clientY; startTop = box.scrollTop; dragging = false;
  }
  function onMove(e) {
    if (!panel) return;
    const moved = e.clientY - startY;
    if (!dragging && Math.abs(moved) > DRAG_THRESHOLD) dragging = true;
    if (dragging) { panel.scrollTop = startTop - moved; e.preventDefault(); }
  }
  function onUp() {
    if (dragging) justDragged = true;
    panel = null; dragging = false;
  }
  function onClick(e) {
    if (justDragged) { e.stopPropagation(); e.preventDefault(); justDragged = false; }
  }

  window.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove, { passive: false });
  window.addEventListener('pointerup', onUp);
  window.addEventListener('click', onClick, true);
})();
