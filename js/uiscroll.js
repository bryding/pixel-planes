// ===========================================================================
//  UI SCROLL  --  makes the menus scrollable so you can always reach the
//  options at the very TOP or BOTTOM, even on a small screen.
//
//  Three ways to scroll a menu, and you get all three:
//    1. Mouse WHEEL ............ free, just from the CSS (overflow-y: auto)
//    2. Finger DRAG on a phone .. free, the browser does it on touch screens
//    3. Mouse HOLD-and-DRAG ..... this file adds it (grab the menu and pull)
//
//  The tricky part of #3 is telling a DRAG apart from a CLICK: if you barely
//  move, you meant to press a button; if you pull, you meant to scroll. We wait
//  until the mouse has moved a few pixels before we call it a drag, and then we
//  swallow the click so letting go doesn't also press a button.
// ===========================================================================

(function () {
  // Every menu box that can get too tall to fit. (Add new ones here.)
  const SELECTOR = '.pauseInner, .startCenter, #modMenu, #modeMenu';
  const DRAG_THRESHOLD = 8;   // pixels you must move before it counts as a drag

  let panel = null;       // the menu box we grabbed
  let startY = 0;         // where the mouse first pressed down
  let startTop = 0;       // how far the menu was scrolled when we grabbed it
  let dragging = false;   // have we moved far enough to call it a drag?
  let justDragged = false; // did the press that's ending right now turn into a drag?

  function onDown(e) {
    justDragged = false;                      // a fresh press is not a drag (yet)
    if (e.pointerType !== 'mouse') return;    // phones already scroll by finger — leave them alone
    const box = e.target.closest(SELECTOR);
    if (!box) return;                         // didn't press on a menu
    if (e.target.closest('input, textarea, select')) return; // sliders/color/text drag themselves
    if (box.scrollHeight <= box.clientHeight) return;        // this menu already fits — nothing to scroll
    panel = box; startY = e.clientY; startTop = box.scrollTop; dragging = false;
  }

  function onMove(e) {
    if (!panel) return;
    const moved = e.clientY - startY;
    if (!dragging && Math.abs(moved) > DRAG_THRESHOLD) {
      dragging = true;
      panel.classList.add('grabbing');        // show the "grabbing hand" cursor
    }
    if (dragging) {
      panel.scrollTop = startTop - moved;      // pull down -> see the options below
      e.preventDefault();                      // don't also select text while dragging
    }
  }

  function onUp() {
    if (panel) panel.classList.remove('grabbing');
    if (dragging) justDragged = true;          // remember, so we can cancel the click below
    panel = null; dragging = false;
  }

  // If the press turned into a drag, eat the click so we don't press a button
  // when we let go. (Capture phase = we get it first, before the button does.)
  function onClickCapture(e) {
    if (justDragged) { e.stopPropagation(); e.preventDefault(); justDragged = false; }
  }

  // Pointer events cover the mouse AND a finger with one set of handlers.
  window.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove, { passive: false });
  window.addEventListener('pointerup', onUp);
  window.addEventListener('click', onClickCapture, true);
})();
