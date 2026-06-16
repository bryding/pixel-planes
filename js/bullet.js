// ===========================================================================
//  BULLET  --  A little glowing dot that flies in a straight line.
//  The plane makes one of these every time you shoot.
// ===========================================================================

class Bullet {
  // We make a bullet at the plane's nose, flying in the way the nose points.
  constructor(x, y, angle, ownerSpeedX, ownerSpeedY) {
    this.x = x;
    this.y = y;

    // The bullet flies in the nose direction. We ALSO add a little of the
    // plane's own speed so bullets feel like they really came off the plane.
    this.vx = Math.cos(angle) * CONFIG.BULLET_SPEED + ownerSpeedX * 0.3;
    this.vy = Math.sin(angle) * CONFIG.BULLET_SPEED + ownerSpeedY * 0.3;

    // How many frames until this bullet disappears (so they don't fly forever).
    this.life = CONFIG.BULLET_LIFE;

    // When dead = true, the game forgets about this bullet.
    this.dead = false;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;

    // Count down the bullet's life. When it hits 0, mark it dead.
    this.life -= 1;
    if (this.life <= 0) this.dead = true;

    // Bullets that hit the ground stop too.
    if (this.y > CONFIG.GROUND_Y) this.dead = true;
  }

  draw(ctx, camX, camY) {
    ctx.fillStyle = CONFIG.COLORS.bullet;
    const s = CONFIG.BULLET_SIZE;
    ctx.fillRect(this.x - camX - s / 2, this.y - camY - s / 2, s, s);
  }
}
