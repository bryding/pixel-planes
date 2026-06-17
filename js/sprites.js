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
  px(5, 9, 3, 6, body);      // vertical fin
  px(5, 9, 1, 6, dk);
  px(6, 10, 2, 1, lt);
  px(3, 15, 9, 2, body);     // horizontal tailplane
  px(3, 15, 9, 1, lt);
  px(11, 15, 1, 2, dk);

  // --- The ONE wing (monoplane): a tapered airfoil under the fuselage ---
  px(14, 20, 24, 3, body);
  px(14, 20, 24, 1, lt);     // sunlit top of the wing
  px(14, 22, 24, 1, dk);     // shaded underside
  px(33, 19, 5, 1, lt);      // a little leading-edge sweep at the root
  px(14, 20, 1, 1, dk); px(37, 20, 1, 1, dk); // softened tips

  // --- Fuselage (streamlined, tapering to the tail) ---
  px(6, 15, 4, 4, body);     // tail boom
  px(9, 13, 31, 7, body);
  px(9, 13, 31, 1, lt);      // top highlight
  px(9, 19, 31, 1, dk);      // belly shadow

  // --- Engine cowling + spinner at the nose ---
  px(40, 12, 4, 7, cowl);
  px(40, 12, 4, 1, cowlLt);
  px(40, 18, 4, 1, cowlDk);
  px(44, 13, 1, 5, cowl);    // rounded front
  px(45, 14, 2, 3, hub);     // spinner hub

  // --- Bubble canopy + pilot head ---
  px(24, 10, 8, 3, dk);          // canopy frame
  px(25, 10, 6, 2, '#9fd8ff');   // glass
  px(26, 11, 3, 2, '#f1c27d');   // pilot head

  // --- Roundel marking on the fuselage ---
  px(17, 14, 4, 3, round1);
  px(18, 15, 2, 1, round2);

  // --- Main landing gear: strut + wheel under the wing ---
  line(23, 22, 22, 28, strut);
  line(27, 22, 26, 28, strut);
  px(21, 27, 8, 3, wheel);   // tire
  px(23, 28, 4, 1, wheelHb);

  // --- Small tailwheel under the tail ---
  px(6, 19, 1, 3, strut);
  px(5, 22, 3, 2, wheel);

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

// ---------------------------------------------------------------------------
//  UNICORN sprite (for Unicorn Mode). Same size/pivot as the plane so all the
//  flight maths line up -- it just LOOKS like a flying unicorn.
// ---------------------------------------------------------------------------
function buildUnicornSprite(pal, whiteout) {
  const W = 50, H = 34, cx = 25, cy = 17;
  const cvs = document.createElement('canvas');
  cvs.width = W; cvs.height = H;
  const g = cvs.getContext('2d');
  const body = whiteout ? '#ffffff' : pal.body;
  const lt   = whiteout ? '#ffffff' : pal.lt;
  const dk   = whiteout ? '#dcdcdc' : pal.dk;
  const horn = whiteout ? '#ffffff' : '#f4c542';
  const hoof = whiteout ? '#cccccc' : '#3a2c1c';
  const rain = ['#e74c3c', '#f39c12', '#f1c40f', '#2ecc71', '#3498db', '#9b59b6'];
  function px(x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }
  function line(x0, y0, x1, y1, c) {
    const s = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= s; i++) { const t = i / s;
      px(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), 1, 1, c); }
  }

  // Flowing rainbow tail (back/left)
  for (let i = 0; i < 6; i++) line(13, 13 + i, 3, 21 + i, rain[i]);

  // Back legs
  px(15, 21, 2, 7, body); px(15, 27, 2, 1, hoof);
  px(19, 21, 2, 7, body); px(19, 27, 2, 1, hoof);

  // Body / torso
  px(12, 13, 24, 9, body);
  px(12, 13, 24, 1, lt);
  px(12, 21, 24, 1, dk);

  // Front legs
  px(28, 21, 2, 7, body); px(28, 27, 2, 1, hoof);
  px(32, 21, 2, 7, body); px(32, 27, 2, 1, hoof);

  // Neck + head (front/right)
  px(33, 9, 5, 6, body);
  px(36, 4, 9, 9, body);
  px(36, 4, 9, 1, lt);
  px(44, 8, 2, 4, body);     // muzzle
  px(40, 1, 2, 3, body);     // ear
  px(42, 8, 1, 2, '#1a1a1a'); // eye

  // Rainbow mane down the neck
  for (let i = 0; i < 6; i++) px(31 + i, 5, 1, 9, rain[i]);

  // Golden spiral horn pointing up-front
  line(44, 4, 49, -1, horn); line(45, 4, 49, 0, horn);
  px(46, 2, 1, 1, '#ffffff');

  return { canvas: cvs, cx: cx, cy: cy };
}
function makeUnicornSet(pal) {
  return { normal: buildUnicornSprite(pal, false), flash: buildUnicornSprite(pal, true) };
}
function makeUnicornSetFromColor(color) {
  return makeUnicornSet({ body: color, lt: shadeHex(color, 55), dk: shadeHex(color, -55) });
}
// The player's unicorn (bots build their own from their color).
const UNICORN_SPRITES = {
  player: makeUnicornSet({ body: '#3d8fd6', lt: '#7fbdef', dk: '#2466a0' }),
};

// WW2 Mode team planes (green vs black).
const WW2_SPRITES = {
  green: makePlaneSetFromColor('#4a7a36'),
  black: makePlaneSetFromColor('#2b2b2b'),
};

// Pre-build every plane's pictures once, when the game starts.
// (Keyed by team: 'player' = blue, 1 = purple enemies, 2 = orange enemies.)
const PLANE_SPRITES = {
  player: makePlaneSet({ body: '#3d8fd6', lt: '#7fbdef', dk: '#2466a0' }),
  1:      makePlaneSet({ body: '#9b59b6', lt: '#c79be0', dk: '#6c3483' }),
  2:      makePlaneSet({ body: '#e67e22', lt: '#f5a85a', dk: '#a85916' }),
};

// Stamp a plane sprite onto the screen, rotated to its flying angle,
// with a spinning propeller drawn on the nose.
// A flying saucer for Alien Invasion (tag) mode. It does NOT rotate with the
// nose like a plane -- it's a hovering UFO that always sits flat. "spin" is used
// to animate the ring of blinking lights and a gentle bob.
function drawUfoCraft(ctx, x, y, spin, isPlayer) {
  ctx.save();
  ctx.translate(x, y + Math.sin(spin * 0.1) * 2); // gentle hover bob

  // Soft tractor-beam glow underneath.
  const glow = ctx.createRadialGradient(0, 14, 2, 0, 14, 30);
  glow.addColorStop(0, 'rgba(120,255,140,0.5)');
  glow.addColorStop(1, 'rgba(120,255,140,0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.moveTo(-8, 6); ctx.lineTo(8, 6); ctx.lineTo(20, 30); ctx.lineTo(-20, 30); ctx.closePath(); ctx.fill();

  // Saucer body (a flat ellipse).
  ctx.fillStyle = '#9aa3b0';
  ctx.beginPath(); ctx.ellipse(0, 4, 22, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#6b7280';
  ctx.beginPath(); ctx.ellipse(0, 6, 22, 5, 0, 0, Math.PI); ctx.fill();

  // Glass dome on top.
  ctx.fillStyle = '#bfe9ff';
  ctx.beginPath(); ctx.ellipse(0, 0, 11, 9, 0, Math.PI, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#7ad0a0';                 // a little green pilot inside
  ctx.beginPath(); ctx.arc(0, -2, 4, 0, Math.PI * 2); ctx.fill();

  // Ring of blinking colored lights around the rim.
  const cols = ['#ff4d4d', '#ffd24a', '#4dff6a', '#5bc0ff'];
  for (let i = 0; i < 6; i++) {
    const on = (Math.floor(spin * 0.2) + i) % 2 === 0;
    ctx.fillStyle = on ? cols[i % cols.length] : '#3a3f48';
    ctx.fillRect(-18 + i * 7, 6, 4, 4);
  }

  // The player's UFO gets a small white outline so you can spot yourself.
  if (isPlayer) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(0, 4, 23, 9, 0, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

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

  // Bad Weather: mud spots and water droplets on the plane.
  if (typeof mode !== 'undefined' && mode === 'badweather') {
    ctx.fillStyle = '#4a3a22';
    ctx.fillRect(-5, 1, 3, 2); ctx.fillRect(7, -2, 2, 2); ctx.fillRect(0, 2, 2, 2);
    ctx.fillStyle = 'rgba(180,205,235,0.85)';
    ctx.fillRect(-2, -3, 1, 2); ctx.fillRect(10, 0, 1, 2); ctx.fillRect(-9, 0, 1, 2);
  }

  // Night Mode: the plane's lights are on (headlight + red/green nav lights).
  if (typeof mode !== 'undefined' && mode === 'night') {
    ctx.fillStyle = '#fff7c0'; ctx.fillRect(17, -2, 3, 3);   // white headlight
    ctx.fillStyle = '#ff4d4d'; ctx.fillRect(-12, 2, 2, 2);   // red nav light
    ctx.fillStyle = '#4dff6a'; ctx.fillRect(12, 2, 2, 2);    // green nav light
  }

  ctx.restore();
}
