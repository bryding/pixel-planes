// ===========================================================================
//  INPUT  --  Keeps track of which keys are being held down right now.
//  Other files can ask "is the up arrow held?" by checking Input.up, etc.
//
//  TWO control schemes (for split-screen 2-player):
//   • Player 1 (RIGHT / blue):  Arrow keys to fly,  B = guns,  N = missile,  M = eject
//                               (Space also = guns, X also = missile, C also = eject)
//   • Player 2 (LEFT  / red):   W A S D to fly,      Q = guns,  E = missile,  F = eject
// ===========================================================================

const Input = {
  // --- Player 1 (arrow keys) ---
  up: false,
  down: false,
  left: false,
  right: false,
  fire: false,    // SPACE or M held? (shoot the guns)
  missile: false, // X or N held? (launch a missile)
  eject: false,   // C held? (bail out / parachute)

  // --- Player 2 (WASD) ---
  up2: false,
  down2: false,
  left2: false,
  right2: false,
  fire2: false,   // Q held?
  missile2: false,// E held?
  eject2: false,  // F held?
};

// If you're typing in a text box (like the command bar), the keys should
// type letters -- NOT fly the plane. This checks for that, so pressing W or
// A while typing doesn't make your plane lurch around.
function typingInABox(e) {
  const el = e.target;
  return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
}

// Outside split-screen, WASD is a comfy ALTERNATIVE way to fly YOUR plane
// (both schemes work at once). In split-screen WASD belongs to player 2.
function wasdIsPlayer1() {
  return (typeof splitScreen === 'undefined' || !splitScreen);
}

// When a key is pressed DOWN, turn the matching switch on.
window.addEventListener('keydown', function (e) {
  if (typingInABox(e)) return;
  const k = e.key.toLowerCase();
  // Player 1 — arrows + Space/X/C, plus M (gun) and N (missile) for split-screen.
  if (e.key === 'ArrowUp')    Input.up = true;
  if (e.key === 'ArrowDown')  Input.down = true;
  if (e.key === 'ArrowLeft')  Input.left = true;
  if (e.key === 'ArrowRight') Input.right = true;
  if (e.key === ' ' || k === 'b') Input.fire = true;
  if (k === 'x' || k === 'n')     Input.missile = true;
  if (k === 'c' || k === 'm')     Input.eject = true;

  // WASD also flies player 1 whenever we're NOT in split-screen.
  if (wasdIsPlayer1()) {
    if (k === 'w') Input.up = true;
    if (k === 's') Input.down = true;
    if (k === 'a') Input.left = true;
    if (k === 'd') Input.right = true;
  }

  // Player 2 — WASD + Q (gun) + E (missile) + F (eject).
  if (k === 'w') Input.up2 = true;
  if (k === 's') Input.down2 = true;
  if (k === 'a') Input.left2 = true;
  if (k === 'd') Input.right2 = true;
  if (k === 'q') Input.fire2 = true;
  if (k === 'e') Input.missile2 = true;
  if (k === 'f') Input.eject2 = true;

  // Stop the arrow keys (and space) from also scrolling the web page.
  if (e.key.startsWith('Arrow') || e.key === ' ') e.preventDefault();
});

// When a key is let UP, turn the matching switch off.
window.addEventListener('keyup', function (e) {
  const k = e.key.toLowerCase();
  if (e.key === 'ArrowUp')    Input.up = false;
  if (e.key === 'ArrowDown')  Input.down = false;
  if (e.key === 'ArrowLeft')  Input.left = false;
  if (e.key === 'ArrowRight') Input.right = false;
  if (e.key === ' ' || k === 'b') Input.fire = false;
  if (k === 'x' || k === 'n')     Input.missile = false;
  if (k === 'c' || k === 'm')     Input.eject = false;

  // Letting go of WASD also releases player 1 (outside split-screen).
  if (wasdIsPlayer1()) {
    if (k === 'w') Input.up = false;
    if (k === 's') Input.down = false;
    if (k === 'a') Input.left = false;
    if (k === 'd') Input.right = false;
  }

  if (k === 'w') Input.up2 = false;
  if (k === 's') Input.down2 = false;
  if (k === 'a') Input.left2 = false;
  if (k === 'd') Input.right2 = false;
  if (k === 'q') Input.fire2 = false;
  if (k === 'e') Input.missile2 = false;
  if (k === 'f') Input.eject2 = false;
});

// ===========================================================================
//  MOUSE MODE  --  An OPTIONAL way to fly with the mouse instead of the arrows.
//  When it's switched ON (from the Settings menu):
//   • the plane's nose smoothly turns to POINT AT your mouse pointer
//   • LEFT mouse button  = hold to fire the guns    (same as Space)
//   • RIGHT mouse button = launch a homing missile  (same as X)
//   • the mouse WHEEL    = throttle up / down (your speed)
//  When it's OFF, the mouse does nothing special, so menus click normally.
// ===========================================================================

// Is mouse mode switched on right now? (game.js flips this from the button.)
let mouseMode = false;

// Where the mouse pointer is, measured in GAME pixels (the plane aims here).
const Mouse = { x: CONFIG.GAME_W / 2, y: CONFIG.GAME_H / 2 };

// Turn the pointer's spot on the web page into GAME-pixel coordinates. The
// canvas is stretched to fill the window, so we scale the spot back down to
// match the small internal picture the game is really drawn on.
function updateMousePos(e) {
  const cv = document.getElementById('game');
  if (!cv) return;
  const rect = cv.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  Mouse.x = (e.clientX - rect.left) * (cv.width  / rect.width);
  Mouse.y = (e.clientY - rect.top)  * (cv.height / rect.height);
}
window.addEventListener('mousemove', updateMousePos);

// Mouse buttons only DO something when mouse mode is ON, and only when you
// click the game itself (not a menu button), so menus keep working normally.
window.addEventListener('mousedown', function (e) {
  if (!mouseMode) return;
  if (e.target && e.target.id !== 'game') return;
  if (e.button === 0) Input.fire = true;      // left button  -> guns
  if (e.button === 2) Input.missile = true;   // right button -> missile
});
// Always let go on mouse-up so a button can never get "stuck" held down.
window.addEventListener('mouseup', function (e) {
  if (e.button === 0) Input.fire = false;
  if (e.button === 2) Input.missile = false;
});

// Stop the right-click menu from popping up over the game while flying.
window.addEventListener('contextmenu', function (e) {
  if (mouseMode) e.preventDefault();
});

// Mouse WHEEL = throttle. Scroll up to speed up, scroll down to slow down.
window.addEventListener('wheel', function (e) {
  if (!mouseMode || typeof player === 'undefined' || !player) return;
  // deltaY is negative when you scroll UP, positive when you scroll DOWN.
  player.throttle -= Math.sign(e.deltaY) * 0.05;
  player.throttle = Math.max(0, Math.min(1, player.throttle)); // keep it 0..1
  e.preventDefault();
}, { passive: false });
