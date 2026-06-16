// ===========================================================================
//  PLANE  --  The player's airplane: how it moves and how it's drawn.
// ===========================================================================

class Plane {
  constructor(x, y) {
    // Where the plane is in the world.
    this.x = x;
    this.y = y;

    // How fast it's moving sideways (vx) and up/down (vy).
    // "v" is short for "velocity", which just means speed-with-a-direction.
    this.vx = 2;
    this.vy = 0;

    // Which way the nose is pointing, as an angle.
    // 0 means pointing to the right. We start flying to the right.
    this.angle = 0;

    // The throttle is like a gas pedal: 0 = off, 1 = full power.
    this.throttle = CONFIG.START_THROTTLE;

    // A spinning number used to animate the propeller.
    this.propSpin = 0;
  }

  // This runs every frame to move the plane.
  update() {
    // --- 1. Read the controls ---
    if (Input.up)   this.throttle += CONFIG.THROTTLE_RATE;
    if (Input.down) this.throttle -= CONFIG.THROTTLE_RATE;
    // Keep the throttle between 0 (off) and 1 (full power).
    this.throttle = Math.max(0, Math.min(1, this.throttle));

    if (Input.left)  this.angle -= CONFIG.TURN_SPEED;
    if (Input.right) this.angle += CONFIG.TURN_SPEED;

    // --- 2. Push the plane in the direction the nose points ---
    // Math.cos/Math.sin turn an angle into left-right and up-down amounts.
    const push = this.throttle * CONFIG.THRUST;
    this.vx += Math.cos(this.angle) * push;
    this.vy += Math.sin(this.angle) * push;

    // --- 3. Gravity pulls the plane down ---
    this.vy += CONFIG.GRAVITY;

    // --- 4. Air resistance slows it down a little ---
    this.vx *= CONFIG.DRAG;
    this.vy *= CONFIG.DRAG;

    // --- 5. Don't let it go faster than the top speed ---
    const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    if (speed > CONFIG.MAX_SPEED) {
      this.vx = (this.vx / speed) * CONFIG.MAX_SPEED;
      this.vy = (this.vy / speed) * CONFIG.MAX_SPEED;
    }

    // --- 6. Actually move ---
    this.x += this.vx;
    this.y += this.vy;

    // --- 7. Don't fall through the ground ---
    if (this.y > CONFIG.GROUND_Y - 6) {
      this.y = CONFIG.GROUND_Y - 6;
      if (this.vy > 0) this.vy = 0; // stop falling
    }

    // --- 8. Don't fly off the top of the sky ---
    if (this.y < 10) {
      this.y = 10;
      if (this.vy < 0) this.vy = 0;
    }

    // Spin the propeller a bit (faster when throttle is higher).
    this.propSpin += 0.5 + this.throttle;
  }

  // Draw the plane. camX/camY is where the camera is, so we draw the plane
  // in the right spot on the screen.
  draw(ctx, camX, camY) {
    const screenX = this.x - camX;
    const screenY = this.y - camY;

    ctx.save();
    ctx.translate(screenX, screenY); // move the "pen" to the plane
    ctx.rotate(this.angle);          // rotate so the plane faces its angle

    const C = CONFIG.COLORS;

    // Body (a little rectangle)
    ctx.fillStyle = C.plane;
    ctx.fillRect(-8, -3, 16, 6);

    // Darker belly stripe
    ctx.fillStyle = C.planeDark;
    ctx.fillRect(-8, 1, 16, 2);

    // Wing (sticking up a bit)
    ctx.fillStyle = C.plane;
    ctx.fillRect(-2, -6, 6, 3);

    // Tail fin (at the back)
    ctx.fillRect(-9, -7, 3, 4);

    // Propeller at the front: it flickers as it spins
    ctx.fillStyle = C.propeller;
    const blade = Math.sin(this.propSpin) * 5;
    ctx.fillRect(8, -blade, 2, blade * 2);

    ctx.restore();
  }
}
