// ===========================================================================
//  INPUT  --  Keeps track of which keys are being held down right now.
//  Other files can ask "is the up arrow held?" by checking Input.up, etc.
// ===========================================================================

const Input = {
  up: false,
  down: false,
  left: false,
  right: false,
};

// When a key is pressed DOWN, turn the matching switch on.
window.addEventListener('keydown', function (e) {
  if (e.key === 'ArrowUp')    Input.up = true;
  if (e.key === 'ArrowDown')  Input.down = true;
  if (e.key === 'ArrowLeft')  Input.left = true;
  if (e.key === 'ArrowRight') Input.right = true;

  // Stop the arrow keys from also scrolling the web page.
  if (e.key.startsWith('Arrow')) e.preventDefault();
});

// When a key is let UP, turn the matching switch off.
window.addEventListener('keyup', function (e) {
  if (e.key === 'ArrowUp')    Input.up = false;
  if (e.key === 'ArrowDown')  Input.down = false;
  if (e.key === 'ArrowLeft')  Input.left = false;
  if (e.key === 'ArrowRight') Input.right = false;
});
