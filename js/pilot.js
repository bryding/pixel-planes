// ===========================================================================
//  PILOT  --  Press C once to EJECT: the pilot free-falls out of the plane.
//  Press C AGAIN to pop the parachute (which slows you down). Steer left/right
//  with the arrows; on the ground you can walk. Reach the big barn to get
//  rescued and keep your points. (If you splat before opening the chute, you
//  die.)
// ===========================================================================

class Pilot {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = -CONFIG.EJECT_UP; // a little upward hop as you bail out
    this.landed = false;        // touched the ground yet?
    this.chuteOpen = false;     // has the parachute been popped (press C again)?
    this.swing = 0;             // gentle parachute sway
  }

  // Press C a second time to pop the parachute.
  deploy() {
    if (!this.chuteOpen && !this.landed) {
      this.chuteOpen = true;
      this.vy *= 0.3; // the chute jerks you to a gentle sink
    }
  }

  update() {
    let steer = 0;
    if (Input.left)  steer -= 1;
    if (Input.right) steer += 1;

    if (this.landed) {
      // --- On the ground: WALK left/right toward the barn ---
      this.vx = steer * CONFIG.PILOT_WALK;
      this.x = wrapX(this.x + this.vx);
      this.y = CONFIG.GROUND_Y - 4;
      if (steer !== 0) this.swing += 0.3; // little walking wiggle
      return;
    }

    if (this.chuteOpen) {
      // --- Parachute open: drift and sink gently ---
      this.swing += 0.06;
      this.vx += steer * 0.08;
      this.vx *= 0.94;
      const maxDrift = CONFIG.PARACHUTE_DRIFT;
      this.vx = Math.max(-maxDrift, Math.min(maxDrift, this.vx));
      this.vy += CONFIG.GRAVITY * 0.4;
      if (this.vy > CONFIG.PARACHUTE_FALL) this.vy = CONFIG.PARACHUTE_FALL;
    } else {
      // --- Free fall (no chute yet): drop fast, with a little air steering ---
      this.vx += steer * 0.05;
      this.vx *= 0.98;
      this.vy += CONFIG.GRAVITY * 1.3;
      if (this.vy > 9) this.vy = 9;
    }

    this.x = wrapX(this.x + this.vx);
    this.y += this.vy;
    if (this.y >= CONFIG.GROUND_Y - 4) {
      this.y = CONFIG.GROUND_Y - 4;
      this.landed = true;
      this.vy = 0;
    }
  }

  draw(ctx) {
    const sx = worldToScreenX(this.x);
    const sy = this.y - camera.y;
    const sway = Math.sin(this.swing) * 2;

    // Parachute canopy (a red-and-white dome) only once it's been opened.
    if (this.chuteOpen && !this.landed) {
      const cyTop = sy - 22;
      ctx.fillStyle = '#e74c3c';
      ctx.beginPath();
      ctx.arc(sx + sway, cyTop, 14, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(sx + sway - 5, cyTop - 9, 10, 9); // white center panel
      // strings from canopy to pilot
      ctx.strokeStyle = '#dddddd';
      ctx.beginPath();
      ctx.moveTo(sx + sway - 13, cyTop); ctx.lineTo(sx - 2, sy - 4);
      ctx.moveTo(sx + sway + 13, cyTop); ctx.lineTo(sx + 2, sy - 4);
      ctx.stroke();
    }

    // The little pilot.
    ctx.fillStyle = '#3a2a1a'; ctx.fillRect(sx - 3, sy - 6, 6, 8); // body
    ctx.fillStyle = CONFIG.COLORS.pilot; ctx.fillRect(sx - 2, sy - 9, 4, 3); // head

    // Walking legs (they shuffle as you walk on the ground).
    if (this.landed) {
      const step = Math.sin(this.swing) * 2;
      ctx.fillStyle = '#2a1d12';
      ctx.fillRect(sx - 3, sy + 2, 2, 3 + step);
      ctx.fillRect(sx + 1, sy + 2, 2, 3 - step);
    }
  }
}
