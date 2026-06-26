// ===========================================================================
//  POWER-UPS  --  Floating bubbles you fly into. Three kinds:
//    'shield' (blue)  -> invincible for a while
//    'turret' (gold)  -> your gun shoots 5 bullets wide
//    'skull'  (red)   -> BAD! freezes you and costs you half your health
// ===========================================================================

class PowerUp {
  constructor(x, y, type) {
    this.x = x;
    this.baseY = y;
    this.y = y;
    this.type = type;
    this.bob = (x % 6); // a steady starting wobble (no Math.random needed)
    this.life = CONFIG.POWERUP_LIFE;
    this.dead = false;
  }

  update() {
    this.bob += 0.05;
    this.y = this.baseY + Math.sin(this.bob) * 6; // gentle floating
    this.life -= 1;
    if (this.life <= 0) this.dead = true;
  }

  draw(ctx) {
    const sx = worldToScreenX(this.x), sy = this.y - camera.y;
    const r = CONFIG.POWERUP_RADIUS;
    const col = this.type === 'shield' ? '#5bc0ff'
              : this.type === 'turret' ? '#e0a93a' : '#c0392b';

    // The bubble.
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(255,255,255,0.4)';        // shiny highlight
    ctx.beginPath(); ctx.arc(sx - r * 0.35, sy - r * 0.35, r * 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.stroke();

    // The icon inside.
    if (this.type === 'shield') {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(sx - 6, sy - 6); ctx.lineTo(sx + 6, sy - 6);
      ctx.lineTo(sx + 6, sy + 1); ctx.lineTo(sx, sy + 8); ctx.lineTo(sx - 6, sy + 1);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = col; ctx.fillRect(sx - 1, sy - 4, 2, 8); ctx.fillRect(sx - 4, sy - 1, 8, 2);
    } else if (this.type === 'turret') {
      ctx.fillStyle = '#333333';
      ctx.fillRect(sx - 6, sy - 2, 8, 6);   // gun body
      ctx.fillRect(sx + 1, sy - 1, 7, 3);   // barrel
      ctx.fillStyle = '#777777'; ctx.fillRect(sx - 6, sy + 3, 8, 2); // base
    } else { // skull
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(sx, sy - 1, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(sx - 4, sy + 3, 8, 3);
      ctx.fillStyle = '#000000';
      ctx.fillRect(sx - 4, sy - 2, 2, 3);   // eye
      ctx.fillRect(sx + 2, sy - 2, 2, 3);   // eye
      ctx.fillRect(sx - 1, sy + 1, 2, 2);   // nose
    }
  }
}

// Pick a random-ish type (shield common, turret common, skull rarer).
function randomPowerUpType(seed) {
  const r = Math.abs(Math.sin(seed * 91.7)) % 1;
  if (r < 0.40) return 'shield';
  if (r < 0.72) return 'turret';
  return 'skull';
}
