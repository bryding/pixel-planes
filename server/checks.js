// ===========================================================================
//  CHECKS  --  tiny "does the math still work?" tests for the server's pure
//  rules. No framework — just Node's built-in assert. Run it with:
//      node server/checks.js
//  If everything's fine it prints a list of ✓ lines and exits 0. If something
//  breaks, it throws and tells you which check failed.
// ===========================================================================

const assert = require('assert');
const CONFIG = require('../online/js/config.js');
const BotAI = require('../online/js/bot-ai.js');
const { desiredBots, cleanPlayerName, plausibleMove } = require('./rules.js');

let count = 0;
function ok(name, cond) { assert.ok(cond, 'FAILED: ' + name); count++; console.log('  ✓ ' + name); }

console.log('Bot-count math (bots = max(0, target − humans)):');
ok('0 humans -> target bots',        desiredBots(10, 0) === 10);
ok('1 human  -> target − 1 bots',    desiredBots(10, 1) === 9);
ok('target humans -> 0 bots',        desiredBots(10, 10) === 0);
ok('more humans than target -> 0',   desiredBots(10, 14) === 0);

console.log('Name cleaning (trim, safe charset, cap 14, default Player):');
ok('blank -> Player',                cleanPlayerName('') === 'Player');
ok('spaces trimmed',                 cleanPlayerName('  Ben  ') === 'Ben');
ok('strips odd characters',          cleanPlayerName('B@e<n>!') === 'Ben');
ok('caps at 14 characters',          cleanPlayerName('ABCDEFGHIJKLMNOPQ').length === 14);
ok('keeps spaces/_/-',               cleanPlayerName('Red Baron_1') === 'Red Baron_1');

console.log('Sanity check (drop impossible jumps, FR-014):');
const W = CONFIG.WORLD_WIDTH, J = CONFIG.MAX_SPEED * 80;
ok('no previous state -> allowed',   plausibleMove(null, { x: 5, y: 5 }) === true);
ok('small move allowed',             plausibleMove({ x: 100, y: 100 }, { x: 160, y: 110 }) === true);
ok('teleport rejected',              plausibleMove({ x: 100, y: 100 }, { x: 100 + J + 50, y: 100 }) === false);
ok('big vertical jump rejected',     plausibleMove({ x: 100, y: 100 }, { x: 100, y: 100 + J + 50 }) === false);
ok('wrap-around edge is fine',       plausibleMove({ x: W - 5, y: 0 }, { x: 5, y: 0 }) === true);

console.log('Bot brain (shared with the offline enemies):');
const s = BotAI.makeStyle(3, CONFIG);
ok('makeStyle is deterministic',     BotAI.makeStyle(3, CONFIG).turn === s.turn);
const self = { x: 0, y: 0, vx: 0, vy: 0, angle: 0, health: 10, style: s, propSpin: 0, fireCooldown: 0, missileCooldown: 0, team: 1 };
const near = [self, { x: 60, y: 0, vx: 0, vy: 0, alive: true, team: 2 }];
const far  = [self, { x: 99999, y: 0, vx: 0, vy: 0, alive: true, team: 2 }];
ok('shoots a close, lined-up enemy', BotAI.think(self, near, CONFIG, false).shoot === true);
ok('holds fire on a far enemy',      BotAI.think(self, far, CONFIG, false).shoot === false);
ok('ignores a teammate',             BotAI.think(self, [self, { x: 60, y: 0, vx: 0, vy: 0, alive: true, team: 1 }], CONFIG, false).target === null);
ok('never launches missiles in WW2', BotAI.think(self, near, CONFIG, true).missile === false);
// In WW2 (offline) targeting is by FACTION, not team. A same-faction plane on a
// different team is a friend; an other-faction plane is a target.
const ace = { x: 0, y: 0, vx: 0, vy: 0, angle: 0, health: 10, style: s, propSpin: 0, fireCooldown: 0, missileCooldown: 0, team: 1, faction: 'green' };
const sameFaction = [ace, { x: 60, y: 0, vx: 0, vy: 0, alive: true, team: 9, faction: 'green' }];
const foeFaction  = [ace, { x: 60, y: 0, vx: 0, vy: 0, alive: true, team: 9, faction: 'black' }];
ok('WW2 spares a same-faction plane', BotAI.think(ace, sameFaction, CONFIG, true).target === null);
ok('WW2 targets the other faction',   BotAI.think(ace, foeFaction, CONFIG, true).target !== null);

console.log('\nAll ' + count + ' checks passed. 🎉');
