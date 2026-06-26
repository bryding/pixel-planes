// ===========================================================================
//  MISSILE  --  A homing rocket that chases a locked-on enemy.
//
//  When you fire, the missile picks the closest enemy and steers toward it.
//  BUT it only has a little fuel: once the fuel runs out it stops steering
//  and flies straight, so a sharp-turning plane can dodge it. It also leaves
//  a smoke trail behind so you can watch it hunt.
// ===========================================================================

class Missile {
  constructor(x, y, angle, team, target) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.team = team;       // who fired it (only hurts other teams)
    this.target = target;   // the plane it's chasing (may be null)

    this.fuel = CONFIG.MISSILE_FUEL; // frames of steering left
    this.life = CONFIG.MISSILE_LIFE; // frames before it fizzles out
    this.dead = false;

    this.trail = []; // little puffs of smoke we leave behind
  }

  update() {
    // --- Steer toward the target while we still have fuel ---
    if (this.fuel > 0 && this.target && this.target.alive) {
      const want = Math.atan2(this.target.y - this.y, wrapDX(this.target.x - this.x));
      const turn = CONFIG.MISSILE_TURN;
      const d = angleDiff(want, this.angle); // shortest way to turn
      if (d > turn) this.angle += turn;
      else if (d < -turn) this.angle -= turn;
      else this.angle = want;
      this.fuel -= 1;
    }
    // (When fuel is gone, we just keep the angle we have = flies straight.)

    // --- Move forward (and loop around the world sideways) ---
    this.x = wrapX(this.x + Math.cos(this.angle) * CONFIG.MISSILE_SPEED);
    this.y += Math.sin(this.angle) * CONFIG.MISSILE_SPEED;

    // --- Drop a puff of smoke, and age the old puffs ---
    this.trail.push({ x: this.x, y: this.y, life: 14 });
    for (const p of this.trail) p.life -= 1;
    while (this.trail.length && this.trail[0].life <= 0) this.trail.shift();

    // --- Die of old age, or when it hits the ground ---
    this.life -= 1;
    if (this.life <= 0) this.dead = true;
    if (this.y > CONFIG.GROUND_Y) this.dead = true;
  }

  draw(ctx) {
    const C = CONFIG.COLORS;

    // Unicorn Mode: a golden horn with a rainbow trail. 🦄🌈
    if (typeof mode !== 'undefined' && mode === 'unicorn') {
      const rain = ['#e74c3c', '#f39c12', '#f1c40f', '#2ecc71', '#3498db', '#9b59b6'];
      this.trail.forEach((p, i) => {
        const a = p.life / 14, s = 3 + (1 - a) * 4;
        ctx.globalAlpha = a * 0.85;
        ctx.fillStyle = rain[i % 6];
        ctx.fillRect(worldToScreenX(p.x) - s / 2, p.y - camera.y - s / 2, s, s);
      });
      ctx.globalAlpha = 1;
      ctx.save();
      ctx.translate(worldToScreenX(this.x), this.y - camera.y);
      ctx.rotate(this.angle);
      ctx.fillStyle = '#f4c542';                 // golden horn
      ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-5, -3); ctx.lineTo(-5, 3); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.fillRect(2, -1, 2, 2); // sparkle
      ctx.restore();
      return;
    }

    // Smoke trail (older puffs are bigger and more faded).
    for (const p of this.trail) {
      const a = p.life / 14;            // 1 = fresh, 0 = gone
      const s = 2 + (1 - a) * 4;        // grows as it fades
      ctx.globalAlpha = a * 0.7;
      ctx.fillStyle = C.smoke;
      ctx.fillRect(worldToScreenX(p.x) - s / 2, p.y - camera.y - s / 2, s, s);
    }
    ctx.globalAlpha = 1; // always reset, so nothing else turns see-through

    // The missile itself, pointing where it's heading.
    ctx.save();
    ctx.translate(worldToScreenX(this.x), this.y - camera.y);
    ctx.rotate(this.angle);
    ctx.fillStyle = C.missileFin;
    ctx.fillRect(-6, -3, 3, 6);   // tail fins
    ctx.fillStyle = C.missile;
    ctx.fillRect(-5, -2, 10, 4);  // body
    ctx.fillStyle = C.missileTip;
    ctx.fillRect(5, -1, 3, 2);    // nose
    ctx.restore();
  }
}
