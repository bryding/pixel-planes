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

// Air is the SAME everywhere now -- the plane flies exactly the same way up
// high as it does down low (uniform aerodynamic efficiency).
function airDensity(y) {
  return 1;
}

// Apply one frame of real-ish flight to any flying thing (player or enemy).
//   o     = the plane object (needs x, y, vx, vy, angle)
//   push  = how hard the engine is pushing this frame
//
// The model: THRUST pushes along the nose, GRAVITY always pulls down, and the
// WINGS make LIFT at right angles to the way the plane is actually moving --
// but only when there's airspeed and the nose isn't pointed too far off the
// airflow. Point straight up with no throttle and gravity bleeds your speed,
// the lift dies, and you STALL and fall. The nose then weathervanes down into
// a dive so you can pick up speed and recover. Sets o.stalling for the HUD.
function applyFlightPhysics(o, push, liftScale) {
  if (liftScale === undefined) liftScale = 1; // 1 = full wings; lower = less lift
  const density = airDensity(o.y);

  // Engine pushes along the nose (weaker in thin air up high).
  push *= 0.35 + 0.65 * density;
  o.vx += Math.cos(o.angle) * push;
  o.vy += Math.sin(o.angle) * push;

  // Gravity always pulls down.
  o.vy += CONFIG.GRAVITY;

  let speed = Math.hypot(o.vx, o.vy);

  if (speed > 0.0001) {
    const vdir = Math.atan2(o.vy, o.vx);          // the way we're moving
    const aoa = angleDiff(o.angle, vdir);          // "angle of attack"

    // Lift coefficient: grows with angle of attack, then COLLAPSES past about
    // 45 degrees -- that collapse is the stall. (sin(2*aoa) peaks at 45 deg
    // and is zero at 0 and 90 deg.)
    // Lift coefficient. The CAMBER term gives lift even at zero angle (so the
    // plane holds height in level flight); the sin term adds lift as you pull
    // up and then COLLAPSES past ~45 deg (the stall). Note: when you fly
    // straight up, this lift points sideways -- it can't hold you up -- so a
    // throttle-off vertical climb still stalls and drops.
    const cl = CONFIG.CAMBER * Math.cos(aoa) - Math.sin(2 * aoa);
    // Lift also fades out FAST as you slow toward the stall speed -- so the
    // moment you bleed off speed (like climbing with no throttle) the wings
    // quit and you drop. This is what makes the stall happen quickly.
    // Your stall speed depends on how steeply you're pointed: low when level
    // (you can fly slow), but higher when climbing straight up (a vertical
    // climb needs lots of speed). "up" is 0 level/diving, 1 straight up.
    const up = Math.max(0, -Math.sin(o.angle));
    const effStall = CONFIG.STALL_SPEED + up * (CONFIG.STALL_SPEED_UP - CONFIG.STALL_SPEED);
    const stallFade = Math.max(0, Math.min(1, (speed - effStall) / 1.2));
    const lift = CONFIG.LIFT * speed * cl * density * stallFade * liftScale;
    const liftDir = vdir - Math.PI / 2;            // 90 deg off the airflow
    o.vx += Math.cos(liftDir) * lift;
    o.vy += Math.sin(liftDir) * lift;

    // Extra drag when the nose is far off the airflow (and base air drag).
    o.vx *= CONFIG.DRAG;
    o.vy *= CONFIG.DRAG;
    const induced = CONFIG.DRAG_AOA * Math.abs(Math.sin(aoa));
    o.vx -= o.vx * induced;
    o.vy -= o.vy * induced;

    // A little extra brake only when the wing is turned almost fully sideways
    // to the airflow (a deep stall). Kept small so you can always recover by
    // diving (gravity) or throttling up.
    const stallness = Math.min(1, Math.max(0, (Math.abs(aoa) - 1.0) / 0.6));
    const sd = stallness * CONFIG.STALL_DRAG;
    o.vx -= o.vx * sd;
    o.vy -= o.vy * sd;

    // Weathervane: the nose drifts to follow the airflow. This is what drops
    // the nose into a dive after a stall so you can pick up speed and recover.
    o.angle += angleDiff(vdir, o.angle) * CONFIG.WEATHERVANE;

    o.stalling = speed < effStall;
  } else {
    o.stalling = true;
  }

  // Don't go faster than the top speed.
  speed = Math.hypot(o.vx, o.vy);
  if (speed > CONFIG.MAX_SPEED) {
    o.vx = (o.vx / speed) * CONFIG.MAX_SPEED;
    o.vy = (o.vy / speed) * CONFIG.MAX_SPEED;
  }
}
