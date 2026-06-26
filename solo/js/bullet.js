// ===========================================================================
//  BULLET  --  A little glowing dot that flies in a straight line.
//  The plane makes one of these every time you shoot.
// ===========================================================================

class Bullet {
  // We make a bullet at the plane's nose, flying in the way the nose points.
  // "team" says who fired it, so it only hurts planes on OTHER teams.
  // "color" is just how it looks (your bullets are yellow, enemies' are red).
  constructor(x, y, angle, ownerSpeedX, ownerSpeedY, team, color, faction) {
    this.x = x;
    this.y = y;
    this.team = team;
    this.faction = faction; // used for team friendly-fire in WW2 mode
    this.color = color;

    // The bullet flies in the nose direction. We ALSO add a little of the
    // plane's own speed so bullets feel like they really came off the plane.
    // Bullets fly twice as fast in WW2 mode.
    const spd = CONFIG.BULLET_SPEED * ((typeof mode !== 'undefined' && mode === 'ww2') ? 2 : 1);
    this.vx = Math.cos(angle) * spd + ownerSpeedX * 0.3;
    this.vy = Math.sin(angle) * spd + ownerSpeedY * 0.3;

    // How many frames until this bullet disappears (so they don't fly forever).
    this.life = CONFIG.BULLET_LIFE;

    // When dead = true, the game forgets about this bullet.
    this.dead = false;
  }

  update() {
    this.x = wrapX(this.x + this.vx); // loop around the world sideways
    this.y += this.vy;

    // Count down the bullet's life. When it hits 0, mark it dead.
    this.life -= 1;
    if (this.life <= 0) this.dead = true;

    // Bullets that hit the ground stop too.
    if (this.y > CONFIG.GROUND_Y) this.dead = true;
  }

  draw(ctx) {
    const sx = worldToScreenX(this.x), sy = this.y - camera.y;

    // Unicorn Mode: bullets are heart emojis. 💖
    if (typeof mode !== 'undefined' && mode === 'unicorn') {
      ctx.font = (CONFIG.BULLET_SIZE * 3.2) + 'px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('❤️', sx, sy);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      return;
    }

    // A glowing TRACER streak behind the bullet so it's easy to see.
    const tx = sx - this.vx * 0.6, ty = sy - this.vy * 0.6;
    const s = CONFIG.BULLET_SIZE;
    ctx.lineCap = 'round';

    // soft outer glow
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = s * 2.2;
    ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(sx, sy); ctx.stroke();
    ctx.globalAlpha = 1;

    // bright colored core streak
    ctx.strokeStyle = this.color;
    ctx.lineWidth = s;
    ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(sx, sy); ctx.stroke();

    // hot white tip
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(sx, sy, s * 0.55, 0, Math.PI * 2); ctx.fill();
  }
}
