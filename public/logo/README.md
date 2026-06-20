# Chata logo

The Chata mark is an **A-frame** — at once a cabin (*chata*), a tent, a mountain,
and a roof over the group — with a downward-opening doorway knocked out. It is
drawn in `currentColor`, so it tints to any trip's accent or reverses to white
over a photo. Source of truth: the *Chata Design System* board (01 — Logo).

Clear space = the doorway width on every side. Minimum size ≈ 22 px.

## Files

This toolkit lives under `public/logo/`, so every export is **served by Next at
`/logo/…`** (e.g. `/logo/png/chata-icon-cabin-120.png`) — that's why it sits in
`public/` rather than a source-only folder: the PNGs are referenced by URL from
emails, favicons, and the PWA manifest.

`src/` holds the editable SVGs; `png/` holds rasterized exports. Re-run
`./render.sh` (needs `rsvg-convert`, from `brew install librsvg`) after editing
any SVG.

### Flat marks — `src/chata-mark-{accent,ink,white}.svg`

The bare A-frame on a transparent background, one per single-colour treatment:

| Variant  | Colour    | Use on                                |
| -------- | --------- | ------------------------------------- |
| `accent` | `#2f9e73` | light surfaces (default trip green)   |
| `ink`    | `#1c1b18` | light surfaces, single-colour / print |
| `white`  | `#ffffff` | photos and dark surfaces (reversed)   |

Exported at 16, 32, 48, 64, 120, 180, 240, 512 px.

### App-icon tiles — `src/chata-icon-{cabin,la2028,baltic}.svg`

Rounded square carrying a trip's accent gradient with the mark reversed to white
— the home-screen icon, where the trip photo doesn't reach. One per seeded trip:

| Theme    | Gradient            |
| -------- | ------------------- |
| `cabin`  | sage → forest green |
| `la2028` | cobalt blue         |
| `baltic` | sunset gold → coral |

Exported at 120, 180, 192, 512, 1024 px. **`chata-icon-cabin-120.png` is the
120×120 the email template asks for** (cabin = the neutral default trip).

## Emails

Email clients render PNG, not SVG. Reference an export by absolute URL and pin
its size, e.g.:

```html
<img src="https://your-host/logo/png/chata-icon-cabin-120.png" width="60" height="60" alt="Chata">
```

Serve the 120 px (2×) file at 60 px display for crisp rendering on retina.
