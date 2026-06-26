// ===========================================================================
//  EXPLOSION  --  A quick burst of flying sparks when a plane pops. A "big"
//  one also has a growing fireball ring, used when a plane is destroyed or
//  crashes into the ground.
// ===========================================================================

class Explosion {
  constructor(x, y, color, big = false) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.dead = false;

    // A handful of sparks, each flying off in a random direction.
    this.sparks = [];
    const count = big ? 22 : 12;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * (big ? 4 : 2.5);
      this.sparks.push({
        x: x, y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 15 + Math.random() * (big ? 22 : 15),
      });
    }

    // The fireball ring (only for "big" booms).
    this.big = big;
    this.blastR = 0;
    this.blastLife = big ? 16 : 0;
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
    // Grow the fireball ring outward, then let it fade.
    if (this.blastLife > 0) {
      this.blastLife -= 1;
      this.blastR += 3.5;
      anyAlive = true;
    }
    if (!anyAlive) this.dead = true;
  }

  draw(ctx) {
    // Fireball ring first (so sparks draw on top).
    if (this.big && this.blastLife > 0) {
      const a = this.blastLife / 16;
      ctx.fillStyle = 'rgba(255,180,60,' + (a * 0.7) + ')';
      ctx.beginPath();
      ctx.arc(worldToScreenX(this.x), this.y - camera.y, this.blastR, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const s of this.sparks) {
      if (s.life <= 0) continue;
      ctx.fillStyle = this.color;
      ctx.fillRect(worldToScreenX(s.x) - 1, s.y - camera.y - 1, 2, 2);
    }
  }
}
