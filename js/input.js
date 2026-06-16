// ===========================================================================
//  INPUT  --  Keeps track of which keys are being held down right now.
//  Other files can ask "is the up arrow held?" by checking Input.up, etc.
// ===========================================================================

const Input = {
  up: false,
  down: false,
  left: false,
  right: false,
  fire: false,    // is SPACE being held? (used to shoot the guns)
  missile: false, // is X being held? (used to launch a missile)
  eject: false,   // is C being held? (used to bail out / parachute)
};

// When a key is pressed DOWN, turn the matching switch on.
window.addEventListener('keydown', function (e) {
  if (e.key === 'ArrowUp')    Input.up = true;
  if (e.key === 'ArrowDown')  Input.down = true;
  if (e.key === 'ArrowLeft')  Input.left = true;
  if (e.key === 'ArrowRight') Input.right = true;
  if (e.key === ' ')          Input.fire = true; // Space bar = shoot!
  if (e.key === 'x' || e.key === 'X') Input.missile = true; // X = missile
  if (e.key === 'c' || e.key === 'C') Input.eject = true;   // C = eject

  // Stop the arrow keys (and space) from also scrolling the web page.
  if (e.key.startsWith('Arrow') || e.key === ' ') e.preventDefault();
});

// When a key is let UP, turn the matching switch off.
window.addEventListener('keyup', function (e) {
  if (e.key === 'ArrowUp')    Input.up = false;
  if (e.key === 'ArrowDown')  Input.down = false;
  if (e.key === 'ArrowLeft')  Input.left = false;
  if (e.key === 'ArrowRight') Input.right = false;
  if (e.key === ' ')          Input.fire = false;
  if (e.key === 'x' || e.key === 'X') Input.missile = false;
  if (e.key === 'c' || e.key === 'C') Input.eject = false;
});
