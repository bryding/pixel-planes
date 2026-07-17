# Decision Log

A record of the big choices made on this project, newest first. Each entry
says what was decided, why, and what changed. (Exact code history is in git —
this is the "why" that git messages can't hold.)

## 2026-07-16 — The Great Consolidation: one main, one host (Railway)

**Decided by:** Ben (project owner), working with Claude Code.

**The situation:** the project had drifted onto THREE hosts and THREE diverged
branches without anyone fully realizing it:

| Where | What it had |
|---|---|
| `main` + **Railway** | Ben's June-24–26 work: Railway cutover, a spec-driven multiplayer-only rewrite (`specs/002-multiplayer-world`), then a chooser front page + a restored `solo/` single-player |
| `single-plus-online` + **GitHub Pages** | Wyatt's line: the newest single-player (black hole mode, score banking, scrollable menus, mouse mode) + the `online/` client (text chat, VOICE chat, modes) |
| `bot-player-emojis` + **Render** | The most-evolved SERVER: chat + voice (WebRTC relay) + world bots + anti-cheat. Render's free 5 GB/month bandwidth ran out on July 4 → service suspended, which is what triggered this cleanup |

**Decisions:**
1. **Everything lives on `main`, hosted ONLY on Railway.** Render abandoned
   (`render.yaml` deleted); the GitHub Pages deploy workflow deleted (the old
   Pages site simply stops updating).
2. **Wyatt's game is the game.** His single-player and his chat+voice online
   world won every clash — "it's his vision for the game" (Ben). The old
   multiplayer-only client from the 002 rewrite was retired (still in git
   history, commit `aeb4322` and earlier).
3. **Ben's chooser stays as the front door.** `/` asks "How do you want to
   play?" → 🤖 Single Player (`solo/`) or 🌍 Multiplayer Online (`online/`).
4. **The `bot-player-emojis` server was adopted** (it's the superset:
   chat + voice + bots). It now reads its shared config and bot brain from
   `online/js/` — NOT from `solo/js/`, which belongs to single-player only.
5. **The old lobby protocol is retired** (create/join servers with passwords).
   The one always-on shared world replaced it. Dead lobby code still sits in
   `solo/js/net.js` (unreachable panels; quick-join is a deliberate no-op).
6. The `specs/`, `.specify/`, `tools/` folders are inert leftovers from the
   spec-driven experiment on old main — kept for reference only.

**Why one host:** three hosts meant three things to break, three URLs to
remember, and surprise suspensions. Railway's server already serves the game
files, so one service really can do everything.

## 2026-07-16 — Mouse Mode added to single-player (Wyatt's request)

Settings toggle (saved in localStorage `pp_mousemode`): the nose chases the
pointer, left click = guns, right click = missile, wheel = throttle. Arrow
keys still work as a backup. Turn rate is capped at the same TURN_SPEED as
keyboard so it's easier to aim but never unfairly faster.

## 2026-07-16 — Delegate mechanical chores to a cheap model

Ben's rule: work that needs no real judgment (grep sweeps, file copies, doc
drafts from an outline, cache bumps) goes to the `grunt` agent
(`.claude/agents/grunt.md`, runs on Haiku). Design decisions, tricky game
code, and git surgery stay with the main model. See CLAUDE.md.

## 2026-06-23 → 07-01 — (superseded) Render + GitHub Pages era

The online server was first deployed to Render (free `wss://`), and from
2026-07-01 the `online/` client auto-deployed to GitHub Pages. Both retired
by the consolidation above. Kept here so old URLs in chat logs make sense:
`pixel-planes.onrender.com`, `pixel-planes-bryding.onrender.com`,
`bryding.github.io/pixel-planes`.

## From the start — plain HTML5 Canvas + vanilla JS, no build step

The game is one `index.html` + script files you can read. No frameworks, no
bundler. Chosen because this is a learning project for a 12-year-old: change
a number in `config.js`, refresh, see what happens. This remains the rule for
everything in `solo/` and `online/`.
