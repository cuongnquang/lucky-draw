# Lucky Draw Studio

A premium lucky-draw system for events, galas and live stages. Pure front-end — no build step, no server, no dependencies. Open `index.html` and go.

## Quick start

- **Run locally:** double-click `index.html` (works from `file://`, no server required). Or serve the folder: `python -m http.server` (useful for testing).
- **First run:** a ready-made demo event auto-loads ("TECH FEST 2026", 100 participants, 4 prizes) so every feature is testable immediately.
- **Start drawing:** *Home & Setup → Run the game* (or use the *Draw stage* item in the sidebar), pick a prize, pick how many winners, hit **Start draw**.

## Features

- **Participant & prize management** — add/edit/delete, search & status filters (eligible / winner), reorder prizes by drag, custom emoji, image, description and quantity per prize.
- **Prize selection** — the *Prizes* page has a primary **Select prize for draw** action: pick which prize the next draw uses (with remaining/winner info per row). The choice persists, shows "Selected for next draw" on the prize card, syncs the stage and operator rail, and when a prize completes the stage offers **Select next prize**.
- **Draw engine** — countdown → spinning numbers/names → reveal; public draw modes: *Random number* (#ID), *Random name*, *Random participant* (ID + name), *Number Range* (random integer); reveal **all at once** (grid) or **one by one** (sequential).
- **Number Range mode** — draw random integers from a From/To range with presets (1–10 … 1–10000) or a custom range (up to 1–1,000,000), zero-padded formats (3–6 digits), optional "prevent duplicate numbers" so nothing repeats until you reset, multi-winner draws, own history entries + export, and a giant stage number. Prize is optional — a prize can be attached or the range can run on its own.
- **Winner logic** — winners are excluded from future draws (toggleable); prize quantity decreases each draw and prizes auto-complete when exhausted; full winner history with per-round records.
- **Presentation mode** — hides the operator UI, floating operator bar appears on mouse move, canvas confetti celebration + WebAudio sound effects, optional uploaded background music.
- **Event branding** — event name/subtitle/logo, five background themes (navy, violet, emerald, crimson, midnight) or an uploaded background image; images are downscaled to keep `localStorage` small.
- **CSV import/export** — headers in English or Vietnamese (e.g. `code/name/phone/dept` or `mã/họ tên/sđt/phòng`), BOM + quoted cells handled, import report with skipped rows, export includes win status.
- **Persistence** — everything is saved automatically to `localStorage`; refresh-safe. "Reset game" makes everyone eligible again; "Clear everything" wipes to a blank event.
- **Offline & responsive** — fonts bundled locally; works at 1080p stage sizes and on small screens (sidebar becomes a bottom bar).

## Operator shortcuts (on the draw stage)

| Key | Action |
| --- | --- |
| `Space` | Start / stop / next draw |
| `F` | Toggle presentation mode |
| `Esc` | Exit presentation mode |
| `↑` / `↓` | Adjust winner count |
| `R` | Reset the used-number list (Number Range mode, when not spinning) |

`STOP` button is available at any point during countdown / spinning / slowing.

## Keyboard-safe & a11y

`focus-visible` outlines, `aria-pressed` toggles, `prefers-reduced-motion` fallbacks, and no browser `alert()` — all dialogs/toasts are in-app.

## CSV import format

Columns are matched by header name (case-insensitive). Only **name** is required — a code is auto-generated (zero-padded) if missing. `phone` and `dept` are optional.

```
code,name,phone,dept
NV001,Nguyễn Văn An,0901234567,Engineering
NV002,Trần Thị Bình,0912345678,Marketing
```

## Project structure

```
index.html          App shell: sidebar, views, stage markup, overlays, icon sprite
css/styles.css      Design system, themes, stage animation, presentation mode, responsive
js/state.js         State, localStorage persistence, demo data, actions
js/csv.js           CSV parse/export, image-to-dataURL downscaling
js/audio.js         WebAudio SFX + uploaded background music
js/effects.js       Confetti / particle canvas
js/draw.js          Draw engine & stage rendering (status machine)
js/views.js         Home, participants, prizes, history + modals
js/app.js           Boot, router, toasts, presentation & keyboard shortcuts
assets/fonts/       Inter, Outfit, Space Grotesk (local variable fonts)
```

## Data & storage

- `lucky-draw-studio-v2` — the full app state (event, settings, participants, prizes, history).
- `lucky-draw-studio-boot` — flag that fires the one-time demo load.
- `ld-music` — remembers the uploaded music file name.

"Clear everything" removes the state key and returns to an empty event.

## Browser support

Built with evergreen Web APIs (fetch not used; local files only). Tested with current Edge/Chromium. Playwright smoke/E2E scripts used during development live out of the repo.