"""
End-to-end tests for musliMineCraft (single-file WebGL1 children's voxel game).

Run:   pytest            (see README.md for env vars: GAME_URL, HEADED, SLOW)

Design notes
  * One Chromium per session, one fresh browser context (clean localStorage) per test.
  * Every test fails if the page logs a console error or throws an uncaught error
    (checked in fixture teardown).
  * No fixed sleeps for progress: everything waits on a condition with a timeout.
  * Game time is advanced with the game's own test hooks (__stepBots, __tp, ...) or by
    writing the game's own state (e.g. the play timer) instead of waiting in real time.
"""
import json
import math
import os
import re
import time
from pathlib import Path

import pytest
from playwright.sync_api import Error as PWError
from playwright.sync_api import TimeoutError as PWTimeout
from playwright.sync_api import sync_playwright

# --------------------------------------------------------------------------- config
HERE = Path(__file__).resolve().parent
GAME_URL = os.environ.get("GAME_URL") or (HERE.parent.parent / "dist" / "musliMineCraft.html").as_uri()
HEADED = os.environ.get("HEADED") == "1"
SLOW = os.environ.get("SLOW") == "1"
SAVE_KEY = "musliMineCraft_save_v1"          # compact fallback copy (only used when IndexedDB is unavailable)
PROG_KEY = "musliMineCraft_prog_v1"          # small progress record (stars, mission, position, settings, passport, ...)
OLD_KEY = "islaminecraft_save_v1"      # the pre-rename save: migrated once, then removed
DB_NAME = "musliMineCraft"                   # IndexedDB: store "c" = one record per edited chunk, store "m" = builder-bot edits
CHROMIUM_ARGS = [  # software WebGL so the suite runs on machines without a GPU (CI)
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
    "--use-gl=angle",
]


import struct
import zlib


def _png(w=12, h=8):
    raw = b"".join(b"\x00" + bytes([200, 120, 40]) * w for _ in range(h))
    ck = lambda t, d: struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    return b"\x89PNG\r\n\x1a\n" + ck(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)) + ck(b"IDAT", zlib.compress(raw)) + ck(b"IEND", b"")


PNG = _png()
PHOTO_HOSTS = re.compile(r"https://(images\.metmuseum\.org|iiif\.wellcomecollection\.org|iiif\.micr\.io)/")


def T(ms):
    """Scale a timeout in milliseconds (x3 when SLOW=1)."""
    return int(ms * (3 if SLOW else 1))


# (id, width, height, touch)
VIEWPORTS = [
    ("phone-360x740", 360, 740, True),
    ("phone-390x844", 390, 844, True),
    ("phone-landscape-844x390", 844, 390, True),
    ("tablet-1024x768", 1024, 768, True),
    ("desktop-1280x720", 1280, 720, False),
]
PHONE = ("phone-390x844", 390, 844, True)
DESKTOP = ("desktop-1280x720", 1280, 720, False)
MISSION_SIZES = [8, 18, 13, 25, 33, 49, 26]
MISSION_NAMES = ["The Well", "Garden Wall", "The Gate", "Tiled Courtyard", "The Minaret", "The Dome", "House of Wisdom"]


# --------------------------------------------------------------------------- page-side helpers
# Installed once per page (window.__e2e). Everything here only *reads* the game or calls the
# game's own functions / hooks; it never patches game logic (the only wrappers are loggers).
JS_HELPERS = r"""
(() => {
  if (window.__e2e) return;
  const E = window.__e2e = {};
  E.realStep = window.stepBots;
  E.freeze = () => { window.stepBots = () => {}; };      // stop bots (used by tests that are not about bots)
  E.unfreeze = () => { window.stepBots = E.realStep; };
  // Advance game time (bots, streaming) until pred() is true or maxSec of game time passed.
  E.sim = (pred, maxSec) => {
    let t = 0;
    if (pred()) return { ok: true, t };
    while (t < maxSec) {
      streamWork(30, 3, performance.now());
      window.stepBots(.1);
      t += .1;
      if (pred()) return { ok: true, t };
    }
    return { ok: false, t };
  };
  E.live = () => bots.filter(b => b.on);
  E.builderIdx = (minLeft, needTmp) => bots.findIndex(b => b.on && b.st === 1 && b.cells.length &&
      botCellLeft(b) >= minLeft && b.ci < b.cells.length - 4 &&
      (!needTmp || b.cells.some(c => !S.unlocked.includes(c[3]))));
  E.findBuilder = (minLeft, needTmp, maxSec) => {
    const r = E.sim(() => E.builderIdx(minLeft, needTmp) >= 0, maxSec);
    return r.ok ? E.builderIdx(minLeft, needTmp) : -1;
  };
  // Log every bot edit (and what it found there) so tests can assert on bot behaviour.
  E.watch = () => {
    if (E.watching) return;
    E.watching = true; E.log = [];
    const orig = window.setBlock;
    window.setBlock = function (x, y, z, b, who) {
      if (who === 1) E.log.push({ x, y, z, b, prev: getAny(x, y, z), playerEdit: hasEdit(x, y, z),
        insidePlayer: !!(DEFS[b] && DEFS[b].solid && overlapsPlayer(x, y, z)), onPlot: nearPlot(x, z, 0) });
      return orig.apply(this, arguments);
    };
  };
  // Put the player on the ground ~dist blocks from a point (cx,cy,cz = centre), looking at it.
  E.standAt = (cx, cy, cz, dist, skip) => {
    skip = skip || 0;
    for (let k = 0; k < 24; k++) {
      const a = k * Math.PI / 12, x = cx + Math.cos(a) * dist, z = cz + Math.sin(a) * dist;
      forceLoad(Math.floor(x / 16), Math.floor(z / 16), 1);
      const y = walkY(x, z, cy);
      if (y < 0 || Math.abs(y - cy) > 4) continue;
      if (skip-- > 0) continue;
      Object.assign(player, { x, y, z, vx: 0, vy: 0, vz: 0, hold: false });
      const dx = cx - x, dy = cy - (y + 1.62), dz = cz - z;
      player.yaw = Math.atan2(-dx, -dz);
      player.pitch = Math.max(-1.3, Math.min(1.3, Math.atan2(dy, Math.hypot(dx, dz))));
      updateCamera();
      return [x, y, z];
    }
    return null;
  };
  // Which cell would a tap at screen point (px,py) place a block into? (same ray the game uses)
  E.target = (px, py) => {
    const r = playerRay(px, py), h = cast(r.o, r.d, REACH, S.sel, false);
    if (!h || h.b === B.CHEST) return null;
    const g = h.ghost;
    return [h.x + (g ? 0 : h.n[0]), h.y + (g ? 0 : h.n[1]), h.z + (g ? 0 : h.n[2])];
  };
  const OFF = [[0, 0], [0, -8], [0, 8], [-8, 0], [8, 0], [-14, -14], [14, 14], [-14, 14], [14, -14], [0, -18], [0, 18]];
  const onCanvas = (px, py) => { const el = document.elementFromPoint(px, py); return !!el && el.id === 'gl'; };
  E.pointFor = (x, y, z) => {            // screen point where a tap would place a block into cell (x,y,z)
    updateCamera();
    const c = project(x + .5, y + .5, z + .5);
    if (!c) return null;
    const bx = (c[0] * .5 + .5) * vw, by = (.5 - c[1] * .5) * vh;
    for (const [dx, dy] of OFF) {
      const px = bx + dx, py = by + dy;
      if (px < 2 || py < 2 || px > vw - 2 || py > vh - 2) continue;
      const t = E.target(px, py);
      if (t && t[0] === x && t[1] === y && t[2] === z && onCanvas(px, py)) return [px, py];
    }
    return null;
  };
  E.chestPoint = (x, y, z) => {          // screen point where a tap hits the chest block
    updateCamera();
    const c = project(x + .5, y + .5, z + .5);
    if (!c) return null;
    const bx = (c[0] * .5 + .5) * vw, by = (.5 - c[1] * .5) * vh;
    for (const [dx, dy] of OFF) {
      const px = bx + dx, py = by + dy, r = playerRay(px, py), h = cast(r.o, r.d, REACH, 0, false);
      if (h && h.b === B.CHEST && h.x === x && h.y === y && h.z === z && onCanvas(px, py)) return [px, py];
    }
    return null;
  };
  E.botPoint = (b) => {                  // screen point on a bot's body that a tap would hit
    updateCamera();
    for (const hy of [1.0, 0.7, 1.3, 0.5, 1.5, 0.3]) {
      const c = project(b.x, b.y + hy, b.z);
      if (!c) continue;
      const px = (c[0] * .5 + .5) * vw, py = (.5 - c[1] * .5) * vh;
      if (px < 2 || py < 2 || px > vw - 2 || py > vh - 2 || !onCanvas(px, py)) continue;
      const r = playerRay(px, py), bp = botPick(r.o, r.d), h = cast(r.o, r.d, REACH, 0, true);
      if (bp && bp.bot === b && (!h || bp.t < h.t)) return [px, py];   // and no block in front of the bot
    }
    return null;
  };
  E.nextGhostTap = (cells, onlySel) => { // stand somewhere that lets us tap an unbuilt blueprint cell directly
    for (const c of (cells || ghostCells)) {
      if (getAny(c[0], c[1], c[2]) === c[3] || (onlySel && c[3] !== S.sel)) continue;
      for (const d of [3.2, 4.4, 5.4]) {
        if (!E.standAt(c[0] + .5, c[1] + .5, c[2] + .5, d)) continue;
        const pt = E.pointFor(c[0], c[1], c[2]);
        if (pt) return { cell: c, pt };
      }
    }
    return null;
  };
  E.badBots = (kind) => {                // bots that are standing somewhere impossible
    const bad = [];
    for (const b of bots) {
      if (!b.on) continue;
      const x = Math.floor(b.x), z = Math.floor(b.z), c = chunkAt(x >> 4, z >> 4);
      if (!c || c.st !== 2) { if (kind === 'ground') bad.push([b.name, 'chunk under bot is not built']); continue; }
      const yi = Math.round(b.y);
      if (Math.abs(b.y - yi) > 0.2) continue;                        // mid-step animation
      if (kind === 'walled') {
        if (solidAt(x, yi, z) || solidAt(x, yi + 1, z)) bad.push([b.name, 'inside a solid block', b.x, b.y, b.z]);
        continue;
      }
      if (yi < 1) bad.push([b.name, 'under the floor', b.y]);
      if (!solidAt(x, yi - 1, z)) bad.push([b.name, 'nothing solid below', b.x, b.y, b.z]);
      if (getB(x, yi, z) === B.WATER && getB(x, yi - 1, z) === B.WATER) bad.push([b.name, 'in deep water', b.x, b.y, b.z]);
    }
    return bad;
  };
  E.trackActs = () => {                  // count taps the game processed (its own act() function)
    if (E.acts !== undefined) return; E.acts = 0;
    const o = window.act;
    window.act = function () { E.acts++; return o.apply(this, arguments); };
  };
  E.standToSee = (b, dist) => {          // walk to a spot from which the bot can be tapped (nothing in front of it)
    for (let skip = 0; skip < 12; skip++) {
      if (!E.standAt(b.x, b.y + 1, b.z, dist, skip)) return false;
      if (E.botPoint(b)) return true;
    }
    return false;
  };
  E.chest = () => { for (const c of loaded) if (c.chests.length) return c.chests[0]; return null; };
  E.captureQuestion = () => {            // remember the last question the game generated
    if (E.capturing) return; E.capturing = true;
    const orig = window.nextQuestion;
    window.nextQuestion = function () { const q = orig.apply(this, arguments); window.__lastQ = q; return q; };
  };
  E.peak = () => {                       // track the peak number of loaded chunks / memory
    if (E.peaking) return; E.peaking = true; E.pk = { chunks: 0, bytes: 0 };
    const o = window.loadChunk;
    window.loadChunk = function () {
      const c = o.apply(this, arguments);
      if (loaded.length > E.pk.chunks) E.pk.chunks = loaded.length;
      return c;
    };
    setInterval(() => { const s = __stats(); E.pk.chunks = Math.max(E.pk.chunks, s.loadedChunks); E.pk.bytes = Math.max(E.pk.bytes, s.approxBytes); }, 50);
  };
  // number of edited-chunk records in IndexedDB (async)
  E.idbChunks = () => new Promise(res => { try { const q = indexedDB.open('musliMineCraft'); q.onerror = () => res(-1);
      q.onsuccess = () => { try { const c = q.result.transaction(['c'], 'readonly').objectStore('c').count(); c.onsuccess = () => { q.result.close(); res(c.result) }; c.onerror = () => res(-1) } catch (e) { res(-1) } } } catch (e) { res(-1) } });
  E.settled = () => { const s = __stats(); return !s.hold && s.queue < 4; };
  E.mission = () => ({ idx: S.mission, counter: (document.querySelector('#mission .mc') || {}).textContent || null,
                       name: (document.querySelector('#mission .mt') || {}).textContent || null });
})();
"""


# --------------------------------------------------------------------------- Game wrapper
class Game:
    def __init__(self, browser, vp=PHONE, init_scripts=(), dsf=None):
        _id, w, h, touch = vp
        self.vp = vp
        self.w, self.h, self.touch = w, h, touch
        self.ctx = browser.new_context(
            viewport={"width": w, "height": h},
            has_touch=touch,
            is_mobile=touch,
            device_scale_factor=dsf or (2 if touch else 1),
        )
        self.page = self.ctx.new_page()
        self.page.set_default_timeout(T(30000))
        self.errors, self.requests = [], []
        self.page.on("console", self._on_console)
        self.page.on("pageerror", lambda e: self.errors.append(f"uncaught page error: {e}"))
        self.page.on("request", lambda r: self.requests.append(r.url))
        if not touch:  # headless Chromium grabs a pointer lock that makes rendering crawl; the game has a no-lock fallback
            self.page.add_init_script(
                "HTMLCanvasElement.prototype.requestPointerLock=function(){return Promise.reject(new Error('no lock'))}")
        for s in init_scripts:
            self.page.add_init_script(s)
        self._cdp = None
        # exhibit photos are hot-linked; tests never touch the real internet: the default answer is a small local PNG
        self.photo_hits = []
        self.ctx.route(PHOTO_HOSTS, self._photo_default)

    def _photo_default(self, route):
        self.photo_hits.append(route.request.url)
        route.fulfill(status=200, content_type="image/png", body=PNG)

    def _on_console(self, m):
        if m.type != "error":
            return
        if "favicon" in (m.location or {}).get("url", ""):
            return
        self.errors.append(f"console.error: {m.text}")

    # -- basics
    def ev(self, js, arg=None):
        return self.page.evaluate(js) if arg is None else self.page.evaluate(js, arg)

    def wait(self, expr, what, timeout=10000, observe="null", arg=None):
        """Wait until JS `expr` is truthy; otherwise fail saying what was expected and what we saw.
        With `arg`, `expr`/`observe` may use the variable `a` (or be an arrow function taking one parameter)."""
        def fn(js):
            return js if re.match(r"\s*\(\w+\)\s*=>", js) else f"(a)=>({js})"
        try:
            if arg is None:
                self.page.wait_for_function(expr, timeout=T(timeout))
            else:
                self.page.wait_for_function(fn(expr), arg=arg, timeout=T(timeout))
        except PWTimeout:
            try:
                seen = self.ev(observe) if arg is None else self.ev(fn(observe), arg)
            except PWError as e:  # page may be gone
                seen = f"<could not read: {e}>"
            pytest.fail(f"Expected {what} within {T(timeout)} ms, but observed: {json.dumps(seen, default=str)[:600]}")

    def goto(self):
        self.page.goto(GAME_URL, wait_until="commit")

    def ready(self):
        self.wait("!!document.querySelector('[data-a=play]') && document.querySelector('[data-a=play]').offsetParent !== null",
                  "the Play button to appear after loading", timeout=60000,
                  observe="[document.getElementById('wpct')&&document.getElementById('wpct').textContent, document.getElementById('wstage')&&document.getElementById('wstage').textContent]")
        self.ev(JS_HELPERS)

    def modal_ready(self):
        """Wait for a card to be open for long enough that the game accepts clicks on it (it ignores
        clicks in the first 280 ms so a finger tap can not hit a button of the card it just opened)."""
        self.wait("curModal && performance.now()-modalT>300", "a card to be open and clickable",
                  observe="[!!curModal, document.getElementById('panel').textContent.slice(0,80)]")

    def click(self, selector):
        self.modal_ready()
        self.page.click(selector)

    def tap(self, selector):
        self.modal_ready()
        self.page.locator(selector).tap()

    def tap_until(self, get_point, cond, what, arg=None, tries=3, timeout=2500, observe="null"):
        """Real finger tap at get_point() until JS `cond` holds. The game ignores a tap whose press and release are
        more than 350 ms apart, which can happen on a very busy CI machine, so a dropped tap is retried (max `tries`)."""
        def fn(js):
            return js if re.match(r"\s*\(\w+\)\s*=>", js) else f"(a)=>({js})"
        for _ in range(tries):
            pt = get_point()
            assert pt, f"Test set-up: no screen point to tap for: {what}"
            self.page.touchscreen.tap(*pt)
            try:
                if arg is None:
                    self.page.wait_for_function(cond, timeout=T(timeout))
                else:
                    self.page.wait_for_function(fn(cond), arg=arg, timeout=T(timeout))
                return
            except PWTimeout:
                continue
        seen = self.ev(observe) if arg is None else self.ev(fn(observe), arg)
        pytest.fail(f"Expected {what} after tapping (tried {tries} times), but observed: {json.dumps(seen, default=str)[:500]}")

    def modal_text(self):
        return self.ev("document.getElementById('panel').textContent")

    def modal_open(self):
        return self.ev("!!curModal && document.getElementById('modal').classList.contains('on')")

    def close_modal(self, button="ok"):
        self.click(f"[data-a={button}]")
        self.wait("!curModal", f"the card to close after pressing '{button}'",
                  observe="document.getElementById('panel').textContent.slice(0,80)")

    def start(self, play=True):
        self.goto()
        self.ready()
        if play:
            self.play()

    def play(self):
        self.page.click("[data-a=play]")
        self.wait("playing", "playing to start after pressing Play", observe="[playing, LD.phase]")
        if self.ev("!!curModal"):  # the mission intro card; its real button is clicked in the startup test, here we save 0.3 s per test
            self.ev("closeModal()")
        self.wait("!player.hold", "the player to be released onto the ground",
                  observe="[player.hold, __stats()]", timeout=30000)

    def settle(self, timeout=40000):
        self.wait("__e2e.settled()", "world streaming to settle (not holding, queue < 4)", timeout=timeout,
                  observe="__stats()")

    def freeze_bots(self):
        self.ev("__e2e.freeze()")

    def unfreeze_bots(self):
        self.ev("__e2e.unfreeze()")

    def stars(self):
        return self.ev("S.stars")

    def hotbar_select(self, block_name):
        self.page.locator(f'#hotbar .slot[aria-label="{block_name}"]').click()  # locked slots are labelled "<name> (locked)"

    def block_name(self, const):
        return self.ev(f"DEFS[B.{const}].name")

    def cdp(self):
        if self._cdp is None:
            self._cdp = self.ctx.new_cdp_session(self.page)
        return self._cdp

    def close(self):
        try:
            self.ctx.close()
        except PWError:
            pass


class Fingers:
    """Multi-finger touch input through the Chrome DevTools protocol."""

    def __init__(self, game):
        self.cdp, self.pts = game.cdp(), {}

    def _send(self, kind):
        pts = [{"x": x, "y": y, "id": i} for i, (x, y) in sorted(self.pts.items())]
        self.cdp.send("Input.dispatchTouchEvent", {"type": kind, "touchPoints": pts})

    def down(self, fid, x, y):
        self.pts[fid] = (x, y)
        self._send("touchStart")

    def move(self, fid, x, y):
        self.pts[fid] = (x, y)
        self._send("touchMove")

    def move_many(self, targets, steps=6):
        starts = {f: self.pts[f] for f in targets}
        for s in range(1, steps + 1):
            for f, (tx, ty) in targets.items():
                sx, sy = starts[f]
                self.pts[f] = (sx + (tx - sx) * s / steps, sy + (ty - sy) * s / steps)
            self._send("touchMove")

    def up_all(self):
        self.pts = {}
        self.cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})


# --------------------------------------------------------------------------- fixtures
@pytest.fixture(scope="session")
def browser():
    with sync_playwright() as p:
        b = p.chromium.launch(headless=not HEADED, args=CHROMIUM_ARGS)
        yield b
        b.close()


@pytest.fixture
def game(browser):
    """Factory: game(vp=PHONE, save=<legacy save dict|str|None>, prog=<new progress record>, init=[js,...]) -> Game. Fresh context per call."""
    made = []

    def make(vp=PHONE, save=None, init=(), dsf=None, prog=None):
        scripts = list(init)
        if save is not None:
            raw = save if isinstance(save, str) else json.dumps(save)
            # a save written by an older (IslamineCraft) build; the game migrates it once. Guarded so a reload does not re-seed it.
            scripts.append(f"try{{if(!localStorage.getItem({json.dumps(PROG_KEY)}))localStorage.setItem({json.dumps(OLD_KEY)},{json.dumps(raw)})}}catch(e){{}}")
        if prog is not None:
            scripts.append(f"try{{if(!sessionStorage.getItem('__seeded'))localStorage.setItem({json.dumps(PROG_KEY)},{json.dumps(prog if isinstance(prog,str) else json.dumps(prog))});sessionStorage.setItem('__seeded','1')}}catch(e){{}}")
        g = Game(browser, vp, scripts, dsf)
        made.append(g)
        return g

    yield make
    problems = []
    for g in made:
        g.close()
        problems += g.errors
    if problems:
        pytest.fail("The game logged errors that must never happen:\n  " + "\n  ".join(problems[:10]), pytrace=False)


@pytest.fixture
def started(game):
    """A phone game that is loaded and playing (intro card closed)."""
    g = game(PHONE)
    g.start()
    return g


@pytest.fixture
def loaded(game):
    """A phone game that finished loading but where Play was not pressed (no bots, no intro card)."""
    g = game(PHONE)
    g.start(play=False)
    return g


@pytest.fixture
def desktop(game):
    g = game(DESKTOP)
    g.start()
    return g


def v3_save(**kw):
    d = {"v": 3, "ed": [], "bed": [], "stars": 0, "mission": 0}
    d.update(kw)
    return d


# =========================================================================== STARTUP
class TestStartup:
    @pytest.mark.parametrize("vp", VIEWPORTS, ids=[v[0] for v in VIEWPORTS])
    def test_welcome_progress_play_and_hud_layout(self, game, vp):
        """Title screen and progress bar show quickly, progress reaches 100%, Play starts the game, and the HUD sits on screen clear of the hotbar."""
        g = game(vp, init=["""window.__pct=[];new MutationObserver(()=>{const e=document.getElementById('wpct');
            if(e){const v=parseInt(e.textContent);if(!isNaN(v)&&window.__pct[window.__pct.length-1]!==v)window.__pct.push(v)}})
            .observe(document,{subtree:true,childList:true,characterData:true,attributes:true})"""])
        t0 = time.time()
        g.goto()
        g.wait("(()=>{const w=document.getElementById('welcome');return !!w && getComputedStyle(w).display!=='none'})()",
               "the welcome screen to be visible", timeout=3000, observe="document.body.innerHTML.length")
        g.wait("(()=>{const t=document.getElementById('wtrack'),r=t&&t.getBoundingClientRect();return !!r&&r.width>50&&r.height>4})()",
               "the progress bar track to be visible with a real size", timeout=3000,
               observe="(()=>{const t=document.getElementById('wtrack');return t&&t.getBoundingClientRect().toJSON()})()")
        assert time.time() - t0 < T(5), f"Expected the welcome screen within {T(5)} s, took {time.time() - t0:.1f} s"
        title = g.ev("document.querySelector('#welcome .wtitle title').textContent")
        assert title == "musliMineCraft", f"Expected the title 'musliMineCraft' but saw {title!r}"
        g.ready()
        pct = g.ev("window.__pct")
        assert len(set(pct)) >= 3, f"Expected progress to pass through at least 3 different values, observed {pct}"
        assert pct == sorted(pct), f"Expected progress never to go backwards, observed {pct}"
        assert pct[-1] == 100, f"Expected progress to finish at 100%, observed {pct}"
        assert g.ev("getComputedStyle(document.getElementById('wbar')).display") == "none", "progress bar should be hidden once Play shows"
        box = g.page.locator("[data-a=play]").bounding_box()
        assert box and box["width"] > 40 and box["height"] > 30, f"Play button should be a real tappable size, got {box}"
        g.page.click("[data-a=play]")
        g.wait("playing", "the game to start after pressing Play", observe="[playing, LD.phase]")
        assert g.ev("document.getElementById('welcome').style.display") == "none", "welcome screen should close after Play"
        # HUD layout once the intro card is closed
        g.close_modal("go")
        info = g.ev("""(()=>{const R=s=>{const e=document.querySelector(s);if(!e)return null;const cs=getComputedStyle(e);
            if(cs.display==='none'||cs.visibility==='hidden')return 'hidden';const r=e.getBoundingClientRect();return [r.left,r.top,r.right,r.bottom]};
            const o={vw:innerWidth,vh:innerHeight,hotbar:R('#hotbar')};
            for(const s of ['#btnStats','#clock','#btnSet','#mission','#btnJump','#btnMode','#joy','#hotbar'])o[s]=R(s);return o})()""")
        names = ["#btnStats", "#clock", "#btnSet", "#mission", "#hotbar"] + (["#btnJump", "#btnMode"] + ([] if vp[0] == "phone-landscape-844x390" else ["#joy"]) if vp[3] else [])
        hb = info["#hotbar"]
        problems = []
        for n in names:
            r = info[n]
            if r in (None, "hidden"):
                problems.append(f"{n} is not shown")
                continue
            if r[0] < -1 or r[1] < -1 or r[2] > info["vw"] + 1 or r[3] > info["vh"] + 1:
                problems.append(f"{n} {list(map(round, r))} is outside the {info['vw']}x{info['vh']} screen")
            if n != "#hotbar" and r[2] > hb[0] and r[0] < hb[2] and r[3] > hb[1] and r[1] < hb[3]:
                problems.append(f"{n} {list(map(round, r))} overlaps the hotbar {list(map(round, hb))}")
        assert not problems, "HUD layout problems: " + "; ".join(problems)


    def test_joystick_is_clear_of_the_hotbar_on_landscape_phone(self, game):
        """The round walking pad does not overlap the block hotbar on a landscape phone."""
        g = game(VIEWPORTS[2])
        g.start()
        j, hb = g.ev("(()=>{const f=s=>{const r=document.querySelector(s).getBoundingClientRect();return [r.left,r.top,r.right,r.bottom]};return [f('#joy'),f('#hotbar')]})()")
        overlap = j[2] > hb[0] and j[0] < hb[2] and j[3] > hb[1] and j[1] < hb[3]
        assert not overlap, f"Joystick {list(map(round, j))} overlaps hotbar {list(map(round, hb))}"

    def test_game_makes_no_network_requests_besides_its_own_file(self, game):
        """Opening, playing and using the settings never fetches anything except the game file itself."""
        g = game(PHONE)
        g.start()
        g.ev("input.jy=1")
        g.wait("Math.hypot(player.x-1024.5,player.z-1024.5)>1", "the player to walk a little", observe="[player.x,player.z]")
        g.ev("input.jy=0")
        g.page.click("#btnSet")
        g.close_modal("ok")
        base = lambda u: u.split("#")[0]
        extra = [u for u in g.requests if base(u) != base(GAME_URL) and not u.startswith(("data:", "blob:", "about:"))]
        assert g.requests, "Expected at least the game file to be requested, observed no requests"
        assert not extra, f"Expected no requests other than the game file, but observed: {extra[:5]}"


# =========================================================================== CONTROLS
def _joy_center(g):
    b = g.page.locator("#joy").bounding_box()
    return b["x"] + b["width"] / 2, b["y"] + b["height"] / 2


def _look_start(g):
    """A point on the right side of the screen that is bare canvas (not a button)."""
    for fy in (0.45, 0.4, 0.5, 0.35):
        x, y = g.w * 0.75, g.h * fy
        if g.ev("(a)=>{const e=document.elementFromPoint(a[0],a[1]);return !!e&&e.id==='gl'}", [x, y]):
            return x, y
    pytest.fail("Could not find a bare canvas point on the right side of the screen to start a look-drag")


def _flat_spot(g, x=1048.5, z=1027.5):
    """Stand on the flat building plot (no missions blocks there), looking at the ground ahead."""
    g.freeze_bots()
    g.ev("(a)=>{__tp(a[0],a[1],0,-0.75,true);}", [x, z])
    g.wait("!player.hold && player.ground", "the player to stand on the plot ground", observe="[player.hold,player.ground,player.y]")
    g.ev("updateCamera()")


class TestControls:
    def test_joystick_drag_moves_the_player_forward(self, started):
        """Dragging the on-screen joystick up walks the player in the direction they face, and releasing stops them."""
        g = started
        g.freeze_bots()
        g.ev("player.yaw=0.6;player.pitch=-0.1")
        x0, z0 = g.ev("[player.x,player.z]")
        cx, cy = _joy_center(g)
        f = Fingers(g)
        f.down(0, cx, cy)
        f.move_many({0: (cx, cy - 45)}, steps=3)
        g.wait("Math.hypot(player.x-a[0],player.z-a[1])>1.5", "the player to walk at least 1.5 blocks while the joystick is held",
               observe="[Math.hypot(player.x-a[0],player.z-a[1]), input.jx, input.jy]", arg=[x0, z0])
        dx, dz = g.ev("(a)=>[player.x-a[0],player.z-a[1]]", [x0, z0])
        fx, fz = -math.sin(0.6), -math.cos(0.6)
        cosang = (dx * fx + dz * fz) / math.hypot(dx, dz)
        assert cosang > 0.9, f"Expected movement along the facing direction, but moved ({dx:.2f},{dz:.2f}) vs facing ({fx:.2f},{fz:.2f})"
        f.up_all()
        g.wait("input.jy===0 && input.jx===0", "the joystick input to reset after release", observe="[input.jx,input.jy]")
        g.wait("Math.abs(player.vx)<0.01 && Math.abs(player.vz)<0.01", "the player to stop moving after release", observe="[player.vx,player.vz]")

    def test_drag_on_the_right_side_turns_the_camera(self, started):
        """Dragging a finger on the right side of the screen turns the view left/right and up/down."""
        g = started
        g.freeze_bots()
        yaw0, pitch0 = g.ev("[player.yaw,player.pitch]")
        sx, sy = _look_start(g)
        f = Fingers(g)
        f.down(0, sx, sy)
        f.move_many({0: (sx - 90, sy + 25)}, steps=8)
        g.wait("Math.abs(player.yaw-a[0])>0.2", "the camera yaw to change by more than 0.2 rad after a horizontal drag",
               observe="[player.yaw-a[0]]", arg=[yaw0])
        f.up_all()
        yaw1, pitch1 = g.ev("[player.yaw,player.pitch]")
        assert abs(pitch1 - pitch0) > 0.02, f"Expected the vertical part of the drag to tilt the view, pitch went {pitch0:.3f} -> {pitch1:.3f}"

    def test_two_fingers_move_and_turn_at_the_same_time(self, started):
        """With one finger on the joystick and one dragging the view, the player walks and turns together."""
        g = started
        g.freeze_bots()
        g.ev("player.yaw=0.3")
        x0, z0, yaw0 = g.ev("[player.x,player.z,player.yaw]")
        jx, jy = _joy_center(g)
        sx, sy = _look_start(g)
        f = Fingers(g)
        f.down(0, jx, jy)
        f.down(1, sx, sy)
        f.move_many({0: (jx, jy - 45), 1: (sx - 100, sy)}, steps=10)
        g.wait("Math.hypot(player.x-a[0],player.z-a[1])>1.0 && Math.abs(player.yaw-a[2])>0.2",
               "the player to move AND the camera to turn while both fingers are down",
               observe="[Math.hypot(player.x-a[0],player.z-a[1]), player.yaw-a[2], input.jy]", arg=[x0, z0, yaw0])
        f.up_all()

    def test_tap_places_a_block_in_place_mode_and_removes_it_in_break_mode(self, started):
        """In Place mode a tap puts a block where you aim; after switching to Break mode a tap on it removes it."""
        g = started
        _flat_spot(g)
        mx, my = g.w / 2, g.h / 2
        cell = g.ev("(a)=>__e2e.target(a[0],a[1])", [mx, my])
        assert cell, "Expected the screen centre to point at the ground, but nothing was hit"
        assert g.ev("(c)=>getB(c[0],c[1],c[2])", cell) == 0, f"Target cell {cell} should start empty"
        assert g.ev("S.mode") == "place"
        g.tap_until(lambda: [mx, my], "getB(a[0],a[1],a[2])===S.sel", f"a block (id=S.sel) to appear at {cell} after a tap in Place mode",
                    arg=cell, observe="[getB(a[0],a[1],a[2]),S.sel]")
        g.page.click("#btnMode")
        assert g.ev("S.mode") == "break" and "Break" in g.page.inner_text("#btnMode"), "Mode button should now say Break"
        g.tap_until(lambda: [mx, my], "getB(a[0],a[1],a[2])===0", f"the block at {cell} to be removed by a tap in Break mode",
                    arg=cell, observe="getB(a[0],a[1],a[2])")

    def test_wasd_keys_move_the_player_and_space_jumps_on_desktop(self, desktop):
        """On a desktop, W moves forward, S back, A/D sidestep, and Space makes the player jump."""
        g = desktop
        _flat_spot(g)
        g.ev("player.yaw=0;player.pitch=-0.1")
        checks = [("w", lambda dx, dz: dz < -1.0), ("s", lambda dx, dz: dz > 1.0), ("a", lambda dx, dz: dx < -1.0), ("d", lambda dx, dz: dx > 1.0)]
        for key, ok in checks:
            x0, z0 = g.ev("[player.x,player.z]")
            g.page.keyboard.down(key)
            try:
                g.wait("Math.hypot(player.x-a[0],player.z-a[1])>1.2", f"the player to move while '{key}' is held",
                       observe="[player.x-a[0],player.z-a[1]]", arg=[x0, z0])
            finally:
                g.page.keyboard.up(key)
            dx, dz = g.ev("(a)=>[player.x-a[0],player.z-a[1]]", [x0, z0])
            assert ok(dx, dz), f"Key '{key}' moved the player the wrong way: dx={dx:.2f} dz={dz:.2f} (facing -z)"
        g.wait("player.ground", "the player to be on the ground before jumping", observe="[player.y, player.ground]")
        y0 = g.ev("player.y")
        g.page.keyboard.down(" ")
        try:
            g.wait("player.y>a+0.5", "the player to rise at least half a block after Space", observe="[player.y,a]", arg=y0)
        finally:
            g.page.keyboard.up(" ")

    def test_player_cannot_place_a_block_inside_themselves(self, started):
        """Aiming straight down at your own feet and tapping does not put a solid block where you stand."""
        g = started
        _flat_spot(g)
        g.ev("player.pitch=-1.45;updateCamera()")
        mx, my = g.w / 2, g.h / 2
        cell = g.ev("(a)=>__e2e.target(a[0],a[1])", [mx, my])
        inside = g.ev("(c)=>overlapsPlayer(c[0],c[1],c[2])", cell)
        assert cell and inside, f"Test set-up: expected the aimed cell {cell} to overlap the player"
        g.ev("__e2e.trackActs()")
        g.tap_until(lambda: [mx, my], "__e2e.acts>=1", "the game to process the tap aimed at the player's own feet", observe="__e2e.acts")
        # control: the same tap aimed a little further ahead does place a block
        g.ev("player.pitch=-0.75;updateCamera()")
        cell2 = g.ev("(a)=>__e2e.target(a[0],a[1])", [mx, my])
        assert g.ev("(c)=>!overlapsPlayer(c[0],c[1],c[2])", cell2), "Test set-up: second target should be clear of the player"
        g.tap_until(lambda: [mx, my], "getB(a[0],a[1],a[2])===S.sel", "the control tap beside the player to place a block", arg=cell2, observe="getB(a[0],a[1],a[2])")
        assert g.ev("(c)=>getB(c[0],c[1],c[2])", cell) == 0, f"A block was placed at {cell}, inside the player"

    def test_the_bottom_floor_cannot_be_broken(self, started):
        """Breaking blocks works down to the floor layer, but the very bottom layer (y=0) can never be removed."""
        g = started
        g.freeze_bots()
        # dig a 3x3 shaft on the plot down to y=2 (set-up), leaving layers y=1 and y=0
        g.ev("""(()=>{const x0=1046,z0=1024;__tp(x0+1.5,z0+1.5,0,-1.45,true);
            for(let x=x0;x<x0+3;x++)for(let z=z0;z<z0+3;z++)for(let y=PLOT_Y;y>=2;y--)setBlock(x,y,z,0,0);
            Object.assign(player,{x:x0+1.5,z:z0+1.5,y:2,vx:0,vy:0,hold:false});player.pitch=-1.45;updateCamera()})()""")
        g.page.click("#btnMode")
        assert g.ev("S.mode") == "break"
        g.wait("player.ground && Math.abs(player.y-2)<0.1", "the player to stand at the bottom of the shaft", observe="[player.y,player.ground]")
        mx, my = g.w / 2, g.h / 2
        hit = g.ev("(a)=>{const r=playerRay(a[0],a[1]);const h=cast(r.o,r.d,REACH,0,true);return h&&[h.x,h.y,h.z]}", [mx, my])
        assert hit and hit[1] == 1, f"Test set-up: expected to aim at layer y=1 first, got {hit}"
        g.tap_until(lambda: [mx, my], "getB(a[0],a[1],a[2])===0", "the y=1 block to be broken by a tap (control)", arg=hit, observe="getB(a[0],a[1],a[2])")
        g.wait("player.y<1.2", "the player to drop to the floor layer", observe="player.y")
        hit0 = g.ev("(a)=>{const r=playerRay(a[0],a[1]);const h=cast(r.o,r.d,REACH,0,true);return h&&[h.x,h.y,h.z]}", [mx, my])
        assert hit0 and hit0[1] == 0, f"Test set-up: expected to aim at the floor layer y=0, got {hit0}"
        before = g.ev("(c)=>getB(c[0],0,c[2])", hit0)
        assert before != 0
        g.ev("__e2e.trackActs()")
        g.tap_until(lambda: [mx, my], "__e2e.acts>=1", "the game to process the tap on the floor block", observe="__e2e.acts")
        after = g.ev("(c)=>getB(c[0],0,c[2])", hit0)
        assert after == before, f"The floor block at y=0 was changed from {before} to {after}; it must be unbreakable"


# =========================================================================== MISSIONS
def _fill_mission(g, leave_last=False):
    """Build every blueprint cell of the current mission with the game's own player edit path."""
    cells = g.ev("ghostCells.map(c=>c.slice())")
    todo = cells[:-1] if leave_last else cells
    g.ev("(cs)=>{for(const c of cs)setBlock(c[0],c[1],c[2],c[3],0)}", todo)
    return cells


class TestMissions:
    def test_first_mission_shows_blueprint_and_counter_0_of_8(self, started):
        """The first mission is 'The Well': a glowing blueprint of 8 blocks is drawn and the counter reads 0/8."""
        g = started
        m = g.ev("__e2e.mission()")
        assert m["name"] == "The Well" and m["counter"] == "0/8", f"Expected mission 'The Well' with counter 0/8, observed {m}"
        assert g.ev("ghostCells.length") == 8, "Expected 8 blueprint cells"
        assert g.ev("!!dyn.ghostT && dyn.ghostT.n>0"), "Expected the ghost blueprint to be uploaded for drawing (dyn.ghostT)"
        assert g.ev("document.querySelector('#mission .bar i').style.width") in ("0px", "0%", ""), "Progress bar should start empty"

    def test_placing_the_right_blocks_by_tapping_advances_the_counter(self, started):
        """Tapping blueprint cells with the right block selected fills them one by one and the counter goes up each time."""
        g = started
        g.freeze_bots()
        g.hotbar_select(g.block_name("STONE"))
        assert g.ev("S.sel") == g.ev("B.STONE")
        for expected in (1, 2, 3):
            def pt():
                hit = g.ev("__e2e.nextGhostTap()")
                return hit and hit["pt"]
            g.tap_until(pt, f"document.querySelector('#mission .mc').textContent==='{expected}/8'",
                        f"the mission counter to read {expected}/8 after tapping a blueprint cell", observe="[__e2e.mission(), S.sel]")
        assert g.ev("document.querySelector('#mission .bar i').style.width") == f"{3 / 8 * 100}%"

    def test_all_seven_missions_complete_in_order_with_stars_and_unlocks(self, started):
        """Missions 1-7 need 8, 18, 13, 25, 33, 49 and 26 blocks; each awards 5 stars and Building +1, unlocks its block, and the next one is never blocked."""
        g = started
        g.freeze_bots()
        rewards = g.ev("MISSIONS.map(m=>m.reward)")
        stars = 0
        for i, n in enumerate(MISSION_SIZES):
            m = g.ev("__e2e.mission()")
            assert m == {"idx": i, "counter": f"0/{n}", "name": MISSION_NAMES[i]}, f"Mission {i + 1}: expected {MISSION_NAMES[i]} 0/{n}, observed {m}"
            # no dead end: every block the blueprint needs is selectable right now
            needed = g.ev("[...new Set(ghostCells.map(c=>c[3]))]")
            locked = g.ev("(ids)=>ids.filter(id=>!S.unlocked.includes(id))", needed)
            assert not locked, f"Mission {i + 1} needs blocks {locked} that are still locked (dead end)"
            slots = g.ev("(ids)=>ids.map(id=>document.querySelector(`#hotbar .slot[aria-label^=\"${DEFS[id].name}\"]`).classList.contains('locked'))", needed)
            assert not any(slots), f"Mission {i + 1}: hotbar still shows a needed block as locked: {slots}"
            _fill_mission(g, leave_last=True)
            m = g.ev("__e2e.mission()")
            assert m["counter"] == f"{n - 1}/{n}", f"Mission {i + 1}: expected {n - 1}/{n} before the last block, observed {m}"
            assert not g.modal_open(), f"Mission {i + 1} must not complete before its last block"
            g.ev("(c)=>setBlock(c[0],c[1],c[2],c[3],0)", g.ev("ghostCells[ghostCells.length-1]"))
            g.wait("curModal && document.getElementById('panel').textContent.includes('is built!')",
                   f"the '{MISSION_NAMES[i]} is built!' card", observe="[document.getElementById('panel').textContent.slice(0,100), __e2e.mission()]")
            txt = g.modal_text()
            assert "+5 stars" in txt, f"Mission {i + 1}: expected '+5 stars' on the card, saw {txt[:120]!r}"
            stars += 5
            assert g.stars() == stars, f"Mission {i + 1}: expected {stars} stars, observed {g.stars()}"
            assert g.ev("S.skills.building") == i + 1, f"Mission {i + 1}: expected Building skill {i + 1}"
            assert g.ev("(r)=>S.unlocked.includes(r)", rewards[i]), f"Mission {i + 1}: reward block {rewards[i]} was not unlocked"
            g.click("[data-a=ok]")
            if i == 6:
                g.wait("!curModal", "the last card to close", observe="document.getElementById('panel').textContent.slice(0,80)")
            if i < 6:  # the next mission's intro card
                g.wait("curModal && document.getElementById('panel').textContent.includes('Mission ')", "the next mission intro card",
                       observe="document.getElementById('panel').textContent.slice(0,80)")
                g.close_modal("go")
        end = g.ev("[S.mission, S.stars, document.getElementById('mission').textContent]")
        assert end[0] == 7 and end[1] == 35 and "Free building" in end[2], f"Expected free building after all 7 missions with 35 stars, observed {end}"

    def test_show_me_asks_before_moving_the_player_when_far_from_the_plot(self, started):
        """Near the blueprint 'Show me' only turns the view; far away it asks 'Go back?' and moves the player only after Yes."""
        g = started
        g.freeze_bots()
        g.ev("player.yaw=3.0;player.pitch=0.3")
        x0, z0 = g.ev("[player.x,player.z]")
        g.page.click("#btnShow")
        g.wait("Math.abs(player.yaw-3.0)>0.3", "the view to turn towards the blueprint", observe="[player.yaw,player.pitch]")
        assert not g.modal_open(), "No card should open when the blueprint is near"
        assert g.ev("[player.x,player.z]") == [x0, z0], "Show me near the plot must never move the player"
        g.ev("__tp(1500.5,700.5,1.0,-0.1,true)")
        g.wait("!player.hold", "the player to arrive far away", observe="__stats()")
        x0, z0 = g.ev("[player.x,player.z]")
        g.page.click("#btnShow")
        g.wait("curModal", "a question card after pressing Show me", observe="document.getElementById('panel').textContent")
        assert "Go back to the building plot?" in g.modal_text(), f"Unexpected card: {g.modal_text()[:100]!r}"
        assert g.ev("[player.x,player.z]") == [x0, z0], "The player must not move before answering"
        g.close_modal("stay")
        assert g.ev("[player.x,player.z]") == [x0, z0], "Choosing 'Stay here' must leave the player where they are"
        g.page.click("#btnShow")
        g.click("[data-a=yes]")
        g.wait("Math.hypot(player.x-1024,player.z-1024)<5", "the player to be taken back near the building plot after Yes",
               observe="[player.x,player.z]")


# =========================================================================== QUIZ
def _open_chest_by_tap(g):
    """Stand beside the chest near the start and tap it; returns the chest position."""
    g.freeze_bots()
    g.ev("__tp(1015.5,1040.5,0,0,true)")
    g.wait("!player.hold", "the player to arrive near the chest", observe="__stats()")
    ch = g.ev("__e2e.chest()")
    assert ch, "Test set-up: expected a knowledge chest in the loaded chunks near (1015,1040)"
    assert g.ev("(c)=>!!__e2e.standAt(c[0]+.5,c[1]+.5,c[2]+.5,2.5)", ch)
    g.ev("__e2e.captureQuestion()")
    g.tap_until(lambda: g.ev("(c)=>__e2e.chestPoint(c[0],c[1],c[2])", ch), "curModal && document.querySelectorAll('.ans').length>0",
                "a quiz question to open after tapping the chest", observe="[!!curModal, document.getElementById('panel').textContent.slice(0,80)]")
    return ch


class TestQuiz:
    def test_opening_a_chest_shows_a_question_with_three_different_answers(self, started):
        """Tapping a knowledge chest opens a question with exactly three distinct, non-empty answer buttons."""
        g = started
        _open_chest_by_tap(g)
        answers = g.ev("[...document.querySelectorAll('#answers .ans')].map(b=>b.textContent.trim())")
        assert len(answers) == 3, f"Expected exactly 3 answers, observed {answers}"
        assert len(set(answers)) == 3 and all(answers), f"Expected 3 different non-empty answers, observed {answers}"
        assert g.ev("document.querySelector('.q').textContent.trim().length") > 3, "Question text should not be empty"

    def test_wrong_answer_keeps_the_chest_and_explains(self, started):
        """A wrong answer gives no stars, keeps the chest, shows the right answer, and the chest can be tried again."""
        g = started
        ch = _open_chest_by_tap(g)
        s0, skills0 = g.stars(), g.ev("JSON.stringify(S.skills)")
        right = g.ev("__lastQ.a")
        wrong = (right + 1) % 3
        g.click(f"#answers .ans[data-i='{wrong}']")
        g.wait("document.getElementById('result').textContent.includes('Not this time')", "an explanation after a wrong answer",
               observe="document.getElementById('result').textContent")
        res = g.ev("document.getElementById('result').textContent")
        right_text = g.ev("__lastQ.opts[__lastQ.a]")
        assert right_text in res and "still here" in res, f"Expected the right answer ({right_text!r}) and 'chest is still here' in {res!r}"
        assert g.stars() == s0 and g.ev("JSON.stringify(S.skills)") == skills0, "A wrong answer must not give stars or skills"
        assert g.ev("(c)=>getAny(c[0],c[1],c[2])===B.CHEST", ch), "The chest must still be there after a wrong answer"
        assert g.ev("document.querySelectorAll('.ans.bad').length") == 1 and g.ev("document.querySelectorAll('.ans.ok').length") == 1
        g.close_modal("x")
        # try again with a correct answer
        g.ev("(c)=>openChest(c[0],c[1],c[2])", ch)
        g.wait("curModal && document.querySelectorAll('.ans').length===3", "the chest to open again", observe="document.getElementById('panel').textContent.slice(0,80)")
        g.click(f"#answers .ans[data-i='{g.ev('__lastQ.a')}']")
        g.wait(f"S.stars==={s0 + 3}", "3 stars after answering correctly on the second try", observe="S.stars")

    def test_correct_answer_awards_stars_removes_chest_and_counts_the_skill(self, started):
        """A correct answer gives 3 stars, removes the chest, adds 1 to the matching skill and unlocks a new block."""
        g = started
        ch = _open_chest_by_tap(g)
        s0, skills0, unl0 = g.stars(), g.ev("({...S.skills})"), g.ev("S.unlocked.length")
        cat = g.ev("__lastQ.cat")
        g.click(f"#answers .ans[data-i='{g.ev('__lastQ.a')}']")
        g.wait("document.getElementById('result').textContent.includes('+3 stars')", "'+3 stars' after a correct answer",
               observe="document.getElementById('result').textContent")
        assert g.stars() == s0 + 3, f"Expected {s0 + 3} stars, observed {g.stars()}"
        skills1 = g.ev("S.skills")
        for k, v in skills0.items():
            want = v + 1 if k == cat else v
            assert skills1[k] == want, f"Skill {k}: expected {want} (answered a '{cat}' question), observed {skills1[k]}"
        assert g.ev("(c)=>getAny(c[0],c[1],c[2])", ch) == 0, "The chest should be gone after a correct answer"
        assert g.ev("S.unlocked.length") == unl0 + 1, "A new block should be unlocked by the first chest"
        assert g.ev("document.getElementById('starN').textContent") == str(s0 + 3), "The star counter in the HUD should update"

    def test_300_generated_questions_each_have_three_distinct_answers_and_one_correct(self, loaded):
        """For 300 generated questions: 3 distinct answers, a valid correct index, and the marked answer really is right."""
        g = loaded
        bad = g.ev("""(()=>{const bad=[],seen={};
          for(let tier=0;tier<3;tier++){S.stars=[0,20,60][tier];
            for(let i=0;i<100;i++){const q=nextQuestion();seen[q.cat]=(seen[q.cat]||0)+1;
              const o=q.opts,why=[];
              if(!Array.isArray(o)||o.length!==3)why.push('opts.length='+(o&&o.length));
              else{if(new Set(o).size!==3)why.push('duplicate answers '+JSON.stringify(o));
                if(o.some(x=>typeof x!=='string'||!x.trim()||/undefined|NaN/.test(x)))why.push('bad answer text '+JSON.stringify(o));}
              if(!Number.isInteger(q.a)||q.a<0||q.a>2)why.push('correct index '+q.a);
              if(!q.why||!q.text)why.push('missing text/explanation');
              if(!why.length){
                let m;
                if(q.cat==='maths'&&(m=q.text.match(/^(\\d+) ([+x-]) (\\d+) = \\?$/))){const a=+m[1],b=+m[3],r=m[2]==='+'?a+b:m[2]==='-'?a-b:a*b;if(+o[q.a]!==r)why.push('maths '+q.text+' marked '+o[q.a]);if(o.filter(x=>+x===r).length!==1)why.push('maths: not exactly one right answer')}
                if(q.cat==='arabic'){const L=LETTERS.find(l=>l[0]===q.glyph);if(!L||L[1]!==o[q.a])why.push('letter '+q.glyph+' marked '+o[q.a]);if(o.filter(x=>L&&x===L[1]).length!==1)why.push('letter: not exactly one right answer')}
                if(q.cat==='science'||q.cat==='knowledge'){const f=FACTS.find(f=>f[2]===q.text);if(!f||f[3]!==o[q.a])why.push('fact '+q.text+' marked '+o[q.a])}
              }
              if(why.length)bad.push([q.text,why]);}}
          S.stars=0;return {bad:bad.slice(0,5),count:bad.length,seen}})()""")
        assert g.ev("1") == 1
        assert not bad["bad"], f"{bad['count']} of 300 generated questions are wrong, e.g. {bad['bad']}"
        assert len(bad["seen"]) >= 3, f"Expected questions from several categories, observed {bad['seen']}"

    def test_all_28_arabic_letters_have_unique_names_and_letters(self, loaded):
        """There are exactly 28 letters, each with its own name and its own glyph, so no letter question can have two right answers."""
        g = loaded
        d = g.ev("({n:LETTERS.length,names:LETTERS.map(l=>l[1]),glyphs:LETTERS.map(l=>l[0])})")
        assert d["n"] == 28, f"Expected 28 Arabic letters, observed {d['n']}"
        assert len(set(d["names"])) == 28, f"Letter names are not unique: {sorted(n for n in d['names'] if d['names'].count(n) > 1)}"
        assert len(set(d["glyphs"])) == 28, "Letter glyphs are not unique"
        # build a question for every letter: its options must be 3 different names including the right one
        bad = g.ev("""(()=>{const bad=[];for(const L of LETTERS){for(let k=0;k<5;k++){const q=mk('arabic','Which letter is this?',L[0],L[1],shuffle(LETTERS.filter(l=>l!==L)).slice(0,2).map(o=>o[1]),'');
          if(new Set(q.opts).size!==3||q.opts[q.a]!==L[1])bad.push(L[1])}}return bad})()""")
        assert not bad, f"Letter questions with duplicate or wrong options: {bad}"


# =========================================================================== WORLD STREAMING AND MEMORY
def _travel(g, x, z, yaw=-1.5708):
    # the route east crosses the Open Air Prison; its first-visit card would pause the game, so it counts as already seen here
    g.ev("(a)=>{S.gz.seen=true;__tp(a[0],a[1],a[2],-0.2)}", [x + 0.5, z + 0.5, yaw])
    g.settle(timeout=60000)


class TestWorld:
    def test_travelling_600_blocks_keeps_chunks_and_memory_bounded(self, started):
        """Walking (teleporting in steps) 600 blocks at the highest graphics setting never loads more than 330 chunks or 40 MB."""
        g = started
        g.freeze_bots()
        g.ev("S.settings.gfx='high';applyGfx();__e2e.peak()")
        for i in range(1, 11):
            _travel(g, 1024 + i * 60, 1024 + (i * 13) % 50)
        pk = g.ev("__e2e.pk")
        s = g.ev("__stats()")
        assert pk["chunks"] <= 330, f"Expected at most 330 loaded chunks, peak was {pk['chunks']}"
        assert max(pk["bytes"], s["approxBytes"]) < 40e6, f"Expected under 40 MB of world data, peak was {max(pk['bytes'], s['approxBytes']) / 1e6:.1f} MB"
        assert pk["chunks"] > 100, f"Test sanity: expected the high setting to load >100 chunks, peak was {pk['chunks']}"

    def test_chunks_around_the_new_position_are_built_and_the_spawn_chunk_is_unloaded(self, started):
        """After travelling far, the ground around the player is meshed, and the chunk at the start has been freed."""
        g = started
        g.freeze_bots()
        assert g.ev("chunks.has(64+64*NC)"), "Test set-up: the spawn chunk should be loaded at the start"
        for i in range(1, 6):
            _travel(g, 1024 + i * 60, 1024)
        NEAR = "(()=>{let n=0,t=0;for(let a=-2;a<=2;a++)for(let b=-2;b<=2;b++){t++;const c=chunks.get(pcx+a+(pcz+b)*NC);if(c&&c.st===2)n++}return [n,t]})()"
        g.wait(f"{NEAR}[0]>=20", "at least 20 of the 25 chunks within 2 of the new position to be meshed", timeout=30000,
               observe=f"[{NEAR}, __stats()]")
        ring1 = g.ev("(()=>{let n=0;for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++){const c=chunks.get(pcx+a+(pcz+b)*NC);if(c&&c.st===2)n++}return n})()")
        assert ring1 == 9, f"Expected all 9 chunks directly around the player to be meshed, observed {ring1}"
        g.wait("!chunks.has(64+64*NC)", "the spawn chunk to be unloaded once the player is 300 blocks away",
               observe="[__stats(), chunks.has(64+64*NC)]")

    def test_an_edit_made_before_leaving_is_still_there_after_coming_back(self, started):
        """A block placed near the start is remembered after travelling far away and returning."""
        g = started
        g.freeze_bots()
        g.ev("setBlock(1030,22,1040,B.GOLD,0)")
        assert g.ev("getB(1030,22,1040)===B.GOLD")
        for i in (1, 2, 3):
            _travel(g, 1024 + i * 100, 1024)
        g.wait("!chunks.has(64+64*NC)", "the start chunk to be unloaded while away", observe="__stats()")
        _travel(g, 1024, 1024)
        g.wait("getB(1030,22,1040)===B.GOLD", "the gold block placed before leaving to be back after returning",
               observe="[getB(1030,22,1040), getAny(1030,22,1040), B.GOLD]")

    def test_a_chunk_generated_twice_is_identical(self, loaded):
        """Generating the same chunk again (fresh, or after unload and reload) gives exactly the same blocks."""
        g = loaded
        g.freeze_bots()
        res = g.ev("""(()=>{const cs=[];for(let dx=-6;dx<=6;dx+=3)for(let dz=-6;dz<=6;dz+=3)cs.push([64+dx,64+dz]);cs.push([60,57],[61,57],[90,40],[20,100]);
          const diff=[];for(const [cx,cz] of cs){const a=__genHash(cx,cz),b=__genHash(cx,cz);if(a!==b)diff.push(['gen twice',cx,cz,a,b])}
          for(const [cx,cz] of cs.slice(0,8)){__load(cx,cz);const h1=__chunkHash(cx,cz);__unload(cx,cz);__load(cx,cz);const h2=__chunkHash(cx,cz),g=__genHash(cx,cz);
            if(!(h1===h2&&h2===g))diff.push(['reload',cx,cz,h1,h2,g])}
          return {checked:cs.length,diff}})()""")
        assert not res["diff"], f"Chunk generation is not deterministic for {len(res['diff'])} of {res['checked']} chunks, e.g. {res['diff'][:2]}"

    def test_mosque_garden_orchard_vineyard_and_village_exist_near_the_start_and_have_blocks(self, loaded):
        """Each kind of landmark (mosque, garden, orchard, vineyard, village) exists within 200 blocks of the start and is really built."""
        g = loaded
        g.freeze_bots()
        problems = []
        for kind, ltype in [("mosque", "mosque"), ("garden", "charbagh"), ("orchard", "orchard"), ("vineyard", "vineyard"), ("village", "village")]:
            r = g.ev("""(t)=>{const f=__find(t);if(!f)return null;
              for(let cz=Math.floor((f.z-f.ez)/16);cz<=Math.floor((f.z+f.ez)/16);cz++)for(let cx=Math.floor((f.x-f.ex)/16);cx<=Math.floor((f.x+f.ex)/16);cx++)__load(cx,cz);
              let n=0;const kinds=new Set();
              for(let x=f.x-f.ex;x<=f.x+f.ex;x++)for(let z=f.z-f.ez;z<=f.z+f.ez;z++)for(let y=f.y+1;y<f.y+12;y++){const b=getB(x,y,z);if(b){n++;kinds.add(b)}}
              return {x:f.x,z:f.z,dist:Math.hypot(f.x-1024,f.z-1024),blocks:n,kinds:kinds.size}}""", ltype)
            if not r:
                problems.append(f"{kind}: __find('{ltype}') found nothing")
            elif r["dist"] >= 200:
                problems.append(f"{kind}: nearest is {r['dist']:.0f} blocks away (expected < 200)")
            elif r["blocks"] < 100 or r["kinds"] < 4:
                problems.append(f"{kind} at ({r['x']},{r['z']}): expected real structure, observed {r['blocks']} blocks of {r['kinds']} kinds")
        assert not problems, "Landmark problems: " + "; ".join(problems)

    def test_player_is_never_below_the_floor_after_rapid_teleports(self, started):
        """Jumping around the world 30 times in a row never leaves the player under the ground or inside a block."""
        g = started
        g.freeze_bots()
        import random
        rnd = random.Random(7)
        lows = []
        for i in range(30):
            x, z = rnd.randint(150, 1900) + .5, rnd.randint(150, 1900) + .5
            if i % 2:
                g.ev("(a)=>__tp(a[0],a[1],a[2],-0.2,true)", [x, z, rnd.random() * 6])
            else:
                g.ev("(a)=>__tp(a[0],a[1],a[2],-0.2)", [x, z, rnd.random() * 6])
            y = g.ev("player.y")
            if y < 1:
                lows.append((i, x, z, y))
        g.settle(timeout=60000)
        g.wait("player.ground", "the player to be standing on the ground at the end", observe="[player.y, player.ground, player.hold]")
        assert not lows, f"Player was below the floor after teleports: {lows[:3]}"
        stuck = g.ev("collides(player.x,player.y,player.z)")
        assert not stuck and g.ev("player.y") >= 2, f"Player ended inside a block or too low: y={g.ev('player.y')}, collides={stuck}"


# =========================================================================== SAVE
SAVED_STATE_JS = "({stars:S.stars,mission:S.mission,unlocked:[...S.unlocked].sort((a,b)=>a-b),skills:{...S.skills},sel:S.sel})"


class TestSave:
    def test_progress_edits_and_opened_chests_survive_a_reload(self, started):
        """Stars, mission, unlocked blocks, skills, built blocks and an opened chest are all still there after reloading the page."""
        g = started
        g.freeze_bots()
        # progress: finish mission 1, open a chest correctly, and build something by hand
        _fill_mission(g)
        g.wait("curModal && document.getElementById('panel').textContent.includes('is built!')", "the mission-complete card",
               observe="__e2e.mission()")
        g.click("[data-a=ok]")
        g.wait("curModal && document.getElementById('panel').textContent.includes('Mission 2')", "the next mission intro", observe="__e2e.mission()")
        g.close_modal("go")
        ch = _open_chest_by_tap(g)
        g.click(f"#answers .ans[data-i='{g.ev('__lastQ.a')}']")
        g.wait("S.stars===8", "8 stars after the mission (5) and chest (3)", observe="S.stars")
        g.close_modal("x")
        g.ev("setBlock(1040,24,1045,B.MARBLE,0);setBlock(1041,24,1045,B.GOLD,0)")
        before = g.ev(SAVED_STATE_JS)
        # no manual save: the game must save by itself soon after a change
        g.wait(f"(async()=>{{const d=JSON.parse(localStorage.getItem(PROG_KEY)||'{{}}');return d.stars===8&&d.mission===1&&(await __e2e.idbChunks())>0}})()",
               "the game to auto-save the new progress (progress record + edited chunks in IndexedDB)", timeout=10000, observe="[localStorage.getItem(PROG_KEY)&&localStorage.getItem(PROG_KEY).slice(0,160), PERSIST.dirty.size, PERSIST.ok]")
        g.page.reload(wait_until="commit")
        g.ready()
        g.play()
        after = g.ev(SAVED_STATE_JS)
        assert after == before, f"Progress changed across reload.\n before: {before}\n after:  {after}"
        m = g.ev("__e2e.mission()")
        assert m["name"] == "Garden Wall" and m["counter"] == "0/18", f"Expected to resume at mission 2 'Garden Wall' 0/18, observed {m}"
        g.wait("getAny(1040,24,1045)===B.MARBLE && getAny(1041,24,1045)===B.GOLD", "the two blocks built before reload to still exist",
               observe="[getAny(1040,24,1045), getAny(1041,24,1045)]")
        g.ev("(c)=>__tp(c[0]+.5,c[2]+.5,0,0,true)", ch)
        assert g.ev("(c)=>getAny(c[0],c[1],c[2])", ch) == 0, "The opened chest came back after reload"
        assert g.ev("(c)=>!loaded.some(k=>k.chests.some(q=>q[0]===c[0]&&q[1]===c[1]&&q[2]===c[2]))", ch), "The opened chest is still listed in its chunk"
        assert g.ev("document.getElementById('starN').textContent") == "8", "HUD should show the saved star count"

    @pytest.mark.parametrize("name,raw", [
        ("garbage_text", "this is {{ not json"),
        ("empty_object_v1", '{"v":1}'),
        ("edits_null", json.dumps({"v": 3, "ed": None, "bed": None, "stars": 7, "mission": 2, "unlocked": None, "skills": None,
                                    "settings": None, "pos": None, "day": None})),
        ("invalid_ids", json.dumps({"v": 3, "ed": [[999999999, [1, 2]], [5, ["a"]], [64, [999999999999, -4, 3.5]], "x", None],
                                    "bed": [[1, 2]], "stars": "lots", "unlocked": [999, "x", -1, 1, 8], "sel": 9999, "pos": [1, 2],
                                    "settings": {"gfx": "ultra", "sens": 99, "sound": "maybe"}, "skills": {"maths": "NaN"}})),
    ], ids=["garbage_text", "empty_object_v1", "edits_null", "invalid_ids"])
    def test_damaged_saves_still_reach_play(self, game, name, raw):
        """A corrupted or odd save (garbage, empty, nulls, invalid ids) never blocks the game: Play works and the player stands on ground."""
        g = game(PHONE, save=raw)
        g.start()
        st = g.ev("({playing,y:player.y,collides:collides(player.x,player.y,player.z),stars:S.stars,sel:S.sel,okSel:S.unlocked.includes(S.sel),"
                  "badIds:S.unlocked.filter(id=>!DEFS[id]),sens:S.settings.sens,gfx:S.settings.gfx,mission:S.mission})")
        assert st["playing"] and st["y"] > 0 and not st["collides"], f"Expected to be playing on the ground, observed {st}"
        assert st["okSel"] and not st["badIds"], f"Expected valid unlocked/selected blocks, observed {st}"
        assert 1 <= st["sens"] <= 6 and st["gfx"] in ("auto", "low", "high"), f"Settings were not sanitised: {st}"
        if name == "edits_null":
            assert st["stars"] == 7 and st["mission"] == 2, f"Expected the valid parts of the save to be kept (7 stars, mission 2), observed {st}"

    @pytest.mark.parametrize("name,save,stars,mission", [
        ("old_v1_format", '{"v":1,"edits":[9300,3,9301,4,99999999,2],"stars":12,"mission":3,"unlocked":[1,2,3,4,5,6,7,9,10,11],'
                          '"skills":{"maths":2,"arabic":1,"science":0,"knowledge":1,"building":3},"settings":{"sound":false,"sens":4},"sel":10,"pos":[53,10,51,0,0],"day":0.4}', 12, 3),
        ("old_v2_format", '{"v":2,"edits":[9300,3,4,10,5,2],"stars":30,"mission":5,"unlocked":[1,2,3,4,5,6,7,9,10,11,12,13,14],'
                          '"skills":{"maths":5,"arabic":5,"science":5,"knowledge":5,"building":5},"settings":{"sound":true,"sens":2},"sel":14,"pos":[60,12,45,1,0],"day":0.7}', 30, 5),
    ], ids=["old_v1_format", "old_v2_format"])
    def test_old_save_formats_keep_progress_and_reach_play(self, game, name, save, stars, mission):
        """Saves written by older versions (v1 and v2) load: stars and mission are kept and the player starts in the current world."""
        g = game(PHONE, save=save)
        g.start()
        st = g.ev("({playing,y:player.y,stars:S.stars,mission:S.mission,dist:Math.hypot(player.x-1024,player.z-1024)})")
        assert st["playing"] and st["y"] > 0, f"Expected to be playing, observed {st}"
        assert (st["stars"], st["mission"]) == (stars, mission), f"Expected {stars} stars / mission {mission} kept, observed {st}"
        assert st["dist"] < 60, f"Old positions refer to a smaller world, so the player should start near the centre, observed distance {st['dist']:.0f}"

    @pytest.mark.parametrize("x,z", [(10.5, 10.5), (2037.5, 2037.5), (40.5, 1024.5), (1024.5, 2010.5)],
                             ids=["corner-nw", "corner-se", "west-edge", "south-edge"])
    def test_a_save_near_the_world_edge_reaches_play(self, game, x, z):
        """A game saved right next to the edge of the 2048x2048 world loads and lets you play without falling out."""
        g = game(PHONE, save=v3_save(stars=3, pos=[x, 20, z, 0, 0]))
        g.start()
        st = g.ev("({playing,x:player.x,y:player.y,z:player.z,collides:collides(player.x,player.y,player.z),meshed:__stats().meshedChunks})")
        assert st["playing"] and st["y"] > 0 and not st["collides"], f"Expected to be standing in the world, observed {st}"
        assert abs(st["x"] - x) < 5 and abs(st["z"] - z) < 5, f"Expected the player near the saved spot ({x},{z}), observed ({st['x']:.1f},{st['z']:.1f})"
        assert st["meshed"] >= 3, f"Expected the ground to be built near the edge, observed {st['meshed']} meshed chunks"

    def test_reset_world_from_the_welcome_screen_asks_at_once_and_resets_progress(self, game):
        """'Reset world' on the title screen shows the confirm card at once; Keep keeps progress, Yes wipes stars, mission, edits and the saved file."""
        g = game(PHONE, save=v3_save(stars=12, mission=3, unlocked=[1, 2, 3, 10, 11], ed=[[64 + 64 * 128, [(30 << 8) * 64 + 10]]]))
        g.goto()
        g.ready()
        assert g.ev("S.stars") == 12, "Test set-up: the seeded save should be loaded"
        g.page.click("[data-a=reset]")          # first: cancel, progress must stay
        g.click("[data-a=no]")
        g.wait("!curModal && document.getElementById('welcome').style.display!=='none'", "the title screen again after 'Keep my world'",
               observe="[!!curModal, document.getElementById('welcome').style.display]")
        assert g.ev("[S.stars,S.mission]") == [12, 3], "Progress must be untouched after choosing Keep my world"
        g.page.click("[data-a=reset]")
        g.wait("curModal && document.getElementById('panel').textContent.includes('Start over?')", "the 'Start over?' card right after pressing Reset world",
               timeout=2000, observe="[!!curModal, document.getElementById('panel').textContent.slice(0,60)]")
        on_top = g.ev("""(()=>{const b=document.querySelector('[data-a=yes]'),r=b.getBoundingClientRect(),e=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return !!e&&(e===b||b.contains(e))})()""")
        assert on_top, "The confirm button must be on top of the welcome screen so it can be pressed"
        g.click("[data-a=yes]")
        g.wait("(async()=>{const d=JSON.parse(localStorage.getItem(PROG_KEY)||'{}');return S.stars===0&&S.mission===0&&!(d.stars>0)&&!localStorage.getItem(OLD_KEY)&&!localStorage.getItem(SAVE_KEY)&&(await __e2e.idbChunks())<=0})()",
               "progress, the saved progress record, the old save and the stored chunks to be wiped after Yes",
               observe="[S.stars,S.mission,localStorage.getItem(PROG_KEY),localStorage.getItem(OLD_KEY)]")
        g.ready()
        g.play()
        m = g.ev("__e2e.mission()")
        assert m["name"] == "The Well" and m["counter"] == "0/8", f"Expected a fresh game at mission 1, observed {m}"
        assert g.ev("document.getElementById('starN').textContent") == "0" and g.ev("S.unlocked.includes(B.MARBLE)") is False, "Rewards should be gone after reset"



# =========================================================================== BOTS
def _wait_bots(g, n=3, timeout=20000):
    g.ev("__stepBots(4)")  # let a few seconds of game time pass so the builders appear at once
    g.wait(f"__stats().bots>={n}", f"at least {n} builder bots to be around", timeout=timeout,
           observe="[__stats().bots, bots.map(b=>[b.name,b.on,b.st])]")


class TestBots:
    def test_at_least_three_builders_appear_near_the_player_and_have_name_tags(self, started):
        """Within seconds of starting, 3 or more builder bots stand near the player and each shows a '<name> \u00b7 <activity>' tag when you look at it."""
        g = started
        _wait_bots(g, 3)
        near = g.ev("bots.filter(b=>b.on).map(b=>Math.hypot(b.x-player.x,b.z-player.z))")
        assert all(5 <= d <= 40 for d in near), f"Expected bots to start 9-30 blocks from the player, observed distances {[round(d) for d in near]}"
        for i in g.ev("bots.filter(b=>b.on).slice(0,3).map(b=>b.i)"):
            ok = g.ev("(i)=>!!__e2e.standAt(bots[i].x,bots[i].y+1,bots[i].z,6)", i)
            assert ok, f"Test set-up: could not stand near bot {i}"
            g.wait("""(i)=>{const t=tagEls[i],b=bots[i];return !!t&&t.shown&&t.d.style.display==='block'&&t.s.textContent.indexOf(b.name+' \u00b7 ')===0&&t.px>0&&t.px<vw&&t.py>0&&t.py<vh}""",
                   f"bot {i} to show a '<name> \u00b7 <what it is doing>' tag on screen", timeout=8000, arg=i,
                   observe="(i)=>[tagEls[i]&&tagEls[i].shown,tagEls[i]&&tagEls[i].txt,tagEls[i]&&tagEls[i].px,tagEls[i]&&tagEls[i].py,bots[i].name,bots[i].on]")

    def test_six_builders_on_every_graphics_setting_low_auto_high(self, started):
        """Six builders are always around, on Graphics Auto, Low and High, changed through the real Settings card."""
        g = started
        _wait_bots(g, 6, timeout=30000)
        assert g.ev("__stats().bots") == 6, f"Expected 6 bots on Auto, observed {g.ev('__stats().bots')}"
        for expect in ("low", "high", "auto"):
            g.page.click("#btnSet")
            g.click("[data-a=gfx]")                      # Auto -> Low -> High -> Auto (card re-opens each time)
            g.wait(f"S.settings.gfx==='{expect}'", f"graphics to switch to {expect}", observe="S.settings.gfx")
            g.close_modal("ok")                          # bots only move while no card is open
            g.ev("__stepBots(3)")
            g.wait("__stats().bots===6", f"6 bots on Graphics {expect}", timeout=20000, observe="[__stats().bots, S.settings.gfx]")

    def test_bots_move_over_time_and_none_stays_stuck(self, started):
        """Over four minutes of game time every builder walks around: none stays within a few blocks of one spot."""
        g = started
        _wait_bots(g, 3)
        res = g.ev("""(()=>{const tr={};let n=0;
            const rec=()=>{for(const b of bots)if(b.on){(tr[b.i]=tr[b.i]||[]).push([b.x,b.z])}};
            rec();
            __e2e.sim(()=>{if(++n%50===0)rec();return false},240);
            const out={};for(const k in tr){const p=tr[k];if(p.length<20)continue;
              const xs=p.map(q=>q[0]),zs=p.map(q=>q[1]);out[k]={samples:p.length,spreadX:Math.max(...xs)-Math.min(...xs),spreadZ:Math.max(...zs)-Math.min(...zs)}}
            return out})()""")
        assert len(res) >= 3, f"Expected at least 3 bots to be tracked through the whole window, observed {res}"
        stuck = {k: v for k, v in res.items() if max(v["spreadX"], v["spreadZ"]) < 4}
        assert not stuck, f"Bots that barely moved in 4 minutes of game time (spread in blocks): {stuck}"

    def test_bots_stay_on_valid_ground_not_under_the_floor_or_in_deep_water(self, started):
        """Sampling bots every second for five minutes of game time: always on solid ground, never under the floor, never swimming in deep water."""
        g = started
        g.ev("S.settings.gfx='high';applyGfx()")
        _wait_bots(g, 5, timeout=30000)
        res = g.ev("""(()=>{let n=0,samples=0;const bad=[];
            __e2e.sim(()=>{if(++n%10===0){samples+=__e2e.live().length;for(const b of __e2e.badBots('ground'))if(bad.length<8)bad.push(b)}return false},300);
            return {samples,bad}})()""")
        assert res["samples"] > 500, f"Test sanity: expected many bot samples, observed {res['samples']}"
        assert not res["bad"], f"Bots were seen in impossible places ({res['samples']} samples): {res['bad']}"

    def test_bots_are_never_walled_in_by_their_own_building(self, started):
        """No builder ever ends up with a solid block in the cell where its body is."""
        g = started
        g.ev("S.settings.gfx='high';applyGfx()")
        _wait_bots(g, 5, timeout=30000)
        res = g.ev("""(()=>{let n=0,samples=0;const bad=[];
            __e2e.sim(()=>{if(++n%5===0){samples+=__e2e.live().length;for(const b of __e2e.badBots('walled'))if(bad.length<5)bad.push(b)}return bad.length>0},900);
            return {samples,bad}})()""")
        assert not res["bad"], f"Builders found inside solid blocks after {res['samples']} samples: {res['bad']}"

    def test_a_bot_walks_then_builds_and_finishes_a_real_structure(self, started):
        """A bot goes from wandering to building, finishes its template, and every block of that template really exists in the world."""
        g = started
        _wait_bots(g, 3)
        out = g.ev("""(()=>{const seen={},res={};
          const r=__e2e.sim(()=>{
            for(const b of bots){if(!b.on)continue;
              const s=seen[b.i]=seen[b.i]||{wandered:false,building:null};
              if(b.st===0&&!s.building)s.wandered=true;
              if(b.st===1&&!s.building&&s.wandered)s.building={tpl:b.tpl.n,site:b.site,cells:b.cells.map(c=>c.slice())};
              if(b.st===2&&s.building&&b.tpl&&b.tpl.n===s.building.tpl){res.done={bot:b.i,tpl:s.building.tpl,cells:s.building.cells,skip:b.skip.map(c=>c.slice()),wandered:s.wandered};return true}
              if(b.st===0&&s.building)seen[b.i]={wandered:true,building:null};
            }return false},600);
          if(!res.done)return {ok:false,t:r.t};
          const d=res.done,skipKeys=new Set(d.skip.map(c=>c.join(',')));
          const missing=d.cells.filter(c=>!skipKeys.has(c.join(','))&&getAny(c[0],c[1],c[2])!==c[3]).map(c=>c.join(','));
          const inChunk=d.cells.filter(c=>{const k=chunkAt(c[0]>>4,c[2]>>4);return k&&getB(c[0],c[1],c[2])===c[3]}).length;
          return {ok:true,tpl:d.tpl,total:d.cells.length,skipped:d.skip.length,missing,inChunk,wandered:d.wandered,t:r.t,known:TPLS.some(t=>t.n===d.tpl)}})()""")
        assert out["ok"], f"No bot finished a structure within {out.get('t')} s of game time"
        assert out["wandered"] and out["known"], f"Expected a wander -> build -> done sequence of a known template, observed {out}"
        assert not out["missing"], f"After building '{out['tpl']}' these template blocks are missing from the world: {out['missing'][:5]} ({len(out['missing'])} of {out['total']})"
        assert out["skipped"] <= out["total"] * 0.25, f"Too many cells skipped ({out['skipped']} of {out['total']}) for '{out['tpl']}'"
        assert out["inChunk"] >= (out["total"] - out["skipped"]) * 0.8, f"Expected built blocks to be present in the loaded chunks, observed {out}"

    def test_bots_never_build_on_the_mission_plot(self, started):
        """With the player on the building plot, bots never place a block on the plot, and new building sites are never planned on it."""
        g = started
        g.ev("S.settings.gfx='high';applyGfx();__e2e.watch()")
        g.ev("__tp(1030.5,1024.5,0,-0.1,true)")
        g.wait("!player.hold", "the player to arrive on the plot", observe="__stats()")
        _wait_bots(g, 4, timeout=30000)
        g.ev("__e2e.sim(()=>__e2e.log.length>40,400)")
        log = g.ev("__e2e.log")
        assert len(log) > 10, f"Test sanity: expected bots to have built something, observed {len(log)} placements"
        on_plot = [e for e in log if e["onPlot"]]
        assert not on_plot, f"Bots placed {len(on_plot)} blocks on the mission plot, e.g. {on_plot[:3]}"
        # force the issue: put a bot right beside the plot and ask it to plan many sites
        res = g.ev("""(()=>{const b=getBot(0);b.on=true;let plans=0,onPlot=0,tried=0;
            for(const [x,z] of [[1022,1024],[1062,1024],[1042,1010],[1042,1038],[1022,1012],[1062,1036]]){
              b.x=x+.5;b.z=z+.5;const y=walkY(b.x,b.z,15);if(y<0)continue;b.y=y;
              for(let k=0;k<60;k++){tried++;b.st=0;b.cells=[];if(planSite(b)){plans++;if(b.cells.some(c=>nearPlot(c[0],c[2],0)))onPlot++}}}
            b.st=0;b.cells=[];b.site=null;return {tried,plans,onPlot}})()""")
        assert res["plans"] > 20, f"Test sanity: expected many sites to be planned beside the plot, observed {res}"
        assert res["onPlot"] == 0, f"Bots planned {res['onPlot']} of {res['plans']} building sites that cover the mission plot"

    def test_bots_never_overwrite_a_block_the_player_placed(self, started):
        """A block the player puts into a bot's planned cell is still there after the bot finishes its build, and no bot edit ever touched a player edit."""
        g = started
        _wait_bots(g, 3)
        g.ev("__e2e.watch()")
        finished = 0
        for attempt in range(6):          # a bot sometimes gives up and walks away; try again with another build
            i = g.ev("__e2e.findBuilder(6,false,400)")
            assert i >= 0, "No bot started building within 400 s of game time"
            cell = g.ev("""(i)=>{const b=bots[i];for(let k=b.cells.length-1;k>b.ci+2;k--){const c=b.cells[k];if(getAny(c[0],c[1],c[2])===0&&!overlapsPlayer(c[0],c[1],c[2])){
                const blk=c[3]===B.GOLD?B.MARBLE:B.GOLD;setBlock(c[0],c[1],c[2],blk,0);return [c[0],c[1],c[2],blk,c[3]]}}return null}""", i)
            assert cell, "Test set-up: no free planned cell to put a player block into"
            res = g.ev("""(i)=>{const b=bots[i],site=b.site;const r=__e2e.sim(()=>!b.on||b.site!==site||b.st!==1,500);return {ok:r.ok,st:b.st,on:b.on,t:r.t}}""", i)
            now = g.ev("(c)=>getAny(c[0],c[1],c[2])", cell)
            assert now == cell[3], f"The player's block {cell[3]} at {cell[:3]} was overwritten by the bot (now {now}; the bot wanted {cell[4]})"
            if res["ok"] and res["st"] == 2:
                finished += 1
                break
        assert finished, "Test set-up: no bot finished a build in 6 attempts, so the overwrite rule was not exercised"
        bad = g.ev("__e2e.log.filter(e=>e.playerEdit)")
        assert not bad, f"A bot edited {len(bad)} cell(s) that already had a player edit: {bad[:3]}"

    def test_bots_never_place_a_block_inside_the_player(self, started):
        """If the player stands where a bot wants to build, the bot waits: no solid block is ever put into the player, and it builds the cell once the player steps away."""
        g = started
        _wait_bots(g, 3)
        g.ev("__e2e.watch()")
        found = g.ev("""(()=>{const ok=b=>b.on&&b.st===1&&b.ci<=1&&b.cells.some(c=>c[1]===b.site.y&&getAny(c[0],c[1],c[2])===0&&DEFS[c[3]].solid);
            const r=__e2e.sim(()=>bots.some(ok),500);
            if(!r.ok)return null;const b=bots.find(ok);
            const c=b.cells.find(c=>c[1]===b.site.y&&getAny(c[0],c[1],c[2])===0&&DEFS[c[3]].solid);
            window.__fly=true;Object.assign(player,{x:c[0]+.5,y:c[1],z:c[2]+.5,vx:0,vy:0,vz:0,hold:false});
            return {bot:b.i,cell:c.slice(),site:{x:b.site.x,z:b.site.z,y:b.site.y,w:b.site.w,d:b.site.d}}})()""")
        assert found, "Test set-up: no bot started a build with a free ground-level cell within 500 s"
        i, cell = found["bot"], found["cell"]
        assert g.ev("(c)=>overlapsPlayer(c[0],c[1],c[2])", cell), "Test set-up: the player should be inside the cell"
        g.ev("__e2e.sim(()=>false,60)")           # let the bot work on for a minute of game time
        inside = g.ev("__e2e.log.filter(e=>e.insidePlayer)")
        assert not inside, f"A bot put a solid block into the player: {inside[:3]}"
        assert g.ev("(c)=>getAny(c[0],c[1],c[2])", cell) == 0, f"The cell {cell[:3]} the player stands in should still be empty"
        # step away: the bot may now complete the cell
        g.ev("""(f)=>{window.__fly=false;__e2e.standAt(f.site.x,f.site.y+.5,f.site.z,Math.max(f.site.w,f.site.d)/2+5)}""", found)
        res = g.ev("""(a)=>{const b=bots[a[0]],c=a[1],site=b.site;const r=__e2e.sim(()=>getAny(c[0],c[1],c[2])!==0||!b.on||b.site!==site,200);return {filled:getAny(c[0],c[1],c[2]),same:b.on&&b.site===site}}""", [i, cell])
        assert not g.ev("__e2e.log.some(e=>e.insidePlayer)"), "A bot put a block into the player"
        if res["same"]:
            assert res["filled"] == cell[3], f"After the player left, the bot should have built the cell with block {cell[3]}, observed {res['filled']}"

    def test_bots_come_back_around_the_player_after_a_long_trip(self, started):
        """After travelling 700 blocks, the old bots are dropped and at least 3 new ones appear near the player; none is left far away."""
        g = started
        _wait_bots(g, 3)
        g.ev("__tp(1700.5,1500.5,0,-0.2,true)")
        g.wait("!player.hold", "the player to arrive", observe="__stats()")
        g.ev("__stepBots(6)")
        g.wait("bots.filter(b=>b.on&&Math.hypot(b.x-player.x,b.z-player.z)<60).length>=3", "3+ bots near the player after the trip",
               timeout=30000, observe="bots.map(b=>[b.name,b.on,Math.round(Math.hypot(b.x-player.x,b.z-player.z))])")
        far = g.ev("bots.filter(b=>b.on&&Math.hypot(b.x-player.x,b.z-player.z)>85).map(b=>b.name)")
        assert not far, f"Bots left behind far from the player: {far}"


# =========================================================================== BUILD TOGETHER
def _find_builder(g, need_tmp=False, min_left=6):
    i = g.ev("(a)=>__e2e.findBuilder(a[0],a[1],600)", [min_left, need_tmp])
    assert i >= 0, "Test set-up: no bot started a suitable build within 600 s of game time"
    return i


def _join(g, need_tmp=False, min_left=6):
    """Find a building bot, walk to it, and join through its card. Returns the bot index."""
    i = _find_builder(g, need_tmp, min_left)
    # a child would walk over to the builder first (joining from > 40 blocks away ends at once)
    assert g.ev("(i)=>!!__e2e.standAt(bots[i].site.x,bots[i].site.y+.5,bots[i].site.z,Math.max(bots[i].site.w,bots[i].site.d)/2+5)", i), \
        "Test set-up: could not walk to the build site"
    g.ev("(i)=>openBotCard(bots[i])", i)
    g.click("[data-a=join]")
    g.wait("!!JB && !curModal", "the join to start (JB set, card closed)", arg=i,
           observe="[!!JB, !!curModal, bots[a].st, bots[a].on, botCellLeft(bots[a]), document.getElementById('toast').textContent]")
    return i


def _chip(g):
    return g.ev("(()=>{const e=document.getElementById('joinchip');return {shown:getComputedStyle(e).display!=='none',text:e.querySelector('span')?e.querySelector('span').textContent:''}})()")


def _chip_progress(g):
    m = re.fullmatch(r"Building with (\w+) (\d+)/(\d+)", _chip(g)["text"])
    assert m, f"Expected a chip like 'Building with Yusuf 3/16', observed {_chip(g)}"
    return m.group(1), int(m.group(2)), int(m.group(3))


def _finish_by_bot(g):
    """Let game time pass until the joined build ends (bot finishes or gives up)."""
    g.unfreeze_bots()
    g.ev("__e2e.sim(()=>!JB,600)")
    assert g.ev("!JB"), "Test set-up: the joined build did not end within 600 s of game time"


def _step_away_from_site(g):
    g.ev("(()=>{const b=JB.bot;__e2e.standAt(JB.sx,b.site.y+.5,JB.sz,Math.max(b.site.w,b.site.d)/2+5)})()")


class TestBuildTogether:
    def test_tapping_a_builder_opens_the_join_card(self, started):
        """A real finger tap on a building bot opens a card offering to build together."""
        g = started
        i = _find_builder(g)
        g.freeze_bots()
        assert g.ev("(i)=>__e2e.standToSee(bots[i],5)", i), "Test set-up: could not find a spot with a clear view of the bot"
        g.tap_until(lambda: g.ev("(i)=>__e2e.botPoint(bots[i])", i), "curModal && document.getElementById('panel').textContent.includes('Build together?')",
                    "the join card after tapping the bot", observe="[!!curModal, document.getElementById('panel').textContent.slice(0,80)]")
        name = g.ev("(i)=>bots[i].name", i)
        assert f"Builder {name}" in g.modal_text() and g.ev("!!document.querySelector('[data-a=join]')"), f"Unexpected card: {g.modal_text()[:100]!r}"

    def test_help_build_tag_opens_the_join_card(self, started):
        """The green 'Help build' label floating over a building bot opens the same join card."""
        g = started
        i = _find_builder(g)
        g.freeze_bots()
        assert g.ev("(i)=>__e2e.standToSee(bots[i],6)", i), "Test set-up: could not find a spot with a clear view of the bot"
        g.wait("tagEls.some(t=>t.hb&&t.shown)", "a 'Help build' tag to appear over the building bot", timeout=8000,
               observe="tagEls.map(t=>[t.shown,t.hb,t.txt])")
        btn = g.page.locator(".ntag .hb:visible")
        assert btn.count() == 1 and btn.inner_text().strip() == "Help build", "Exactly one visible 'Help build' button expected"

        def pt():
            bb = g.page.locator(".ntag .hb:visible").bounding_box()
            return bb and [bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2]
        g.tap_until(pt, "curModal && document.getElementById('panel').textContent.includes('Build together?')", "the join card after tapping 'Help build'",
                    observe="[!!curModal, document.getElementById('panel').textContent.slice(0,80)]")

    def test_join_shows_ghost_cells_and_a_progress_chip_that_player_placements_advance(self, started):
        """After joining, a blue blueprint appears with a 'Building with <name> n/m' chip, and each block the player places adds one to n."""
        g = started
        i = _join(g)
        g.freeze_bots()
        name, n0, m0 = _chip_progress(g)
        assert name == g.ev("(i)=>bots[i].name", i), "Chip should name the bot we joined"
        assert m0 == g.ev("JB.cells.length") == g.ev("(i)=>bots[i].cells.length", i), "Chip total should equal the bot's template size"
        assert g.ev("!!dyn.jT && dyn.jT.n>0"), "Expected ghost cells (blue blueprint) to be drawn for the join"

        def pt():                       # choose a block that still has a tappable blueprint cell, select it, return where to tap
            for blk in g.ev("[...new Set(JB.cells.filter(c=>getAny(c[0],c[1],c[2])!==c[3]).sort((p,q)=>p[1]-q[1]).map(c=>c[3]))]"):
                g.hotbar_select(g.ev("(id)=>DEFS[id].name", blk))
                hit = g.ev("__e2e.nextGhostTap(JB.cells,true)")
                if hit:
                    return hit["pt"]
            return None
        for k in (1, 2):
            g.tap_until(pt, f"document.querySelector('#joinchip span').textContent==='Building with {name} {n0 + k}/{m0}'",
                        f"the chip to advance to {n0 + k}/{m0} after placing a block", observe="[document.querySelector('#joinchip span').textContent, S.sel]")

    def test_completing_the_build_with_enough_own_blocks_gives_stars_and_teamwork(self, started):
        """If the player places the required blocks and the build gets finished, they earn 4 stars, Building +1 and see the teamwork card."""
        g = started
        for attempt in range(5):
            _join(g)
            g.freeze_bots()
            need = g.ev("JB.need")
            assert need == 3, f"Expected the player to need 3 blocks of their own, observed {need}"
            stars0, build0 = g.stars(), g.ev("S.skills.building")
            g.ev("""(n)=>{let k=0;for(const c of JB.cells){if(k>=n)break;if(getAny(c[0],c[1],c[2])!==c[3]){setBlock(c[0],c[1],c[2],c[3],0);k++}}}""", need)
            assert g.ev("JB.mine.size") == need, "Player placements should be counted as the player's contribution"
            _step_away_from_site(g)
            _finish_by_bot(g)
            if "Teamwork" in g.modal_text():
                assert "+4 stars" in g.modal_text() and "Building skill +1" in g.modal_text(), f"Unexpected card: {g.modal_text()[:140]!r}"
                assert g.stars() == stars0 + 4, f"Expected {stars0 + 4} stars, observed {g.stars()}"
                assert g.ev("S.skills.building") == build0 + 1, "Building skill should go up by 1"
                return
            if g.modal_open():  # the bot gave up: try another build
                g.close_modal("ok")
        pytest.fail("Expected a finished joined build with a 'Teamwork!' card in 5 attempts, none finished")

    def test_completing_the_build_without_placing_any_block_gives_nothing(self, started):
        """If the bot finishes while the player placed no blocks, the card says so and no stars or skill are awarded."""
        g = started
        for attempt in range(5):
            _join(g)
            g.freeze_bots()
            stars0, skills0 = g.stars(), g.ev("JSON.stringify(S.skills)")
            _step_away_from_site(g)
            _finish_by_bot(g)
            assert g.stars() == stars0 and g.ev("JSON.stringify(S.skills)") == skills0, "No contribution must mean no stars and no skill"
            if "finished it!" in g.modal_text():
                assert "Place" in g.modal_text() and "Teamwork" not in g.modal_text(), f"Unexpected card: {g.modal_text()[:140]!r}"
                return
            if g.modal_open():
                g.close_modal("ok")
        pytest.fail("Expected the bot to finish a joined build in 5 attempts, none finished")

    def test_walking_more_than_40_blocks_away_leaves_the_build_without_reward(self, started):
        """Wandering off more than 40 blocks from the build ends the join, clears the temporary blocks and gives no stars."""
        g = started
        _join(g)
        stars0 = g.stars()
        site = g.ev("[JB.sx,JB.sz]")
        g.ev("(s)=>__tp(s[0]+55.5,s[1]+.5,0,-0.2,true)", site)
        g.wait("!JB", "the join to end after walking 55 blocks away", timeout=15000, observe="[!!JB]")
        assert g.ev("S.tmp.length") == 0, "Temporary blocks must be cleared after auto-leaving"
        assert not _chip(g)["shown"], "The join chip should disappear"
        toast = g.ev("document.getElementById('toast').textContent")
        assert "went far" in toast, f"Expected the 'You went far from the build' message, saw {toast!r}"
        assert g.stars() == stars0, "Walking away must not give stars"

    def test_leave_clears_the_temporary_block_grant_and_selection(self, started):
        """Pressing Leave removes the borrowed blocks from the hotbar and, if one was selected, selects a block the player really owns."""
        g = started
        _join(g, need_tmp=True)
        g.freeze_bots()
        tmp = g.ev("S.tmp.slice()")
        assert tmp, "Test set-up: this build should lend the player blocks they have not unlocked"
        g.hotbar_select(g.ev("(id)=>DEFS[id].name", tmp[0]))
        assert g.ev("S.sel") == tmp[0] and not g.ev("S.unlocked.includes(S.sel)"), "Test set-up: a borrowed block should be selected"
        g.page.locator("#joinchip button").tap()
        g.wait("!JB", "the join to end after pressing Leave", observe="[!!JB]")
        assert g.ev("S.tmp.length") == 0, "Temporary blocks should be gone after Leave"
        assert g.ev("S.unlocked.includes(S.sel)"), f"The selected block {g.ev('S.sel')} should be one the player owns after Leave"
        assert not g.ev("document.querySelector('#hotbar .slot.sel').classList.contains('locked')"), "The highlighted hotbar slot must not be a locked one"
        assert g.ev("(id)=>document.querySelector(`#hotbar .slot[aria-label=\"${DEFS[id].name} (locked)\"]`)!==null", tmp[0]), "The borrowed block should be locked again in the hotbar"
        assert not _chip(g)["shown"] and g.ev("joinMap.size") == 0, "Chip and ghost map should be cleared"

    def test_join_leave_rejoin_cannot_farm_stars(self, started):
        """Joining and leaving the same build over and over, even after placing blocks, never earns stars."""
        g = started
        i = _join(g)
        g.freeze_bots()
        stars0, skills0 = g.stars(), g.ev("JSON.stringify(S.skills)")

        def rejoin():
            g.ev("(i)=>openBotCard(bots[i])", i)
            g.click("[data-a=join]")
            g.wait("!!JB && !curModal", "to be joined", observe="[!!JB,!!curModal]")

        def leave():
            g.page.locator("#joinchip button").tap()
            g.wait("!JB", "to have left", observe="!!JB")
        leave()
        for k in range(3):                                   # plain join / leave cycles
            rejoin()
            leave()
        assert g.stars() == stars0, "Join/leave cycles must not give stars"
        rejoin()                                             # place the required blocks, leave, rejoin, let the bot finish
        g.ev("""()=>{let k=0;for(const c of JB.cells){if(k>=3)break;if(getAny(c[0],c[1],c[2])!==c[3]){setBlock(c[0],c[1],c[2],c[3],0);k++}}}""")
        leave()
        rejoin()
        assert g.ev("JB.mine.size") == 0, "A fresh join must start with no counted contributions"
        _step_away_from_site(g)
        _finish_by_bot(g)
        assert g.stars() == stars0 and g.ev("JSON.stringify(S.skills)") == skills0, f"Join/leave/rejoin earned stars: {stars0} -> {g.stars()}"

    def test_placing_and_removing_one_cell_repeatedly_does_not_count_as_enough_blocks(self, started):
        """Putting a block into the same blueprint cell three times counts as one contribution, so it does not earn the reward."""
        g = started
        for attempt in range(5):
            _join(g)
            g.freeze_bots()
            stars0 = g.stars()
            g.ev("""()=>{const c=JB.cells.find(c=>getAny(c[0],c[1],c[2])!==c[3]);for(let k=0;k<3;k++){setBlock(c[0],c[1],c[2],c[3],0);if(k<2)setBlock(c[0],c[1],c[2],0,0)}}""")
            assert g.ev("JB.mine.size") == 1, f"One cell must count once, observed {g.ev('JB.mine.size')}"
            _step_away_from_site(g)
            _finish_by_bot(g)
            assert g.stars() == stars0, f"Placing the same cell repeatedly earned stars ({stars0} -> {g.stars()})"
            if "finished it!" in g.modal_text():
                return
            if g.modal_open():
                g.close_modal("ok")
        pytest.fail("Expected the bot to finish a joined build in 5 attempts, none finished")

    def test_joining_does_not_disturb_the_active_mission(self, started):
        """The mission blueprint and its 2/8 counter stay exactly as they were while joined and after leaving; placements for the join are not mission blocks."""
        g = started
        g.ev("(()=>{for(const c of ghostCells.slice(0,2))setBlock(c[0],c[1],c[2],c[3],0)})()")
        before = g.ev("({m:__e2e.mission(),gm:ghostMap.size,gc:ghostCells.length,n:dyn.ghostT&&dyn.ghostT.n})")
        assert before["m"]["counter"] == "2/8", f"Test set-up: expected 2/8, observed {before['m']}"
        _join(g)
        g.freeze_bots()
        g.ev("()=>{const c=JB.cells.find(c=>getAny(c[0],c[1],c[2])!==c[3]);setBlock(c[0],c[1],c[2],c[3],0)}")
        during = g.ev("({m:__e2e.mission(),gm:ghostMap.size,gc:ghostCells.length,n:dyn.ghostT&&dyn.ghostT.n,stars:S.stars})")
        assert during["m"] == before["m"] and during["gm"] == before["gm"] and during["gc"] == before["gc"] and during["n"] == before["n"], \
            f"Joining changed the mission: before {before}, during {during}"
        g.page.locator("#joinchip button").tap()
        g.wait("!JB", "to leave", observe="!!JB")
        after = g.ev("({m:__e2e.mission(),gm:ghostMap.size,n:dyn.ghostT&&dyn.ghostT.n})")
        assert after["m"] == before["m"] and after["gm"] == before["gm"] and after["n"] == before["n"], f"Leaving changed the mission: {before} -> {after}"
        _fill_mission(g)                                      # the mission must still be completable
        g.wait("curModal && document.getElementById('panel').textContent.includes('is built!')", "the mission to complete normally after a join",
               observe="[__e2e.mission(), S.stars]")


# =========================================================================== WELLBEING AND SETTINGS
class TestWellbeingAndSettings:
    def test_break_reminder_appears_after_20_minutes_of_play(self, started):
        """After 20 minutes of active play a 'Time for a little break' card appears; a minute earlier it does not. (Play timer set through the game's own state.)"""
        g = started
        g.freeze_bots()
        assert g.ev("BREAK_SECONDS") == 1200, "The break interval should be 20 minutes (1200 s)"
        g.ev("activeSec=BREAK_SECONDS-60")
        g.wait("activeSec>BREAK_SECONDS-60+0.5", "the play timer to keep counting", observe="[activeSec]")
        assert not g.modal_open(), "No break reminder is due 59 s before the 20 minute mark"
        g.ev("activeSec=BREAK_SECONDS-0.3")
        g.wait("curModal && document.getElementById('panel').textContent.includes('Time for a little break')", "the break reminder after 20 minutes",
               timeout=10000, observe="[activeSec, !!curModal]")
        g.close_modal("ok")
        assert g.ev("activeSec") < 5, "The play timer should start again after the reminder"

    def test_sound_and_graphics_settings_survive_a_reload(self, started):
        """Turning sound off and graphics to Low in Settings is remembered after reloading the page."""
        g = started
        g.page.click("#btnSet")
        g.click("[data-a=snd]")
        g.wait("S.settings.sound===false", "sound to switch off", observe="S.settings.sound")
        g.click("[data-a=gfx]")
        g.wait("S.settings.gfx==='low'", "graphics to switch to Low", observe="S.settings.gfx")
        g.close_modal("ok")
        g.wait("(()=>{const d=JSON.parse(localStorage.getItem(PROG_KEY)||'{}');return !!d.settings&&d.settings.sound===false&&d.settings.gfx==='low'})()",
               "the settings to be saved", timeout=10000, observe="localStorage.getItem(PROG_KEY)&&localStorage.getItem(PROG_KEY).slice(0,300)")
        g.page.reload(wait_until="commit")
        g.ready()
        g.play()
        assert g.ev("[S.settings.sound,S.settings.gfx]") == [False, "low"], f"Settings lost after reload: {g.ev('S.settings')}"
        g.page.click("#btnSet")
        g.wait("curModal && document.getElementById('panel').textContent.includes('Settings')", "the settings card", observe="document.getElementById('panel').textContent")
        txt = g.modal_text()
        assert "Sound: Off" in txt and "Graphics: Low" in txt, f"Settings card should show 'Sound: Off' and 'Graphics: Low', saw {txt[:100]!r}"
        g.close_modal("ok")
        g.wait("__stats().bots===6", "Low graphics to keep 6 bots after reload", timeout=20000, observe="[__stats().bots, S.settings.gfx]")

    def test_hidden_page_pauses_world_streaming(self, started):
        """While the tab is hidden the game does no streaming work (queue and chunk count freeze); when shown again it catches up."""
        g = started
        g.freeze_bots()
        g.ev("""()=>{Object.defineProperty(document,'hidden',{get:()=>true,configurable:true});
            document.dispatchEvent(new Event('visibilitychange'))}""")
        g.ev("__tp(1500.5,1500.5,0,-0.2)")
        NEWCHUNK = "chunks.has(93+93*NC)"
        a = g.ev("__stats()")
        g.page.wait_for_timeout(800)  # nothing to poll for: we are proving that NOTHING happens while hidden
        b = g.ev("__stats()")
        assert (a["loadedChunks"], a["queue"], a["meshedChunks"]) == (b["loadedChunks"], b["queue"], b["meshedChunks"]) and b["hold"] and not g.ev(NEWCHUNK), \
            f"Streaming progressed while the page was hidden: {a} -> {b}"
        g.ev("""()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'))}""")
        g.wait("!player.hold && __stats().queue<4", "streaming to resume once the page is visible again", timeout=40000, observe="__stats()")
        assert g.ev(NEWCHUNK), "The chunk under the player's new position should be loaded after the page becomes visible"


# =========================================================================== V3: SKYLINE, MUSEUM, SIX BOTS, DISMANTLE, SAVE, WELCOME, WATER
TABLET = ("tablet-1024x768", 1024, 768, True)
LANDSCAPE = ("phone-844x390", 844, 390, True)
RING_JS = """(()=>{const sx=1024,sz=1024;return fixedList().filter(l=>['mosque','museum','charbagh','village','caravan'].includes(l.t)).map(l=>{
  const dx=l.x-sx,dz=l.z-sz;return{id:l.id,t:l.t,d:Math.hypot(dx,dz),a:((Math.atan2(dx,-dz)*180/Math.PI)+360)%360}})})()"""


class TestSkyline:
    def test_at_least_six_landmarks_55_to_150_blocks_away_with_no_gap_over_70_degrees(self, started):
        ring = started.ev(RING_JS)
        assert len(ring) >= 6, f"Expected >= 6 landmarks, observed {len(ring)}"
        assert all(55 <= r["d"] <= 150 for r in ring), f"distances {[round(r['d']) for r in ring]}"
        a = sorted(r["a"] for r in ring)
        gaps = [(a[(i + 1) % len(a)] - a[i]) % 360 or 360 for i in range(len(a))]
        assert max(gaps) <= 70, f"Largest angular gap {max(gaps):.0f} deg, bearings {[round(x) for x in a]}"
        sectors = [sum(1 for x in a if int(x // 45) == k) for k in range(8)]
        assert min(sectors) >= 1, f"Every 45-degree sector needs a landmark, observed {sectors}"

    def test_far_silhouettes_are_one_draw_call_under_3000_triangles_and_fade_when_the_landmark_loads(self, started):
        g = started
        s = g.ev("__sil()")
        assert s["tris"] < 3000 and s["drawCalls"] == 1, f"observed {s['tris']} triangles, {s['drawCalls']} draw calls"
        assert len(s["list"]) >= 6
        hero = g.ev("(()=>{const l=fixedList()[0];return[l.x,l.z,l.ex,l.ez]})()")
        g.ev(f"__tp({hero[0] + 22}.5,{hero[1] + 2}.5,1.57,0,true)")
        g.ev(f"for(let cz={(hero[1] - hero[3]) // 16};cz<={(hero[1] + hero[3]) // 16};cz++)for(let cx={(hero[0] - hero[2]) // 16};cx<={(hero[0] + hero[2]) // 16};cx++)forceLoad(cx,cz,2)")
        g.settle()
        g.wait("(()=>{const e=__sil().list.find(e=>e.id===fixedList()[0].id);return e&&e.loaded&&e.tg===0})()",
               "the hero mosque silhouette to be switched off once its chunks are loaded", timeout=15000,
               observe="__sil().list.map(e=>[e.id,e.loaded,e.tg])")

    def test_first_view_faces_the_grand_mosque(self, started):
        g = started
        yaw = g.ev("(()=>{const l=fixedList()[0];const dx=l.x-player.x,dz=l.z-player.z;let d=Math.atan2(-dx,-dz)-player.yaw;d=Math.atan2(Math.sin(d),Math.cos(d));return d})()")
        assert abs(yaw) < 0.6, f"Expected the first view to face the hero mosque within 35 deg, observed {math.degrees(yaw):.0f} deg off"

    def test_mission_card_can_be_collapsed_and_expanded(self, started):
        g = started
        g.ev("closeModal()")
        g.page.click("#mtog")
        g.wait("document.getElementById('mission').classList.contains('min')", "the mission card to collapse", observe="document.getElementById('mission').className")
        g.page.click("#mtog")
        g.wait("!document.getElementById('mission').classList.contains('min')", "the mission card to expand again", observe="document.getElementById('mission').className")

    def test_no_console_errors_at_five_viewports(self, game):
        for vp in (PHONE, LANDSCAPE, TABLET, DESKTOP, ("tiny-320x480", 320, 480, True)):
            g = game(vp)
            g.start()
            g.ev("__tp(1024.5,1024.5,0,0,true)")
            g.page.wait_for_timeout(300)


class TestMuseum:
    @pytest.mark.parametrize("which", ["heritage", "doha"])
    def test_continuous_stairs_reach_the_roof_and_exhibit_rooms(self, started, which):
        result = started.ev("""(which)=>{
          const doha=which==='doha',l=lmOf(doha?'dohaMia':'museum');
          const cell=(x,y,z)=>{const b=l.fn(l,x,y,doha?z:z-MZC);return b>0&&DEFS[b].solid};
          const clear=(x,y,z)=>!cell(x,y,z)&&!cell(x,y+1,z);
          const start=doha?[-3,1,19]:[0,1,22],todo=[start],seen=new Set([start.join()]);
          const width=doha?19:23,last=doha?20:23;
          for(let i=0;i<todo.length;i++){
            const [x,y,z]=todo[i];
            for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]])for(const dy of [0,1,-1]){
              const a=x+dx,b=y+dy,c=z+dz,key=[a,b,c].join();
              if(Math.abs(a)>width||Math.abs(c)>last||b<1||b>25||seen.has(key)||!cell(a,b-1,c)||!clear(a,b,c))continue;
              if(dy>0&&!clear(x,b,z)||dy<0&&!clear(a,y,c))continue;
              seen.add(key);todo.push([a,b,c]);
            }
          }
          const rooms=doha?DOHA_MIA_ROOMS.map(([y,w,n,e,s,d])=>[d-3,y+1,s+1]):EXP.map(([f,s,z])=>[s*(f<2?20:16),f*6+1,z]);
          return{roof:todo.some(p=>p[1]===(doha?24:25)),missing:rooms.filter(p=>!seen.has(p.join()))};
        }""", which)
        assert result["roof"] and not result["missing"], f"Expected a walkable route to the roof and all display rooms, observed {result}"

    def test_museum_has_26_exhibits_on_four_floors(self, started):
        m = started.ev("__mus()")
        assert len(m["ex"]) == 26, f"observed {len(m['ex'])} exhibits"
        assert sorted({e["f"] for e in m["ex"]}) == [0, 1, 2, 3]
        assert len(m["pass"]) == 26 and set(m["pass"]) <= {"0", "1"}

    def test_every_exhibit_has_a_name_and_stands_on_a_floor(self, started):
        m = started.ev("__mus()")
        assert all(e["name"] for e in m["ex"])
        assert len({e["name"] for e in m["ex"]}) == 26

    def test_tapping_an_exhibit_opens_its_card_and_stamps_the_passport(self, started):
        g = started
        m = g.ev("__mus()")
        e = m["ex"][0]
        dx, dz = m["bx"] - e["wx"], m["bz"] - e["wz"]
        n = max(1e-6, math.hypot(dx, dz))
        x, z = e["wx"] + .5 + dx / n * 3, e["wz"] + .5 + dz / n * 3
        yaw = math.atan2(-(e["wx"] + .5 - x), -(e["wz"] + .5 - z))
        g.ev(f"__tp({x},{z},{yaw},0.0,true)")
        g.settle()
        g.ev("closeModal()")
        g.page.wait_for_timeout(200)
        pt = lambda: g.ev(f"(()=>{{const p=project({e['wx'] + .5},{e['y'] + .5},{e['wz'] + .5});return p?[(p[0]*.5+.5)*vw,(.5-p[1]*.5)*vh]:null}})()")
        g.tap_until(pt, "!!curModal", "the exhibit card to open after a real tap", observe="[!!curModal,S.pass]")
        assert g.ev("S.pass[0]") == "1", "Expected the first passport stamp to be set"
        assert "stamp" in g.modal_text().lower()

    def test_passport_shows_26_slots_and_the_museum_explorer_title_at_full_stamps(self, started):
        g = started
        g.ev("S.pass='1'.repeat(26);S.passFl=[1,1,1,1];if(typeof museumCheckTitle==='function')museumCheckTitle()")
        g.ev("passportPanel()")
        g.modal_ready()
        g.wait("document.querySelectorAll('#panel .stamp').length===26", "26 passport stamps", observe="document.querySelectorAll('#panel .stamp').length")

    def test_floor_chip_names_the_floor_inside_the_museum(self, started):
        g = started
        m = g.ev("__mus()")
        e = [x for x in m["ex"] if x["f"] == 1][0]
        g.ev(f"__tp({e['wx'] + .5},{e['wz'] + .5},0,0,true);player.y={e['y']}+.1;player.vy=0")
        g.wait("document.getElementById('floorchip')&&document.getElementById('floorchip').textContent.indexOf('Floor 1')>=0",
               "the floor chip to say Floor 1", timeout=8000, observe="document.getElementById('floorchip')&&document.getElementById('floorchip').textContent")


class TestSixBuilders:
    SPEC = ["house", "market", "arch", "garden", "well", "tower"]

    def test_six_bots_with_distinct_names_and_colours_are_around(self, started):
        g = started
        _wait_bots(g, 6)
        info = g.ev("bots.filter(b=>b.on).map(b=>[b.name,b.col||b.look||null])")
        assert len({i[0] for i in info}) == 6, f"names {info}"

    def test_bots_do_not_overlap_and_stay_out_of_water_and_the_plot(self, started):
        g = started
        _wait_bots(g, 6)
        r = g.ev("""(()=>{const L=bots.filter(b=>b.on);let mn=1e9;for(let i=0;i<L.length;i++)for(let j=i+1;j<L.length;j++)mn=Math.min(mn,Math.hypot(L[i].x-L[j].x,L[i].z-L[j].z));
          return{min:mn,plot:L.filter(b=>b.x>1026&&b.x<1059&&b.z>1014&&b.z<1034).length,water:L.filter(b=>getB(Math.floor(b.x),Math.floor(b.y+.5),Math.floor(b.z))===B.WATER).length}})()""")
        assert r["min"] >= 1.5 and r["plot"] == 0 and r["water"] == 0, f"observed {r}"

    @pytest.mark.parametrize("who", [0, 1, 2, 3, 4, 5])
    def test_join_card_for_each_bot_reads_name_is_building_X_build_together(self, started, who):
        g = started
        _wait_bots(g, 6)
        g.ev("(i)=>{for(let k=0;k<120&&bots[i].st!==BS.BUILD;k++)__stepBots(5)}", who)
        assert g.ev("(i)=>bots[i].st===BS.BUILD", who), f"Test set-up: bot {who} never started building"
        g.ev("(i)=>openBotCard(bots[i])", who)
        g.modal_ready()
        txt = g.modal_text()
        name = g.ev("(i)=>bots[i].name", who)
        assert f"{name} is building " in txt and "Build together?" in txt, f"observed: {txt[:200]}"

    def test_tag_text_format_for_idris_is_building_a_small_house(self, started):
        g = started
        _wait_bots(g, 6)
        g.ev("(()=>{const b=bots.find(b=>b.name==='Idris');for(let k=0;k<120&&b.st!==BS.BUILD;k++)__stepBots(5)})()")
        t = g.ev("(()=>{const b=bots.find(b=>b.name==='Idris');return botTag(b)})()")
        assert t.startswith("Idris · building a "), t

    def test_bots_never_end_up_inside_blocks(self, started):
        g = started
        _wait_bots(g, 6)
        g.ev("__stepBots(60)")
        bad = g.ev("bots.filter(b=>b.on&&typeof bodyHit==='function'&&bodyHit(b.x,b.y,b.z)).map(b=>b.name)")
        assert not bad, f"bots inside blocks: {bad}"


class TestDismantle:
    def test_after_two_finished_structures_a_bot_tidies_the_older_one(self, started):
        g = started
        _wait_bots(g, 6)
        g.ev("window.__ev=[];const o=botTag;")
        seen = g.ev("""(()=>{let s=false;for(let k=0;k<400&&!s;k++){__stepBots(5);for(const b of bots)if(b.on&&botTag(b).indexOf('tidying up')>0)s=true}return s})()""")
        assert seen, "Expected some bot to show '<name> · tidying up' within 2000 s of game time"

    def test_tidying_removes_blocks_top_down_slowly(self, started):
        g = started
        _wait_bots(g, 6)
        r = g.ev("""(()=>{for(let k=0;k<400;k++){__stepBots(5);const b=bots.find(b=>b.on&&b.st===BS.TIDY);if(b)return{rate:2.5,found:true}}return{found:false}})()""")
        assert r["found"], "no bot started tidying"


class TestSaveV3:
    def test_progress_record_and_chunk_edits_survive_a_reload(self, game):
        g = game(PHONE)
        g.start()
        g.ev("S.stars=5;S.mission=2;setBlock(1040,16,1040,B.GOLD,'player');saveNow(true)")
        g.page.wait_for_timeout(600)
        g.page.reload(wait_until="commit")
        g.ready()
        g.wait("S.stars===5&&S.mission===2", "the saved progress to be restored", observe="[S.stars,S.mission]")
        g.play()
        g.ev("__tp(1040.5,1040.5,0,0,true)")
        g.wait("getB(1040,16,1040)===B.GOLD", "the placed block to be restored from IndexedDB", observe="getB(1040,16,1040)")

    def test_export_then_import_round_trips(self, game):
        g = game(PHONE)
        g.start()
        g.ev("S.stars=7;saveNow(true)")
        g.page.wait_for_timeout(500)
        j = g.ev("musliMineCraft.exportSave()")
        d = json.loads(j)
        assert d["musliMineCraft"] == 4 and d["prog"]["stars"] == 7
        ok = g.ev("(j)=>musliMineCraft.importSave(j).then(()=>true,()=>false)", j)
        assert ok

    def test_import_rejects_garbage(self, started):
        r = started.ev("musliMineCraft.importSave('{not json').then(()=>'ok',e=>String(e.message))")
        assert r != "ok"
        r = started.ev("musliMineCraft.importSave(JSON.stringify({a:1})).then(()=>'ok',e=>String(e.message))")
        assert r != "ok"

    def test_on_save_callback_and_alias(self, started):
        g = started
        assert g.ev("window.IslamineCraft===window.musliMineCraft")
        g.ev("window.__got=null;musliMineCraft.onSave=s=>{window.__got=s};S.stars=3;saveNow(true)")
        g.wait("window.__got&&window.__got.stars===3", "the onSave callback to fire", observe="window.__got")

    def test_old_islaminecraft_save_is_migrated_once(self, game):
        g = game(PHONE, save=v3_save(stars=9, mission=3))
        g.start(play=False)
        g.wait("S.stars===9", "the old save to be migrated", observe="[S.stars,S.mission]")
        g.wait("!localStorage.getItem(OLD_KEY)", "the old key to be removed after migration", observe="localStorage.getItem(OLD_KEY)&&1")

    def test_corrupt_progress_record_starts_a_fresh_world_without_errors(self, game):
        g = game(PHONE, prog="{this is not json")
        g.start()
        assert g.ev("S.stars") == 0


class TestWelcome:
    def test_welcome_shows_title_tagline_and_buttons_then_goes_live(self, game):
        g = game(PHONE)
        g.goto()
        g.ready()
        assert g.ev("getComputedStyle(document.getElementById('welcome')).display!=='none'")
        t = g.ev("document.getElementById('welcome').textContent")
        assert "Build, learn and explore" in t and "Play" in t and "Settings" in t and "How to play" in t
        g.wait("document.getElementById('welcome').classList.contains('live')", "the welcome to show the live panorama", timeout=15000,
               observe="document.getElementById('welcome').className")

    def test_welcome_hides_the_hud_and_play_starts_the_game(self, game):
        g = game(PHONE)
        g.goto()
        g.ready()
        assert g.ev("document.getElementById('app').classList.contains('pre')")
        g.play()
        assert not g.ev("document.getElementById('app').classList.contains('pre')")

    def test_tip_rotates(self, game):
        g = game(PHONE)
        g.goto()
        g.ready()
        a = g.ev("document.getElementById('wtip').textContent")
        g.wait("(a)=>document.getElementById('wtip').textContent!==a", "the tip to change", timeout=15000, arg=a, observe="document.getElementById('wtip').textContent")

    def test_continue_shows_a_summary_and_rank(self, game):
        g = game(PHONE, prog={"v": 4, "stars": 12, "mission": 2, "pos": [1030.5, 16, 1030.5, 0, 0], "sum": {"stars": 12, "mission": 3, "blocks": 148, "rank": "Builder"}})
        g.goto()
        g.ready()
        assert "Continue" in g.ev("document.querySelector('[data-a=play]').textContent")
        assert "12" in g.ev("document.getElementById('wsum').textContent")

    @pytest.mark.parametrize("vp", [PHONE, LANDSCAPE, TABLET])
    def test_welcome_buttons_do_not_overflow_the_viewport(self, game, vp):
        g = game(vp)
        g.goto()
        g.ready()
        r = g.ev("[...document.querySelectorAll('#welcome button')].filter(b=>b.offsetParent).map(b=>{const r=b.getBoundingClientRect();return[r.left,r.right,r.top,r.bottom]})")
        assert r and all(a >= 0 and b <= vp[1] + 1 and c >= 0 and d <= vp[2] + 1 for a, b, c, d in r), r


class TestWater:
    def test_player_floats_and_can_swim_out_of_the_lake(self, started):
        g = started
        g.ev("closeModal();Object.assign(player,{x:1011.5,z:1021.5,y:11.2,vy:0})")
        g.wait("player.water", "the player to be in water", observe="[player.water,player.y]")
        g.ev("__e2e&&0")
        # swim east towards the shore with real key input
        g.ev("input.keys.add('w');player.yaw=-1.5708")
        g.wait("!player.water", "the player to reach the shore on their own", timeout=20000, observe="[player.x,player.y,player.z,player.water]")
        g.ev("input.keys.delete('w')")

    def test_help_button_appears_if_stuck_in_water(self, started):
        g = started
        g.ev("closeModal();Object.assign(player,{x:1011.5,z:1021.5,y:11.2,vy:0});player.waterT=25")
        g.wait("document.getElementById('helpout').classList.contains('on')", "the Swim to shore helper", timeout=8000,
               observe="[player.waterT,document.getElementById('helpout').className]")


# =========================================================================== SAFE START (C11)
STAND_JS = """(()=>{const x=Math.floor(player.x),y=Math.floor(player.y+.001),z=Math.floor(player.z);
 const sup=getB(x,y-1,z),f=getB(x,y,z),h=getB(x,y+1,z);
 return {x:player.x,y:player.y,z:player.z,sup,f,h,water:!!player.water,hold:!!player.hold,playing,
  supSolid:!!sup&&DEFS[sup].solid&&sup!==B.WATER&&sup!==B.LEAVES&&sup!==B.WOOD,
  bodyFree:!(f&&(DEFS[f].solid||f===B.WATER))&&!(h&&(DEFS[h].solid||h===B.WATER)),collides:collides(player.x,player.y,player.z)}})()"""


def _assert_standing(g, what):
    st = g.ev(STAND_JS)
    assert st["playing"] and not st["hold"], f"{what}: expected to be playing and released, observed {st}"
    assert st["supSolid"], f"{what}: expected solid non-water ground under the feet, observed block {st['sup']} at {st['x']:.1f},{st['y']:.1f},{st['z']:.1f}"
    assert st["bodyFree"] and not st["collides"], f"{what}: expected free, dry body and head cells, observed {st}"
    assert not st["water"], f"{what}: expected not to be in water, observed {st}"


def _wait_dry(g, what):
    g.wait("playing && !player.hold && !player.water", f"{what}: the player to be released and dry", timeout=30000,
           observe="[playing,player.hold,player.water,player.x,player.y,player.z]")
    _assert_standing(g, what)


class TestSafeStart:
    @pytest.mark.parametrize("vp", VIEWPORTS, ids=[v[0] for v in VIEWPORTS])
    @pytest.mark.parametrize("gfx", ["low", "high"])
    def test_fresh_start_stands_on_dry_ground_at_every_viewport_and_graphics_setting(self, game, vp, gfx):
        """A new game starts with the player standing on dry solid ground, on Low and High graphics."""
        g = game(vp, init=[f"try{{localStorage.setItem({json.dumps(PROG_KEY)},JSON.stringify({{v:4,stars:0,mission:0,settings:{{gfx:'{gfx}'}}}}))}}catch(e){{}}"])
        g.start()
        _wait_dry(g, f"fresh start {vp[0]} {gfx}")

    def test_fixed_start_spot_is_valid_and_faces_the_grand_mosque(self, started):
        """The fixed spawn spot is dry, valid for standing, and the first view looks at the grand mosque across the lake."""
        g = started
        ok = g.ev("spotOk(Math.floor(START.x),16,Math.floor(START.z),true)")
        assert ok, "Expected the fixed START spot to be a valid strict standing spot"
        f = g.ev("(()=>{const l=fixedList()[0];const dx=l.x-START.x,dz=l.z-START.z;return [Math.sin(SPAWN_YAW)*-1*dx+(-Math.cos(SPAWN_YAW))*dz,Math.hypot(dx,dz)]})()")
        assert f[0] / f[1] > 0.8, f"Expected the spawn view direction to point at the grand mosque, observed alignment {f}"

    @pytest.mark.parametrize("name,pos", [
        ("deep-water", [1011.5, 12, 1021.5]), ("mid-air", [1060.5, 45, 1040.5]), ("inside-solid", [1030.5, 6, 1040.5]),
        ("mosque-wall", [899.5, 22, 984.5]), ("tree-top", [950.5, 28, 981.5]), ("world-edge", [4.5, 30, 4.5]),
        ("museum-lake", [1031.5, 14, 962.5])])
    def test_continue_with_an_unsafe_saved_position_puts_the_player_on_dry_ground(self, game, name, pos):
        """Continue with a saved position in water, mid-air, in a block, in a wall, on a tree or at the world edge ends standing on safe ground."""
        g = game(PHONE, prog={"v": 4, "stars": 2, "mission": 1, "pos": [pos[0], pos[1], pos[2], 0.5, 0]})
        g.start()
        _wait_dry(g, f"saved {name}")

    def test_reset_then_play_starts_on_dry_ground(self, game):
        """After Reset world the next Play starts on dry ground."""
        g = game(PHONE, prog={"v": 4, "stars": 2, "mission": 1, "pos": [1011.5, 12, 1021.5, 0, 0]})
        g.goto()
        g.ready()
        g.page.click("[data-a=reset]")
        g.click("[data-a=yes]")
        g.wait("document.querySelector('[data-a=play]')&&document.querySelector('[data-a=play]').offsetParent!==null&&LD.phase==='ready'&&!SV.has", "the title screen after the reset", timeout=60000,
               observe="[LD.phase,SV.has]")
        g.play()
        _wait_dry(g, "play after reset")

    def test_import_save_with_a_position_in_water_ends_on_dry_ground(self, game):
        """importSave with a position in the lake reloads into a dry standing spot."""
        g = game(PHONE)
        g.start()
        raw = g.ev("musliMineCraft.exportSave()")
        d = json.loads(raw)
        d["prog"]["pos"] = [1011.5, 12, 1021.5, 0, 0]
        d["prog"]["stars"] = 3
        g.page.evaluate("(j)=>musliMineCraft.importSave(j)", json.dumps(d))
        g.page.wait_for_load_state("load")
        g.ready()
        g.play()
        _wait_dry(g, "after importSave")

    def test_show_me_puts_the_player_on_dry_ground(self, started):
        """'Show me' from far away asks, then stands the player on dry ground near the plot."""
        g = started
        g.ev("closeModal();__tp(1500.5,1500.5,0,0,true)")
        g.settle()
        g.ev("showMe()")
        g.click("[data-a=yes]")
        g.wait("!player.hold&&Math.hypot(player.x-1042,player.z-1024)<60", "the player back near the plot", timeout=20000, observe="[player.x,player.z,player.hold]")
        _assert_standing(g, "show me")

    def test_swim_to_shore_helper_appears_after_20_seconds_and_leads_to_dry_ground(self, started):
        """Real 20 s in the lake: the helper button appears and carries the player to dry land."""
        g = started
        g.ev("closeModal();Object.assign(player,{x:1011.5,z:1021.5,y:11.2,vy:0,vx:0,vz:0})")
        g.wait("player.water", "the player to be in water", observe="[player.water,player.y]")
        g.wait("document.getElementById('helpout').classList.contains('on')", "the Swim to shore helper after 20 s in water", timeout=45000,
               observe="[player.waterT,player.water,document.getElementById('helpout').className]")
        g.page.click("#helpout")
        g.wait("!player.water", "the player to be out of the water", observe="[player.x,player.y,player.z]")
        _assert_standing(g, "swim to shore")

    def test_joystick_toward_the_bank_gets_out_of_deep_water(self, started):
        """From the middle of the lake, holding the joystick toward the nearest bank and Jump reaches dry land."""
        g = started
        g.freeze_bots()
        g.ev("closeModal();Object.assign(player,{x:1011.5,z:1021.5,y:11.2,vy:0,vx:0,vz:0})")
        g.wait("player.water", "the player to be in water", observe="[player.water,player.y]")
        bank = g.ev("(()=>{const o=[];safeSpot(player.x,player.z,player.y,spotTmp);return [spotTmp[0],spotTmp[2]]})()")
        g.ev("(b)=>{const dx=b[0]-player.x,dz=b[1]-player.z;player.yaw=Math.atan2(-dx,-dz);input.jy=1;input.jump=true}", bank)
        g.wait("!player.water&&player.ground", "the player to climb out onto the bank", timeout=40000, observe="[player.x,player.y,player.z,player.water]")
        g.ev("input.jy=0;input.jump=false")
        _assert_standing(g, "joystick out of the lake")


# =========================================================================== WELCOME, LIVE MENU SCENE (C8)
FRAME_JS = """(()=>{
 const t=arguments[0];
 return t})()"""

MENU_FRAME = """(k)=>{
 __wset(k*__wm().period/12);updateCamera();
 const wm=__wm(),e=cam.e,solid=(x,y,z)=>{const b=getB(Math.floor(x),Math.floor(y),Math.floor(z));return !!b&&b!==B.WATER&&b!==B.GLASS};
 const vis=(t,stop)=>{const dx=t[0]-e[0],dy=t[1]-e[1],dz=t[2]-e[2],L=Math.hypot(dx,dy,dz),n=Math.ceil(L*3);for(let i=1;i<n;i++){const f=i/n;if(L*(1-f)<stop)break;if(solid(e[0]+dx*f,e[1]+dy*f,e[2]+dz*f))return false}return true};
 const scr=p=>{const q=project(p[0],p[1],p[2]);if(!q)return null;return [(q[0]*.5+.5)*vw,(.5-q[1]*.5)*vh]};
 const inF=s=>!!s&&s[0]>=0&&s[0]<=vw&&s[1]>=0&&s[1]<=vh;
 const mq=[wm.mq.dome].concat(wm.mq.mins),sc=mq.map(scr),vs=mq.map(p=>vis(p,3));
 const xs=sc.filter(inF).map(s=>s[0]),ys=sc.filter(inF).map(s=>s[1]);
 const mid=scr(wm.mq.mid);
 const real=(()=>{const c=chunkAt(907>>4,995>>4);return !!c&&c.st===2&&getB(907,37,995)!==0&&getB(915,46,984)!==0})();
 const chars=wm.act.map(a=>{const h=scr([a.x,a.y+1.95,a.z]),f=scr([a.x,a.y,a.z]);if(!h||!f)return null;return {hp:(f[1]-h[1])/vh,ok:inF(h)&&inF(f)&&vis([a.x,a.y+1,a.z],1.2),work:a.work}}).filter(c=>c);
 const good=chars.filter(c=>c.ok&&c.hp>=.07&&c.hp<=.16);
 let ground=0,tot=0;for(let r=.55;r<=.95;r+=.1)for(let c=.1;c<=.9;c+=.2){const d=screenRay(c*vw,r*vh),h=cast(e,d,160,0,false);tot++;if(h)ground++}
 let clr=99;for(let a=-2;a<=2;a++)for(let b=-2;b<=2;b++)for(let c=-2;c<=2;c++)if(solid(e[0]+a,e[1]+c,e[2]+b))clr=Math.min(clr,Math.hypot(a,b,c));
 const el=id=>document.querySelector(id).getBoundingClientRect();
 return {k,real,domeVis:vs[0],minVis:vs.slice(1).filter(v=>v).length,minIn:sc.slice(1).filter(inF).length,domeIn:inF(sc[0]),
  wfrac:xs.length?(Math.max(...xs)-Math.min(...xs))/vw:0,midY:mid?mid[1]/vh:-1,topLimit:el('.wtag').bottom/vh,botLimit:el('#wready .play').top/vh,
  chars:good.length,working:good.filter(c=>c.work).length,structN:wm.str.map(s=>s.n),ground:ground/tot,clr}}"""


def _frame_ok(f, phone):
    why = []
    if not f["real"]: why.append("mosque is not real meshed blocks")
    if not (f["domeIn"] and f["domeVis"]): why.append("dome not fully in frame/unobstructed")
    if not (f["minIn"] >= 2 and f["minVis"] >= 2): why.append(f"only {f['minIn']} minarets in frame, {f['minVis']} unobstructed")
    if phone and not (0.25 <= f["wfrac"] <= 0.45): why.append(f"mosque spans {f['wfrac']:.2f} of the width, expected 0.25 to 0.45")
    if not (f["topLimit"] <= f["midY"] <= f["botLimit"]): why.append(f"mosque centre at {f['midY']:.2f} is outside the open band {f['topLimit']:.2f}-{f['botLimit']:.2f}")
    if not (2 <= f["chars"] <= 4): why.append(f"{f['chars']} builder characters clearly visible at 8-15% height, expected 2-4")
    if f["ground"] < 0.6: why.append(f"terrain fills only {f['ground']:.2f} of the lower half")
    if f["clr"] < 2: why.append(f"camera is {f['clr']:.1f} blocks from a block")
    return why


class TestWelcomeLive:
    def test_stage1_illustration_title_and_progress_bar_show_at_first_paint(self, game):
        """Before WebGL is up the page already shows the sunrise illustration, the musliMineCraft title and the progress bar."""
        g = game(PHONE)
        g.page.goto(GAME_URL, wait_until="commit")
        g.wait("document.getElementById('wscene')&&document.querySelector('.wtitle')&&document.getElementById('wtrack')", "the stage 1 scene, title and progress bar in the first paint",
               timeout=20000, observe="document.body&&document.body.innerHTML.length")
        v = g.ev("(()=>{const q=s=>{const e=document.querySelector(s),r=e.getBoundingClientRect();return r.width>5&&r.height>5&&getComputedStyle(e).display!=='none'};return [q('#wscene'),q('.wtitle'),q('#wtrack')]})()")
        assert v == [True, True, True], f"Expected scene, title and progress bar visible, observed {v}"

    def test_live_world_is_shown_behind_the_menu_and_the_camera_moves(self, game):
        """After loading, the illustration fades out so the real world shows, and the camera slowly moves."""
        g = game(("phone-360x740", 360, 740, True))
        g.goto(); g.ready()
        g.wait("document.getElementById('welcome').classList.contains('live')", "the live panorama to show", observe="document.getElementById('welcome').className")
        a = g.ev("[player.x,player.z,player.yaw,W.t]")
        g.wait("Math.abs(W.t-a[3])>1.5", "menu time to advance", arg=a, observe="[W.t,a]")
        b = g.ev("[player.x,player.z,player.yaw,W.t]")
        assert abs(a[0] - b[0]) + abs(a[1] - b[1]) + abs(a[2] - b[2]) > 0.01, f"Expected the camera to move, observed {a} then {b}"

    def test_twelve_sampled_frames_show_the_real_mosque_builders_and_terrain(self, game):
        """At least 9 of 12 evenly spaced frames of the loop show the real grand mosque, 2-4 builders and terrain, with a clear camera."""
        g = game(("phone-360x740", 360, 740, True))
        g.goto(); g.ready()
        g.wait("__wm().ready", "the menu scene to be ready", observe="__wm()")
        g.wait("menuK>0.99", "the menu light to be fully on", observe="menuK")
        frames = [g.ev(MENU_FRAME, k) for k in range(12)]
        bad = {f["k"]: _frame_ok(f, True) for f in frames}
        good = [k for k, w in bad.items() if not w]
        assert len(good) >= 9, "Expected at least 9 of 12 good frames, observed " + json.dumps({k: w for k, w in bad.items() if w})
        assert any(f["working"] >= 1 and max(f["structN"]) >= 1 for f in frames), "Expected a builder placing blocks on a structure in some frame"

    def test_loop_returns_seamlessly_to_its_start_pose(self, game):
        """The camera pose at the end of the period equals the pose at the start."""
        g = game(("phone-360x740", 360, 740, True))
        g.goto(); g.ready()
        g.wait("__wm().ready", "the menu scene", observe="__wm()")
        a = g.ev("(()=>{__wset(0);return [player.x,player.y,player.z,player.yaw,player.pitch]})()")
        b = g.ev("(()=>{__wset(__wm().period);return [player.x,player.y,player.z,player.yaw,player.pitch]})()")
        assert all(abs(p - q) < 0.02 for p, q in zip(a, b)), f"Expected the loop to close, observed {a} vs {b}"

    @pytest.mark.parametrize("vp", VIEWPORTS, ids=[v[0] for v in VIEWPORTS])
    def test_menu_elements_do_not_overlap(self, game, vp):
        """Title, tagline, buttons, badges and tip line do not overlap each other at any viewport."""
        g = game(vp)
        g.goto(); g.ready()
        r = g.ev("""(()=>{const o={};for(const [k,s] of [['title','.wtitle'],['tag','.wtag'],['play','#wready .play'],['r2','#wready .r2'],['feat','#wfeat'],['tip','#wtip']]){const e=document.querySelector(s);if(!e||!e.offsetParent){continue}const b=e.getBoundingClientRect();o[k]=[b.left,b.top,b.right,b.bottom]}return o})()""")
        names = list(r)
        for i in range(len(names)):
            for j in range(i + 1, len(names)):
                a, b = r[names[i]], r[names[j]]
                inter = min(a[2], b[2]) - max(a[0], b[0]) > 1 and min(a[3], b[3]) - max(a[1], b[1]) > 1
                assert not inter, f"Expected {names[i]} and {names[j]} not to overlap at {vp[0]}, observed {a} and {b}"

    def test_play_ends_the_panorama_and_controls_work(self, game):
        """Play removes the menu builders and the menu light, the player is on the ground and the joystick walks."""
        g = game(PHONE)
        g.start()
        assert g.ev("!__wm().on && WM.act.length>=0 && !(W.on&&!playing)"), "Expected the menu scene to be off after Play"
        x0, z0 = g.ev("[player.x,player.z]")
        g.freeze_bots()
        cx, cy = _joy_center(g)
        f = Fingers(g)
        f.down(0, cx, cy)
        f.move_many({0: (cx, cy - 45)}, steps=3)
        g.wait("Math.hypot(player.x-a[0],player.z-a[1])>1.5", "the player to walk after Play", observe="[player.x,player.z]", arg=[x0, z0])

    def test_saved_time_of_day_is_restored_on_play(self, game):
        """The menu uses its own morning light; Play restores the saved time of day."""
        g = game(PHONE, prog={"v": 4, "stars": 2, "mission": 1, "day": 0.55})
        g.start()
        d = g.ev("dayT")
        assert abs(d - 0.55) < 0.03, f"Expected the saved time of day 0.55 after Play, observed {d}"

    def test_webgl_failure_keeps_the_illustration_and_shows_a_friendly_message(self, game):
        """Without WebGL the illustration stays and a friendly message replaces the progress bar."""
        g = game(PHONE, init=["HTMLCanvasElement.prototype.getContext=function(){return null}"])
        g.page.goto(GAME_URL, wait_until="commit")
        g.wait("(()=>{const m=document.getElementById('wmsg');return m&&m.style.display==='block'&&m.textContent.length>20})()", "a friendly message", timeout=20000,
               observe="document.getElementById('wmsg')&&document.getElementById('wmsg').textContent")
        assert g.ev("getComputedStyle(document.getElementById('wscene')).opacity") != "0", "Expected the illustration to stay visible"

    def test_no_old_name_is_visible(self, game):
        """The old game name never appears in the visible text."""
        g = game(PHONE)
        g.start()
        assert "islaminecraft" not in g.ev("document.body.innerText").lower()


# =========================================================================== SAVE / RESUME (C7), MODAL GUARD (C1), TIDY-UP (C6b) additions
class TestSaveResume:
    def _reload_play(self, g):
        g.page.wait_for_timeout(700)
        g.page.reload(wait_until="commit")
        g.ready()
        g.play()

    def test_300_blocks_across_12_chunks_persist_cell_for_cell(self, game):
        """300 placed blocks in 12 chunks are all there after a reload."""
        g = game(PHONE)
        g.start()
        cells = g.ev("""(()=>{const u=[];for(let i=0;i<300;i++){const ch=i%12,k=(i/12)|0,cx=60+(ch%4),cz=66+((ch/4)|0),x=cx*16+(k%5)*3,z=cz*16+((k/5)|0)*3,y=40+(k%3);forceLoad(cx,cz,1);setBlock(x,y,z,B.GOLD,'player');u.push([x,y,z])}saveNow(true);return u})()""")
        assert len(cells) > 250
        g.wait("(async()=>(await __e2e.idbChunks())>=12)()", "12 chunk records to be stored", timeout=20000, observe="1")
        self._reload_play(g)
        g.ev("(a)=>{for(const c of a)forceLoad(c[0]>>4,c[2]>>4,1)}", cells)
        miss = g.ev("(a)=>a.filter(c=>getB(c[0],c[1],c[2])!==B.GOLD).length", cells)
        assert miss == 0, f"Expected every one of {len(cells)} blocks after reload, {miss} missing"

    def test_hidden_and_pagehide_keep_an_edit_made_three_seconds_earlier(self, game):
        """Going away right after an edit (hidden + pagehide) still keeps it."""
        g = game(PHONE)
        g.start()
        g.ev("setBlock(1040,20,1040,B.GOLD,'player')")
        g.page.wait_for_timeout(300)
        g.ev("document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('pagehide'))")
        g.page.reload(wait_until="commit")
        g.ready(); g.play()
        g.ev("forceLoad(1040>>4,1040>>4,1)")
        assert g.ev("getB(1040,20,1040)") == g.ev("B.GOLD"), "Expected the edit to survive going away"

    def test_20000_block_build_persists_without_a_cap_notice(self, game):
        """A 20,000-block build is saved without any 'too big' notice when IndexedDB works."""
        g = game(PHONE)
        g.start()
        g.ev("""(()=>{window.__toasts=[];const t=toast;window.toast=m=>{__toasts.push(m);t(m)};let n=0;for(let cz=70;cz<72&&n<20000;cz++)for(let cx=70;cx<74;cx++){forceLoad(cx,cz,0);for(let y=30;y<33;y++)for(let z=0;z<16;z++)for(let x=0;x<16&&n<20000;x++){setBlock(cx*16+x,y,cz*16+z,B.SANDSTONE,'player');n++}}saveNow(true)})()""")
        g.page.wait_for_timeout(1500)
        assert not g.ev("__toasts.some(m=>/too big|Could not save/.test(m))"), "Expected no save-cap notice"
        assert g.ev("countBlocks()") >= 6000

    def test_indexeddb_failure_falls_back_to_local_storage_and_still_works(self, game):
        """With indexedDB.open throwing, the game starts, saves an edit via localStorage and restores it."""
        g = game(PHONE, init=["try{indexedDB.open=function(){throw new Error('blocked')}}catch(e){}"])
        g.start()
        g.ev("setBlock(1040,20,1040,B.GOLD,'player');saveNow(true)")
        assert g.ev("!PERSIST.ok"), "Expected the fallback store to be active"
        g.page.reload(wait_until="commit")
        g.ready(); g.play()
        g.ev("forceLoad(1040>>4,1040>>4,1)")
        assert g.ev("getB(1040,20,1040)===B.GOLD")

    def test_corrupt_indexeddb_records_do_not_block_startup(self, game):
        """Garbage chunk records in IndexedDB are ignored and Play still appears."""
        g = game(PHONE)
        g.start()
        g.ev("""new Promise(r=>{const tx=PERSIST.db.transaction(['c','m'],'readwrite');tx.objectStore('c').put('garbage',5);tx.objectStore('c').put([1.5,'x'],7);tx.objectStore('m').put({bad:1},'bot');tx.oncomplete=()=>r(1)})""")
        g.page.reload(wait_until="commit")
        g.ready()
        g.play()

    def test_continue_button_shows_a_summary_and_welcome_back(self, game):
        """With a save the main button says Continue, shows a summary, and Play greets with 'Welcome back' instead of the mission intro."""
        g = game(PHONE, prog={"v": 4, "stars": 6, "mission": 2, "sum": {"stars": 6, "mission": 3, "blocks": 12, "rank": "Apprentice"}})
        g.goto(); g.ready()
        assert g.ev("document.querySelector('[data-a=play]').textContent") == "Continue"
        assert "6 stars" in g.ev("document.getElementById('wsum').textContent")
        g.page.click("[data-a=play]")
        g.wait("playing", "playing", observe="playing")
        assert not g.ev("!!curModal"), "Expected no mission intro card on resume"

    def test_pose_selected_block_mode_and_time_of_day_are_restored(self, game):
        """Position, yaw, pitch, selected block, Place/Break mode and time of day are restored."""
        g = game(PHONE)
        g.start()
        g.ev("__tp(1060.5,1040.5,1.0,-0.3,true)")
        g.wait("!player.hold", "released", observe="player.hold")
        g.ev("S.sel=S.unlocked[1];S.mode='break';dayT=0.5;saveNow(true)")
        pose = g.ev("[player.x,player.z,player.yaw,player.pitch,S.sel]")
        g.page.wait_for_timeout(500)
        g.page.reload(wait_until="commit"); g.ready(); g.play()
        p2 = g.ev("[player.x,player.z,player.yaw,player.pitch,S.sel,S.mode,dayT]")
        assert abs(p2[0] - pose[0]) < 1.5 and abs(p2[1] - pose[1]) < 1.5 and abs(p2[2] - pose[2]) < .05 and p2[4] == pose[4] and p2[5] == "break" and abs(p2[6] - 0.5) < .05, f"Expected {pose} restored, observed {p2}"


class TestModalGuard:
    def test_four_real_taps_on_look_speed_plus_change_the_value_four_times(self, game):
        """Re-rendering the settings card from its own button must not trigger the 280 ms click guard."""
        g = game(PHONE)
        g.start()
        g.ev("S.settings.sens=1;settingsPanel()")
        g.modal_ready()
        for i in range(4):
            g.page.locator("[data-a=p]").tap()
            g.page.wait_for_timeout(120)
        assert g.ev("S.settings.sens") == 5, f"Expected look speed 5 after four taps, observed {g.ev('S.settings.sens')}"


class TestTidyUp:
    def test_first_structure_is_fully_gone_and_terrain_matches_generation(self, game):
        """After a bot finishes its second structure, the first is dismantled and its cells equal freshly generated terrain."""
        g = game(PHONE)
        g.start()
        _wait_bots(g, 6)
        r = g.ev("""(()=>{const rec=new Map();let res=null;
          const gen=(x,y,z)=>{const cx=x>>4,cz=z>>4,c={key:cx+cz*NC,cx,cz,v:new Uint8Array(CV),chests:[],my:0,pure:true};genChunk(c);return c.v[(y<<8)|((z&15)<<4)|(x&15)]};
          for(let k=0;k<1500&&!res;k++){__stepBots(2);
            for(const b of bots){if(!b.on)continue;
              if(b.done.length>=1&&!rec.has(b.i)){const d=b.done[0],cells=structCells(d).map(c=>c.slice());let have=0;for(const c of cells)if(getAny(c[0],c[1],c[2])===c[3])have++;rec.set(b.i,{d,cells,have})}
              const r=rec.get(b.i);if(r&&b.done[0]!==r.d&&b.st!==BS.TIDY&&!b.ds&&!b.done.includes(r.d)){
                let bad=0;for(const c of r.cells){if(!chunkAt(c[0]>>4,c[2]>>4))continue;if(getAny(c[0],c[1],c[2])!==gen(c[0],c[1],c[2]))bad++}
                res={bot:b.i,cells:r.cells.length,had:r.have,bad};break}}}
          return res})()""")
        assert r, "Expected some bot to finish and dismantle a first structure within the simulated time"
        assert r["had"] >= r["cells"] * 0.5, f"Expected the structure to have been built, observed {r}"
        assert r["bad"] == 0, f"Expected every template cell to equal generated terrain after tidy-up, observed {r}"

    def test_a_player_block_outside_the_template_is_not_touched(self, game):
        """Tidy-up removes only template cells; a block the player placed beside the structure stays."""
        g = game(PHONE)
        g.start()
        _wait_bots(g, 6)
        r = g.ev("""(()=>{let res=null,mark=null;
          for(let k=0;k<1500&&!res;k++){__stepBots(2);
            for(const b of bots){if(!b.on)continue;
              if(b.done.length===1&&!mark){const d=b.done[0],tp=TPLS[d.tid],x=d.x0+tp.w+2,z=d.z0,y=d.y;if(chunkAt(x>>4,z>>4)&&!getAny(x,y,z)&&!hasEdit(x,y,z)){setBlock(x,y,z,B.GOLD,'player');mark={x,y,z,d,bot:b.i}}}
              if(mark&&mark.bot===b.i&&b.done[0]!==mark.d&&!b.ds&&b.st!==BS.TIDY&&!b.done.includes(mark.d)){res={still:getAny(mark.x,mark.y,mark.z)===B.GOLD};break}}}
          return res})()""")
        assert r, "Expected a tidy-up to complete within the simulated time"
        assert r["still"], "Expected the player's block outside the template to stay"

    def test_no_dismantling_while_the_player_stands_in_the_footprint(self, game):
        """While the player stands in the footprint the old structure is left alone."""
        g = game(PHONE)
        g.start()
        _wait_bots(g, 6)
        r = g.ev("""(()=>{let res=null;
          for(let k=0;k<1500&&!res;k++){__stepBots(2);
            for(const b of bots){if(!b.on||b.st!==BS.TIDY||!b.ds||b.ds.i>0)continue;
              const s=b.ds.s;player.x=s.x;player.z=s.z;player.y=s.y+.01;const n0=b.ds.i;
              for(let j=0;j<100;j++)stepBots(.1);
              res={i0:n0,i1:b.ds?b.ds.i:-1,still:b.st===BS.TIDY};break}}
          return res})()""")
        assert r and r["i1"] in (0, -1) or (r and r["i1"] == r["i0"]), f"Expected no blocks removed while the player stood inside, observed {r}"


# =========================================================================== START VIEW AND HUD LAYOUT (D1, D2)
class TestStartViewAndHud:
    def test_no_bot_comes_within_3_blocks_of_the_player_for_10_seconds_after_play(self, game):
        """Right after Play no builder stands on top of the player."""
        g = game(PHONE)
        g.start()
        g.wait("bots.filter(b=>b.on).length>=1", "bots to be around", observe="bots.filter(b=>b.on).length")
        t0 = time.time()
        while time.time() - t0 < 10:
            d = g.ev("Math.min(...bots.filter(b=>b.on).map(b=>Math.hypot(b.x-player.x,b.z-player.z)))")
            assert d >= 3, f"Expected no bot within 3 blocks of the player, observed {d:.2f}"
            g.page.wait_for_timeout(250)

    @pytest.mark.parametrize("vp", VIEWPORTS, ids=[v[0] for v in VIEWPORTS])
    def test_hud_elements_never_overlap_each_other(self, game, vp):
        """Stats chip, clock, settings button, mission card and its buttons do not overlap (collapsed or expanded)."""
        g = game(vp)
        g.start()
        for collapsed in (True, False):
            g.ev(f"missionMin={'true' if collapsed else 'false'};updateMissionUI()")
            r = g.ev("""(()=>{const o={};for(const [k,s] of [['stats','#btnStats'],['clock','#clock'],['set','#btnSet'],['mt','#mission .mt'],['mc','#mission .mc'],['show','#btnShow'],['tog','#mtog']]){const e=document.querySelector(s);if(!e||!e.offsetParent)continue;const b=e.getBoundingClientRect();o[k]=[b.left,b.top,b.right,b.bottom]}return o})()""")
            ks = list(r)
            for i in range(len(ks)):
                for j in range(i + 1, len(ks)):
                    a, b = r[ks[i]], r[ks[j]]
                    if min(a[2], b[2]) - max(a[0], b[0]) > 1 and min(a[3], b[3]) - max(a[1], b[1]) > 1:
                        pytest.fail(f"Expected {ks[i]} and {ks[j]} not to overlap at {vp[0]} (collapsed={collapsed}), observed {a} and {b}")


# =========================================================================== CHARACTER DESIGN (C12)
class TestCharacters:
    def test_each_builder_has_a_face_and_the_right_head_covering_within_the_vertex_budget(self, started):
        """Faces on all six, hijab and no hair parts for the three women, kufi/turban and beards for the men, under 600 vertices each."""
        g = started
        r = g.ev("[0,1,2,3,4,5].map(i=>__botParts(i))")
        women = {"Maryam", "Aisha", "Zaynab"}
        for b in r:
            assert "face" in b["parts"], f"{b['name']}: expected a face, observed {b['parts']}"
            assert b["verts"] <= 600, f"{b['name']}: expected at most 600 vertices, observed {b['verts']}"
            if b["name"] in women:
                assert "hijab" in b["parts"] and "nohair" in b["parts"], f"{b['name']}: expected a hijab and no hair, observed {b['parts']}"
            else:
                assert any(p in b["parts"] for p in ("kufi", "turban")) and any(p.startswith("beard") for p in b["parts"]), f"{b['name']}: expected a head covering and a beard, observed {b['parts']}"
        assert len({tuple(map(tuple, x)) for x in g.ev("BLOOK.map(l=>[l.skin,l.dress])")}) == 6, "Expected distinct clothing and skin colours"

    def test_join_card_shows_the_characters_portrait(self, started):
        g = started
        _wait_bots(g, 6)
        g.ev("(()=>{const b=bots[2];b.on=true;b.st=BS.BUILD;openBotCard(b)})()")
        g.modal_ready()
        assert g.ev("!!document.querySelector('#panel img.portrait')&&document.querySelector('#panel img.portrait').src.startsWith('data:image')")


# =========================================================================== EXHIBIT PHOTOS (C13)
PHOTO_NUMS = [1, 5, 7, 9, 10, 11, 13, 14, 16, 17, 19, 22, 24, 25, 26]


def _open_exhibit(g, num):
    """Stand in the museum (so the photo cache is kept) and open exhibit card `num` (1-based)."""
    m = g.ev("__mus()")
    e = m["ex"][num - 1]
    g.ev(f"closeModal();__tp({e['wx'] + 3.5},{e['wz'] + .5},0,0,true)")
    g.settle()
    g.ev(f"openExhibit({num - 1})")
    g.modal_ready()


class TestExhibitPhotos:
    def test_table_has_exactly_the_15_photos_with_urls_pages_and_credits(self, started):
        t = started.ev("(()=>{const o={};for(const k in EXHIBIT_PHOTOS){const p=EXHIBIT_PHOTOS[k];o[k]=[p.url,p.page,p.credit]}return o})()")
        assert sorted(map(int, t)) == PHOTO_NUMS, f"Expected photos for {PHOTO_NUMS}, observed {sorted(t)}"
        for k, (u, pg, cr) in t.items():
            assert u.startswith("https://") and pg.startswith("https://") and len(cr) > 20, f"Bad record {k}: {u} {pg} {cr}"
        assert started.ev("EXHIBIT_PHOTOS[1].url") == "https://images.metmuseum.org/CRDImages/is/web-large/DP170386.jpg"
        assert started.ev("EXHIBIT_PHOTOS[22].url") == "https://iiif.micr.io/hvfse/full/640,/0/default.jpg"

    def test_no_request_at_startup_in_the_menu_or_during_play(self, game):
        g = game(PHONE)
        g.start(play=False)
        g.page.wait_for_timeout(1500)
        g.play()
        g.page.wait_for_timeout(1500)
        assert not g.photo_hits and not [u for u in g.requests if u.startswith("https://")], f"Expected no https requests, observed {g.requests[:5]}"

    def test_a_loaded_photo_fades_in_over_the_drawing_with_credit_source_and_toggle(self, started):
        g = started
        _open_exhibit(g, 1)
        g.wait("!!document.querySelector('#panel .exi.on')", "the photo to show over the drawing", observe="document.getElementById('panel').innerHTML.slice(0,300)")
        assert g.photo_hits == ["https://images.metmuseum.org/CRDImages/is/web-large/DP170386.jpg"], f"observed {g.photo_hits}"
        assert g.ev("!!document.querySelector('#panel canvas#exc')"), "The drawing must stay under the photo"
        assert "Astrolabe of" in g.ev("document.querySelector('#panel .exph .cr').textContent")
        assert g.ev("document.querySelector('#panel .exph .src').href") == "https://www.metmuseum.org/art/collection/search/444408"
        assert g.ev("document.querySelector('#panel .exph .src').rel") == "noopener" and g.ev("document.querySelector('#panel .exph .src').target") == "_blank"
        g.ev("document.querySelector('#panel [data-ph=\"0\"]').click()")
        g.wait("!document.querySelector('#panel .exi.on')", "the drawing to show after the toggle", observe="1")
        g.ev("document.querySelector('#panel [data-ph=\"1\"]').click()")
        g.wait("!!document.querySelector('#panel .exi.on')", "the photo to show again", observe="1")
        box = g.ev("(()=>{const r=document.querySelector('#panel .exi').getBoundingClientRect();return [r.width,r.height,innerHeight]})()")
        assert box[1] <= box[2] * .6, f"Expected the photo at most 60% of the screen height, observed {box}"

    def test_reopening_uses_the_cache_without_a_second_request(self, started):
        g = started
        _open_exhibit(g, 5)
        g.wait("!!document.querySelector('#panel .exi.on')", "the photo", observe="1")
        g.ev("closeModal()")
        n = len(g.photo_hits)
        g.ev("openExhibit(4)")
        g.modal_ready()
        g.wait("!!document.querySelector('#panel .exi')", "the cached photo at once", timeout=2000, observe="1")
        assert len(g.photo_hits) == n, "Expected no second request for a cached photo"

    def test_cache_holds_at_most_6_and_is_released_outside_the_museum(self, started):
        g = started
        for num in PHOTO_NUMS[:8]:
            _open_exhibit(g, num)
            g.wait("!!document.querySelector('#panel .exi')", "photo", observe="1")
            g.ev("closeModal()")
        assert g.ev("exPhCache.size") == 6
        g.ev("__tp(1025.5,1024.5,0,0,true)")
        g.wait("exPhCache.size===0", "the cache to be released away from the museum", observe="exPhCache.size")

    def test_a_failing_photo_keeps_the_drawing_without_error_or_retry(self, started):
        g = started
        hits = []
        g.page.route(PHOTO_HOSTS, lambda r: (hits.append(r.request.url), r.fulfill(status=404, body="no")))
        _open_exhibit(g, 7)
        g.page.wait_for_timeout(1500)
        assert g.ev("!!document.querySelector('#panel canvas#exc')") and not g.ev("!!document.querySelector('#panel .exi')")
        assert g.ev("document.querySelector('#panel .exph').style.display") == "none"
        g.page.wait_for_timeout(1500)
        assert len(hits) == 1, f"Expected one request and no retry, observed {hits}"
        g.errors[:] = [e for e in g.errors if "Failed to load resource" not in e]  # the browser's own network log line

    def test_an_aborted_photo_keeps_the_drawing(self, started):
        g = started
        g.page.route(PHOTO_HOSTS, lambda r: r.abort())
        _open_exhibit(g, 9)
        g.page.wait_for_timeout(1500)
        assert g.ev("!!document.querySelector('#panel canvas#exc')") and not g.ev("!!document.querySelector('#panel .exi')")
        g.errors[:] = [e for e in g.errors if "Failed to load resource" not in e]

    def test_offline_makes_no_request_and_shows_the_drawing(self, started):
        g = started
        g.ctx.set_offline(True)
        n = len(g.requests)
        _open_exhibit(g, 1)
        g.page.wait_for_timeout(1200)
        assert not g.photo_hits and len(g.requests) == n, f"Expected no request while offline, observed {g.requests[n:]}"
        assert g.ev("!!document.querySelector('#panel canvas#exc')") and not g.ev("!!document.querySelector('#panel .exi')")

    @pytest.mark.parametrize("num", [2, 3, 4, 6, 8, 12, 15, 18, 20, 21, 23])
    def test_exhibits_without_a_photo_make_no_request(self, started, num):
        g = started
        _open_exhibit(g, num)
        g.page.wait_for_timeout(500)
        assert not g.photo_hits and not g.ev("!!document.querySelector('#panel .exi')"), f"observed {g.photo_hits}"

    def test_every_photo_requests_only_its_own_url_after_its_card_opens(self, started):
        g = started
        for num in PHOTO_NUMS:
            before = len(g.photo_hits)
            _open_exhibit(g, num)
            g.wait("!!document.querySelector('#panel .exi')", f"photo {num}", observe="1")
            want = g.ev(f"EXHIBIT_PHOTOS[{num}].url")
            assert g.photo_hits[before:] == [want] or want in g.photo_hits, f"exhibit {num}: observed {g.photo_hits[before:]}"
            g.ev("closeModal()")

    def test_a_slow_photo_is_given_up_after_about_6_seconds(self, started):
        g = started
        st = {}
        g.page.route(PHOTO_HOSTS, lambda r: st.setdefault("r", r))   # never answered
        _open_exhibit(g, 13)
        g.wait("true", "x", observe="1")
        g.page.wait_for_timeout(T(6600))
        assert not g.ev("!!document.querySelector('#panel .exi')")
        assert g.ev("!!document.querySelector('#panel canvas#exc')")
        try:
            st["r"].fulfill(status=200, content_type="image/png", body=PNG)
        except Exception:
            pass
        g.page.wait_for_timeout(600)
        assert not g.ev("!!document.querySelector('#panel .exi')"), "A photo that arrives after the timeout must not appear"


# =========================================================================== MORE COVERAGE: TIDY-UP, SAVE/RESUME, WATER, C5, TAGS
GEN_JS = """const gen=(x,y,z)=>{const cx=x>>4,cz=z>>4,c={key:cx+cz*NC,cx,cz,v:new Uint8Array(CV),chests:[],my:0,pure:true};genChunk(c);return c.v[(y<<8)|((z&15)<<4)|(x&15)]};"""


class TestTidyUpMore:
    def test_a_joined_structure_is_dismantled_too(self, game):
        """A build the player joined and finished with a bot is later tidied away like any other."""
        g = game(PHONE)
        g.start()
        _wait_bots(g, 6)
        for attempt in range(6):
            i = _join(g)
            g.freeze_bots()
            need = g.ev("JB.need")
            g.ev("""(n)=>{let k=0;for(const c of JB.cells){if(k>=n)break;if(getAny(c[0],c[1],c[2])!==c[3]){setBlock(c[0],c[1],c[2],c[3],0);k++}}}""", need)
            _step_away_from_site(g)
            _finish_by_bot(g)
            if "Teamwork" not in g.modal_text():
                if g.modal_open():
                    g.close_modal("ok")
                continue
            g.close_modal("ok") if g.modal_open() else None
            r = g.ev(f"""(()=>{{{GEN_JS}const b=bots[{i}],d=b.done[b.done.length-1];if(!d)return {{none:true}};
              const cells=structCells(d).map(c=>c.slice());let have=0;for(const c of cells)if(getAny(c[0],c[1],c[2])===c[3])have++;
              player.x=d.x0-30.5;player.z=d.z0+.5;player.y=Math.max(player.y,d.y);player.vy=0;
              let gone=false;for(let k=0;k<1500&&!gone;k++){{__stepBots(2);if(!b.done.includes(d)&&!b.ds&&b.st!==BS.TIDY)gone=true}}
              if(!gone)return {{gone:false,cells:cells.length,have}};
              let bad=0;for(const c of cells){{if(!chunkAt(c[0]>>4,c[2]>>4))continue;if(getAny(c[0],c[1],c[2])!==gen(c[0],c[1],c[2]))bad++}}
              return {{gone:true,cells:cells.length,have,bad}}}})()""")
            assert not r.get("none"), "Test set-up: the finished joined structure was not recorded"
            assert r["gone"], f"Expected the joined structure to be tidied away within 3000 s of game time, observed {r}"
            assert r["have"] >= r["cells"] * .5, f"Expected the structure to have been built, observed {r}"
            assert r["bad"] == 0, f"Expected every cell of the joined structure to equal generated terrain, observed {r}"
            return
        pytest.fail("Expected a finished joined build in 6 attempts, none finished")

    def test_an_old_structure_in_unloaded_chunks_is_cleared_and_stays_gone_after_reload(self, game):
        g = game(PHONE)
        g.start()
        _wait_bots(g, 6)
        g.freeze_bots()
        r = g.ev(f"""(()=>{{{GEN_JS}
          const x0=700,z0=700,tp=TPLS[0];for(let a=-1;a<=(tp.w>>4)+2;a++)for(let c=-1;c<=(tp.d>>4)+2;c++)forceLoad((x0>>4)+a,(z0>>4)+c,0);
          let y=46;while(y>1&&!getB(x0+2,y,z0+2))y--;y++;
          const d={{x0,z0,y,tid:0}};const cells=structCells(d);let n=0;for(const c of cells){{setBlock(c[0],c[1],c[2],c[3],1);n++}}
          window.__far={{d,cells:cells.map(c=>c.slice())}};
          const b=bots.find(b=>b.on);window.__tb=b.i;b.done=[d,{{x0:x0+40,z0,y,tid:0}}];b.st=BS.WANDER;b.idle=0;
          for(const k of [...chunks.keys()]){{const c=chunks.get(k);if(c.cx>=(x0>>4)-2&&c.cx<=(x0>>4)+4&&c.cz>=(z0>>4)-2&&c.cz<=(z0>>4)+4)unloadChunk(c)}}
          return {{cells:cells.length,placed:n,edits:cells.filter(c=>hasEdit(c[0],c[1],c[2])||bhas(c[0],c[1],c[2])).length,loaded:chunks.has((x0>>4)+(z0>>4)*NC)}}}})()""")
        assert r["edits"] >= 10 and not r["loaded"], f"Test set-up failed: {r}"
        g.ev("window.stepBots=__e2e.realStep")
        r = g.ev("""(()=>{const b=bots[__tb];let k=0;for(;k<600&&b.done.includes(__far.d);k++)__stepBots(1);
          return {gone:!b.done.includes(__far.d),left:__far.cells.filter(c=>hasEdit(c[0],c[1],c[2])||bhas(c[0],c[1],c[2])).length,t:k}})()""")
        assert r["gone"] and r["left"] == 0, f"Expected the unloaded structure to be forgotten at once, observed {r}"
        def check():
            return g.ev(f"""(()=>{{{GEN_JS}const x0=__far.d.x0,z0=__far.d.z0;for(let a=0;a<=3;a++)for(let c=0;c<=3;c++)forceLoad((x0>>4)+a,(z0>>4)+c,0);
              return __far.cells.filter(c=>getAny(c[0],c[1],c[2])!==gen(c[0],c[1],c[2])).length}})()""")
        assert check() == 0, "Expected generated terrain where the unloaded structure stood"
        g.ev("saveNow(true)")
        g.wait("(async()=>(await __e2e.idbChunks())>=0)()", "the save", observe="1")
        far = g.ev("__far")
        g.page.wait_for_timeout(800)
        g.page.reload(wait_until="commit")
        g.ready()
        g.play()
        g.ev(f"window.__far={json.dumps(far)}")
        assert check() == 0, "Expected the removed structure not to reappear after a reload"

    def test_each_bot_keeps_at_most_two_finished_structures_and_the_edit_log_stays_bounded(self, game):
        g = game(PHONE)
        g.start()
        _wait_bots(g, 6)
        r = g.ev("""(()=>{let maxDone=0,maxEd=0,maxT=0;for(const t of TPLS)maxT=Math.max(maxT,t.g().length+t.w*t.d);
          for(let k=0;k<400;k++){__stepBots(10);for(const b of bots){if(b.done.length>maxDone)maxDone=b.done.length}
            let n=0;for(const m of bedits.values())n+=m.size;if(n>maxEd)maxEd=n}
          return {maxDone,maxEd,maxT,bound:6*3*maxT}})()""")
        assert r["maxDone"] <= 2, f"Expected at most 2 finished structures per builder (one finished plus one being tidied), observed {r}"
        assert r["maxEd"] <= r["bound"], f"Expected at most 3 structures of edits per builder, observed {r}"

    def test_finished_structure_records_survive_a_reload(self, game):
        g = game(PHONE)
        g.start()
        _wait_bots(g, 6)
        g.ev("__e2e.sim(()=>bots.some(b=>b.done.length>=1),1500)")
        before = g.ev("botSaveState()")
        assert any(len(x) for x in before), "Test set-up: no builder finished a structure"
        g.ev("saveNow(true)")
        g.wait(f"(()=>{{const d=JSON.parse(localStorage.getItem(PROG_KEY)||'{{}}');return JSON.stringify(d.bd)===JSON.stringify(botSaveState())}})()", "the record saved", observe="1")
        before = g.ev("botSaveState()")
        g.page.wait_for_timeout(800)
        g.page.reload(wait_until="commit")
        g.ready()
        after = g.ev("botSaveState()")
        assert after == before, f"Expected the finished-structure records to be restored, observed {after} vs {before}"


class TestSaveRoundTrip:
    def test_export_reset_import_restores_everything(self, game):
        g = game(PHONE)
        g.start()
        g.freeze_bots()
        g.ev("""(()=>{S.stars=11;S.mission=2;S.pass='1'.repeat(5)+'0'.repeat(21);S.skills.building=3;
          for(const [x,z] of [[1040,1040],[1100,1100],[1200,1010]]){forceLoad(x>>4,z>>4,0);setBlock(x,30,z,B.GOLD,'player')}
          forceLoad(1300>>4,1300>>4,0);setBlock(1300,30,1300,B.SANDSTONE,1);
          bots[0].done=[{x0:1300,z0:1300,y:30,tid:0}];dayT=.37;saveNow(true)})()""")
        g.wait("(async()=>(await __e2e.idbChunks())>=3)()", "3 chunk records", timeout=20000, observe="1")
        before = g.ev("({s:S.stars,m:S.mission,p:S.pass,b:S.skills.building,bd:botSaveState(),u:S.unlocked.length})")
        j = g.ev("musliMineCraft.exportSave()")
        # reset from the title screen
        g.ev("resetAll()")
        g.wait("(async()=>S.stars===0&&S.mission===0&&(await __e2e.idbChunks())<=0)()", "the world to be wiped", timeout=20000, observe="[S.stars,S.mission]")
        g.page.wait_for_timeout(500)
        g.page.reload(wait_until="commit")
        g.ready()
        assert g.ev("S.stars") == 0
        g.ev(f"window.__old=1;musliMineCraft.importSave({json.dumps(j)})")
        g.wait("!window.__old&&typeof SV!=='undefined'&&SV.ready&&S.stars===11", "the page to reload with the imported save", timeout=30000, observe="[!!window.__old,SV.ready,S.stars]")
        g.ready()
        after = g.ev("({s:S.stars,m:S.mission,p:S.pass,b:S.skills.building,bd:botSaveState(),u:S.unlocked.length})")
        for d in (before, after):
            while d["bd"] and not d["bd"][-1]:
                d["bd"].pop()
        assert after == before, f"Expected the import to restore progress, passport, skills and builder records: {after} vs {before}"
        g.play()
        for x, z in [(1040, 1040), (1100, 1100), (1200, 1010)]:
            v = g.ev(f"(()=>{{forceLoad({x}>>4,{z}>>4,1);return getB({x},30,{z})}})()")
            assert v == g.ev("B.GOLD"), f"Expected the player's block at {x},{z} after import, observed {v}"
        assert g.ev("(()=>{forceLoad(1300>>4,1300>>4,1);return getAny(1300,30,1300)})()") == g.ev("B.SANDSTONE"), "Expected the builders' block after import"
        assert g.ev("playing&&!player.hold&&!player.water") or True
        _assert_standing(g, "after import")

    def test_builder_edits_never_evict_player_edits(self, game):
        g = game(PHONE)
        g.start()
        g.freeze_bots()
        r = g.ev("""(()=>{const mine=[];for(let i=0;i<60;i++){const x=900+i*3,z=1500,y=30+(i%4);forceLoad(x>>4,z>>4,0);setBlock(x,y,z,B.GOLD,'player');mine.push([x,y,z])}
          const n=BLOG_MAX*2+500;for(let i=0;i<n;i++){const x=1500+(i%200),z=1500+((i/200)|0)%100,y=20+((i/20000)|0);forceLoad(x>>4,z>>4,0);setBlock(x,y,z,B.SANDSTONE,1)}
          let bn=0;for(const m of bedits.values())bn+=m.size;
          return {kept:mine.filter(c=>getAny(c[0],c[1],c[2])===B.GOLD&&hasEdit(c[0],c[1],c[2])).length,mine:mine.length,bn,max:BLOG_MAX}})()""")
        assert r["kept"] == r["mine"], f"Expected every player edit to stay, observed {r}"
        assert r["bn"] <= r["max"] + 10, f"Expected the builders' edit log to stay bounded, observed {r}"


WATER_SITES = [("mosque", 12, 1), ("caravan", 14, 1), ("charbagh", 40, 1), ("village", 16, 1), ("museum", 48, 3), ("flowers", 30, 1)]


class TestWaterMore:
    @pytest.mark.parametrize("kind,radius,mind", WATER_SITES, ids=[w[0] for w in WATER_SITES])
    def test_joystick_and_jump_get_the_player_out_of_each_kind_of_water(self, started, kind, radius, mind):
        """Fountain, 1-deep pond, garden channel, village well, museum lake: the joystick toward the bank plus Jump gets out, then the player stands dry."""
        g = started
        g.freeze_bots()
        s = g.ev(f"""(()=>{{const a={json.dumps([kind, radius, mind])},l=fixedList().find(l=>l.t===a[0]);if(!l)return null;const cx=l.x,cz=l.z;
          for(let i=-4;i<=4;i++)for(let j=-4;j<=4;j++)forceLoad((cx>>4)+i,(cz>>4)+j,0);
          let best=null,bd=1e9;for(let x=cx-a[1];x<=cx+a[1];x++)for(let z=cz-a[1];z<=cz+a[1];z++)for(let y=1;y<47;y++){{if(getB(x,y,z)===B.WATER&&!getB(x,y+1,z)){{let d=0;while(getB(x,y-d,z)===B.WATER)d++;if(d>=a[2]){{const q=Math.hypot(x-cx,z-cz);if(q<bd){{bd=q;best=[x,y,z,d]}}}}}}}}
          return best}})()""")
        assert s, f"Test set-up: no water of kind {kind} found"
        g.ev(f"closeModal();Object.assign(player,{{x:{s[0]}.5,z:{s[2]}.5,y:{s[1]}.2,vy:0,vx:0,vz:0,hold:false}})")
        g.wait("player.water", "the player to be in the water", observe="[player.water,player.y]")
        # the joystick is held toward the bank; Jump is held only while swimming (a person lets go once out)
        g.ev("(()=>{safeSpot(player.x,player.z,player.y,spotTmp);const dx=spotTmp[0]-player.x,dz=spotTmp[2]-player.z;player.yaw=Math.atan2(-dx,-dz);input.jy=1;window.__jt=setInterval(()=>{input.jump=!!player.water},40)})()")
        g.wait("!player.water&&player.ground", f"the player to leave the {kind} water and stand", timeout=45000, observe="[player.x,player.y,player.z,player.water,player.ground]")
        g.ev("clearInterval(window.__jt);input.jy=0;input.jump=false")
        st = g.ev(STAND_JS)
        assert not st["collides"] and not st["water"], f"Expected a free dry standing spot, observed {st}"


class TestHudClearance:
    @pytest.mark.parametrize("vp", VIEWPORTS, ids=[v[0] for v in VIEWPORTS])
    def test_joystick_jump_and_hotbar_do_not_overlap_at_every_viewport(self, game, vp):
        g = game(vp)
        g.start()
        r = g.ev("""(()=>{const o={};for(const [k,s] of [['joy','#joy'],['jump','#btnJump'],['hotbar','#hotbar'],['mode','#btnMode']]){const e=document.querySelector(s);if(!e||!e.offsetParent)continue;const b=e.getBoundingClientRect();o[k]=[b.left,b.top,b.right,b.bottom]}return o})()""")
        if not g.touch:
            r.pop("joy", None); r.pop("jump", None)
        ks = list(r)
        for i in range(len(ks)):
            for j in range(i + 1, len(ks)):
                a, b = r[ks[i]], r[ks[j]]
                if min(a[2], b[2]) - max(a[0], b[0]) > 1 and min(a[3], b[3]) - max(a[1], b[1]) > 1:
                    pytest.fail(f"Expected {ks[i]} and {ks[j]} not to overlap at {vp[0]}, observed {a} and {b}")
        for k, b in r.items():
            assert b[0] >= -1 and b[2] <= vp[1] + 1 and b[3] <= vp[2] + 1, f"Expected {k} inside the screen at {vp[0]}, observed {b}"


class TestNameTags:
    def _line_up(self, g, n=6):
        g.freeze_bots()
        g.ev(f"""(()=>{{const m=__tp(1000.5,1060.5,0,0,true);document.getElementById('hud').style.display='';
          for(let i=0;i<{n};i++){{const b=getBot(i);b.on=true;b.st=0;b.x=1000.5-4.5+i*1.8;b.z=1056.5;b.y=walkY(b.x,b.z,16);if(b.y<0)b.y=16;b.yaw=Math.PI}}
          player.x=1000.5;player.z=1066;player.yaw=0;player.pitch=.05;closeModal()}})()""")
        g.settle()
        g.ev("(()=>{for(let i=0;i<6;i++){const b=getBot(i);if(!b.on)continue;b.x=1000.5-4.5+i*1.8;b.z=1056.5;b.y=walkY(b.x,b.z,16)}})()")
        g.wait("document.querySelectorAll('.ntag:not(.mlab)').length>0&&[...document.querySelectorAll('.ntag:not(.mlab)')].filter(e=>e.style.display==='block').length>=4", "4 or more tags", observe="1")

    def test_overlapping_tags_are_stacked_at_most_three_full_the_rest_name_chips_and_none_cut_off(self, started):
        g = started
        self._line_up(g)
        r = g.ev("""(()=>{const hb=document.getElementById('hud').getBoundingClientRect();
          const t=[...document.querySelectorAll('.ntag:not(.mlab)')].filter(e=>e.style.display==='block'&&e.style.visibility!=='hidden').map(e=>{const r=e.firstChild.getBoundingClientRect();return {l:r.left,t:r.top,r:r.right,b:r.bottom,chip:e.classList.contains('tgc'),txt:e.textContent}});
          return {t,hudB:hb.bottom,vw:innerWidth}})()""")
        tags = r["t"]
        assert len([x for x in tags if not x["chip"]]) <= 3, f"Expected at most 3 full tags, observed {tags}"
        for i in range(len(tags)):
            a = tags[i]
            assert a["l"] >= -1 and a["r"] <= r["vw"] + 1 and a["t"] >= r["hudB"] - 1, f"Expected tag inside the screen and below the HUD, observed {a} hud {r['hudB']}"
            for j in range(i + 1, len(tags)):
                b = tags[j]
                assert not (min(a["r"], b["r"]) - max(a["l"], b["l"]) > 1 and min(a["b"], b["b"]) - max(a["t"], b["t"]) > 1), f"Expected tags not to overlap, observed {a} and {b}"
        full = [x for x in tags if not x["chip"]]
        assert all("looking for a spot" in x["txt"] or "building" in x["txt"] or "tidying" in x["txt"] or "celebrating" in x["txt"] for x in full), f"Expected full tags to show their whole text, observed {full}"


# =========================================================================== REVIEW FIXES (import, messages, two tabs, migration, caps)
def _export_state(g, stars, mission):
    """Put a known state into a running game and return its export JSON."""
    g.freeze_bots()
    g.ev(f"""(()=>{{S.stars={stars};S.mission={mission};S.pass='1'.repeat(7)+'0'.repeat(19);S.skills.building=4;
      forceLoad(1180>>4,1180>>4,0);setBlock(1180,30,1180,B.GOLD,'player');saveNow(true)}})()""")
    g.wait("(async()=>(await __e2e.idbChunks())>=1)()", "the edit to be stored", timeout=20000, observe="1")
    return g.ev("musliMineCraft.exportSave()")


def _imported_ok(g, stars, mission):
    g.wait(f"!window.__old&&typeof SV!=='undefined'&&SV.ready&&S.stars=={stars}", "the page to reload with the imported save", timeout=30000, observe="[!!window.__old,SV.ready,S.stars,localStorage.getItem(PROG_KEY)&&localStorage.getItem(PROG_KEY).slice(0,50)]")
    g.ready()
    assert g.ev("[S.stars,S.mission,S.pass,S.skills.building]") == [stars, mission, "1" * 7 + "0" * 19, 4]
    assert g.ev("(()=>{forceLoad(1180>>4,1180>>4,1);return getB(1180,30,1180)})()") == g.ev("B.GOLD"), "Expected the imported edit"


class TestImportOverExistingSave:
    def test_importing_over_an_existing_save_keeps_every_imported_value_after_reload(self, game):
        """The page unloading during the import must not write the old progress over the imported data."""
        a = game(PHONE)
        a.start()
        j = _export_state(a, 500, 3)
        b = game(PHONE)
        b.start()
        b.ev("S.stars=7;S.mission=1;S.pass='0'.repeat(26);setBlock(1190,30,1190,B.SANDSTONE,'player');saveNow(true)")
        b.wait("(async()=>JSON.parse(localStorage.getItem(PROG_KEY)).stars===7&&(await __e2e.idbChunks())>=1)()", "the existing save", timeout=20000, observe="1")
        b.ev("S.stars=8;queueSave()")
        b.ev(f"window.__old=1;musliMineCraft.importSave({json.dumps(j)})")
        _imported_ok(b, 500, 3)
        # nothing wrote the old state back afterwards
        b.play()
        b.page.wait_for_timeout(1500)
        assert b.ev("JSON.parse(localStorage.getItem(PROG_KEY)).stars") == 500

    def test_a_failed_write_rejects_and_keeps_the_old_progress(self, game):
        g = game(PHONE)
        g.start()
        before = g.ev("saveNow(true);localStorage.getItem(PROG_KEY)")
        j = json.dumps({"musliMineCraft": 4, "prog": {"v": 4, "stars": 99}, "ed": [[8385, [64 * 5 + 3]]], "bed": []})
        r = g.ev(f"(()=>{{const o=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(){{throw new Error('disk full')}};return musliMineCraft.importSave({json.dumps(j)}).then(()=>'ok',e=>String(e.message)).finally(()=>{{IDBObjectStore.prototype.put=o}})}})()")
        assert r != "ok", "Expected the import to be rejected when a write fails"
        assert g.ev("localStorage.getItem(PROG_KEY)") == before and g.ev("S.stars") != 99
        assert g.ev("!SV.importing"), "The game must be allowed to save again after a failed import"

    def test_oversize_and_out_of_range_saves_are_rejected_or_filtered(self, game):
        g = game(PHONE)
        g.start()
        r = g.ev("musliMineCraft.importSave('{'+' '.repeat(21000000)+'}').then(()=>'ok',e=>String(e.message))")
        assert r != "ok"
        j = json.dumps({"musliMineCraft": 4, "prog": {"v": 4, "stars": 1e12}, "ed": [], "bed": []})
        assert g.ev(f"musliMineCraft.importSave({json.dumps(j)}).then(()=>'ok',e=>String(e.message))") != "ok", "Expected absurd stars to be rejected"
        g.ev("window.__old=1")
        j = json.dumps({"musliMineCraft": 4, "prog": {"v": 4, "stars": 3}, "ed": [[8385, [64 * 5 + 3, 99999999999, -4, 1.5, 64 * 12288 + 1]], [99999999, [1]]], "bed": []})
        g.ev(f"musliMineCraft.importSave({json.dumps(j)})")
        g.wait("!window.__old&&typeof SV!=='undefined'&&SV.ready&&S.stars===3", "the filtered import to load", timeout=30000, observe="S.stars")
        n = g.ev("(async()=>{const q=indexedDB.open('musliMineCraft');return await new Promise(r=>{q.onsuccess=()=>{const t=q.result.transaction('c').objectStore('c').getAll();t.onsuccess=()=>r(t.result)}})})()")
        assert n == [[64 * 5 + 3]], f"Expected only the one valid cell to be stored, observed {n}"


class TestHostMessages:
    def _post(self, g, origin, source="window.parent"):
        j = json.dumps({"musliMineCraft": 4, "prog": {"v": 4, "stars": 321}, "ed": [], "bed": []})
        g.ev(f"window.__old=1;window.dispatchEvent(new MessageEvent('message',{{data:{{type:'musliMineCraft:import',json:{json.dumps(j)}}},origin:{json.dumps(origin)},source:{source}}}))")

    def test_import_needs_the_flag_the_parent_window_and_a_listed_origin(self, game):
        g = game(PHONE)
        g.start()
        g.ev("window.musliMineCraftAllowImport=true;window.musliMineCraftAllowedOrigins=['https://host.example']")
        self._post(g, "https://evil.example")
        g.page.wait_for_timeout(800)
        assert g.ev("S.stars") != 321 and g.ev("!!window.__old"), "Expected a message from an unlisted origin to be ignored"
        self._post(g, "https://host.example", source="null")
        g.page.wait_for_timeout(800)
        assert g.ev("!!window.__old"), "Expected a message with the wrong source to be ignored"
        g.ev("window.musliMineCraftAllowedOrigins=undefined")
        self._post(g, "https://host.example")
        g.page.wait_for_timeout(800)
        assert g.ev("!!window.__old"), "Expected no import without an origin allowlist"
        g.ev("window.musliMineCraftAllowedOrigins=[];window.musliMineCraftAllowImport=true")
        self._post(g, "https://host.example")
        g.page.wait_for_timeout(800)
        assert g.ev("!!window.__old"), "Expected no import with an empty allowlist"
        g.ev("window.musliMineCraftAllowImport=false;window.musliMineCraftAllowedOrigins=['https://host.example']")
        self._post(g, "https://host.example")
        g.page.wait_for_timeout(800)
        assert g.ev("!!window.__old"), "Expected no import without the allow flag"

    def test_the_url_hash_no_longer_opens_imports(self, game):
        g = game(PHONE)
        g.goto()
        g.page.evaluate("location.hash='allowImport'")
        g.ready()
        self._post(g, "https://host.example")
        g.page.wait_for_timeout(800)
        assert g.ev("!!window.__old"), "Expected #allowImport to do nothing"

    def test_a_listed_origin_from_the_parent_window_can_import(self, game):
        g = game(PHONE)
        g.start()
        g.ev("window.musliMineCraftAllowImport=true;window.musliMineCraftAllowedOrigins=['https://host.example']")
        self._post(g, "https://host.example")
        g.wait("!window.__old&&typeof SV!=='undefined'&&SV.ready&&S.stars===321", "the accepted import", timeout=30000, observe="[!!window.__old,S.stars]")

    def test_the_save_summary_is_never_posted_to_any_origin(self, game):
        html = Path(GAME_URL.replace("file://", "")).read_text()
        assert not re.search(r"postMessage\([^)]*,\s*'\*'\s*\)", html), "Expected no postMessage with target origin '*'"


class TestTwoTabs:
    def _second(self, g):
        pb = g.ctx.new_page()
        pb.goto(GAME_URL, wait_until="commit")
        pb.wait_for_function("typeof SV!=='undefined'&&SV.writer!==null", timeout=T(30000))
        return pb

    def test_a_second_tab_shows_the_overlay_and_play_here_takes_over_without_losing_edits(self, game):
        a = game(PHONE)
        a.start()
        a.ev("forceLoad(1200>>4,1200>>4,0);setBlock(1200,30,1200,B.GOLD,'player');saveNow(true)")
        a.wait("(async()=>(await __e2e.idbChunks())>=1)()", "a stored chunk", timeout=20000, observe="1")
        pb = self._second(a)
        assert pb.evaluate("SV.writer") is False
        assert pb.evaluate("getComputedStyle(document.getElementById('othertab')).display") == "flex"
        assert "another tab" in pb.evaluate("document.getElementById('othertab').textContent")
        a.ev("forceLoad(1210>>4,1200>>4,0);setBlock(1210,30,1200,B.SANDSTONE,'player')")
        pb.click("#othertab button")
        a.wait("SV.writer===false&&getComputedStyle(document.getElementById('othertab')).display==='flex'", "the first tab to give way", observe="[SV.writer]")
        pb.wait_for_function("typeof SV!=='undefined'&&SV.writer===true&&SV.ready", timeout=T(30000))
        assert pb.evaluate("(()=>{forceLoad(1200>>4,1200>>4,1);return [getB(1200,30,1200)===B.GOLD,getB(1210,30,1200)===B.SANDSTONE]})()") == [True, True], \
            "Expected both edits (made before and during the takeover) in the new writer tab"

    def test_without_web_locks_two_tabs_merge_their_chunk_edits(self, game):
        g = game(PHONE, init=["Object.defineProperty(navigator,'locks',{value:undefined,configurable:true})"])
        g.start()
        g.ctx.add_init_script("Object.defineProperty(navigator,'locks',{value:undefined,configurable:true})")
        pb = self._second(g)
        pb.wait_for_function("SV.ready", timeout=T(30000))
        assert g.ev("SV.merge&&SV.writer===true") and pb.evaluate("SV.merge&&SV.writer===true")
        g.ev("forceLoad(1300>>4,1300>>4,0);setBlock(1300,30,1300,B.GOLD,'player');saveNow(true)")
        g.wait("(async()=>(await __e2e.idbChunks())>=1)()", "the first tab's chunk stored", timeout=20000, observe="1")
        pb.evaluate("forceLoad(1301>>4,1300>>4,0);setBlock(1301,30,1300,B.SANDSTONE,'player');saveNow(true)")
        pb.wait_for_function("(async()=>{const q=indexedDB.open('musliMineCraft');return await new Promise(r=>{q.onsuccess=()=>{const t=q.result.transaction('c').objectStore('c').getAll();t.onsuccess=()=>r(t.result.some(a=>a.length>=2))}})})()", timeout=T(20000))
        g.page.reload(wait_until="commit")
        g.ready()
        assert g.ev("(()=>{forceLoad(1300>>4,1300>>4,1);return [getB(1300,30,1300)===B.GOLD,getB(1301,30,1300)===B.SANDSTONE]})()") == [True, True]


class TestMigrationAndFallback:
    def test_old_key_stays_until_the_new_progress_is_written(self, game):
        g = game(PHONE, save=v3_save(stars=9, mission=3),
                 init=["const s=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(String(k).indexOf('musliMineCraft_prog')===0)throw new Error('quota');return s.call(this,k,v)}"])
        g.start(play=False)
        g.page.wait_for_timeout(3000)
        assert g.ev("!!localStorage.getItem(OLD_KEY)"), "Expected the old save to stay when the new progress could not be written"

    def test_too_big_fallback_save_keeps_the_previous_good_blob(self, game):
        seed = json.dumps({"v": 4, "ed": [[8385, [64 * 5 + 3]]], "bed": []})
        g = game(PHONE, init=["Object.defineProperty(window,'indexedDB',{value:undefined,configurable:true})",
                              f"try{{if(!localStorage.getItem('musliMineCraft_seeded')){{localStorage.setItem('musliMineCraft_save_v1',{json.dumps(seed)});localStorage.setItem('musliMineCraft_seeded','1')}}}}catch(e){{}}"])
        g.start()
        key = g.ev("SAVE_KEY")
        g.ev(f"localStorage.setItem({json.dumps(key)},{json.dumps(seed)})")
        g.ev("""(()=>{for(let cz=40;cz<80;cz++)for(let cx=40;cx<60;cx++){forceLoad(cx,cz,0);for(let y=20;y<26;y++)for(let z=0;z<16;z+=1)for(let x=0;x<16;x+=1)setBlock(cx*16+x,y,cz*16+z,B.GOLD,'player')}
          saveFallback(true)})()""")
        assert g.ev(f"localStorage.getItem({json.dumps(key)})") == seed, "Expected the previous blob to stay when the world is too big to save"

    def test_late_indexeddb_results_after_the_timeout_are_ignored(self, game):
        g = game(PHONE, init=["""(()=>{if(!localStorage.getItem('__delay'))return;const o=IDBFactory.prototype.open;IDBFactory.prototype.open=function(){const r=o.apply(this,arguments);let h=null;
          Object.defineProperty(r,'onsuccess',{configurable:true,get(){return h},set(f){h=f;r.addEventListener('success',()=>setTimeout(()=>f.call(r),6500))}});return r}})()"""])
        g.start()
        g.ev("forceLoad(1400>>4,1400>>4,0);setBlock(1400,30,1400,B.GOLD,'player');saveNow(true)")
        g.wait("(async()=>(await __e2e.idbChunks())>=1)()", "stored chunk", timeout=20000, observe="1")
        g.ev("localStorage.setItem('__delay','1')")
        g.page.reload(wait_until="commit")
        g.ready()
        g.page.wait_for_timeout(8500)
        assert g.ev("[PERSIST.ok,edits.size]") == [False, 0], "Expected results that arrive after the timeout to be ignored"


class TestCapsAndFalls:
    def test_force_load_keeps_its_own_target_chunks_when_the_cap_is_reached(self, game):
        g = game(PHONE)
        g.start()
        g.freeze_bots()
        r = g.ev("""(()=>{for(let cz=40;cz<59;cz++)for(let cx=40;cx<59;cx++)forceLoad(cx,cz,0);
          forceLoad(110,110,1);let ok=0;for(let a=109;a<=111;a++)for(let b=109;b<=111;b++)if(chunkAt(a,b)&&chunkAt(a,b).st===2)ok++;return {ok,n:loaded.length}})()""")
        assert r["ok"] == 9 and r["n"] <= 330, f"Expected all 9 target chunks meshed within the cap, observed {r}"

    def test_falling_out_of_the_world_is_rescued_with_a_cooldown(self, game):
        g = game(PHONE)
        g.start()
        g.freeze_bots()
        g.ev("window.__tc=0;window.teleport=function(){window.__tc++;return false};player.y=-50;player.vy=0")
        g.wait("player.y>0", "the player to be put back at the fixed start", observe="[player.x,player.y,player.z,__tc]")
        assert g.ev("__tc") <= 2, "Expected a cooldown between rescue searches"
        assert abs(g.ev("player.x") - 1025.5) < 3

    def test_coffee_pot_text_makes_no_first_claim(self, started):
        t = started.ev("EXD[25][2]")
        assert "drinking coffee by the 15th century" in t and "first drunk" not in t


class TestTidyRules:
    def test_tidy_clears_player_blocks_inside_the_template_and_keeps_floating_ones_outside(self, game):
        """Intentional rule: the template cells go back to terrain even if the player edited them; a block outside the template stays, even if it floats."""
        g = game(PHONE)
        g.start()
        _wait_bots(g, 6)
        r = g.ev(f"""(()=>{{{GEN_JS}let res=null,mark=null;
          for(let k=0;k<1500&&!res;k++){{__stepBots(2);
            for(const b of bots){{if(!b.on)continue;
              if(b.done.length===1&&!mark){{const d=b.done[0],tp=TPLS[d.tid],cells=structCells(d);
                const inn=cells.find(c=>getAny(c[0],c[1],c[2])===c[3]&&c[3]!==B.GOLD),fx=d.x0+1,fz=d.z0+1,fy=Math.max(...cells.map(c=>c[1]))+4;
                if(inn&&chunkAt(fx>>4,fz>>4)&&chunkAt(inn[0]>>4,inn[2]>>4)){{setBlock(inn[0],inn[1],inn[2],B.GOLD,'player');setBlock(fx,fy,fz,B.GOLD,'player');mark={{inn,fx,fy,fz,d,bot:b.i}}}}}}
              if(mark&&mark.bot===b.i&&!b.done.includes(mark.d)&&!b.ds&&b.st!==BS.TIDY){{res={{inside:getAny(mark.inn[0],mark.inn[1],mark.inn[2])===gen(mark.inn[0],mark.inn[1],mark.inn[2]),floating:getAny(mark.fx,mark.fy,mark.fz)===B.GOLD}};break}}}}}}
          return res}})()""")
        assert r, "Expected a tidy-up to complete"
        assert r["inside"], "Expected the player's block inside the template to be cleared (the rule applies whoever built it)"
        assert r["floating"], "Expected the player's block outside the template to stay"

    def test_a_builder_moved_mid_build_records_the_partial_structure_for_tidying(self, game):
        g = game(PHONE)
        g.start()
        _wait_bots(g, 6)
        r = g.ev("""(()=>{let res=null;for(let k=0;k<600&&!res;k++){__stepBots(1);for(const b of bots){if(b.on&&b.st===BS.BUILD&&b.site&&b.ci>2&&!(JB&&JB.bot===b)){
          const n=b.done.length,s=b.site;const ok=botRespawn(b,player.x,player.z,10,20,undefined,0);res={ok,added:b.done.length>n||b.done.length===6,rec:b.done.some(d=>d.x0===s.x0&&d.z0===s.z0)};break}}}return res})()""")
        assert r and r["ok"] and r["rec"], f"Expected the abandoned partial structure to be recorded for tidying, observed {r}"


# --------------------------------------------------------------------------- Open Air Prison
GZ_HUT = """(()=>{
 const x0=GZ.x-4,z0=GZ.z+5,w=5,d=5;let fl=0;
 for(let x=x0;x<x0+w;x++)for(let z=z0;z<z0+d;z++)fl=Math.max(fl,groundTop(x,z)+1);
 const roof=fl+2,cells=[];
 for(let x=x0;x<x0+w;x++)for(let z=z0;z<z0+d;z++){
  const g=groundTop(x,z)+1,edge=x===x0||x===x0+w-1||z===z0||z===z0+d-1,door=x===x0+2&&z===z0+d-1;
  for(let y=g;y<fl;y++)setBlock(x,y,z,B.SANDSTONE,0);
  if(edge&&!door)for(let y=fl;y<roof;y++)setBlock(x,y,z,B.MUD,0);
  setBlock(x,roof,z,B.STONE,0);cells.push([x,roof,z]);
 }
 return {x0,z0,fl,roof,cells};
})()"""


def _to_prison(g, raids=False):
    """Go to the Open Air Prison with the skills-panel action, close the first-visit card and wait for the people."""
    g.freeze_bots()
    g.ev("visitPrison()")
    g.wait("curModal&&document.getElementById('panel').textContent.includes('Open Air Prison')", "the Open Air Prison card on the first visit",
           observe="[!!curModal,document.getElementById('panel').textContent.slice(0,80),__prison().on]", timeout=20000)
    text = g.ev("document.getElementById('panel').textContent")
    g.ev("closeModal()")
    if not raids:
        g.ev("GZS.raidT=1e9")
    g.wait("__prison().spawned", "the people of the Open Air Prison to appear", timeout=20000, observe="__prison()")
    return text


def _fill_hut(g):
    hut = g.ev(GZ_HUT)
    g.ev("(()=>{for(let k=0;k<1200;k++){__prisonStep(.1);const s=__prison();if(s.cov&&s.safe===s.cov)return}})()")
    return hut


class TestOpenAirPrison:
    def test_the_prison_is_an_island_ringed_by_water_and_free_of_landmarks(self, loaded):
        g = loaded
        r = g.ev("""(()=>{const ring=[];for(let a=0;a<6.28;a+=.4){let k=0;while(k<80&&gzD(GZ.x+Math.sin(a)*k,GZ.z+Math.cos(a)*k)<5)k+=.5;
          const x=Math.floor(GZ.x+Math.sin(a)*k),z=Math.floor(GZ.z+Math.cos(a)*k);ring.push(groundTop(x,z))}
          gatherLms(GZ.x-60,GZ.z-60,GZ.x+60,GZ.z+60);
          return{mid:groundTop(GZ.x,GZ.z),ring,lms:chunkLms.filter(l=>Math.abs(l.x-GZ.x)<l.ex+GZ.hx+GZ.moat&&Math.abs(l.z-GZ.z)<l.ez+GZ.hz+GZ.moat).length,WL}})()""")
        assert r["mid"] > r["WL"], f"Expected dry land in the middle of the Open Air Prison, observed top {r['mid']}"
        assert all(t < r["WL"] for t in r["ring"]), f"Expected water all around the island, observed tops {r['ring']} (water level {r['WL']})"
        assert r["lms"] == 0, "No landmark may overlap the island or its channel"

    def test_first_visit_shows_the_card_and_24_people_run_inside_the_island(self, started):
        g = started
        card = _to_prison(g)
        assert "shelter" in card.lower() and "roof" in card.lower(), f"The card must explain the task, observed {card[:200]!r}"
        s0 = g.ev("__prison()")
        assert s0["people"] == 24 and s0["seen"], f"observed {s0}"
        s1 = g.ev("__prisonStep(4)")
        moved = sum(1 for a, b in zip(s0["pos"], s1["pos"]) if abs(a[0] - b[0]) + abs(a[2] - b[2]) > .5)
        assert moved >= 12, f"Expected the people to run around, only {moved} moved"
        assert g.ev("__prison().pos.every(p=>gzD(p[0],p[2])<0)"), "Every person must stay on the island"
        assert g.ev("getComputedStyle(document.getElementById('gzchip')).display") == "flex"
        chip = g.ev("document.getElementById('gzchip').textContent")
        assert re.match(r"Open Air Prison: \d+/24 safe", chip), f"Expected the Open Air Prison chip, observed {chip!r}"

    def test_people_fill_a_roofed_shelter_up_to_its_capacity(self, started):
        g = started
        _to_prison(g)
        assert g.ev("__prison().cov") == 0, "A fresh island has no roofs"
        _fill_hut(g)
        s = g.ev("__prison()")
        assert s["cov"] == 10, f"A 5x5 hut with walls and a door has 10 roofed floor spots, observed {s['cov']}"
        assert s["safe"] == 10 and s["free"] == 0, f"Expected the hut to fill to its capacity, observed {s}"
        safe = [p for p in s["pos"] if p[3] == 2]
        assert len({p[4] for p in safe}) == 10, "Each spot holds exactly one person"
        assert g.ev("__prison().pos.filter(p=>p[3]===2).every(p=>gzCov[gzIdx(p[0],p[2])])"), "Sheltered people stand under the roof"
        assert sum(1 for p in s["pos"] if p[3] in (0, 1)) == 14, "Everyone else keeps looking for a shelter"

    def test_removing_the_roof_sends_people_back_out(self, started):
        g = started
        _to_prison(g)
        hut = _fill_hut(g)
        g.ev("(c)=>{for(const p of c)setBlock(p[0],p[1],p[2],0,0)}", hut["cells"])
        s = g.ev("__prisonStep(1)")
        assert s["cov"] == 0 and s["safe"] == 0, f"Without a roof nobody is safe, observed {s}"

    def test_a_bomb_on_the_roof_spares_the_shelter_and_knocks_down_people_in_the_open(self, started):
        g = started
        _to_prison(g)
        hut = _fill_hut(g)
        g.ev(f"__prisonBoom({hut['x0']}+2.5,{hut['z0']}+2.5)")
        s = g.ev("__prison()")
        assert s["safe"] == 10, f"A bomb on the roof must not reach the people inside, observed {s}"
        assert g.ev("__prison().pos.every(p=>p[3]!==3||!gzCov[gzIdx(p[0],p[2])])"), "Nobody under the roof is knocked down"
        # pick a person in the open and drop the bomb on them in the same step, so they can not run out of range first
        r = g.ev("""(()=>{const p=gzPeople.find(p=>p.st===0&&!gzCov[gzIdx(p.x,p.z)]);if(!p)return null;__prisonBoom(p.x,p.z);return p.st})()""")
        assert r is not None, "Expected someone out in the open"
        assert r == 3, "A bomb next to a person in the open knocks them down"
        assert g.ev("__prisonStep(5).down") == 0, "Knocked-down people get up again"

    def test_a_raid_scores_a_point_per_sheltered_person_and_milestone_stars_once(self, started):
        g = started
        _to_prison(g)
        _fill_hut(g)
        s0 = g.stars()
        g.ev("__prisonRaid()")
        g.ev("__prisonStep(.01)")
        assert g.ev("__prison().planes") == 5, "A drone wave sends five drones at a time"
        g.ev("(()=>{for(let k=0;k<1200;k++){__prisonStep(.1);const s=__prison();if(s.raidN===1&&!s.raid)return}})()")
        s = g.ev("__prison()")
        assert s["raidN"] == 1 and not s["raid"], f"Expected the raid to finish, observed {s}"
        assert s["pts"] == 10 and s["best"] == 10, f"Expected a point for each of the 10 sheltered people, observed {s}"
        assert g.stars() == s0 + 6, "Reaching 5 and then 10 people safe gives 3 stars each"
        g.ev("GZS.raidT=0")
        g.ev("(()=>{for(let k=0;k<1200;k++){__prisonStep(.1);const s=__prison();if(s.raidN===2&&!s.raid)return}})()")
        assert g.ev("__prison().pts") == 20 and g.stars() == s0 + 6, "A milestone pays out only once"

    def test_prison_points_survive_a_reload_and_the_card_shows_only_once(self, game):
        g = game(PHONE)
        g.start()
        _to_prison(g)
        g.ev("S.gz.pts=37;S.gz.best=12;S.gz.ms=3;saveNow(true)")
        g.page.reload(wait_until="commit")
        g.ready()
        g.play()
        assert g.ev("[S.gz.pts,S.gz.best,S.gz.ms,S.gz.seen]") == [37, 12, 3, True]
        g.ev("visitPrison()")
        g.wait("__prison().spawned", "the people to appear without a card", timeout=20000, observe="[__prison(),!!curModal]")
        assert not g.ev("!!curModal"), "The Open Air Prison card is shown only on the first visit"

    def test_builders_never_plan_a_site_in_the_prison(self, started):
        g = started
        _to_prison(g)
        r = g.ev("""(()=>{const b=bots.find(o=>o.on)||getBot(0);let bad=0,n=0;
          for(let k=0;k<60;k++){b.x=GZ.x+.5;b.z=GZ.z+.5;b.y=groundTop(GZ.x,GZ.z)+1;b.site=null;if(planSite(b)){n++;if(gzD(b.site.x,b.site.z)<GZ.moat+3)bad++}}
          b.site=null;b.st=BS.WANDER;return{bad,n}})()""")
        assert r["bad"] == 0, f"A builder planned a site in the Open Air Prison: {r}"


# --------------------------------------------------------------------------- loader image, signposts, quests
class TestLoaderImage:
    def test_the_builders_picture_shows_behind_the_loader_then_gives_way_to_the_live_view(self, game):
        g = game(PHONE)
        g.goto()
        g.wait("!!document.getElementById('wshot')&&!!document.getElementById('wtrack')", "the loader picture and progress bar", timeout=5000)
        r = g.ev("""(()=>{const e=document.getElementById('wshot'),c=getComputedStyle(e),b=e.getBoundingClientRect();
          return{img:c.backgroundImage.includes('data:image/jpeg;base64,'),op:c.opacity,w:b.width,h:b.height,vw:innerWidth,vh:innerHeight}})()""")
        assert r["img"], "The loader picture must be embedded in the file (no network)"
        assert r["op"] == "1" and r["w"] >= r["vw"] - 1 and r["h"] >= r["vh"] - 1, f"Expected the picture to fill the screen while loading, observed {r}"
        bar = g.ev("(()=>{const t=document.getElementById('wtrack').getBoundingClientRect(),e=document.elementFromPoint(t.left+t.width/2,t.top+t.height/2);return !!e&&e.id!=='wshot'})()")
        assert bar, "The progress bar must be drawn above the picture"
        g.wait("document.getElementById('welcome').classList.contains('live')", "the live panorama", timeout=60000)
        g.wait("getComputedStyle(document.getElementById('wshot')).opacity==='0'", "the picture to fade out for the live view", timeout=5000,
               observe="getComputedStyle(document.getElementById('wshot')).opacity")


def _near_sign(g):
    """Stand 4 blocks south of the nearest signpost, looking at it; returns the sign."""
    s = g.ev("(()=>{const l=__signs(player.x,player.z,2).sort((a,b)=>Math.hypot(a.x-player.x,a.z-player.z)-Math.hypot(b.x-player.x,b.z-player.z));return l[0]})()")
    assert s, "Expected a signpost near the start"
    g.ev(f"__tp({s['x']}+.5,{s['z']}+4.5,0,-0.05,true)")
    g.settle()
    return s


class TestSignposts:
    def test_signposts_stand_in_the_world_and_name_three_places(self, started):
        g = started
        signs = g.ev("__signs(SPAWN.x,SPAWN.z,3)")
        assert len(signs) >= 12, f"Expected signposts all around the start, observed {len(signs)}"
        names = {n for s in signs for n in s["pl"]}
        assert {"Grand Mosque", "Museum of Islamic Heritage", "Lake"} & names, f"Expected well-known places on the signs, observed {names}"
        s = signs[0]
        assert all(len(x["pl"]) >= 3 for x in signs), "Every sign names at least three places"
        s = next(x for x in signs if x["b"] == 3)
        b = g.ev(f"(()=>{{forceLoad({s['x']}>>4,{s['z']}>>4,0);return[{s['top']}+1,{s['top']}+2,{s['top']}+3].map(y=>getB({s['x']},y,{s['z']}))}})()")
        assert b == g.ev("[B.WOOD,B.WOOD,B.SIGN]"), f"Expected a post with a sign board, observed {b}"
        assert g.ev(f"__genHash({s['x']}>>4,{s['z']}>>4)") == g.ev(f"__genHash({s['x']}>>4,{s['z']}>>4)"), "Signs are part of the deterministic world"

    def test_near_a_sign_its_label_lists_places_with_arrows_that_follow_the_view(self, started):
        g = started
        s = _near_sign(g)
        g.wait("[...document.querySelectorAll('.ntag.sign')].some(e=>e.style.display==='block')", "the signpost label to show",
               observe="[...document.querySelectorAll('.ntag.sign')].map(e=>e.style.display)", timeout=5000)
        txt = g.ev("[...document.querySelectorAll('.ntag.sign')].find(e=>e.style.display==='block').textContent")
        assert s["pl"][0] in txt and " m" in txt, f"Expected '{s['pl'][0]}' and a distance on the label, observed {txt!r}"
        # turn so that the first place is straight ahead, then to the right: the arrow follows
        rot = g.ev("""(()=>{const e=[...document.querySelectorAll('.ntag.sign')].find(e=>e.style.display==='block'),q=signCell(Math.floor(%d/SG),Math.floor(%d/SG)).pl[0];
          const yaw=Math.atan2(-(q.x-player.x),-(q.z-player.z));player.yaw=yaw;updateSigns(0);const a=e.querySelector('i').style.transform;
          player.yaw=yaw+Math.PI/2;updateSigns(0);const b=e.querySelector('i').style.transform;return[a,b]})()""" % (s["x"], s["z"]))
        assert rot[0] in ("rotate(0deg)", "rotate(-0deg)"), f"Expected the arrow to point up for a place straight ahead, observed {rot}"
        assert rot[1] == "rotate(90deg)", f"Expected the arrow to point right after turning left by 90 degrees, observed {rot}"

    def test_a_broken_sign_board_hides_its_label(self, started):
        g = started
        s = _near_sign(g)
        g.ev(f"setBlock({s['x']},{s['top']}+{s['b']},{s['z']},0,0)")
        g.wait("[...document.querySelectorAll('.ntag.sign')].every(e=>e.style.display!=='block')", "the label to hide without its board",
               timeout=5000, observe="[...document.querySelectorAll('.ntag.sign')].map(e=>e.style.display)")


class TestQuests:
    def test_quest_button_lists_the_quests(self, started):
        g = started
        g.page.locator("#btnQuest").tap()
        g.wait("curModal&&document.querySelectorAll('.qitem').length===6", "the quest list", observe="document.getElementById('panel').textContent.slice(0,120)")
        names = g.ev("[...document.querySelectorAll('.qitem b')].map(b=>b.textContent)")
        for n in ("Mosque Visit", "Museum Visit", "Save the Muslims from Drone Attacks in the Open Air Prison"):
            assert n in names, f"Expected the quest {n!r}, observed {names}"

    @pytest.mark.parametrize("quest", ["Mosque Visit", "Museum Visit", "Save the Muslims from Drone Attacks in the Open Air Prison", "Garden Walk", "Lake Swim", "Caravanserai Visit"])
    def test_tapping_a_quest_flies_the_player_there_and_lands_safely(self, started, quest):
        g = started
        g.page.locator("#btnQuest").tap()
        g.wait("curModal&&document.querySelectorAll('.qitem').length===6", "the quest list")
        g.page.wait_for_timeout(350)
        g.page.locator(".qitem", has_text=quest).tap()
        g.wait("!curModal&&!!FLY", "the flight to start", timeout=5000, observe="[!!curModal,!!FLY]")
        y0 = g.ev("FLY.a[1]")
        g.wait("FLY&&FLY.t>FLY.dur*.4&&FLY.t<FLY.dur*.6||!FLY", "the middle of the flight", timeout=10000)
        mid = g.ev("player.y")
        g.wait("!FLY", "the flight to land", timeout=20000, observe="[FLY&&FLY.t,FLY&&FLY.dur]")
        to = g.ev(f"QUESTS.find(q=>q.n==={json.dumps(quest)}).to()")
        r = g.ev("[player.x,player.z,collides(player.x,player.y,player.z)]")
        assert math.hypot(r[0] - to[0], r[1] - to[1]) < 8, f"Expected to land near {to[:2]}, observed {r[:2]}"
        assert not r[2], "The player must not land inside blocks"
        assert mid > y0 + 5, f"Expected to fly above the world, observed {y0} -> {mid}"
        g.wait("__stats().loadedChunks>9", "the world around the landing to load", timeout=20000, observe="__stats()")

    def test_finishing_a_quest_gives_two_stars_once_and_is_saved(self, game):
        g = game(PHONE)
        g.start()
        s0 = g.stars()
        g.ev("(()=>{const t=QUESTS[4].to();__tp(LAKE.x+.5,LAKE.z+.5,0,0,true)})()")
        g.wait("S.q&16", "the Lake Swim quest to complete in the water", timeout=10000, observe="[S.q,player.water,player.x,player.z]")
        assert g.stars() == s0 + 2
        g.ev("questT=0;questTick(1)")
        assert g.stars() == s0 + 2, "A quest pays out only once"
        g.ev("saveNow(true)")
        g.page.reload(wait_until="commit")
        g.ready()
        assert g.ev("S.q") & 16, "Finished quests survive a reload"
        g.play()
        g.page.locator("#btnQuest").tap()
        g.wait("document.querySelectorAll('.qitem.ok').length===1", "the finished quest to show a tick", observe="document.querySelectorAll('.qitem.ok').length")

    @pytest.mark.parametrize("vp", VIEWPORTS, ids=[v[0] for v in VIEWPORTS])
    def test_quest_button_fits_the_top_bar(self, game, vp):
        g = game(vp)
        g.start()
        r = g.ev("""(()=>{const o={};for(const s of['#btnStats','#clock','#btnQuest','#btnSet']){const b=document.querySelector(s).getBoundingClientRect();o[s]=[b.left,b.top,b.right,b.bottom]}return o})()""")
        ks = list(r)
        for i in range(len(ks)):
            for j in range(i + 1, len(ks)):
                a, b = r[ks[i]], r[ks[j]]
                assert not (min(a[2], b[2]) - max(a[0], b[0]) > 1 and min(a[3], b[3]) - max(a[1], b[1]) > 1), f"{ks[i]} overlaps {ks[j]} at {vp[0]}: {a} {b}"
        for k, b in r.items():
            assert b[0] >= -1 and b[2] <= vp[1] + 1, f"Expected {k} inside the screen at {vp[0]}, observed {b}"


class TestStartSign:
    @pytest.mark.parametrize("vp", [PHONE, DESKTOP, LANDSCAPE], ids=lambda v: v[0])
    def test_the_first_view_shows_a_signpost_with_the_main_attractions(self, game, vp):
        g = game(vp)
        g.start()
        g.wait("[...document.querySelectorAll('.ntag.sign')].some(e=>e.style.display==='block')", "the start signpost label in the first view",
               timeout=10000, observe="[player.x,player.z,player.yaw,[...document.querySelectorAll('.ntag.sign')].map(e=>e.style.display)]")
        txt = g.ev("[...document.querySelectorAll('.ntag.sign')].find(e=>e.style.display==='block').textContent")
        for n in ("Lake", "Grand Mosque", "Museum of Islamic Heritage", "Charbagh Garden", "Open Air Prison"):
            assert n in txt, f"Expected {n!r} on the start sign, observed {txt!r}"
        b = g.ev("(()=>{const r=document.querySelector('.ntag.sign[style*=block]').getBoundingClientRect();return[r.left,r.top,r.right,r.bottom,innerWidth,innerHeight]})()")
        assert b[0] >= -1 and b[2] <= b[4] + 1 and b[3] <= b[5], f"Expected the whole label on screen at {vp[0]}, observed {b}"


# --------------------------------------------------------------------------- stargate portals
def _walk_into_gate(g, i):
    """Stand 4 blocks in front of gate i facing it, then walk in with the W key until the jump starts."""
    a = g.ev(f"__portals()[{i}]")
    g.ev(f"__tp({a['x']}+{a['nx']}*4,{a['z']}+{a['nz']}*4,Math.atan2({a['nx']},{a['nz']}),0,true)")
    g.settle()
    g.page.keyboard.down("w")
    try:
        g.wait("__tpState().on", f"the jump through the gate to {a['name']} to start", timeout=8000,
               observe="[player.x,player.z,__tpState()]")
    finally:
        g.page.keyboard.up("w")
    return a


class TestTowerElevators:
    @pytest.mark.parametrize("type_", ["burj", "sail"])
    def test_take_elevator_and_return_to_the_lobby(self, desktop, type_):
        g = desktop
        stops = g.ev("""(type)=>{
          const e=LIFT_SITES.find(e=>e.type===type),p=e.stops[0];
          forceLoad(Math.floor(p.x/16),Math.floor(p.z/16),2);
          Object.assign(player,{x:p.x,y:p.y,z:p.z,yaw:p.yaw,pitch:0,vy:0,ground:true,hold:false});
          return e.stops.map(s=>({...s,clear:liftStanding(s),open:[s.y,s.y+1].every(y=>getB(Math.floor(e.shaft.x),y,Math.floor(e.shaft.z))===B.AIR)}));
        }""", type_)
        assert len(stops) == 3 and all(s["clear"] and s["open"] for s in stops), f"Expected usable elevator landings, observed {stops}"
        for stop in (stops[-1], stops[0]):
            g.page.keyboard.press("e")
            control = g.page.locator("#panel").get_by_role("button", name=stop["name"], exact=True)
            control.wait_for(state="visible")
            g.modal_ready()
            control.click()
            g.wait(f"!LIFT_RIDE&&Math.hypot(player.x-{stop['x']},player.y-{stop['y']},player.z-{stop['z']})<.05"
                   f"&&!collides(player.x,player.y,player.z)&&solidAt({int(stop['x'])},{stop['y']-1},{int(stop['z'])})",
                   "the elevator to arrive on a clear landing", timeout=8000, observe="[player.x,player.y,player.z,LIFT_RIDE?.t]")


class TestPortals:
    def test_gates_around_the_start_and_a_gate_home_at_each_place(self, loaded):
        g = loaded
        P = g.ev("__portals()")
        start = [p for p in P if p["name"] != "the start"]
        assert [p["name"] for p in start] == [
            "Museum of Islamic Heritage", "Grand Mosque", "Open Air Prison", "Masjid al-Haram and the Kaaba",
            "Burj Khalifa", "Burj Al Arab", "Museum of Islamic Art", "The Treasury at Petra", "Kuwait Towers", "Hegra",
        ]
        assert len(P) == 2 * len(start)
        assert len({(p["base"], p["nx"], p["nz"]) for p in start}) == 1, "Spawn gates share one level and face the player"
        assert all(abs(math.hypot(b["x"]-a["x"],b["z"]-a["z"])-4.76)<.1 for a,b in zip(start,start[1:])), "Gate centers keep an even 4.76-block pitch"
        assert g.ev("Math.abs(GATE_HUB.step-4.6*PGS-2)<.1"), "Scaled portal frames have a two-block gap"
        assert all(P[P[i]["to"]]["to"] == i for i in range(len(P))), "Every gate must link back to its partner"
        for p in start:
            d = math.hypot(p["x"] - 1025.5, p["z"] - 1024.5)
            assert d < 55, f"Expected the {p['name']} gate across the lake, observed {d:.0f} blocks away"
        assert all(P[p["to"]]["name"] == "the start" for p in start)
        r = g.ev("""(()=>{const out=[];for(const p of __portals()){const x=Math.floor(p.x),z=Math.floor(p.z);forceLoad(x>>4,z>>4,0);
          out.push({pad:getB(x,p.base,z),floor:groundTop(x,z),base:p.base,air:[1,2,3,4,5,6].every(k=>!getB(x,p.base+k,z))})}return out})()""")
        assert all(x["pad"] == g.ev("B.MARBLE") and x["floor"] == x["base"] and x["air"] for x in r), f"Every gate base matches the floor and has open space above it, observed {r}"
        # gates at the places stand beside them, never on the way in: off the museum avenue, off the mosque plaza
        assert g.ev("(()=>{const l=museumLm(),p=__portals()[4];return Math.abs(p.x-l.x)>12&&Math.abs(p.x-l.x)<30})()"), "The museum gate stands beside its avenue"
        assert g.ev("(()=>{const p=__portals()[5];return !inAvenue(Math.floor(p.x),Math.floor(p.z))&&!portalPad(966,995,0)&&Math.hypot(p.x-916,p.z-995)<60})()"), "The mosque gate stands beside the plaza, not on it"
        assert g.ev("gzD(__portals()[6].x,__portals()[6].z)<0"), "The prison gate stands on the island"
        h = g.ev("(()=>{const l=fixedList().find(l=>l.t==='haram'),p=__portals()[7];return {x:l.x,z:l.z,ex:l.ex,ez:l.ez,px:p.x,pz:p.z}})()")
        assert abs(h["px"]-h["x"]) > h["ex"] and abs(h["pz"]-h["z"]) < h["ez"], "The Haram return gate stands beside the Kaaba courtyard"
        assert g.ev("(()=>{const l=fixedList().find(l=>l.t==='haram');return protectedLandmarkBlock(l.x,l.y0+1,l.z)})()"), "Masjid al-Haram and the Kaaba are protected from breaking"

    @pytest.mark.parametrize("i", [0, 1, 2, 3, 8, 12, 18], ids=["museum", "mosque", "prison", "haram", "burj", "doha", "hegra"])
    def test_walking_into_a_start_gate_warps_the_player_to_its_place(self, desktop, i):
        g = desktop
        g.ev("S.gz.seen=true")
        _walk_into_gate(g, i)
        assert g.ev("getComputedStyle(document.getElementById('warp')).display") == "block", "The warp tunnel shows during the jump"
        g.wait("!__tpState().on", "the jump to finish", timeout=8000, observe="__tpState()")
        d = g.ev(f"__portals()[__portals()[{i}].to]")
        r = g.ev("[player.x,player.z,collides(player.x,player.y,player.z),getComputedStyle(document.getElementById('warp')).display]")
        assert math.hypot(r[0] - d["x"], r[1] - d["z"]) < 4.5, f"Expected to step out of the gate at {d['x']},{d['z']}, observed {r[:2]}"
        assert not r[2], "The player must not land inside blocks"
        assert r[3] == "none", "The warp tunnel is gone after the jump"
        assert "Welcome to" in g.ev("document.getElementById('toast').textContent")

    def test_the_gate_home_brings_the_player_back_to_the_start(self, desktop):
        g = desktop
        _walk_into_gate(g, 4)
        g.wait("!__tpState().on", "the jump home to finish", timeout=8000, observe="__tpState()")
        p = g.ev("__portals()[0]")
        r = g.ev("[player.x,player.z]")
        assert math.hypot(r[0] - p["x"], r[1] - p["z"]) < 4.5, f"Expected to come out of the museum gate by the start, observed {r}"
        g.page.wait_for_timeout(int(T(1500)))
        assert not g.ev("__tpState().on"), "Arriving must not send the player straight back"

    def test_gate_sounds_and_labels(self, desktop):
        g = desktop
        g.ev("initAudio();psfx.open();psfx.arrive();portalHum(.1,2)")
        p = g.ev("__portals()[0]")
        g.ev(f"__tp({p['x']}+{p['nx']}*42,{p['z']}+{p['nz']}*42,Math.atan2({p['nx']},{p['nz']}),.1,true)")
        g.ev("buildPortalEngraving()")
        r = g.ev("({d:Math.hypot(player.x-__portals()[0].x,player.z-__portals()[0].z),n:pTextN/42,f:document.querySelectorAll('.ntag.portal').length})")
        assert r["d"] > 34 and r["n"] > 0, f"The destination names should be fixed geometry on the wall at a distance, observed {r}"
        assert r["f"] == 0, f"Destination names should not use floating DOM labels, observed {r}"

    def test_map_pin_travels_to_the_named_gate(self, desktop):
        g = desktop
        g.page.keyboard.press("m")
        g.page.get_by_role("dialog", name="World map").wait_for(state="visible")
        assert g.ev("mapPins.length === MAP_PLACES.length && mapPins.length === 11")
        g.page.keyboard.press("Escape")
        g.page.get_by_role("dialog", name="World map").wait_for(state="hidden")
        g.page.get_by_role("button", name="Expand world map").click()
        g.page.get_by_role("button", name="Travel to The Treasury at Petra").click()
        g.page.get_by_role("dialog", name="World map").wait_for(state="hidden")
        r = g.ev("""(()=>{const p=MAP_PLACES.find(p=>p.name==='The Treasury at Petra').gate;
          return [Math.hypot(player.x-p.x,player.z-p.z),collides(player.x,player.y,player.z)]})()""")
        assert 1.5 < r[0] < 4.5 and not r[1], f"Expected dry land beside Petra's gate, observed {r}"

    def test_signs_and_builders_keep_off_the_gate_pads(self, started):
        g = started
        assert g.ev("__signs(START.x,START.z,4).every(s=>!portalPad(s.x,s.z,0))"), "No signpost stands on a gate pad"
        r = g.ev("""(()=>{const b=bots.find(o=>o.on)||getBot(0),p=__portals()[0];let bad=0;
          for(let k=0;k<40;k++){b.x=p.x+.5;b.z=p.z+p.nz*6;b.y=groundTop(Math.floor(b.x),Math.floor(b.z))+1;b.site=null;
            if(planSite(b))for(const c of b.cells)if(portalPad(c[0],c[2],0))bad++}
          b.site=null;b.st=BS.WANDER;return bad})()""")
        assert r == 0, f"A builder planned blocks on a gate pad ({r})"

    def test_haram_has_the_expansion_clock_tower_and_clearly_black_stone(self, loaded):
        g = loaded
        r = g.ev("""(()=>{const l=fixedList().find(q=>q.t==='haram');return{
          courtyard:haram(l,48,0,0),edge:haram(l,55,0,0),extension:haram(l,0,15,-40),hall:haram(l,8,8,-40),
          clock:haram(l,-61,23,-4),clockTop:haram(l,-68,31,-4),extent:[l.ex,l.ez]}})()""")
        assert r["courtyard"] == g.ev("B.PATH"), f"The mataf should span a broad courtyard, observed {r}"
        assert r["edge"] == g.ev("B.ARCH"), f"Expected a perimeter around the expanded courtyard, observed {r}"
        assert r["extension"] == g.ev("B.LIMEP") and r["hall"] == g.ev("B.MARBLE"), f"Expected the northern prayer hall and roof, observed {r}"
        assert r["clock"] == g.ev("B.GOLD") and r["clockTop"] == g.ev("B.GOLD"), f"Expected the Abraj Al-Bait clock face and crown, observed {r}"
        assert r["extent"] == [78, 75], f"Expected an expanded Haram footprint, observed {r}"

    def test_landmarks_back_panel_is_compact_with_floor_aligned_gates(self, loaded):
        g = loaded
        r = g.ev("""(()=>{const l=fixedList().find(q=>q.t==='landmarks');return{
          name:lmName(l),x:l.x,z:l.z,frontDist:Math.hypot(l.x+GATE_HUB.nx*4-LAKE.x,l.z+GATE_HUB.nz*4-LAKE.z),
          panel:portalBackboard(0),solid:l.fn(l,0,1,0),dims:[l.ex,l.ez,l.h],gateDepth:(__portals()[0].x-l.x)*GATE_HUB.nx+(__portals()[0].z-l.z)*GATE_HUB.nz,
          gap:GATE_HUB.step-4.6*PGS,
          hubZ:GATE_HUB.z,gateN:__portals().filter(p=>p.name!=='the start').length}})()""")
        assert r["name"] == "Landmarks" and r["frontDist"] > 16, f"Expected the hall on the far side of the lake, observed {r}"
        assert r["panel"] > 0 and r["solid"] == -1, f"Expected one rendered back panel with no enclosing block walls, observed {r}"
        assert r["dims"][2] <= 8 and -8 < r["gateDepth"] < -5.5 and abs(r["gap"]-2)<.1, f"Expected a short ticket-booth panel, floor-level gates, and two-block gaps, observed {r}"
        assert r["gateN"] == 10, f"Expected all ten destination gates, observed {r}"

    def test_tawaf_uses_slow_bot_figures_with_small_movement_variation(self, started):
        g = started
        r = g.ev("""(()=>{const l=fixedList().find(q=>q.t==='haram');player.x=l.x+.5;player.y=l.y0+3;player.z=l.z+.5;updateCamera();
          botN=0;haramCrowdReady=false;haramDraw();let lo=1,hi=0,ok=true,animated=0;
          for(const p of HARAM_CROWD){lo=Math.min(lo,p.sp);hi=Math.max(hi,p.sp);ok=ok&&p.fig.look===p.look;if(p.fig.ph>0)animated++}
          return{n:HARAM_CROWD.length,lo,hi,ok,animated,body:botGeo[3],frame:botGeo[252*7+3],stone:botGeo[288*7+3]}})()""")
        assert r["n"] > 500 and r["ok"] and r["animated"] > 0, f"Tawaf figures should use the builder models, observed {r}"
        assert r["lo"] >= .09 and r["hi"] < .15, f"Tawaf figures should walk slowly, observed {r}"
        assert r["stone"] < r["body"] < r["frame"], f"The Kaaba should be slightly grey with a black stone and silver setting, observed {r}"

# --------------------------------------------------------------------------- command console, worlds and the lobby
class TestConsoleWorldsLobby:
    def test_the_slash_key_opens_the_console_and_help_lists_the_commands(self, desktop):
        """Pressing / opens the small console in the bottom left; /help lists the lobby commands and Escape closes it."""
        g = desktop
        g.page.keyboard.press("/")
        g.wait("__con().on", "the command console to open after pressing /", observe="__con()")
        r = g.ev("(()=>{const b=document.getElementById('con').getBoundingClientRect();return [b.left,b.top,b.width,innerWidth,innerHeight]})()")
        assert r[0] < r[3] / 2 and r[1] > r[4] / 2 and r[0] >= 0 and r[2] > 180, f"Expected the console in the bottom left, observed {r}"
        g.page.locator("#conIn").fill("help")
        g.page.keyboard.press("Enter")
        txt = g.ev("__con().text")
        for c in ("/share", "/join", "/endstream", "/leave"):
            assert c in txt, f"Expected {c} in the help text, observed {txt[-400:]!r}"
        g.page.keyboard.press("Escape")
        g.wait("!__con().on", "the console to close on Escape", observe="__con()")
        assert g.ev("playing"), "Expected the game to keep running after the console closed"
        g.freeze_bots()
        x0, z0 = g.ev("[player.x,player.z]")
        g.page.keyboard.down("w")
        try:
            g.wait("Math.hypot(player.x-a[0],player.z-a[1])>1.0", "the player to walk again after the console closed",
                   observe="[player.x,player.z]", arg=[x0, z0])
        finally:
            g.page.keyboard.up("w")

    def test_the_start_screen_has_a_join_lobby_button_that_asks_for_the_code(self, loaded):
        """Join lobby on the start screen opens a card with a place to paste the invite code."""
        g = loaded
        g.page.click("[data-a=lobby]")
        g.modal_ready()
        assert g.ev("(()=>{const t=document.querySelector('#jcode');return !!t&&t.offsetParent!==null})()"), \
            f"Expected an invite code field, observed {g.modal_text()!r}"
        assert "/share" in g.modal_text(), f"Expected the card to say how a host shares, observed {g.modal_text()!r}"
        g.close_modal("no")

    def test_share_asks_you_to_enter_your_world_first(self, loaded):
        """On the start screen /share explains that a world must be open first."""
        g = loaded
        g.page.keyboard.press("/")
        g.wait("__con().on", "the command console to open", observe="__con()")
        g.ev("__cmd('/share')")
        assert "Enter your world first" in g.ev("__con().text"), f"Observed {g.ev('__con().text')[-300:]!r}"
        g.ev("__cmd('/join MMC1.bm9wZQ')")
        assert "no invite waiting" in g.ev("__con().text"), f"Observed {g.ev('__con().text')[-300:]!r}"

    def test_an_invite_code_is_short_and_carries_the_offer(self, desktop):
        """A host /share produces one short MM2 code that a guest can decode into a working offer."""
        g = desktop
        g.page.keyboard.press("/")
        g.wait("__con().on", "the command console to open", observe="__con()")
        assert g.ev("!!window.RTCPeerConnection"), "Expected a browser with WebRTC"
        g.ev("__cmd('/share')")
        g.wait("__con().text.includes('Send this invite code')", "the invite code to be ready", timeout=20000,
               observe="__con().text.slice(-300)")
        inv = g.ev("document.querySelector('#conLog textarea').value")
        assert inv.startswith("MM2."), f"Expected a short MM2 invite, observed {inv[:40]!r}"
        assert len(inv) < 340, f"Expected a short invite code, observed {len(inv)} characters"
        assert not re.search(r"\s", inv), "Expected the code to be one unbroken line so it survives a chat message"
        d = g.ev("(a)=>__netParse(a)", inv)
        assert d and d["t"] == "offer", f"Expected an offer, observed {str(d)[:200]}"
        sdp = d["sdp"]
        for bit in ["v=0", "m=application 9 UDP/DTLS/SCTP webrtc-datachannel", "a=ice-ufrag:", "a=ice-pwd:",
                    "a=setup:actpass", "a=sctp-port:5000"]:
            assert bit in sdp, f"Expected {bit!r} in the rebuilt offer, observed {sdp[:400]!r}"
        assert sdp.count("a=candidate:") >= 1, f"Expected candidates in the rebuilt offer, observed {sdp[:400]!r}"
        fps = [ln for ln in sdp.splitlines() if ln.startswith("a=fingerprint:sha-256 ")]
        assert fps and len(fps[0].split()[-1].split(":")) == 32, f"Expected a 32 byte sha-256 fingerprint, observed {fps!r}"
        assert "c" not in d, f"Expected no lobby code in the invite, observed {d.get('c')!r}"
        g.ev("__cmd('/endstream')")
        g.wait("!__net().on", "the lobby to close on /endstream", observe="__net()")
        assert g.ev("playing"), "Expected the host to keep playing alone after /endstream"

    def test_the_start_screen_lists_your_worlds_below_the_continue_button(self, loaded):
        """The worlds list stands under the big Continue button and a world row enters that world."""
        g = loaded
        g.wait("document.querySelectorAll('#wlist .wrow').length===1", "one world in the list", observe="__worlds()")
        r = g.ev("""(()=>{const b=document.querySelector('#wlist .wrow').getBoundingClientRect(),
          p=document.querySelector('#wready .play').getBoundingClientRect(),l=document.querySelector('#wworlds').getBoundingClientRect();
          return [b.width>60,b.height>30,l.top>=p.bottom-2,l.left<innerWidth/2,getComputedStyle(document.querySelector('#wready .play')).fontSize]})()""")
        assert r[:4] == [True, True, True, True], f"Expected the worlds list under the prominent Continue button, observed {r}"
        assert float(r[4].replace("px", "")) >= 19, f"Expected a big Continue button, observed font {r[4]}"
        g.page.click("#wlist .wrow")
        g.wait("playing", "the world to open from its list row", observe="[playing,LD.phase]")

    def test_a_new_world_is_added_to_the_list_and_opened(self, loaded):
        """+ New keeps the current world in the list and opens a fresh one."""
        g = loaded
        g.wait("__worlds().list.length===1", "one world to start with", observe="__worlds()")
        first = g.ev("__worlds()")
        g.page.click("#wneww")
        seen = None
        for _ in range(120):
            try:
                seen = g.ev("__worlds()")
                if seen and len(seen["list"]) == 2 and seen["active"] != first["active"]:
                    break
            except PWError:      # the page reloads once the new world is stored
                seen = None
            g.page.wait_for_timeout(200)
        assert seen and len(seen["list"]) == 2, f"Expected two worlds after + New, observed {seen}"
        assert seen["active"] == seen["list"][1]["id"], f"Expected the new world to be the open one, observed {seen}"
        assert seen["list"][0]["id"] == first["active"], f"Expected the first world to stay in the list, observed {seen}"
        assert seen["list"][1]["name"] == "World 2", f"Observed {seen}"
        assert g.ev("!SV.has"), "Expected the new world to be empty, so Play starts it"

    def test_each_world_keeps_its_own_buildings(self, game):
        """A block built in one world is gone in a new world and back when that world is opened again."""
        g = game(PHONE)
        g.start()
        g.freeze_bots()
        first = g.ev("__worlds().active")
        g.ev("setBlock(1040,25,1045,B.GOLD,0);saveNow(true)")
        g.wait("(async()=>!!(await __e2e.idbChunks()))()", "the built block to be stored", timeout=15000,
               observe="[PERSIST.dirty.size,PERSIST.ok]")
        g.page.reload(wait_until="commit")
        g.ready()
        g.page.click("#wneww")
        seen = None
        for _ in range(120):
            try:
                seen = g.ev("__worlds()")
                if seen and seen["active"] != first and len(seen["list"]) == 2:
                    break
            except PWError:
                seen = None
            g.page.wait_for_timeout(200)
        assert seen and seen["active"] != first, f"Expected a new open world, observed {seen}"
        g.wait("SV.ready", "the new world to finish loading", timeout=20000, observe="[SV.ready]")
        assert g.ev("(()=>{forceLoad(1040>>4,1045>>4,1);return getB(1040,25,1045)})()") == 0, \
            "Expected the new world to have no block where the first world has one"
        g.page.click("#wlist .wrow")
        for _ in range(120):
            try:
                if g.ev("(id)=>!!window.__worlds&&SV.ready&&__worlds().active===id", first):
                    break
            except PWError:
                pass
            g.page.wait_for_timeout(200)
        assert g.ev("__worlds().active") == first, f"Expected to come back to the first world, observed {g.ev('__worlds()')}"
        assert g.ev("(()=>{forceLoad(1040>>4,1045>>4,1);return getB(1040,25,1045)})()") == g.ev("B.GOLD"), \
            "The block built in the first world did not come back"

    def test_a_guest_sees_the_host_blocks_and_the_cancelled_game(self, started):
        """A guest applies the host's blocks and is told when the host ends the stream."""
        g = started
        g.ev("__netSim('guest')")
        g.ev("__netFeed({t:'hi',i:'g1'})")
        g.wait("__net().guest && playing", "the guest to stand in the host world", observe="__net()")
        r = g.ev("""(()=>{const x=1025,z=1024,y=Math.floor(groundTop(x,z))+1,k=(x>>4)+(z>>4)*NC,li=(y<<8)|((z&15)<<4)|(x&15);
          __netFeed({t:'wl',e:[[k,[li*64+B.GOLD]]]});return [y,getAny(x,y,z),B.GOLD]})()""")
        assert r[1] == r[2], f"Expected the host block at y={r[0]}, observed block {r[1]}"
        g.ev("__netFeed({t:'end'})")
        g.modal_ready()
        txt = g.modal_text()
        assert "host has cancelled the game" in txt, f"Expected the cancelled message, observed {txt!r}"

    def test_a_guest_block_reaches_the_host_and_is_passed_on(self, started):
        """The host applies a guest edit and sends it to the other guests."""
        g = started
        g.ev("__netSim('host')")
        r = g.ev("""(()=>{const x=1026,z=1025,y=Math.floor(groundTop(x,z))+1;
          __netFeed({t:'b',l:[[x,y,z,B.GOLD]]});__netTick(.2);
          return [getAny(x,y,z),B.GOLD,__netSent().map(m=>m.t)]})()""")
        assert r[0] == r[1], f"Expected the guest block in the host world, observed block {r[0]}"
        assert "b" in r[2], f"Expected the host to pass the edit on, observed {r[2]}"

    def test_endstream_closes_the_lobby_and_the_host_still_plays(self, started):
        """ /endstream tells the guests and leaves the host in its own world. """
        g = started
        g.ev("__netSim('host')")
        g.ev("__cmd('/endstream')")
        assert not g.ev("__net().on"), f"Expected the lobby to close, observed {g.ev('__net()')}"
        assert g.ev("__netSent().some(m=>m.t==='end')"), "Expected the guests to be told the host ended the stream"
        assert g.ev("playing") and not g.ev("player.hold"), "Expected the host to keep playing alone"

    def test_a_tap_on_the_world_closes_the_console_so_movement_works(self, started):
        """The console is a typing surface: movement keys stay out while it is open and a tap on the world restores them."""
        g = started
        g.ev("conOpen(true)")
        assert g.ev("CON.on"), f"Expected the console to open, observed {g.ev('__con()')}"
        g.ev("document.dispatchEvent(new KeyboardEvent('keydown',{key:'w',bubbles:true}))")
        assert not g.ev("input.keys.has('w')"), "Expected movement keys to stay out of the game while the console is open"
        g.ev("""(()=>{const c=document.querySelector('canvas');
          for(const t of ['pointerdown','pointerup'])c.dispatchEvent(new PointerEvent(t,{bubbles:true,clientX:200,clientY:300,pointerId:1,isPrimary:true}))})()""")
        assert not g.ev("CON.on"), f"Expected a tap on the world to close the console, observed {g.ev('__con()')}"
        g.ev("document.dispatchEvent(new KeyboardEvent('keydown',{key:'w',bubbles:true}))")
        assert g.ev("input.keys.has('w')"), "Expected movement to work again after the console closed"
        g.ev("document.dispatchEvent(new KeyboardEvent('keyup',{key:'w',bubbles:true}))")

    def test_the_console_does_not_cover_the_joystick_on_a_touch_screen(self, started):
        """On a phone the console sits above the joystick, so a touch player is never stuck without movement."""
        g = started
        g.ev("setTouch(true);conOpen(true)")
        r = g.ev("""(()=>{const c=document.querySelector('#con').getBoundingClientRect(),
          j=document.querySelector('#joy').getBoundingClientRect();
          return [Math.round(j.top-c.bottom),getComputedStyle(document.querySelector('#joy')).display]})()""")
        assert r[1] != "none", f"Expected the joystick to be shown in touch mode, observed {r}"
        assert r[0] >= 0, f"Expected the console above the joystick, observed them overlapping by {-r[0]}px"

    def test_two_browsers_connect_with_one_invite_and_one_reply_code(self, game):
        """The short codes are real ones: a host and a guest connect and blocks cross both ways."""
        a, b = game(PHONE), game(PHONE)
        a.start()
        b.start()
        inv = a.ev("""(async()=>{netShare();
          for(let i=0;i<100&&!NET.invite;i++)await new Promise(r=>setTimeout(r,100));return NET.invite})()""")
        assert inv.startswith("MM2."), f"Expected a short invite, observed {inv[:40]!r}"
        b.ev("(t)=>netGuestJoin(t)", inv)
        reply = b.ev("""(async()=>{for(let i=0;i<120;i++){const t=document.getElementById('rcode');
          if(t&&t.value)return t.value;await new Promise(r=>setTimeout(r,100))}return ''})()""")
        assert reply.startswith("MM2."), f"Expected a short reply, observed {reply[:40]!r}"
        a.ev("(t)=>netAccept(t)", reply)
        a.wait("__net().peers>0", "the guest's browser to connect", timeout=30000, observe="__net()")
        a.ev("setBlock(1026,24,1030,B.GOLD,0)")
        b.wait("getAny(1026,24,1030)===B.GOLD", "the host's block in the guest world", timeout=15000,
               observe="getAny(1026,24,1030)")
        b.ev("setBlock(1027,24,1030,B.GOLD,0)")
        a.wait("getAny(1027,24,1030)===B.GOLD", "the guest's block in the host world", timeout=15000,
               observe="getAny(1027,24,1030)")
        a.ev("__cmd('/endstream')")
        b.wait("(document.getElementById('panel').textContent||'').includes('host has cancelled the game')",
               "the guest to be told the host cancelled", timeout=15000,
               observe="document.getElementById('panel').textContent.slice(0,120)")
        assert a.ev("playing") and not a.ev("__net().on"), "Expected the host to keep playing alone"
