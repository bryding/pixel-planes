// ===========================================================================
//  SPRITES  --  Detailed pixel-art biplanes (BitPlanes style!).
//
//  Instead of drawing the plane shape every frame, we PAINT it once onto a
//  tiny hidden canvas (a "sprite"), pixel by pixel. Then each frame we just
//  stamp that picture down and spin it. Because the picture is made of real
//  pixels, when it rotates it stays nice and chunky -- that retro look.
//
//  The plane is painted facing RIGHT. (0,0) is the top-left of the sprite,
//  and (cx,cy) is the middle, which is the point it spins around.
// ===========================================================================

// Build one biplane picture in the given colors.
// pal      = { body, lt, dk } main color plus a lighter and darker shade.
// whiteout = true makes an all-white copy, used for the "I got hit!" flash.
function buildPlaneSprite(pal, whiteout) {
  const C = CONFIG.COLORS;
  const W = 44, H = 30, cx = 22, cy = 15;

  const cvs = document.createElement('canvas');
  cvs.width = W;
  cvs.height = H;
  const g = cvs.getContext('2d');

  // Pick colors (or white-ish ones for the hit flash).
  const body   = whiteout ? '#ffffff' : pal.body;
  const lt     = whiteout ? '#ffffff' : pal.lt;
  const dk     = whiteout ? '#dcdcdc' : pal.dk;
  const cowl   = whiteout ? '#e8e8e8' : C.cowl;
  const metal  = whiteout ? '#ffffff' : C.metal;
  const wheel  = whiteout ? '#cfcfcf' : C.wheel;
  const strut  = whiteout ? '#e6e6e6' : C.strut;
  const pilot  = whiteout ? '#ffffff' : C.pilot;
  const wire   = whiteout ? '#f0f0f0' : '#cfd8dc';
  const gun    = whiteout ? '#bdbdbd' : '#222222';

  // tiny helper: paint a block of pixels
  function px(x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }

  // --- Tail at the back (left) ---
  px(7, 7, 3, 6, body);     // vertical fin
  px(7, 7, 1, 6, dk);       // fin shadow edge
  px(7, 8, 3, 1, lt);       // fin stripe
  px(4, 13, 8, 2, body);    // horizontal tail wing
  px(4, 13, 8, 1, lt);      // its highlight
  px(11, 13, 1, 2, dk);

  // --- Fuselage (the main body), tapering to the tail ---
  px(8, 12, 3, 5, body);
  px(10, 11, 22, 7, body);
  px(10, 11, 22, 1, lt);    // top highlight
  px(10, 17, 22, 1, dk);    // belly shadow

  // --- Engine cowling at the nose ---
  px(31, 11, 4, 7, cowl);
  px(31, 11, 4, 1, metal);  // shiny top
  px(31, 17, 4, 1, '#22303d');
  px(35, 12, 1, 5, cowl);   // rounded front
  px(36, 13, 2, 3, metal);  // spinner / nose cone
  px(30, 18, 4, 1, '#555');  // exhaust pipe

  // --- Lower wing ---
  px(10, 20, 24, 2, body);
  px(10, 20, 24, 1, lt);
  px(10, 21, 24, 1, dk);

  // --- Rigging wires between the wings (thin diagonal lines) ---
  px(10, 8, 1, 1, wire); px(11, 10, 1, 1, wire); px(12, 12, 1, 1, wire);
  px(33, 8, 1, 1, wire); px(32, 10, 1, 1, wire); px(31, 12, 1, 1, wire);

  // --- Struts holding the wings apart ---
  px(13, 7, 1, 13, strut);
  px(28, 7, 1, 13, strut);
  px(20, 7, 1, 5, strut);   // cabane strut by the cockpit
  px(24, 7, 1, 5, strut);

  // --- Upper wing (long, sits up high on the struts) ---
  px(7, 5, 30, 2, body);
  px(7, 5, 30, 1, lt);
  px(7, 6, 30, 1, dk);
  // roundel marking
  px(19, 5, 4, 2, '#f4f4f4');
  px(20, 5, 2, 1, dk);

  // --- Machine guns on top of the cowling ---
  px(26, 9, 6, 1, gun);
  px(31, 8, 1, 2, gun);

  // --- Cockpit hole + pilot with goggles ---
  px(21, 10, 5, 2, '#2b1d12');
  px(22, 9, 3, 2, pilot);
  px(22, 9, 3, 1, '#3a2a1a');  // helmet line
  px(24, 9, 1, 1, '#1a1a1a');  // goggle glint

  // --- Landing gear: struts, axle, two wheels ---
  px(17, 18, 1, 4, strut);
  px(25, 18, 1, 4, strut);
  px(15, 24, 12, 1, '#333');
  px(14, 22, 4, 3, wheel); px(15, 23, 2, 1, '#777');
  px(24, 22, 4, 3, wheel); px(25, 23, 2, 1, '#777');

  return { canvas: cvs, cx: cx, cy: cy };
}

// Make a "set" for one color: a normal picture and a white flash picture.
function makePlaneSet(pal) {
  return { normal: buildPlaneSprite(pal, false), flash: buildPlaneSprite(pal, true) };
}

// Pre-build every plane's pictures once, when the game starts.
// (Keyed by team: 'player', 1 = purple enemies, 2 = orange enemies.)
const PLANE_SPRITES = {
  player: makePlaneSet({ body: CONFIG.COLORS.plane,  lt: '#ff7a6b', dk: CONFIG.COLORS.planeDark }),
  1:      makePlaneSet({ body: CONFIG.COLORS.enemy,  lt: '#c79be0', dk: CONFIG.COLORS.enemyDark }),
  2:      makePlaneSet({ body: CONFIG.COLORS.enemy2, lt: '#f5a85a', dk: CONFIG.COLORS.enemy2Dark }),
};

// Stamp a plane sprite onto the screen, rotated to its flying angle,
// with a spinning propeller drawn on the nose.
function drawPlaneSprite(ctx, set, x, y, angle, spin, flashing) {
  const spr = flashing ? set.flash : set.normal;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  // The plane picture (drawn centered on its spin point).
  ctx.drawImage(spr.canvas, -spr.cx, -spr.cy);

  // Propeller: a blade in front that grows/shrinks to look like it's spinning.
  const blade = Math.sin(spin) * 8;
  ctx.fillStyle = flashing ? '#ffffff' : '#1a1a1a';
  ctx.fillRect(15, -blade, 2, blade * 2);

  ctx.restore();
}
