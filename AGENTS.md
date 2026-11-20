# AGENTS.md

musliMineCraft: educational, Islamic-themed voxel block-building game for children (phones, tablets, desktop).
One offline HTML file. Raw WebGL 1 + plain JS. No libraries, no bundler, no npm.
Repo: github.com/oazabir/musliMineCraft. Live: https://oazabir.github.io/musliMineCraft/. Branch: `main`.
Licence: CC BY-NC-SA 4.0 (no commercial use). Copyright Omar Al Zabir.

## Layout
- `src/` source parts. `dist/musliMineCraft.html` is the built game (committed).
- `build.sh` joins parts in a fixed order (list is in the script). Needs only bash + awk.
- `tests/e2e/` Playwright (Python, pytest) end-to-end suite. `docs/screenshots/` README images.
- `.github/workflows/`: `e2e.yml` (dist-up-to-date check + full suite), `pages.yml` (build + deploy on push to `main`).

## Architecture
- All JS parts are concatenated into ONE script, one global scope, `'use strict'`. No modules, no imports.
- Part order = dependency order. `let`/`const` used before their line runs is a TDZ error. Put new code in the part that owns the concern.
- Parts: `2-core` constants/blocks/atlas; `3a-world` terrain (pure function of seed); `3a2-museum`; `3b-chunks` chunk manager + mesher; `3-gl` renderer/sky; `4-play` player/physics/ray; `4b-bots` six builder bots; `5-game` state/missions/sound; `5b-museum-ui`; `5c-save` IndexedDB + localStorage + public API; `5d-prison` Open Air Prison island: people, drone attacks, shelters, scoring; `5e-places` place names, signposts (`B.SIGN`, one per 56x56 cell via `signCell`, built in `genChunk` by `genSigns`; the fixed `START_SIGN` is 2 blocks tall and lists `START_PL`), quests + `flyTo`; `6-quiz`; `7-ui` modals/HUD/input/loader/main loop; `1-head.html` CSS + welcome overlay; `8-tail.html` boot.
- The loader picture (`#wshot` in `1-head.html`) is an inline base64 JPEG: top 800 px of `docs/screenshots/builder-bots-working.png` at 540 px wide, quality 48. Keep it small; it fades out when the live panorama starts.
- Game code sits in `<script type="text/plain" id="game">` and is evaluated after two animation frames, so the welcome screen paints first.
- Open Air Prison (`GZ` in `2-core`, `gzD` = signed distance to its shore): terrain shaped in `raw()`, no landmarks/palms/builder sites there. Shelter spot = floor cell with a solid block 2..8 above; one person per spot. Simulated only within `GZ_ACT` blocks. Hooks `__prison`, `__prisonStep`, `__prisonRaid`, `__prisonBoom`. It is called the Open Air Prison everywhere (game text, comments, docs, tests).
- World: 2048 x 2048 blocks, 16x16 chunks, streamed. Edits stored per chunk (IndexedDB), progress in localStorage.
- Quality is adaptive (`adapt`). Must run on low-end Android.
- Public API `window.musliMineCraft` (`exportSave`, `importSave`, `onSave`, `version`), postMessage types `musliMineCraft:save|import`. Documented in the head comment of `1-head.html` and `README.md`.
- The only network traffic allowed: `EXHIBIT_PHOTOS` in `5b-museum-ui.js` (optional museum photos, hot-linked).

## Build rules (read before editing JS)
- `./build.sh` drops blank lines and full-line `//` and one-line `/* */` comments, and trims every line. Do not rely on indentation, blank lines or comment-looking lines inside template literals or multi-line strings.
- CSS in `1-head.html` has its newlines removed: no `//` comments, end every rule with `;` or `}`.
- Edit `src/` only. NEVER hand-edit `dist/`. After any `src/` change run `./build.sh` and commit `dist/musliMineCraft.html` with it. CI fails if dist is stale.
- Output must be identical on macOS and Linux awk. Keep `build.sh` POSIX-awk only (no NUL record separator, no gawk extensions).

## Coding rules
- Terse, dense style matching the surrounding code. Short comments for the non-obvious why only.
- No new dependencies, no build tools, no network requests, no analytics, no external fonts or CDNs.
- Mobile first: touch must always work (joystick, tap, drag-look). Desktop adds keyboard + mouse + pointer lock.
- Pointer lock: any modal must release it; never re-capture while a card is open; Esc must stay released (`wantLock`/`relock` in `7-ui.js`). A hint shows while locked.
- Save format is versioned. Changing stored data needs a migration and a test. Existing saves must keep loading.
- Child-safe: no ads, tracking, chat, links out, gore or deaths. Drone attacks show explosions, but people are only knocked down and get up. Islamic content must be accurate and respectful; keep the museum credits.
- Keep a11y basics: labels on buttons, readable at 360x740 up to 1280x720, safe-area insets.
- Test hooks are `window.__*` (`__tp`, `__stepBots`, `__find`, `__stats`, ...). Tests depend on them: do not rename or remove.

## Testing
```bash
pip install -r tests/e2e/requirements.txt && python -m playwright install chromium
cd tests/e2e && pytest -q            # all, ~15-20 min
SLOW=1 pytest -q                     # slow machine (CI uses this)
pytest -k Bots                       # one group; HEADED=1 to watch
GAME_URL=https://... pytest -k Startup   # test a deployed build
```
- Fresh browser context per test. Every test fails on any console error or uncaught exception.
- No sleeps: poll a condition with a timeout and say expected vs observed. Move game time with the game's own hooks.
- Desktop pointer lock is rejected in headless Chromium; tests use the no-lock fallback. Real mouse-look is verified by hand.
- New behaviour needs a test in `tests/e2e/test_musliMineCraft.py`. Keep the title/name assertions in sync with `GAME` in `2-core.js`.
- No JS linter or typechecker is configured. Minimum check: `for f in src/*.js; do node --check "$f"; done`. Python: `ruff check --isolated --select E9,F tests/e2e`. Shell: `shellcheck build.sh`.

## Git and release
- Work on `main`, small commits, imperative subject. Commit `src/` + rebuilt `dist/` together.
- Push to `main` triggers `pages.yml` (deploy) and `e2e.yml`. Pages source is "GitHub Actions". Verify the live URL after a push.
- Never force-push `main`. Never commit secrets, `node_modules`, venvs, `test-results/`.

## Do
- Read the owning part and its neighbours before changing it. Reuse existing helpers.
- Run build + checks + the relevant test group before committing.
- Keep file names and storage keys stable. They now all use `musliMineCraft`.

## Don't
- Don't add a framework, bundler, TypeScript, npm packages or CDN scripts.
- Don't hand-edit `dist/`. Don't reformat unrelated code.
- Don't add network calls, remote assets or tracking.
- Don't break the embedding API, save format or `__*` test hooks without updating docs and tests.
- Don't swallow errors to make tests pass; tests treat console errors as failures.
