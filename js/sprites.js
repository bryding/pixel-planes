// ===========================================================================
//  SPRITES  --  Drawing for the detailed biplane (two wings!).
//  Both the player and the enemies use this same drawing, just with
//  different colors. The plane is drawn facing RIGHT, centered on (0,0).
//  Whoever calls this has already moved/rotated the "pen" into place.
// ===========================================================================

// pal   = the colors to use, like { body, dark } (team colors).
// spin  = the propeller spin number (makes the blade flicker).
// flash = true for a quick white flash when the plane is hit.
function drawBiplane(ctx, pal, spin, flash) {
  const C = CONFIG.COLORS;

  // When flashing (just got hit), paint the plane white so it's obvious.
  const body = flash ? '#ffffff' : pal.body;
  const dark = flash ? '#dddddd' : pal.dark;

  // --- Tail at the back (left side) ---
  ctx.fillStyle = body;
  ctx.fillRect(-15, -1, 6, 2);   // horizontal tail wing
  ctx.fillStyle = dark;
  ctx.fillRect(-15, -8, 2, 8);   // upright tail fin

  // --- Lower wing ---
  ctx.fillStyle = body;
  ctx.fillRect(-10, 3, 24, 2);
  ctx.fillStyle = dark;
  ctx.fillRect(-10, 5, 24, 1);   // shadow under the lower wing

  // --- Struts: the little posts that join the two wings (biplane look!) ---
  ctx.fillStyle = C.strut;
  ctx.fillRect(-4, -8, 1, 11);
  ctx.fillRect(7, -8, 1, 11);

  // --- Upper wing (sits above the body on the struts) ---
  ctx.fillStyle = body;
  ctx.fillRect(-8, -9, 24, 2);
  ctx.fillStyle = dark;
  ctx.fillRect(-8, -7, 24, 1);   // shadow under the upper wing

  // --- Fuselage: the main body ---
  ctx.fillStyle = body;
  ctx.fillRect(-14, -3, 23, 6);
  ctx.fillStyle = dark;
  ctx.fillRect(-14, 1, 23, 2);   // belly shadow

  // --- Engine cover (cowling) at the front ---
  ctx.fillStyle = C.cowl;
  ctx.fillRect(9, -3, 4, 6);

  // --- Cockpit: window + pilot's head ---
  ctx.fillStyle = C.glass;
  ctx.fillRect(-2, -6, 6, 3);
  ctx.fillStyle = C.pilot;
  ctx.fillRect(0, -6, 2, 2);

  // --- Landing gear: two struts down to two wheels ---
  ctx.fillStyle = C.strut;
  ctx.fillRect(-2, 3, 1, 4);
  ctx.fillRect(3, 3, 1, 4);
  ctx.fillStyle = C.wheel;
  ctx.fillRect(-4, 6, 4, 2);
  ctx.fillRect(2, 6, 4, 2);

  // --- Propeller at the very front (a flickering spinning blade) ---
  ctx.fillStyle = C.metal;
  ctx.fillRect(13, -1, 1, 2);    // the hub
  ctx.fillStyle = C.wheel;
  const blade = Math.sin(spin) * 7; // grows/shrinks to look like spinning
  ctx.fillRect(13, -blade, 2, blade * 2);
}
