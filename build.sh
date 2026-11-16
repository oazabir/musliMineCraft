#!/usr/bin/env bash
# Builds dist/muscraft.html from the parts in src/. Run from the repo root: ./build.sh
# JS parts: blank lines and full-line comments are dropped and each line is trimmed.
# The <style> block in 1-head.html is joined into one line.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"
PARTS=(1-head.html 2-core.js 3a-world.js 3a2-museum.js 3b-chunks.js 3-gl.js 4-play.js 4b-bots.js 5-game.js 5b-museum-ui.js 5c-save.js 6-quiz.js 7-ui.js 8-tail.html)

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
  awk '
    BEGIN { RS = "\0" }
    {
      s = $0; out = ""
      while ((i = index(s, "<style>")) > 0) {
        out = out substr(s, 1, i + 6); s = substr(s, i + 7)
        j = index(s, "</style>")
        if (j == 0) break
        body = substr(s, 1, j - 1); gsub(/\n+/, "", body)
        out = out body; s = substr(s, j)
      }
      printf "%s%s", out, s
    }
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
mv "$tmp" dist/muscraft.html
trap - EXIT
echo "built dist/muscraft.html ($(wc -c < dist/muscraft.html) bytes)"
