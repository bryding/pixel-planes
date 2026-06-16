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
  const W = 44, H = 30, cx = 22, cy = 15;

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
  const cowlLt = whiteout ? '#ffffff' : '#f6a83c';
  const cowlDk = whiteout ? '#cccccc' : '#b5610f';
  const hub    = whiteout ? '#ffffff' : '#f4c542';
  const strut  = whiteout ? '#dddddd' : '#2f3a45';
  const wheel  = whiteout ? '#cccccc' : '#161616';
  const wheelHb= whiteout ? '#ffffff' : '#8a8a8a';
  const roundel= whiteout ? '#ffffff' : '#d23b3b';
  const roundMd= whiteout ? '#dddddd' : '#ffffff';
  const cream  = whiteout ? '#ffffff' : '#f3e6c4';

  // tiny helpers
  function px(x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }
  function line(x0, y0, x1, y1, c) {            // draw a 1px diagonal line
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      px(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), 1, 1, c);
    }
  }

  // --- Tail at the back (left) ---
  px(4, 13, 8, 3, body);   // horizontal stabilizer
  px(4, 13, 8, 1, lt);
  px(6, 8, 3, 6, body);    // vertical fin
  px(6, 8, 1, 6, dk);
  px(6, 9, 3, 1, cream);   // tail stripe
  px(4, 18, 3, 1, strut);  // tail skid

  // --- Lower wing ---
  px(9, 20, 24, 2, body);
  px(9, 20, 24, 1, lt);
  px(9, 21, 24, 1, dk);

  // --- Wing struts: an X-brace out near the tips, posts near the body ---
  line(11, 7, 15, 20, strut); line(15, 7, 11, 20, strut); // left X
  line(29, 7, 33, 20, strut); line(33, 7, 29, 20, strut); // right X
  px(18, 8, 1, 12, strut); px(26, 8, 1, 12, strut);        // cabane posts

  // --- Upper wing (long, sits high on the struts) ---
  px(6, 5, 32, 2, body);
  px(6, 5, 32, 1, cream);  // cream leading edge
  px(6, 6, 32, 1, dk);     // under-shadow
  px(6, 5, 1, 1, dk); px(37, 5, 1, 1, dk); // trimmed tips

  // --- Fuselage (main body) ---
  px(9, 12, 25, 7, body);
  px(9, 12, 25, 1, lt);    // top highlight
  px(9, 18, 25, 1, dk);    // belly shadow

  // --- Orange engine cowling at the nose ---
  px(34, 11, 4, 8, cowl);
  px(34, 11, 4, 1, cowlLt);
  px(34, 18, 4, 1, cowlDk);
  px(38, 12, 1, 6, cowl);  // rounded front
  px(38, 14, 2, 2, hub);   // spinner hub

  // --- Red roundel marking on the fuselage ---
  px(16, 13, 5, 4, roundel);
  px(17, 14, 3, 2, roundMd);
  px(18, 15, 1, 1, roundel);

  // --- Cockpit opening ---
  px(24, 10, 4, 2, '#16222e');
  px(25, 10, 1, 2, lt);

  // --- Machine gun on top of the cowling ---
  px(30, 10, 5, 1, strut);

  // --- Landing gear: a fork down to a big wheel ---
  line(17, 19, 18, 24, strut);
  line(23, 19, 21, 24, strut);
  px(16, 23, 7, 4, wheel);    // tire
  px(18, 24, 3, 2, wheelHb);  // hub

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
  const blade = Math.sin(spin) * 8;
  ctx.fillStyle = flashing ? '#ffffff' : '#1a1a1a';
  ctx.fillRect(17, -blade, 2, blade * 2);

  ctx.restore();
}
