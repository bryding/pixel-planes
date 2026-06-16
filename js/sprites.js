// ===========================================================================
//  SPRITES  --  Detailed pixel-art biplanes.
//
//  We PAINT each plane once onto a tiny hidden canvas (a "sprite"), pixel by
//  pixel. Then each frame we just stamp that picture down and spin it. Because
//  it's made of real pixels, it stays nice and chunky when it rotates.
//
//  The plane is painted facing RIGHT. (0,0) is the top-left of the sprite,
//  and (cx,cy) is the middle -- the point it spins around. The design: a blue
//  biplane with an orange engine cowling, a red roundel, X-braced wings, and
//  a big landing-gear wheel.
// ===========================================================================

// Build one biplane picture in the given colors.
// pal      = { body, lt, dk } main color plus a lighter and darker shade.
// whiteout = true makes an all-white copy, used for the "I got hit!" flash.
function buildPlaneSprite(pal, whiteout) {
  // A side-on WWI-style biplane (like BitPlanes): two clearly separated wings
  // joined by vertical struts, a fuselage tapering to the tail, rounded engine
  // cowl + prop up front, a cockpit with a pilot, main wheels and a tailwheel.
  const W = 50, H = 34, cx = 25, cy = 17;

  const cvs = document.createElement('canvas');
  cvs.width = W;
  cvs.height = H;
  const g = cvs.getContext('2d');

  // Body colors (or whitish ones for the hit flash).
  const body = whiteout ? '#ffffff' : pal.body;
  const lt   = whiteout ? '#ffffff' : pal.lt;
  const dk   = whiteout ? '#dcdcdc' : pal.dk;
  // Fixed "parts" colors, shared by every plane.
  const cowl   = whiteout ? '#eeeeee' : '#e8821e';
  const cowlLt = whiteout ? '#ffffff' : '#ffd9a0';
  const cowlDk = whiteout ? '#cccccc' : '#b5610f';
  const hub    = whiteout ? '#ffffff' : '#f4c542';
  const strut  = whiteout ? '#e6e6e6' : '#3a2c1c';
  const wheel  = whiteout ? '#cccccc' : '#161616';
  const wheelHb= whiteout ? '#ffffff' : '#7a7a7a';
  const round1 = whiteout ? '#ffffff' : '#d23b3b';
  const round2 = whiteout ? '#dddddd' : '#ffffff';

  function px(x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }
  function line(x0, y0, x1, y1, c) {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      px(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), 1, 1, c);
    }
  }

  // --- Tail at the back (left): fin/rudder + horizontal stabilizer ---
  px(5, 8, 3, 7, body);     // vertical fin
  px(5, 8, 1, 7, dk);
  px(6, 9, 2, 1, lt);
  px(3, 14, 9, 2, body);    // horizontal tailplane
  px(3, 14, 9, 1, lt);
  px(11, 14, 1, 2, dk);

  // --- Lower wing ---
  px(9, 23, 30, 2, body);
  px(9, 23, 30, 1, lt);
  px(9, 24, 30, 1, dk);

  // --- Interplane struts (vertical) + cabane struts (the "N" to the body) ---
  px(15, 6, 1, 18, strut);
  px(34, 6, 1, 18, strut);
  line(22, 13, 20, 6, strut);
  line(27, 13, 29, 6, strut);

  // --- Upper wing (staggered slightly forward, long) ---
  px(8, 5, 35, 2, body);
  px(8, 5, 35, 1, lt);
  px(8, 6, 35, 1, dk);
  px(8, 5, 1, 1, dk); px(42, 5, 1, 1, dk); // softened tips

  // --- Fuselage (tapering toward the tail) ---
  px(6, 14, 4, 4, body);    // tail boom
  px(9, 12, 30, 7, body);
  px(9, 12, 30, 1, lt);     // top highlight
  px(9, 18, 30, 1, dk);     // belly shadow

  // --- Rounded engine cowling + spinner at the nose ---
  px(39, 11, 4, 8, cowl);
  px(39, 11, 4, 1, cowlLt);
  px(39, 18, 4, 1, cowlDk);
  px(43, 12, 1, 6, cowl);   // rounded front
  px(44, 14, 2, 3, hub);    // spinner hub

  // --- Cockpit opening + pilot head ---
  px(25, 11, 5, 2, '#20303a');
  px(26, 10, 3, 2, '#f1c27d');
  px(26, 10, 3, 1, '#3a2a1a');

  // --- Roundel marking on the upper wing ---
  px(22, 5, 4, 2, round1);
  px(23, 5, 2, 1, round2);

  // --- Main landing gear: V-struts down to a wheel ---
  line(21, 19, 19, 28, strut);
  line(27, 19, 25, 28, strut);
  px(17, 27, 8, 3, wheel);  // tire
  px(19, 28, 4, 1, wheelHb);

  // --- Small tailwheel under the tail ---
  px(6, 18, 1, 3, strut);
  px(5, 21, 3, 2, wheel);

  return { canvas: cvs, cx: cx, cy: cy };
}

// Make a "set" for one color: a normal picture and a white flash picture.
function makePlaneSet(pal) {
  return { normal: buildPlaneSprite(pal, false), flash: buildPlaneSprite(pal, true) };
}

// Lighten (amt > 0) or darken (amt < 0) a #rrggbb color by an amount.
function shadeHex(hex, amt) {
  let n = parseInt(hex.slice(1), 16);
  let r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt));
  let g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  let b = Math.max(0, Math.min(255, (n & 255) + amt));
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

// Build a full plane sprite set from a single body color (auto light/dark).
function makePlaneSetFromColor(color) {
  return makePlaneSet({ body: color, lt: shadeHex(color, 55), dk: shadeHex(color, -55) });
}

// Pre-build every plane's pictures once, when the game starts.
// (Keyed by team: 'player' = blue, 1 = purple enemies, 2 = orange enemies.)
const PLANE_SPRITES = {
  player: makePlaneSet({ body: '#3d8fd6', lt: '#7fbdef', dk: '#2466a0' }),
  1:      makePlaneSet({ body: '#9b59b6', lt: '#c79be0', dk: '#6c3483' }),
  2:      makePlaneSet({ body: '#e67e22', lt: '#f5a85a', dk: '#a85916' }),
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
  const blade = Math.sin(spin) * 9;
  ctx.fillStyle = flashing ? '#ffffff' : '#1a1a1a';
  ctx.fillRect(21, -blade, 2, blade * 2);

  ctx.restore();
}
