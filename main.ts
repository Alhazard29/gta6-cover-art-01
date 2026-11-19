// Vice City Cover Studio — entry program for gta6-cover-art-01 (Node 22, stdlib only).
//
// The app itself is plain static files under app/: index.html opens in desktop
// Chrome with no network request, and main.js renders the cover maker. This
// program's only job is to hand that app in: it copies app/ and screenshots/
// from this repository into the output directory and writes dossier.json with
// the make.fun library (vendor/makefun-app.ts, the kit's copy, unchanged).
//
// Local check:  mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// The grader runs the same program with /output as the destination.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Caps straight from the competition gate: the dossier text budget, the
// screenshot count/size limits, and the app/ file count, byte and path caps.
// Only text_max_bytes changes the dossier bytes; the rest make this program
// fail exactly where the scorer would refuse the entry.
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
};

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'app'), join(outputDir, 'app'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

writeFileSync(join(outputDir, 'dossier.json'), buildDossier(outputDir, DOSSIER_CAPS));
