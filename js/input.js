// ===========================================================================
//  INPUT  --  Keeps track of which keys are being held down right now.
//  Other files ask "is the up arrow held?" by checking Input.up, etc.
//
//  Controls:  Arrow keys to fly  •  Space = guns  •  X = missile
// ===========================================================================

const Input = {
  up: false,
  down: false,
  left: false,
  right: false,
  fire: false,    // SPACE held? (shoot the guns)
  missile: false, // X held? (launch a missile)
};

// When a key is pressed DOWN, turn the matching switch on.
window.addEventListener('keydown', function (e) {
  const k = e.key.toLowerCase();
  if (e.key === 'ArrowUp')    Input.up = true;
  if (e.key === 'ArrowDown')  Input.down = true;
  if (e.key === 'ArrowLeft')  Input.left = true;
  if (e.key === 'ArrowRight') Input.right = true;
  if (e.key === ' ')          Input.fire = true;
  if (k === 'x')              Input.missile = true;

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
  if (e.key === ' ')          Input.fire = false;
  if (k === 'x')              Input.missile = false;
});
