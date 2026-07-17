// ===========================================================================
//  RULES  --  the small, PURE decisions the server makes, pulled out on their
//  own so they're easy to read and easy to check (see server/checks.js). Pure
//  means: same inputs → same answer, no sockets, no clocks, no surprises.
// ===========================================================================

const CONFIG = require('../online/js/config.js');

// How many bots the world should have: fill the empty seats up to the target,
// but never go below zero (FR-004/005/006).
function desiredBots(target, humans) {
  return Math.max(0, target - humans);
}

// A player name: trimmed, a safe set of characters, max 14, default "Player".
// We do NOT filter words on purpose (FR-011); duplicate names are allowed.
function cleanPlayerName(n) {
  const s = ('' + (n || '')).trim().replace(/[^A-Za-z0-9 _-]/g, '').slice(0, 14);
  return s || 'Player';
}

// Light anti-cheat (FR-014): a real plane can't jump more than this far between
// two reports. Generous so laggy-but-honest players are never kicked; it only
// catches gross teleports (about a second of top-speed travel).
const MAX_JUMP = CONFIG.MAX_SPEED * 80;
function plausibleMove(prev, next) {
  if (!prev || !next) return true;              // nothing to compare yet
  const W = CONFIG.WORLD_WIDTH;
  let dx = ((next.x - prev.x) % W + W) % W; if (dx > W / 2) dx -= W; // shortest way round
  return Math.abs(dx) <= MAX_JUMP && Math.abs(next.y - prev.y) <= MAX_JUMP;
}

module.exports = { desiredBots, cleanPlayerName, plausibleMove, MAX_JUMP };
