# Phase 1 Data Model: Multiplayer Persistent World

In-memory only (no database). "Server" entities live in the Node process; "Wire" shapes are the
JSON that crosses the WebSocket. Field names are illustrative and should stay beginner-readable.

## Server-side entities

### World (one instance)

| Field | Type | Notes |
|-------|------|-------|
| `targetPopulation` | int | Desired total planes. Default 10. From server config (mirrors client `TARGET_POPULATION`). |
| `hardCap` | int | Max concurrent human connections. Default 32. Protects the server. |
| `players` | Map<id, Player> | Connected humans. |
| `bots` | Map<id, Bot> | Server-simulated backfill planes. |
| `tickHz` | int | Snapshot broadcast rate. Default 18. |

**Derived rule (FR-004/005/006)**: after any join/leave, `desiredBots = max(0, targetPopulation −
players.size)`; add/remove bots until `bots.size === desiredBots`. Never below 0; when
`players.size ≥ targetPopulation`, `bots.size === 0`.

### Player (a connected human)

| Field | Type | Notes |
|-------|------|-------|
| `id` | int | Server-assigned, unique per connection (existing `nextId`). |
| `name` | string | 1–14 chars, safe charset, **not** content-filtered (FR-011). Duplicates allowed. |
| `ws` | socket | The live connection. Removed within a few seconds of disconnect (FR-010). |
| `lastState` | PlaneState | Most recent client-reported plane state (relayed + sanity-checked). |
| `alive` | bool | False briefly between death and auto-respawn. |
| `score` | int | Per-life score; resets to 0 on death (FR-013). Client-owned, carried in state. |
| `lastSeen` | timestamp | For sanity checks / idle handling. |

### Bot (server-simulated plane)

| Field | Type | Notes |
|-------|------|-------|
| `id` | int | Unique; same id-space as players so clients treat all planes uniformly. |
| `name` | string | Ordinary-looking name so bots blend in (spec Clarification); not marked as a bot on the wire. |
| `state` | PlaneState | Position/heading/velocity/health, advanced each tick by `bot-ai.js`. |
| `alive` | bool | On death, respawns per `ENEMY_RESPAWN`-style timing to maintain the count. |

> `isBot` is tracked **server-side only** for bookkeeping; it is intentionally **omitted from the
> broadcast** so the client cannot trivially distinguish bots from humans.

## Wire shapes (JSON over WebSocket)

### PlaneState (the unit everyone draws)

```
{ id, name, x, y, heading, vx, vy, health, alive, score }
```

- Sent by a client for its own plane (`state` message).
- Sent by the server for every plane (humans + bots) inside the `snapshot` message.
- Validation on inbound client state (light, FR-014): position delta and speed within plausible
  bounds vs `lastState` and elapsed time; out-of-range updates are clamped or dropped, not trusted.

### Snapshot (server → all clients, ~`tickHz`)

```
{ t: "snapshot", planes: [ PlaneState, ... ] }
```

## State transitions

**Player lifecycle**: `connecting → named → flying → (dead → respawning → flying)* → disconnected`.
- `flying → dead`: health reaches 0 → explosion, `alive=false`, score frozen for display.
- `dead → flying` (auto-respawn, FR-009): after a short configurable delay, respawn at a safe spot
  (spawn protection), `score` reset to 0, `alive=true`. No return to name entry.

**Bot lifecycle**: mirrors player combat, plus **population control**: created when below target,
removed (without an explosion needed) when a human takes the slot.

## Configurable values (Principle III)

Client `js/config.js`: `TARGET_POPULATION` (10), `NET_TICK_HZ` (18), `SERVER_URL`, `RESPAWN_DELAY`,
reuse of `ENEMY_*` for bot feel. Server `config.server.js` mirrors `targetPopulation`, `hardCap`,
`tickHz`, and bot stats so the authoritative side has its own readable knobs.
