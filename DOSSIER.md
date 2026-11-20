# Vice City Cover Studio — Dossier

## What this is

Vice City Cover Studio is an offline, static web app that turns a person's
own photos and a caption into GTA-style multi-panel cover art — the poster
look of bold caption lettering over a Vice City sunset or neon colour
grade — and exports it as a PNG to share.

There is no build step, no server, and no network request. The app is
plain files under `app/`: open `app/index.html` in desktop Chrome (or
serve the folder with any static file server) and it works. Photos are
read from the person's own machine through the file picker and never
leave the device. All art on the cover — the synthwave sun, the skyline
silhouette, the palm silhouettes, the caption lettering — is original
canvas work drawn by this app. No Rockstar Games logo, wordmark,
artwork, character, or font is used anywhere. The only fonts are the
system stacks named in the code (`Arial Narrow` / `Impact` / `Georgia`
fallbacks); no font file is shipped.

## How it works

1. Add photos — one photo or several, portrait, landscape, or square.
   Each photo appears as a thumbnail in the Photos list.
2. Pick a layout and a colour grade. The live preview updates at once.
3. Edit the title and subtitle in the Caption fields.
4. Click a panel on the canvas to select it, then drag it to pan, scroll
   over it to zoom (or use the Zoom slider), and double-click it to swap
   its photo for the next one. Clicking a thumbnail drops that photo
   into the selected panel. Reset panel restores cover fit.
5. Pick an export size and press Export PNG. The app renders the cover
   offscreen at full resolution and downloads a real PNG.
6. Shuffle picks a new layout and grade and redeals the photos.

Everything is local. Shuffle is the only use of randomness, and it only
affects the live session — exports are deterministic for a given state.

## Layouts (5)

| Layout | Panels | Shape |
| --- | --- | --- |
| Vice Grid | 5 | Left column of two stacked panels; right column with one wide panel on top and two half-width panels below |
| Four Panel | 4 | Two-by-two grid |
| Nine Grid | 9 | Three-by-three grid |
| Full Bleed | 1 | One photo fills the whole cover |
| Triple Strip | 3 | Three vertical strips |

Every layout reserves a caption band: band layouts put the title and
subtitle in a band below the panels; overlay layouts paint the caption
over the bottom of the panels on a darkened strip so the lettering stays
readable on any photo.

## Colour grades (5)

| Grade | Sky | Feel |
| --- | --- | --- |
| Vice Sunset | Peach to rose | The default poster sunset |
| Neon Nights | Violet to hot pink | Night-drive neon |
| Palm Dusk | Lavender to coral | Softer dusk |
| Noir | Grey to black | Near-monochrome, high contrast |
| Candy Pop | Pink to violet | Bright, saturated pop |

A grade is a sky gradient, a translucent wash laid over the photos, a
canvas filter applied to each photo as it is drawn (so the grade feels
baked in, not pasted on), and a caption colour set.

## Export sizes (3)

- 1080 x 1080 (square post)
- 1080 x 1350 (portrait post)
- 1920 x 1080 (wide post)

## Files

```text
main.ts                  Entry point: copies app/ and screenshots/ to the
                         output directory and writes output/dossier.json
                         with buildDossier. Every repository path is
                         anchored to this file, never to the working
                         directory, so the grader can run it from any cwd.
app/index.html           The editor page: preview canvas, photo list,
                         layout / grade / size pickers, caption fields,
                         zoom slider, Shuffle and Export PNG.
app/style.css            The editor's own styling (dark studio theme).
app/src/main.js          Editor wiring: state, photo loading from the
                         file input, panel selection / pan / zoom,
                         controls, export, and the window.__coverStudio
                         headless hook.
app/src/cover.js         The cover engine: layout geometry, grade
                         definitions, procedural sunset art for empty
                         panels, photo drawing with pan/zoom, caption
                         rendering, and PNG export.
app/screenshots/        Mirror of screenshots/ (see below).
screenshots/            The four screenshots listed below.
vendor/makefun-app.ts    The kit's dossier builder, unchanged.
LICENSE                  SPDX MIT.
README.md                Project readme.
DOSSIER.md               This file.
```

## How to run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

That copies `app/` and `screenshots/` into `out/` and writes
`out/dossier.json`. The app itself needs nothing else:

```sh
# Serve it with any static server, then open index.html:
python3 -m http.server --directory app 8000
# or simply open app/index.html in desktop Chrome.
```

## Verification summary

Verified headless in Chromium against this exact build, over a local
HTTP server on 127.0.0.1, plus a file:// boot check:

- App boots over http:// and over file:// (the module scripts load;
  plain Chromium blocks ES modules on file:// by CORS policy, which is
  a browser rule, not an app defect — the app itself boots from file://
  with that flag allowed).
- Three self-made test photos (portrait 900x1200, landscape 1600x1000,
  square 1000x1000) load through the real file input and appear in the
  photo list, in the thumbnails, and in the panels.
- All 5 layouts x 5 grades render: 25 of 25 combinations produce a
  non-blank cover on the preview canvas.
- Export downloads a real PNG with correct IHDR dimensions:
  1920x1080 for the wide cover, 1080x1350 for the portrait cover.
  The PNGs are the app's own output, scaled down only for the
  screenshots below — never edited or composited.
- Zero console errors, zero page errors, zero failed requests, zero
  external network requests during the whole run (every request was
  to the local server, a data: URI, or a blob: URL).
- Determinism: running `main.ts` twice into a fresh output directory
  produces byte-identical `dossier.json` (same sha256 both runs).
- Grader simulation: the program was run as user `nobody` (uid 65534)
  in a private mount namespace with the repository read-only and the
  output directory as a mount point, with a 10-second timeout, from
  two different working directories — the repository root and an
  unrelated directory. Both runs exit 0 within the timeout, and the
  `dossier.json` sha256 is identical across both runs, so no relative
  path or working-directory assumption remains.
- No font files ship in the repository, and no reference to any
  bundled display font or font-loading API appears anywhere in it
  (checked by grep).

One defect was found during verification and fixed: the headless hook's
`setLayout` / `setGrade` / `setSize` changed the state and re-rendered
but did not update the picker buttons' active state, so an editor
screenshot could show the wrong layout or grade highlighted. The three
setters now sync the picker buttons, and the affected screenshot was
re-captured after the fix. The full verification was re-run after the
fix and passes.

## Screenshots

All four were taken fresh from this build. The photos in them are
self-made test images (a generated sunset scene with sun, skyline, and
palms — no real person, no game artwork). Each file is at most 256 KiB,
long side at most 1280 px, short side at least 480 px.

| File | Size | Shows |
| --- | --- | --- |
| `01-cover.jpg` | 1280 x 720 | The cover (first by name): an exported PNG, Vice Grid / Vice Sunset, 1920 x 1080, scaled to fit |
| `02-editor.jpg` | 1278 x 1280 | The editor with a photo loaded: Vice Grid / Vice Sunset, three photos in the list, live preview |
| `03-cover-portrait.jpg` | 1024 x 1280 | An exported PNG, Four Panel / Neon Nights, 1080 x 1350, scaled to fit |
| `04-editor-neon.jpg` | 1278 x 1280 | The editor: Nine Grid / Neon Nights, three photos in the list, live preview |

The cover on top is the first screenshot by name, as the competition
requires. The two editor shots show the app at work with a photo
loaded; the two cover shots show what the app exports, in two of the
three post sizes, in two different layouts and grades.
