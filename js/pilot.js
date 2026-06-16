// ===========================================================================
//  PILOT  --  When you press C you EJECT: the pilot pops out of the plane and
//  floats down under a parachute. Steer left/right with the arrow keys. If you
//  drift to the big barn in the middle you get rescued (and keep your points).
// ===========================================================================

class Pilot {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = -CONFIG.EJECT_UP; // a little upward hop as you bail out
    this.landed = false;        // touched the ground yet?
    this.swing = 0;             // gentle parachute sway
  }

  update() {
    this.swing += 0.06;

    // Steer the parachute left/right with the arrow keys.
    let steer = 0;
    if (Input.left)  steer -= 1;
    if (Input.right) steer += 1;
    this.vx += steer * 0.08;
    this.vx *= 0.94;                                  // slow sideways drifting
    const maxDrift = CONFIG.PARACHUTE_DRIFT;
    this.vx = Math.max(-maxDrift, Math.min(maxDrift, this.vx));

    // Fall, but the parachute slows you to a gentle sink.
    this.vy += CONFIG.GRAVITY * 0.4;
    if (this.vy > CONFIG.PARACHUTE_FALL) this.vy = CONFIG.PARACHUTE_FALL;

    // Move (and loop around the world sideways).
    this.x = wrapX(this.x + this.vx);
    this.y += this.vy;

    // Land on the ground.
    if (this.y >= CONFIG.GROUND_Y - 4) {
      this.y = CONFIG.GROUND_Y - 4;
      this.landed = true;
    }
  }

  draw(ctx) {
    const sx = worldToScreenX(this.x);
    const sy = this.y - camera.y;
    const sway = Math.sin(this.swing) * 2;

    // Parachute canopy (a red-and-white dome above the pilot).
    if (!this.landed) {
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
  }
}
