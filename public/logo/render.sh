#!/usr/bin/env bash
# Rasterize the Chata logo SVGs to PNG at the sizes we ship.
# Requires rsvg-convert (brew install librsvg).
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p png

render() { rsvg-convert -w "$2" -h "$2" "$1" -o "$3"; } # <src> <size> <out>

# Flat A-frame marks (transparent background) — accent / ink / white.
for variant in accent ink white; do
  for s in 16 32 48 64 120 180 240 512; do
    render "src/chata-mark-${variant}.svg" "$s" "png/chata-mark-${variant}-${s}.png"
  done
done

# App-icon tiles (gradient + white mark) — one per trip theme. 120 = email size.
for theme in cabin la2028 baltic; do
  for s in 120 180 192 512 1024; do
    render "src/chata-icon-${theme}.svg" "$s" "png/chata-icon-${theme}-${s}.png"
  done
done

# Favicon / app-icon set wired into the Next.js app root (src/app/). Next picks
# these up by filename convention and injects the <link> tags automatically.
# Uses a favicon-tuned source (larger glyph) so the mark survives at 16px.
APP="../../src/app"
cp src/chata-favicon.svg "$APP/icon.svg"                 # modern browsers (scalable)
render src/chata-favicon.svg 180 "$APP/apple-icon.png"   # iOS home screen
# Multi-resolution favicon.ico (16/32/48) for legacy browsers.
tmp="$(mktemp -d)"
for s in 16 32 48; do render src/chata-favicon.svg "$s" "$tmp/f-$s.png"; done
convert "$tmp/f-16.png" "$tmp/f-32.png" "$tmp/f-48.png" "$APP/favicon.ico"
rm -rf "$tmp"

echo "Done. PNGs in ./png; app icons in src/app/"
