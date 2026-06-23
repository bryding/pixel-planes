// ===========================================================================
//  INPUT  --  Keeps track of which keys are being held down right now.
//  Other files can ask "is the up arrow held?" by checking Input.up, etc.
//
//  TWO control schemes (for split-screen 2-player):
//   • Player 1 (RIGHT / blue):  Arrow keys to fly,  M = guns,  N = missile,
//                               (Space also = guns, X also = missile, C = eject)
//   • Player 2 (LEFT  / red):   W A S D to fly,      Q = guns,  E = missile
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
};

// When a key is pressed DOWN, turn the matching switch on.
window.addEventListener('keydown', function (e) {
  const k = e.key.toLowerCase();
  // Player 1 — arrows + Space/X/C, plus M (gun) and N (missile) for split-screen.
  if (e.key === 'ArrowUp')    Input.up = true;
  if (e.key === 'ArrowDown')  Input.down = true;
  if (e.key === 'ArrowLeft')  Input.left = true;
  if (e.key === 'ArrowRight') Input.right = true;
  if (e.key === ' ' || k === 'm') Input.fire = true;
  if (k === 'x' || k === 'n')     Input.missile = true;
  if (k === 'c')                  Input.eject = true;

  // Player 2 — WASD + Q (gun) + E (missile).
  if (k === 'w') Input.up2 = true;
  if (k === 's') Input.down2 = true;
  if (k === 'a') Input.left2 = true;
  if (k === 'd') Input.right2 = true;
  if (k === 'q') Input.fire2 = true;
  if (k === 'e') Input.missile2 = true;

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
  if (e.key === ' ' || k === 'm') Input.fire = false;
  if (k === 'x' || k === 'n')     Input.missile = false;
  if (k === 'c')                  Input.eject = false;

  if (k === 'w') Input.up2 = false;
  if (k === 's') Input.down2 = false;
  if (k === 'a') Input.left2 = false;
  if (k === 'd') Input.right2 = false;
  if (k === 'q') Input.fire2 = false;
  if (k === 'e') Input.missile2 = false;
});
