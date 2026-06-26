# Pixel Planes

A browser-based 2D pixel-art airplane combat game, inspired by **BitPlanes**
(retro aerial dogfighting with momentum-based flight).

## ⭐ Most important context for whoever helps on this project

- **This is a learning project for a 12-year-old (the project owner's nephew).**
  He is learning game development by working with Claude Code.
- **Keep all explanations simple and beginner-friendly.** Avoid jargon. When you
  use a programming word, explain it in plain language. Short steps, one idea at
  a time. Celebrate progress.
- **Guide him to build the game *he* wants.** The goal isn't just to finish a
  game — it's for him to learn and make creative choices. Offer options, ask what
  he'd like, and explain *why* things work the way they do.
- Make the code easy to read and tweak. Lots of friendly comments. Put numbers he
  might want to change (speed, gravity, colors) in `js/config.js` so he can
  experiment and instantly see the effect.
- **Use git and commit often.** Make a commit after each working change/stage so
  there's always a safe point to go back to. Keep commit messages short and clear
  (this also teaches the nephew good habits).

## What the game is

- Momentum-based plane flight (like BitPlanes / the classic game *Sopwith*):
  manage **throttle** and **turn the nose**, gravity pulls you down, the plane
  carries momentum. NOT a fixed Mario-style runner.
- Pixel-art look, side-scrolling camera, dogfights against enemy planes.

## Tech choices (simple by default)

- The game in the browser is plain HTML5 Canvas + vanilla JavaScript — no
  frameworks, and no build step. You can still open `index.html` to play.
- Renders to a low internal resolution (480×270) scaled up for a crisp,
  chunky pixel look.
- We add bigger tools (like a **server**) *only* when a feature truly needs
  one. Multiplayer needs a server so players can share one world — that part
  runs online (on Railway), while the browser game stays simple to read.

## File layout

The game now has TWO separate playable apps behind one menu, so single-player
and multiplayer can't break each other:

- `index.html` — the **chooser**: pick 🤖 Single Player or 🌍 Multiplayer.
- `online.html` + `server/` — the **multiplayer** shared-world client (deployed
  on Railway).
- root `js/`, `css/` — the **shared engine** both games use: `config`, `audio`,
  `physics`, `bullet`, `explosion`, `sprites`, `scenery`, `plane`, `bot-ai`. A
  tweak here (flight feel, art, gravity) helps BOTH single-player and multiplayer.
- `solo/` — the **single-player-only** parts: its own `index.html`, `css/`, and a
  small `js/` with just `game.js` (offline game loop), `input.js` (two-player
  keys), `missile.js`, `enemy.js` (AI bots), `powerup.js`, `pilot.js`. It loads
  the shared engine from `../js/`. This is the classic offline game with all the
  modes (Classic/Unicorn/WW2/Alien/Night/Black Hole/Bad Weather), the
  Modifier/Cheat menu, power-ups, eject + parachute, and 2-player split-screen.

Inside each app the key files are the same idea:

- `css/style.css` — page styling, makes pixels crisp.
- `js/config.js` — all the tweakable numbers (speed, gravity, colors). Start here.
- `js/input.js` — reads the keyboard.
- `js/plane.js` — the player's plane (movement + drawing).
- `js/game.js` — the main game loop that ties it all together.

## Controls

- Up / Down arrows = throttle up / down
- Left / Right arrows = turn the nose
- (later) Space = guns, X = missiles, C = eject

## Build plan (stage by stage — keep it runnable at every stage)

1. ✅ Flight feel + side-scrolling camera + parallax sky/ground.  ← current
2. Shooting + collision + one dummy enemy.
3. AI enemies, waves, health/damage, explosions, HUD, scoring.
4. Pixel-art sprite pass, parallax polish, sound effects, menus.
5. Stretch: missiles, eject, 2-player split-screen Duel.

Prioritize **game feel** — flying should feel satisfying before adding more.

## How to run it

Easiest: double-click `index.html`. If sounds/scripts get blocked, run a tiny
server from the project folder: `python3 -m http.server` then open
http://localhost:8000 .

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
at specs/002-multiplayer-world/plan.md
<!-- SPECKIT END -->
