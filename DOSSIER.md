# Vice Cover Studio — deterministic dossier (round 4, chunk C)

## App purpose

Vice Cover Studio is a GTA 6-style cover art maker that runs entirely
offline in the browser. Load one or more photos from your own machine,
write a caption and subtitle, pick a multi-panel layout and a colour
grade, and export a share-ready PNG. No uploads, no network requests,
no font files. An original design — no Rockstar Games logo, artwork,
or font.

Run it:

```sh
python3 -m http.server --directory app 8080
```

Then open http://localhost:8080 in desktop Chrome.

## Layouts (5)

| ID | Name | Panels | Title zone |
|----|------|--------|------------|
| `vice-grid` | Vice Grid | 4 | top |
| `four-panel` | Four Panel | 4 | bottom |
| `nine-grid` | Nine Grid | 9 | bottom |
| `single-hero` | Single Hero | 1 | top |
| `duo-split` | Duo Split | 2 | bottom |

Default layout: Vice Grid.

## Colour grades (5)

| ID | Name |
|----|------|
| `classic` | Classic Vice |
| `neon` | Neon Nights |
| `sunset` | Vice Sunset |
| `noir` | Noir |
| `pastel` | Pastel Dusk |

Default grade: Vice Sunset. Each grade is a full palette (sky, sun,
ground, accent, ink, photo wash, three title-gradient stops) applied
to the background, the procedural empty-panel art, and the title.

## Export sizes (3)

- 1080 × 1080 (square)
- 1080 × 1350 (portrait)
- 1920 × 1080 (landscape)

Default size: 1080 × 1080. Export is a real PNG download
(`vice-cover-<layout>-<grade>-<size>.png`) produced from the live
preview canvas via `canvas.toBlob('image/png')`.

## Features

- **Photo load** — file input (`accept="image/*"`, multiple); photos
  are dealt round-robin across the panels and shown as thumbnails.
  Clicking a thumbnail assigns that photo to the selected panel.
  Photos never leave the browser (local `blob:` object URLs only).
- **Pan / zoom / reset** — click a panel to select it, drag to pan,
  scroll to zoom (1×–3×), double-click to reset; a zoom slider and a
  Reset panel button do the same for the selected panel. Pan is
  clamped so the photo always covers its panel.
- **Shuffle** — picks a different layout and a different grade and
  shuffles the assigned photos across the panels.
- **Caption / subtitle** — editable text inputs; the caption is drawn
  upper-case and auto-fitted to the canvas width.
- **PNG export** — one click downloads the cover at the selected
  size; the exported PNG matches the live preview canvas.
- **Procedural empty-panel art** — a panel with no photo draws a
  deterministic gradient sky, setting sun, ground band and geometric
  shapes (seeded per panel index), so the cover is complete with zero
  photos loaded and zero external images.

## System-fonts-only approach

All lettering uses operating-system font stacks; the app ships zero
font files and performs zero webfont loading:

- Display / titles: `"Arial Black", Impact, "Helvetica Neue", Arial,
  sans-serif` (900 weight, gradient fill, hard shadow).
- Subtitles: `Georgia, "Times New Roman", "Nimbus Roman", serif`
  (italic).
- UI: `"Helvetica Neue", Arial, "Segoe UI", sans-serif`.

There are no `.ttf`, `.otf`, or `.woff*` files anywhere in the
repository, and no webfont-loading API call or reference to any
downloaded display face anywhere in the source (verified by
repository-wide grep, chunk C).

## Screenshots (4, real renders, headless Chrome)

All four were captured from the working app served locally on
`http://127.0.0.1:8080/` with headless Chrome 159.0.8154.6
(`--headless --no-sandbox`, 1280 × 1100, JPEG quality 82). Each file
is at most 256 KiB. The first, by name, is the cover.

| File | Subject | Size (bytes) |
|------|---------|-------------|
| `01-cover.jpg` | Exported cover, default layout Vice Grid + default grade Vice Sunset, 1080 × 1080 (canvas clip) | 45,025 |
| `02-editor-layout-nine-grid.jpg` | Editor view, layout Nine Grid, grade Vice Sunset | 158,310 |
| `03-editor-grade-neon.jpg` | Editor view, layout Vice Grid, grade Neon Nights | 153,428 |
| `04-editor-photos-loaded.jpg` | Editor view, layout Vice Grid, grade Neon Nights, 3 procedural test photos loaded into panels (thumbnails visible) | 155,773 |

The test photos for shot 04 were generated locally with PIL
(gradient sky, sun, ground band, trees; 800 × 600 JPEGs) — no
external images were used anywhere. Copies live in
`app/screenshots/` and in root `screenshots/` (the entrypoint
`main.ts` copies root `screenshots/` into the output directory).

## Verification results (chunk C, headless Chrome, 2026-11-19)

Method: Chrome DevTools Protocol (Node 24 built-in WebSocket
client), app served from `app/` on `http://127.0.0.1:8080/`.
Console, exceptions, page log, and network traffic were captured for
the whole session (page load, layout/grade changes, photo load,
interactions, all 75 export combos, PNG download).

- **Console errors: 0.** Console warnings: 0. Uncaught exceptions:
  0. Page log errors: 0. Failed requests: 0.
- **Network requests: 7 total, 0 external.** The 7 requests were
  the page itself, `style.css`, `src/cover.js`, `src/main.js`, and 3
  `blob:` object URLs for the loaded test photos. Every request was
  local (`http://127.0.0.1:8080/` or `blob:`); no request left the
  machine.
- **Layout × grade × size export: 75 / 75 passed** (5 × 5 × 3).
  Every combination was exported through the real in-app path
  (`exportDataURL()` → `canvas.toDataURL('image/png')`) and checked
  for a valid PNG magic header (`data:image/png;base64,iVBOR…`) and
  for the canvas dimensions matching the selected size. Exported PNG
  byte sizes ranged from 380,289 to 1,073,580 bytes.
- **PNG export download: works.** Clicking Export PNG downloaded
  `vice-cover-vice-grid-sunset-1080x1080.png` (553,811 bytes, PNG
  image data, 1080 × 1080, valid PNG magic bytes `89 50 4E 47 0D
  0A 1A 0A`).
- **Photo load: works.** 3 test photos loaded via the real file
  input; `state.photos.length` became 3, all images `complete` with
  `naturalWidth > 0`; 3 thumbnails rendered; photos auto-assigned
  round-robin to panels 0–2.
- **Zoom: works.** Zoom slider to 2 → selected panel `zoom === 2`;
  mouse-wheel zoom −240 deltaY → zoom 1 → 1.2712491503214047.
- **Pan: works.** Drag (+120 px, +60 px) inside panel 0 at zoom 2
  moved the panel from `(x 0, y 0)` to `(x 0.6465517241379312,
  y 0.4807692307692308)`. (An earlier probe that clicked the canvas
  centre landed in the inter-panel gutter and selected no panel;
  re-tested with a click inside panel 0 — the app behaved
  correctly in both cases.)
- **Reset: works.** Reset button and double-click both restore the
  panel to `zoom 1, x 0, y 0`.
- **Shuffle: works.** One click changed layout Vice Grid →
  Duo Split and grade Neon Nights → Pastel Dusk.
- **Thumbnail assign: works.** Clicking thumbnail 3 assigned photo
  index 2 to the selected panel (was 1, became 2).
- **Caption edit: works.** Typing `LEONIDA NIGHTS` updated
  `state.caption` to `LEONIDA NIGHTS`.
- **No defects found; no app code was changed in chunk C.**
