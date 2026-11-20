# musliMineCraft end-to-end tests

Automated browser tests for the single-file game `dist/musliMineCraft.html`. They drive the real game in Chromium
(software WebGL, so no GPU is needed) with real touch, mouse and keyboard input, and check that the game and the
builder bots behave as intended. The suite never edits the game.

## What is covered

| Group | Tests | What it checks |
|---|---|---|
| Startup | welcome + progress + Play + HUD layout on 5 screens; landscape joystick; network | Title and progress bar appear fast, progress climbs to 100%, Play starts the game; HUD on screen and clear of the hotbar (360x740, 390x844, 844x390, 1024x768 touch, 1280x720 mouse); the page requests nothing except the game file |
| Controls | joystick, camera drag, two fingers (CDP), tap place / break, WASD + jump, no self-placing, unbreakable floor | Real touch gestures and keys; a tap places a block in Place mode and removes it in Break mode |
| Missions | blueprint + 0/8, tap-to-build, all 7 missions, Show me (near, then far) | Counters 8, 18, 13, 25, 33, 49, 26; +5 stars and Building +1 each; rewards unlock; the next mission is never blocked by a locked block |
| Quiz | open chest, wrong answer, right answer, 300 generated questions, 28 letters | Exactly 3 distinct answers; a wrong answer keeps the chest; a right answer gives 3 stars, removes the chest and bumps the right skill; every generated question has one correct, verifiable answer |
| World | 600 block trip, meshing + unloading, edits persist, determinism, 5 landmark kinds (one test), rapid teleports | At most 330 chunks and under 40 MB; ground built around the player; the start chunk is freed when far; a chunk generated twice is identical; mosque, garden, orchard, vineyard and village exist near the start; never below the floor |
| Save | reload round trip, 4 damaged saves, 2 old formats, 4 edge positions, reset (cancel + confirm) | Stars, mission, unlocks, skills, edits and opened chests survive; bad saves still reach Play; reset asks at once and wipes progress |
| Bots | tags, count vs graphics, movement, valid ground, wander to build, plot, no overwrite, not inside player, recovery after a trip | See the test docstrings; bots are exercised both in real time and by advancing game time with the game's own hooks |
| Build together | tap bot, Help build tag, join + chip, reward, no reward, walk away, leave, farming, mission untouched | The whole join / build / reward flow and its anti-cheat rules |
| Skyline | ring of landmarks, silhouettes, first view, mission card, 5 viewports | At least 6 landmarks at 55-150 blocks with no angular gap over 70 degrees; far silhouettes are one draw call under 3,000 triangles and switch off when the landmark loads; the first view faces the grand mosque; the mission card collapses; no console errors at 5 screen sizes |
| Museum | 26 exhibits, taps, passport, floor chip | Four floors, 26 distinct exhibits; a real finger tap opens an exhibit card and stamps the passport; the passport shows 26 stamps; the floor chip names the floor |
| Six builders | six bots, spacing, per-bot join card, tag text | Six distinct bots on every setting; they never overlap, never stand in water or on the plot or inside blocks; each of the six has a join card `<name> is building ... Build together?` (parametrised); tags read `<name> \u00b7 <activity>` |
| Dismantle | rolling tidy-up | After two finished structures a bot shows `<name> \u00b7 tidying up` and removes the older one |
| Save v3 | reload, export/import, onSave, migration, corrupt record | Progress and edited chunks survive a reload; `musliMineCraft.exportSave/importSave` round trip and reject bad input; `onSave` fires; an `islaminecraft` save migrates once; a corrupt progress record starts a fresh world |
| Welcome | stage 1 to live panorama, HUD hidden, tips, Continue summary, buttons fit 3 screens | Title, tagline, Play/Settings/How to play; the live panorama fades in; a rotating tip; Continue plus a summary line for a saved game |
| Water | float, swim to shore, helper | The player floats, swims out of the lake with real key input, and gets a `Swim to shore` helper after 20 s |
| Portals | 3 gates by the start + 3 gates home on marble pads, walk into each start gate (warp shown, lands at the far gate outside blocks), gate home, no instant return, sounds + labels, signs/builders keep off pads | Real W-key walking on desktop |
| Loader, signs, quests | loader picture, signposts in world + label + arrows + broken board, quest list, fly to each of 6 quests, quest reward once + saved, quest button fits 5 screens | The embedded loader picture fills the screen under the progress bar and fades for the live view; signs are post + board and name 3 places; arrows point up for a place ahead and right after turning; every quest flight lands near its target outside blocks |
| Open Air Prison | island + channel, first-visit card, 24 people on the island, shelter capacity, roof removed, bomb on roof vs open, attack scoring + milestone stars once, save + card once, no builder sites | The island is dry land ringed by water with no landmarks; a 5x5 hut with a door holds exactly 10 people (one per roofed spot); losing the roof frees them; a roof stops a bomb, the open does not and people get up; a raid gives a point per sheltered person and each milestone pays once; points survive a reload |
| Wellbeing and settings | break reminder, sound + graphics persistence, hidden page | 20 minute reminder, settings survive reload, no streaming work while hidden |

Every test also fails if the page logs a console error or throws an uncaught error.

## Install

```bash
cd tests/e2e
python3 -m venv .venv && . .venv/bin/activate      # optional
pip install -r requirements.txt
python -m playwright install --with-deps chromium
```

## Run

```bash
pytest                      # whole suite, headless
pytest -k Bots              # one group
pytest -k "TestMissions"    # by class name
HEADED=1 pytest -k Controls # watch it run
```

## Environment variables

| Variable | Default | Meaning |
|---|---|---|
| `GAME_URL` | `file://.../dist/musliMineCraft.html` (two folders above `tests/e2e/`) | Page to test. Any `http(s)://` or `file://` URL works. |
| `HEADED` | unset | `HEADED=1` shows the browser window. |
| `SLOW` | unset | `SLOW=1` multiplies every wait timeout by 3 for slow CI machines. |

## GitHub Actions

See `.github/workflows/e2e.yml` in the repo root. It checks that `dist/musliMineCraft.html` matches `./build.sh`, then runs the suite with `SLOW=1`.

## How it works (for maintainers)

* One Chromium for the whole run, one fresh browser context (empty localStorage) per test.
* Chromium starts with `--use-angle=swiftshader` so WebGL works without a GPU.
* No sleeps for progress: every wait polls a condition with a timeout and, on failure, says what was expected and what was
  observed. The only fixed waits are one "nothing must happen" check in the hidden-page test (800 ms).
* Game time is moved forward with the game's own test hooks (`__stepBots`, `__tp`, `__find`, `__stats`, `__genHash`, ...) and by
  writing the game's own state (for example the play timer for the 20 minute break reminder). A small helper script
  (`JS_HELPERS` in the test file) is injected into the page; it only reads game state or logs calls to `setBlock`.
* Taps on the 3D scene are real touch taps. The game drops a tap whose press and release are more than 350 ms apart, which
  can happen on an overloaded machine, so a dropped tap is retried up to 3 times (`Game.tap_until`).
* On a desktop context the browser's pointer-lock request is rejected. Headless Chromium otherwise grabs the pointer and
  rendering slows to about 1 frame per second; the game has a documented no-lock fallback that the tests use.
* Bot tests are randomised by the game itself. Waits are generous and a few tests retry with another build when a bot
  happens to give up and walk away.

## Run time

About 15 to 20 minutes headless on a shared machine (212 tests); faster on a quiet or 4-core machine. Each test starts a new
context and the game itself needs about 1.2 s to build its first chunks, so tests are not run in parallel by default
(`pytest -n` is not part of the pinned dependencies).

## Known real bugs the suite reports

None. Both earlier `xfail(strict=True)` marks (bots building into their own bodies; joystick under the hotbar on a landscape
phone) were fixed in the game and the marks removed. No test is marked xfail or skipped.

## Embedding API (for a host app or WebView)

The game file documents this in a comment at its top. Summary:

* `window.musliMineCraft.exportSave()` returns a Promise of a JSON string (progress, all edited chunks, builder-bot edits).
* `window.musliMineCraft.importSave(json)` validates, replaces the save and reloads the page; it rejects on invalid input.
* `window.musliMineCraft.onSave = fn` is called after each save with `{stars, mission, blocks, time}`.
* The game posts `{type:'musliMineCraft:save', stars, mission, blocks}` to its parent window after each save.
* A host may post `{type:'musliMineCraft:import', json}` to the game. It is accepted only when ALL of these hold: `window.musliMineCraftAllowImport === true`, the message comes from `window.parent`, and its origin is listed in `window.musliMineCraftAllowedOrigins` (an array the host sets; there is no default and the URL hash does nothing). The save summary (`musliMineCraft:save`) is posted only to the origins in that list, never to `*`.
* Only one tab writes the save (Web Locks, `musliMineCraft-writer`). A second tab shows "musliMineCraft is open in another tab" with a "Play here" button that makes the other tab save and give way, then reloads from the stores. Without Web Locks both tabs write, merging chunk records in one transaction.
* `window.IslamineCraft` is an alias of `window.musliMineCraft`. A save written by the old IslamineCraft build is migrated once.
* Storage: IndexedDB `musliMineCraft` (store `c` one record per edited chunk, store `m` bot edits), `localStorage` keys
  `musliMineCraft_prog_v1` (progress), `musliMineCraft_jrn_v1` (journal of unconfirmed chunk writes) and `musliMineCraft_save_v1`
  (fallback blob, used only when IndexedDB is unavailable).

## Not covered

* Rendering correctness (pixels, shaders, lighting) and real GPU performance. Only logic, DOM and game state are checked.
* Real audio output. The sound setting is tested; whether sound plays is not.
* Real pointer lock (mouse look) on desktop: it is not available in headless Chromium. Desktop movement and jumping are tested
  with the keyboard.
* The 20 minute break reminder is tested by setting the game's play timer (`activeSec`), not by playing for 20 minutes.
* The hidden-tab test emulates `document.hidden` in the page; it does not use a real background tab.
* Two bots building at once and bot behaviour in a very crowded world are only covered indirectly.

## Added in the final pass

New groups: SAFE START (`TestSafeStart`: fresh start at all five viewports on Low and High graphics, unsafe saved positions in water, mid-air, solid, a mosque wall, a tree top and at the world edge, reset then Play, importSave, Show me, the 20 s Swim to shore helper, joystick out of deep water), WELCOME LIVE (`TestWelcomeLive`: stage 1 at first paint, live scene, 12 sampled frames of the menu loop checked with the game's own projection and raycasts, loop closes, no overlaps at five viewports, Play ends the scene, saved time of day, WebGL failure, no old name), SAVE/RESUME additions (`TestSaveResume`), the modal click guard (`TestModalGuard`), tidy-up (`TestTidyUp`) and start view / HUD layout (`TestStartViewAndHud`: no bot within 3 blocks of the player for 10 s after Play; HUD elements never overlap, collapsed or expanded).

Run: `cd tests/e2e && python3 -m pytest -q` (set `GAME_URL=file:///.../musliMineCraft.html` to test another build). The full suite takes about 15 to 20 minutes on a shared machine.

For the embedding API, see the main `README.md` and the comment at the top of `src/5c-save.js`.

## Exhibit photos (C13)

15 of the 26 museum exhibits can show a real photo over their drawing. The table is the constant `EXHIBIT_PHOTOS` at the top of `src/5b-museum-ui.js` (keyed by exhibit number 1 to 26; each record has `url`, `page`, `credit`).

- The photos are hot-linked from the Metropolitan Museum of Art, the Wellcome Collection and the Rijksmuseum. These sites do not promise hot-linking will keep working.
- For production, download the 15 images, put them on your own CDN, and change the `url` values in that one table.
- The game loads a photo only when its exhibit card is open (a plain `new Image()`, no CORS, no canvas reads, `referrerPolicy no-referrer`, 6 s timeout). If it fails, times out or the device is offline, the drawing stays and nothing is shown or logged by the game. Up to 6 loaded photos are kept in memory and released when the player leaves the museum area.
- These are the only network requests the game can make.
- The Claude artifact preview blocks remote images, so only the drawings show there.
- Tests (`TestExhibitPhotos`) never use the real internet: the fixture answers the three photo hosts with a small local PNG, and individual tests override that with failing, aborted, offline or never-answered routes.
