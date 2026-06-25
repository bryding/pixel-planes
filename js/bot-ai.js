// ===========================================================================
//  BOT AI  --  the "brain" a computer plane uses to decide what to do.
//
//  This file is deliberately PLAIN: no canvas, no drawing, no page stuff, and
//  it doesn't reach out to any global game variables. You give it a bot and the
//  list of planes, and it hands back a decision (which way to point, whether to
//  shoot). Because it's so plain, it runs in TWO places from ONE copy:
//    • the browser, for the offline single-player enemies (js/enemy.js)
//    • the Node server, for the bots that fill the shared online world
//  so both kinds of bot think with exactly the same brain.
// ===========================================================================

const BotAI = {

  // A steady "random-looking" number 0..1 from a bot's number (so a bot's style
  // is always the same, not jittering every time we ask).
  rand(i, salt) {
    const v = Math.sin((i + 1) * 12.9898 + salt * 78.233) * 43758.5453;
    return v - Math.floor(v);
  },

  // The seven flying "personalities". Each bot starts from one of these and is
  // nudged a little so no two bots fly exactly alike.
  ARCHETYPES: [
    { name: 'ace',     turn: 1.05, thrust: 1.1,  aim: 0.7, fireCd: 1.0, missile: 1.1, evade: 0.5, lead: 1.0, wobble: 0.0 },
    { name: 'rookie',  turn: 0.8,  thrust: 0.9,  aim: 1.6, fireCd: 1.6, missile: 1.8, evade: 0.3, lead: 0.4, wobble: 0.03 },
    { name: 'acrobat', turn: 1.2,  thrust: 1.0,  aim: 1.1, fireCd: 1.2, missile: 1.4, evade: 0.6, lead: 0.7, wobble: 0.12 },
    { name: 'bomber',  turn: 0.75, thrust: 0.95, aim: 1.2, fireCd: 1.4, missile: 0.7, evade: 0.2, lead: 0.8, wobble: 0.0 },
    { name: 'sniper',  turn: 0.85, thrust: 1.0,  aim: 0.5, fireCd: 1.2, missile: 1.2, evade: 0.4, lead: 1.1, wobble: 0.0 },
    { name: 'kamikaze',turn: 1.15, thrust: 1.15, aim: 1.3, fireCd: 1.1, missile: 1.4, evade: 0.0, lead: 0.6, wobble: 0.05 },
    { name: 'coward',  turn: 1.0,  thrust: 1.0,  aim: 1.1, fireCd: 1.3, missile: 1.2, evade: 0.9, lead: 0.7, wobble: 0.05 },
  ],

  // Build bot number i's flying style from an archetype + gentle nudges. CFG is
  // the shared config (browser CONFIG or the server's required copy).
  makeStyle(i, CFG) {
    const a = this.ARCHETYPES[i % this.ARCHETYPES.length];
    const j = (salt) => 0.92 + this.rand(i, salt) * 0.16; // a gentle 0.92..1.08 nudge
    return {
      name: a.name,
      turn:      CFG.ENEMY_TURN * a.turn * j(1),
      thrust:    CFG.ENEMY_THRUST * a.thrust * j(2),
      fireRange: CFG.ENEMY_FIRE_RANGE * j(3),
      aim:       CFG.ENEMY_AIM * a.aim * j(4),
      fireCd:    Math.round(CFG.ENEMY_FIRE_COOLDOWN * a.fireCd * j(5)),
      missileCd: Math.round(CFG.ENEMY_MISSILE_COOLDOWN * a.missile * j(6)),
      evade:  a.evade,
      lead:   a.lead,
      wobble: a.wobble,
      preferredAlt: 120 + this.rand(i, 7) * 180, // each likes a different height
    };
  },

  // The shortest left/right distance between two x's on the looping world.
  _wrapDX(dx, W) { dx = ((dx % W) + W) % W; if (dx > W / 2) dx -= W; return dx; },
  // The shortest turn from "from" to "to" (range -PI..PI).
  _angleDiff(to, from) { let d = to - from; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; },

  // Find the closest ALIVE plane this bot is allowed to attack. In WW2 mode
  // that's anyone on the OTHER faction; otherwise anyone not on our own team.
  findTarget(self, planes, CFG, ww2) {
    let best = null, bestDist = Infinity;
    for (const p of planes) {
      if (p === self || !p.alive) continue;
      if (ww2 ? (p.faction === self.faction) : (p.team === self.team)) continue;
      const dx = this._wrapDX(p.x - self.x, CFG.WORLD_WIDTH), dy = p.y - self.y;
      const d = dx * dx + dy * dy;
      if (d < bestDist) { bestDist = d; best = p; }
    }
    return best;
  },

  // Decide what the bot wants this tick: which way to point its nose, and
  // whether to shoot / launch a missile. Returns the chosen target too.
  //   self   = the bot (needs x,y,vx,vy,angle,health,style,propSpin,fireCooldown,missileCooldown,invincibleTimer)
  //   planes = every plane it can see (each needs x,y,vx,vy,alive,team/faction)
  //   CFG    = the shared config
  //   ww2    = true only in the offline WW2 mode (servers pass false)
  think(self, planes, CFG, ww2) {
    const S = self.style;
    const W = CFG.WORLD_WIDTH;
    const target = this.findTarget(self, planes, CFG, ww2);
    const out = { target, wantAngle: self.angle, shoot: false, missile: false };
    if (!target) return out;

    // Smart aim: point where the target WILL be, not where it is now.
    const dx = this._wrapDX(target.x - self.x, W), dy = target.y - self.y;
    const dist = Math.hypot(dx, dy);
    const lead = (dist / CFG.BULLET_SPEED) * S.lead;
    const aimX = target.x + target.vx * lead;
    const aimY = target.y + target.vy * lead;
    let wantAngle = Math.atan2(aimY - self.y, this._wrapDX(aimX - self.x, W));

    // Hurt + cautious bots run away instead of charging in.
    if (self.health <= 1 && dist < 280 && S.evade > 0.45) wantAngle = Math.atan2(-dy, -dx);
    // Acrobats wiggle as they fly.
    wantAngle += Math.sin(self.propSpin * 0.1) * S.wobble;
    out.wantAngle = wantAngle;

    // Shoot / launch a missile if we're close and lined up (aimed at where the
    // target actually is, not the lead point).
    const aimErr = Math.abs(this._angleDiff(Math.atan2(dy, dx), self.angle));
    if (self.fireCooldown <= 0 && dist < S.fireRange && aimErr < S.aim) out.shoot = true;
    if (!ww2 && self.missileCooldown <= 0 && dist < S.fireRange * 2.2 && aimErr < S.aim * 1.5) out.missile = true;
    return out;
  },
};

// Let the Node server load this same brain with require('../js/bot-ai.js').
if (typeof module !== 'undefined') module.exports = BotAI;
