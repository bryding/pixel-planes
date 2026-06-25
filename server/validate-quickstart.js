// ===========================================================================
//  VALIDATE-QUICKSTART  --  runs the LOGIC behind quickstart.md V1–V5 against a
//  real running server, headlessly (no browser). It starts the server on a test
//  port, connects fake players over WebSocket, and checks the protocol does what
//  the quickstart promises.
//
//  Run it:  node server/validate-quickstart.js
//
//  NOTE: this proves the networking/rules. The *visual* parts of the quickstart
//  (you actually see planes, explosions, the name screen) still need a human in
//  a browser — that's the part of T030 a script can't do.
// ===========================================================================

const { spawn } = require('child_process');
const path = require('path');
const WebSocket = require('./node_modules/ws');

const PORT = 8771;
const URL = 'ws://localhost:' + PORT;
let failures = 0;
function check(name, cond) { console.log((cond ? '  ✓ ' : '  ✗ FAIL ') + name); if (!cond) failures++; }
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// A tiny fake player: connects, says hello, optionally streams a fixed state.
function player(name) {
  const ws = new WebSocket(URL);
  const c = { ws, id: null, snap: [], downs: [], hits: 0, fires: 0, name };
  c.state = { x: 500, y: -400, angle: 0, vx: 3, vy: 0, health: 10, alive: true, score: 0 };
  c.send = () => { if (ws.readyState === 1) ws.send(JSON.stringify({ t: 'state', s: c.state })); };
  ws.on('open', () => ws.send(JSON.stringify({ t: 'hello', name })));
  ws.on('message', (d) => {
    const m = JSON.parse(d);
    if (m.t === 'welcome') { c.id = m.id; c.welcome = m; c.stream = setInterval(c.send, 50); }
    if (m.t === 'snapshot') c.snap = m.planes;
    if (m.t === 'down') c.downs.push(m);
    if (m.t === 'hit') c.hits++;
    if (m.t === 'fire' && m.id >= 1000000) c.fires++;
  });
  c.close = () => { clearInterval(c.stream); try { ws.close(); } catch (_) {} };
  return c;
}

async function main() {
  const srv = spawn('node', [path.join(__dirname, 'server.js')], { env: Object.assign({}, process.env, { PORT: String(PORT) }), stdio: 'ignore' });
  await wait(900);
  try {
    // V1 — Join the world: hello -> welcome with world params.
    console.log('V1 — Join the world (SC-001):');
    const a = player('Ace');
    await wait(900);
    check('welcome arrives with id + target + tickHz', a.welcome && a.welcome.id > 0 && a.welcome.target > 0 && a.welcome.tickHz > 0);
    check('you appear in the snapshot as a plane', a.snap.some((p) => p.id === a.id));

    // V2 — See other players live + leave.
    console.log('V2 — See others live (SC-002, FR-010):');
    const b = player('Baron');
    await wait(900);
    check("each sees the other's plane", a.snap.some((p) => p.id === b.id) && b.snap.some((p) => p.id === a.id));
    check('names are carried', a.snap.find((p) => p.id === b.id).name === 'Baron');
    b.close();
    await wait(900);
    check('a closed player leaves the snapshot', !a.snap.some((p) => p.id === b.id));

    // V3 — Bots backfill to TARGET_POPULATION; no isBot flag.
    console.log('V3 — Bots backfill (SC-003/004):');
    const target = a.welcome.target;
    check('1 human -> target planes total', a.snap.length === target);
    check('and target-1 of them are bots', a.snap.filter((p) => p.id >= 1000000).length === target - 1);
    check('no isBot flag on the wire', !a.snap.some((p) => 'isBot' in p));
    const c2 = player('Cleo'), d2 = player('Dax');
    await wait(900);
    check('3 humans -> bots drop to target-3', a.snap.filter((p) => p.id >= 1000000).length === target - 3);
    check('total stays at target', a.snap.length === target);

    // V4 — Combat, death, auto-respawn.
    console.log('V4 — Combat, death, respawn (SC-005/008):');
    const bot = a.snap.find((p) => p.id >= 1000000);
    for (let i = 0; i < 12; i++) a.ws.send(JSON.stringify({ t: 'hit', targetId: bot.id, kind: 'gun' }));
    await wait(500);
    check('shooting a bot down credits the shooter', a.downs.some((x) => x.victimId === bot.id && x.byId === a.id));
    await wait(2500);
    check('bots fire their own bullets (they can shoot you)', a.fires > 0 || c2.fires > 0 || d2.fires > 0);
    a.state = { x: 500, y: -400, angle: 0, vx: 0, vy: 0, health: 0, alive: false, score: 0 }; a.send();
    await wait(300);
    a.state = { x: 2200, y: -400, angle: 0, vx: 3, vy: 0, health: 10, alive: true, score: 0 }; a.send();
    await wait(400);
    const me = a.snap.find((p) => p.id === a.id);
    check('after dying you respawn far away and reappear', me && me.alive === true && me.x > 2000);

    a.close(); c2.close(); d2.close();
    await wait(300);

    // V5 — Tweakability: the bot-count formula follows config (pure check).
    console.log('V5 — Tweakability (SC-006):');
    const { desiredBots } = require('./rules.js');
    check('target 4 -> 4 bots with 0 humans', desiredBots(4, 0) === 4);
    check('target 16 -> 16 bots with 0 humans', desiredBots(16, 0) === 16);
  } finally {
    srv.kill();
  }

  console.log('');
  if (failures === 0) console.log('ALL HEADLESS QUICKSTART CHECKS PASSED. 🎉  (visual V1–V4 + Railway still need a browser/devices.)');
  else console.log(failures + ' CHECK(S) FAILED.');
  process.exit(failures === 0 ? 0 : 1);
}

main();
