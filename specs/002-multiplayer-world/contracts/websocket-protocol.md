# Contract: Client ⇄ Server WebSocket Protocol

The interface this feature exposes is a **WebSocket message protocol** (JSON text frames). This is
the v1 contract for the single persistent world. It deliberately *replaces* the legacy
lobby/host/password messages (`create`, `join`, `setmode`, `you-are-host`, …) which are retired.

Transport: native browser `WebSocket` ⇄ Node `ws`. Every frame is a JSON object with a `t` (type)
field. Unknown `t` values MUST be ignored (forward-compatible).

## Client → Server

| `t` | Payload | Meaning | Server reaction |
|-----|---------|---------|-----------------|
| `hello` | `{ name }` | Sent right after connect with the chosen name. | Validate/clean name; place player in the world; reply `welcome`; recompute bot count. |
| `state` | `{ s: PlaneState }` | The client's own plane this frame (~`NET_TICK_HZ`). | Sanity-check; store as `lastState`; include in next snapshot. |
| `fire` | `{ kind: "gun"\|"missile", x, y, heading }` | The player fired (for visuals/SFX). | Relay as a `fire` event to other clients. |
| `hit` | `{ targetId, kind }` | The shooter's client detected its own shot striking `targetId` (FR-015). | Validate loosely + rate-limit; if `targetId` is a **bot**, apply damage server-side; if a **human**, forward as a `hit` to that client; on destruction broadcast `down` and credit the shooter. |
| `respawn` | `{}` *(optional)* | Client signals it has respawned (or server drives it). | Mark `alive=true`, reset `score=0`. |

> `name` rules (FR-011): trimmed, length-capped (~14), restricted charset, default `Player` if
> blank. **No** profanity filtering in v1. Duplicate names are allowed.

## Server → Client

| `t` | Payload | Meaning |
|-----|---------|---------|
| `welcome` | `{ id, target, tickHz }` | Your assigned id + world params. |
| `snapshot` | `{ planes: [PlaneState, …] }` | All planes (humans + bots) ~`tickHz`. Bots are **not** flagged. |
| `fire` | `{ id, kind, x, y, heading }` | Another plane fired (for visuals/SFX). |
| `hit` | `{ targetId, byId, kind }` | You (the `targetId`) were hit — apply the damage to your own plane. |
| `down` | `{ victimId, byId }` | A plane was destroyed; `byId` scored the kill (drives FR-013 scoring + explosion feedback). |
| `player-left` | `{ id }` | Remove that plane from the view (FR-010). |
| `denied` | `{ msg }` | Join refused (e.g. hard cap reached) — client shows the message. |

`PlaneState` = `{ id, name, x, y, heading, vx, vy, health, alive, score }` (see `data-model.md`).

## Invariants (testable)

1. After a `hello`, the client receives exactly one `welcome` and then a steady stream of
   `snapshot`s at ~`tickHz`.
2. At all times in any `snapshot`, `planeCount == humans + bots` where `bots == max(0, target −
   humans)` (FR-004/005). With 0 humans, `planeCount == target` (SC-003).
3. A disconnected player's `id` stops appearing in snapshots within a few seconds and triggers one
   `player-left` (FR-010).
4. Inbound `state` whose movement exceeds plausible bounds is clamped/dropped, never broadcast as-is
   (FR-014).
5. Connecting beyond `hardCap` humans yields `denied`, not a silent failure.

## Out of scope for v1 (documented, not silently dropped)

- **Full** server-authoritative hit/kill accounting. v1 uses the shooter-detected `hit` model
  above (FR-015): the server validates loosely and relays, but does not re-simulate trajectories.
- Reliable bullet replication (`fire` events are best-effort visuals; the `hit` message — not the
  bullet — is what actually deals damage).
- Anti-cheat beyond the light sanity checks of invariant 4 plus `hit` rate-limiting.
