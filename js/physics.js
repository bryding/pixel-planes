// ===========================================================================
//  PHYSICS & WORLD  --  shared helpers used by planes, bullets and the world.
//
//  The world is a big LOOP: it's CONFIG.WORLD_WIDTH pixels long, and flying off
//  one edge brings you out the other side. These helpers do the "loop math".
// ===========================================================================

// Wrap an x position back into the range 0 .. WORLD_WIDTH.
function wrapX(x) {
  const W = CONFIG.WORLD_WIDTH;
  return ((x % W) + W) % W;
}

// The shortest left/right distance between two x positions, going AROUND the
// loop if that's closer. (So something near the right edge is "close" to
// something near the left edge.)
function wrapDX(dx) {
  const W = CONFIG.WORLD_WIDTH;
  dx = ((dx % W) + W) % W;       // 0 .. W
  if (dx > W / 2) dx -= W;       // -W/2 .. W/2
  return dx;
}

// The SHORTEST turn from angle "from" to angle "to" (in the range -PI..PI),
// so a plane always turns the quick way around.
function angleDiff(to, from) {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// How "thick" the air is at this height: 1 down low, fading to 0 at the
// ceiling. Thin air (high up) means weak lift and a weak engine.
function airDensity(y) {
  const t = (y - CONFIG.CEILING) / (CONFIG.STALL_ALT - CONFIG.CEILING);
  return Math.max(0, Math.min(1, t));
}

// Apply one frame of flight to any flying thing (player or enemy).
//   o     = the plane object (needs x, y, vx, vy, angle)
//   push  = how hard the engine is pushing this frame
// This does thrust, gravity, wing lift, stalling, "grip" (momentum follows the
// nose), air drag, and a top-speed limit. It also sets o.stalling for the HUD.
function applyFlightPhysics(o, push) {
  const density = airDensity(o.y);

  // The engine is weaker in thin air up high.
  push *= 0.35 + 0.65 * density;
  o.vx += Math.cos(o.angle) * push;
  o.vy += Math.sin(o.angle) * push;

  // Gravity always pulls down. (Climbing fights gravity and bleeds your
  // speed; diving lets gravity build it back up -- just like a real plane.)
  o.vy += CONFIG.GRAVITY;

  let speed = Math.hypot(o.vx, o.vy);

  // Wing lift comes from forward speed, but fades when the air is thin (too
  // high) OR when you're flying too slow (a stall). No lift = you fall.
  const forward = o.vx * Math.cos(o.angle) + o.vy * Math.sin(o.angle);
  const speedLift = Math.max(0, Math.min(1, speed / CONFIG.STALL_SPEED));
  o.vy -= Math.max(0, forward) * CONFIG.LIFT * density * speedLift;

  // We're "stalling" if the air is too thin or we're going too slow.
  o.stalling = density < 0.55 || speed < CONFIG.STALL_SPEED;

  // Grip: swing momentum toward the nose -- but only with enough airspeed.
  // Slow/stalled planes mush around with little control.
  const grip = CONFIG.GRIP * Math.min(1, speed / CONFIG.TURN_FULL_SPEED);
  if (speed > 0.001) {
    let dir = Math.atan2(o.vy, o.vx);
    dir += angleDiff(o.angle, dir) * grip;
    o.vx = Math.cos(dir) * speed;
    o.vy = Math.sin(dir) * speed;
  }

  // Air resistance.
  o.vx *= CONFIG.DRAG;
  o.vy *= CONFIG.DRAG;

  // Don't go faster than the top speed.
  speed = Math.hypot(o.vx, o.vy);
  if (speed > CONFIG.MAX_SPEED) {
    o.vx = (o.vx / speed) * CONFIG.MAX_SPEED;
    o.vy = (o.vy / speed) * CONFIG.MAX_SPEED;
  }
}
