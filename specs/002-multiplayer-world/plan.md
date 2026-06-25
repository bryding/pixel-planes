# Implementation Plan: Multiplayer Persistent World

**Branch**: `main` (no feature branch; spec-dir driven) | **Date**: 2026-06-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-multiplayer-world/spec.md`

## Summary

Turn Pixel Planes into a single always-on multiplayer world: a player opens the app, types a
name, and joins one shared sky (agar.io-style). Players see each other in near-real-time,
server-run **bot** planes backfill empty slots up to a configurable target (default 10), combat is
free-for-all, and death triggers an automatic in-place respawn.

**Technical approach**: *Evolve* the existing online stack rather than rebuild it. The repo already
has a working Node + `ws` server (`server/server.js`) that serves the static client and a client
net layer (`js/net.js`) using the browser's native WebSocket. We keep that transport and the
"server also serves the game files" model, and change three things:

1. Collapse the multi-room/host/password lobby into **one implicit persistent world** (every
   connection that sets a name is in it).
2. Move **bot simulation onto the server** so all clients see the same backfill planes, with count
   `= max(0, TARGET − humans)`.
3. Make the server **relay player state + apply light sanity checks** (FR-014), and migrate
   hosting from Render to the existing **Railway** deployment.

## Technical Context

**Language/Version**: JavaScript (ES2020). Client = vanilla browser JS; Server = Node.js ≥ 18.

**Primary Dependencies**: Client — none (native `WebSocket`, plain `<script>` tags, no bundler).
Server — `ws` ^8 only (already in `server/package.json`).

**Storage**: None. World state is in-memory and ephemeral (no DB, no accounts) per spec
Assumptions.

**Testing**: Lightweight per constitution — manual `quickstart.md` scenarios plus a few optional
pure-function Node checks for the sanity-check and bot-count logic. No test framework required.

**Target Platform**: Modern desktop/mobile browsers (client); Node process on Railway (server),
reachable over `wss://`.

**Project Type**: Web (separated client + server, already present in repo).

**Performance Goals**: Client renders at 60 fps; server broadcasts world snapshots at ~18 Hz;
remote planes interpolated so movement looks smooth (SC-002). Target world size 10 planes; design
headroom for a few dozen concurrent connections.

**Constraints**: Client MUST stay buildless (native WebSocket, no client library). Server MUST stay
small and readable (Principle I). All tunables (target population, tick rate, bot behavior) live in
config so they can be changed without touching logic (Principle III).

**Scale/Scope**: One shared world; default target population 10 (configurable). A configurable hard
connection cap (default comfortably above 10, e.g. 32) protects the server.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.* Checked against
constitution **v2.0.0**.

| Principle | Status | How this plan complies |
|-----------|--------|------------------------|
| I. Beginner-Friendly & Learning-First | ✅ PASS | Server stays one small, heavily-commented file; tunables stay named in config; work lands in small stages. |
| II. Simple by Default, Tools Only When Needed | ✅ PASS | A server is exactly the "feature genuinely needs it" case the amendment allows. Client adds **zero** dependencies and no build step (native WebSocket); server depends only on `ws`. |
| III. Tweakable by Design | ✅ PASS | `TARGET_POPULATION`, tick rate, bot stats, hard cap all live in ONE file `js/config.js`, which the Node server also reads (single source of truth — no client/server drift). |
| IV. Always Runnable, Commit Often | ✅ PASS | Staged rollout (see Phasing); the game stays playable each step; single-player systems are reused, not deleted mid-flight. |
| V. Game Feel First | ✅ PASS | Remote planes are interpolated/smoothed so flight still feels good over the network before extra features. |

**Result**: PASS, no violations → Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/002-multiplayer-world/
├── spec.md              # Feature specification (done)
├── plan.md              # This file
├── research.md          # Phase 0 — key technical decisions
├── data-model.md        # Phase 1 — world/player/bot/wire entities
├── quickstart.md        # Phase 1 — run & validate locally + deploy
├── contracts/
│   └── websocket-protocol.md   # Phase 1 — client⇄server JSON message contract
└── checklists/
    └── requirements.md  # Spec quality checklist (done)
```

### Source Code (repository root)

```text
index.html               # Loads client scripts (existing)
js/
├── config.js            # SINGLE source of tunables (browser global + Node-requireable):
│                        #   + TARGET_POPULATION, NET_TICK_HZ, HARD_CAP, RESPAWN_DELAY, reuse ENEMY_*
├── net.js               # SIMPLIFY: drop rooms/host/passwords → connect + setname + join one world
├── game.js              # Entry flow → name screen → join; render remote planes & server bots
├── plane.js / physics.js# Reused for local plane simulation (client-authoritative own plane)
├── enemy.js             # Bot AI — refactor the decision logic to be DOM-free so the server reuses it
└── (bullet/missile/explosion/scenery/sprites/audio/pilot/powerup).js  # reused for rendering/feel

server/
├── server.js            # EVOLVE: one world, server-run bots, snapshot broadcast, sanity checks
├── world.js             # NEW (optional split): world state + bot stepping, kept small
├── bot-ai.js            # NEW: DOM-free bot decision logic shared with client enemy.js
└── package.json         # `ws` dependency (existing); server reads ../js/config.js for tunables

railway.json (or Procfile / root package.json)   # NEW: tell Railway to run node server/server.js
render.yaml              # RETIRE or keep as alt; primary deploy becomes Railway
```

**Structure Decision**: Keep the existing **two-part web layout** (vanilla client in repo root +
Node server in `server/`). The server continues to double as the static file host, so one Railway
deployment serves both the game and the WebSocket — avoiding the https/ws mismatch the existing
`net.js` already warns about. New server code is split into a couple of tiny, well-named files so a
beginner can read each in one sitting.

## Phasing (keep it runnable — Principle IV)

1. **One world, no lobby**: simplify `net.js` + server to a single implicit world (humans only, no
   bots yet). Name screen → join → see other humans. *Playable.*
2. **Server bots backfill**: server simulates bots to fill to `TARGET_POPULATION`; clients render
   them like any other plane. *Playable, world never empty.*
3. **Combat + auto-respawn + per-life score** over the network; light sanity checks. *Playable.*
4. **Railway cutover**: add Railway run config, point `SERVER_URL` at the Railway `wss://` URL,
   verify live. *Shipped.*

## Complexity Tracking

No constitution violations — section intentionally empty.
