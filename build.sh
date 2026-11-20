#!/usr/bin/env bash
# Builds dist/musliMineCraft.html from the parts in src/. Run from the repo root: ./build.sh
# JS parts: blank lines and full-line comments are dropped and each line is trimmed.
# The <style> block in 1-head.html is joined into one line.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"
PARTS=(1-head.html 2-core.js 3a-world.js 3a2-museum.js 3b-chunks.js 3-gl.js 4-play.js 4b-bots.js 5-game.js 5b-museum-ui.js 5c-save.js 5d-prison.js 5e-places.js 5f-portals.js 6-quiz.js 7-ui.js 8-tail.html)

strip_js() {
  awk '
    { sub(/^[ \t\r\f\v]+/, ""); sub(/[ \t\r\f\v]+$/, "") }
    $0 == "" { next }
    /^\/\// { next }
    /^\/\*/ && /\*\/$/ { t = $0; if (gsub(/\/\*/, "", t) == 1) next }
    { print }
  ' "$1"
}

join_style() {
  # Line by line (no NUL record separator) so every awk gives the same output.
  awk '
    {
      line = $0; out = ""; nl = "\n"
      while (1) {
        if (!ins) {
          i = index(line, "<style>")
          if (i == 0) { out = out line; break }
          out = out substr(line, 1, i + 6); line = substr(line, i + 7); ins = 1
        } else {
          j = index(line, "</style>")
          if (j == 0) { out = out line; nl = ""; break }
          out = out substr(line, 1, j - 1); line = substr(line, j); ins = 0
        }
      }
      printf "%s", prev; prev = out nl
    }
    # the final newline of the part is dropped (the build has always done this)
    END { sub(/\n$/, "", prev); printf "%s", prev }
  ' "$1"
}

mkdir -p dist
tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT
for f in "${PARTS[@]}"; do
  [[ -f "src/$f" ]] || { echo "missing src/$f" >&2; exit 1; }
  case "$f" in
    1-head.html) join_style "src/$f" >> "$tmp" ;;
    *.js) strip_js "src/$f" >> "$tmp" ;;
    *) cat "src/$f" >> "$tmp" ;;
  esac
done
mv "$tmp" dist/musliMineCraft.html
trap - EXIT
echo "built dist/musliMineCraft.html ($(wc -c < dist/musliMineCraft.html) bytes)"
