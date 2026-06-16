// ===========================================================================
//  EXPLOSION  --  A quick burst of flying sparks when a plane pops.
//  It's just for looks (it doesn't hurt anything), but it makes hits
//  feel a lot more satisfying!
// ===========================================================================

class Explosion {
  constructor(x, y, color) {
    // Make a handful of "sparks", each flying off in a random direction.
    this.sparks = [];
    for (let i = 0; i < 12; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 2.5;
      this.sparks.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 15 + Math.random() * 15,
      });
    }
    this.color = color;
    this.dead = false;
  }

  update() {
    let anyAlive = false;
    for (const s of this.sparks) {
      s.x += s.vx;
      s.y += s.vy;
      s.vy += 0.08;      // a little gravity on the sparks
      s.vx *= 0.96;      // slow down over time
      s.life -= 1;
      if (s.life > 0) anyAlive = true;
    }
    // When every spark has faded, this explosion is done.
    if (!anyAlive) this.dead = true;
  }

  draw(ctx, camX, camY) {
    for (const s of this.sparks) {
      if (s.life <= 0) continue;
      ctx.fillStyle = this.color;
      ctx.fillRect(s.x - camX - 1, s.y - camY - 1, 2, 2);
    }
  }
}
