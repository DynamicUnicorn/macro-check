# Macro Check — notes for Claude

Phone web app (GitHub Pages, `main` branch root) for judging supermarket foods by macros and price.
Full user and technical documentation: README.md. Read it before changing behaviour.

## Conventions
- No build step and no frameworks: plain `index.html` (UI) + `core.js` (all calculations, DOM-free).
  Put new calculations in `core.js` and cover them in `tests/unit.js` with hand-checked numbers.
- Every app change: run `npm test`, bump `VERSION` in `sw.js` (`macro-check-vN` → `vN+1`),
  update the "Macro Check vN" text in Settings, README (features + changelog), then push to `main`.
- Dates shown to the user are dd/mm/yyyy (`MC.dmy`).
- Free services only (Open Food Facts, Open Prices); no paid APIs, no API keys.
- User data lives only in the phone's localStorage. Never break existing stored items:
  new fields need sensible defaults for old items (see `ensureHistory`, `isProtected`).
- Values the user typed are never overwritten by lookups/rescans (`prod.edited`, `prod.tracked`).
- Commit author email must be the GitHub noreply address
  `317667440+DynamicUnicorn@users.noreply.github.com` (email privacy blocks other addresses).
- Show the user's alias via `MC.displayName(p)`, never `p.name` directly.
