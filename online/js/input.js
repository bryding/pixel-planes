// ===========================================================================
//  INPUT  --  Keeps track of which keys are being held down right now.
//  Other files ask "is the up key held?" by checking Input.up, etc.
//
//  You can fly with EITHER the arrow keys OR the WASD keys -- both do the
//  same thing, so use whichever feels comfy:
//     Up / W      = throttle up        Down / S    = throttle down
//     Left / A    = turn nose left      Right / D   = turn nose right
//     Space = guns   •   X = missile
// ===========================================================================

const Input = {
  up: false,
  down: false,
  left: false,
  right: false,
  fire: false,    // SPACE held? (shoot the guns)
  missile: false, // X held? (launch a missile)
};

// If the player is typing in a text box (like the "Your name" box), the keys
// should type letters -- NOT fly the plane. This checks for that so pressing
// W or A while naming yourself doesn't make your plane lurch around.
function typingInABox(e) {
  const el = e.target;
  return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
}

// When a key is pressed DOWN, turn the matching switch on.
window.addEventListener('keydown', function (e) {
  if (typingInABox(e)) return;
  const k = e.key.toLowerCase();
  if (e.key === 'ArrowUp'    || k === 'w') Input.up = true;
  if (e.key === 'ArrowDown'  || k === 's') Input.down = true;
  if (e.key === 'ArrowLeft'  || k === 'a') Input.left = true;
  if (e.key === 'ArrowRight' || k === 'd') Input.right = true;
  if (e.key === ' ')                       Input.fire = true;
  if (k === 'x')                           Input.missile = true;

  // Stop the arrow keys (and space) from also scrolling the web page.
  if (e.key.startsWith('Arrow') || e.key === ' ') e.preventDefault();
});

// When a key is let UP, turn the matching switch off.
window.addEventListener('keyup', function (e) {
  const k = e.key.toLowerCase();
  if (e.key === 'ArrowUp'    || k === 'w') Input.up = false;
  if (e.key === 'ArrowDown'  || k === 's') Input.down = false;
  if (e.key === 'ArrowLeft'  || k === 'a') Input.left = false;
  if (e.key === 'ArrowRight' || k === 'd') Input.right = false;
  if (e.key === ' ')                       Input.fire = false;
  if (k === 'x')                           Input.missile = false;
});
