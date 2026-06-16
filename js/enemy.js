// ===========================================================================
//  ENEMY  --  A "dummy" target plane that just floats there for now.
//  Later (Stage 3) we'll give it a brain so it flies and fights back!
//  For now it's a punching bag so we can test shooting and hitting.
// ===========================================================================

class Enemy {
  constructor(x, y) {
    this.startX = x; // remember where it started so it can come back
    this.startY = y;
    this.x = x;
    this.y = y;

    // How many more hits before it pops.
    this.hits = CONFIG.ENEMY_HITS;

    // It bobs up and down gently so it's not totally boring to look at.
    this.bob = 0;

    // When alive = false, it's been popped and is waiting to come back.
    this.alive = true;
    this.respawnTimer = 0;

    // A quick "flash" when it gets hit, so a hit feels punchy.
    this.flash = 0;
  }

  update() {
    if (this.alive) {
      // Gentle floating motion.
      this.bob += 0.05;
      this.y = this.startY + Math.sin(this.bob) * 8;

      // Count the hit-flash down toward 0.
      if (this.flash > 0) this.flash -= 1;
    } else {
      // It's popped: count down, then bring it back fresh.
      this.respawnTimer -= 1;
      if (this.respawnTimer <= 0) {
        this.alive = true;
        this.hits = CONFIG.ENEMY_HITS;
        this.x = this.startX;
        this.y = this.startY;
      }
    }
  }

  // Called when a bullet touches the enemy. Returns true if it just popped.
  takeHit() {
    this.hits -= 1;
    this.flash = 6; // flash white for a few frames
    if (this.hits <= 0) {
      this.alive = false;
      this.respawnTimer = CONFIG.ENEMY_RESPAWN;
      return true; // it popped!
    }
    return false;
  }

  draw(ctx, camX, camY) {
    if (!this.alive) return; // don't draw a popped enemy

    const screenX = this.x - camX;
    const screenY = this.y - camY;

    ctx.save();
    ctx.translate(screenX, screenY);

    const C = CONFIG.COLORS;

    // If it was just hit, draw it white for a frame or two (a hit flash).
    const body = this.flash > 0 ? '#ffffff' : C.enemy;
    const dark = this.flash > 0 ? '#dddddd' : C.enemyDark;

    // The enemy faces LEFT (toward the player), so it's drawn mirrored.
    // Body
    ctx.fillStyle = body;
    ctx.fillRect(-8, -3, 16, 6);
    // Belly stripe
    ctx.fillStyle = dark;
    ctx.fillRect(-8, 1, 16, 2);
    // Wing
    ctx.fillStyle = body;
    ctx.fillRect(-4, -6, 6, 3);
    // Tail fin (at the back = the right side, since it faces left)
    ctx.fillRect(6, -7, 3, 4);

    ctx.restore();
  }
}
