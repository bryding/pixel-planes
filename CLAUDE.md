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
- **Delegate mechanical work to the cheap `grunt` agent** (defined in
  `.claude/agents/grunt.md`, runs on Haiku). Anything that doesn't need the main
  model's judgment — verification grep sweeps, find-and-replace checks, file
  copies, cache-version bumps, drafting docs from a detailed outline — should go
  to `grunt` via the Agent tool (give it a precise brief, then review its work).
  Keep design decisions, tricky game code, and anything touching git history
  with the main model.
- **Read `doc/` first.** The `doc/` folder documents the codebase, hosting, and
  past decisions — reading it saves re-deriving everything from the code.

## What the game is

- Momentum-based plane flight (like BitPlanes / the classic game *Sopwith*):
  manage **throttle** and **turn the nose**, gravity pulls you down, the plane
  carries momentum. NOT a fixed Mario-style runner.
- Pixel-art look, side-scrolling camera, dogfights against enemy planes.

## Tech choices (kept deliberately simple)

- Plain HTML5 Canvas + vanilla JavaScript. No build step, no frameworks.
- Runs by opening `index.html` in a browser (or via a tiny local server).
- Renders to a low internal resolution (480×270) scaled up for a crisp,
  chunky pixel look.

## File layout

- `index.html` — the page; loads the scripts.
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
