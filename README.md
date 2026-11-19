# Top Gun Surgeon

Flight school for future surgeons. A browser game for kids (about 9–14) that teaches the real **Top Gun laparoscopic skills drills** — Pea Drop, Triangle Transfer, Cobra Rope, Cylinder Transfer and Suturing — rule by rule, inside a 3D box trainer with real physics.

Plain HTML/CSS/JS with ES modules, no build step. three.js 0.171 and Rapier load from jsDelivr; fonts from Google Fonts. Everything else is in this folder. Works on phones, tablets and computers, installs as an app, and plays offline after the first visit.

## Run it

Serve the folder over HTTP (modules don't load from `file://`):

```bash
python3 -m http.server 8000
```

Open http://localhost:8000. Add `?unlock=1` to the URL to unlock every level (testing).

## Deploy

1. Regenerate the offline file list: `node tools/precache.mjs` (updates `sw.js`).
2. Upload the whole folder (except `tools/`) to any static host, e.g. a subfolder of a website. It needs HTTPS for install and offline play.

## What's in the game

- **Drills** with the official Top Gun rules and penalties (from the Top Gun eBook): bumps (+5 s on the Top Gun corrected time), dragging, earthquakes, putting, skipping reds, fireman's pole, crossing over, 3 strikes.
- **Scout**, a paper-plane buddy, runs **Rule school**: each rule taught by doing it, then a quiz. Rule cards collect in the **Rule book**; breaking a rule shows its card.
- **Three stars** per mission (finish · few bumps · 75+ points or beat par); 1 star opens the next level.
- **Campaign map** (4 islands, 20 bases) with **Night flight** and **Speed run** variants, **ghost racing** against your best run, an **Album** of stickers, patches and Real surgeon cards, a **reward track**, and a gentle **daily flight plan** with free freeze days.
- **Healthy by design:** nothing for sale, no loot boxes, no accounts, no ads, no data leaves the device; a break nudge after ~20 minutes.
- **Accessibility:** text size, reduce motion (follows the device), screen-reader announcements, keyboard focus rings, shape + colour signals, left-hand layouts, Scout can read aloud.
- **Performance:** automatic smooth mode steps quality down on slow devices; lens effects can be turned off in Settings.

## Controls

Keyboard and touch (and gamepad). Tab swaps hands in two-hand drills.

- **Mouse:** off for now inside drills (menus still use it).
- **Touch:** drag anywhere to move; hold GRAB; height slider on the edge. Two-hand drills split the screen.
- **Keyboard (like a real laparoscope):** arrows swing the instrument around its entry port at a fixed depth; W / S push it in and pull it out along the shaft (left-hand layout: WASD swings, ↑ / ↓ in and out). Space toggles grip. Q/E rotate the hook and needle. Shift for fine control.
- **Gamepad** supported.

## Code map

- `js/app.js` — router, loading screen, service worker
- `js/store.js`, `js/progress.js` — local save, runs, stars, ranks
- `js/rules.js` — rules, lessons, quiz, Real surgeon facts
- `js/campaign.js` — map, variants, stickers, patches, reward track, daily plan, ghosts
- `js/music.js`, `js/audio.js` — adaptive music and sound effects (synthesized + `assets/sfx`)
- `js/game/` — engine (rendering, lights, quality governor), physics (Rapier), input, effects, session (in-drill flow), `drills/`
- `js/ui/` — screens, debrief, buddy, album/map, kit components
- `tools/kidbot.js` — play-testing bot used to tune difficulty; `tools/precache.mjs` — offline list

## Before publishing

"Top Gun" is a trademark of Paramount; the Top Gun Laparoscopic Skills program uses the name too. Confirm the name (or permission) before publishing publicly.
