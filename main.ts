// main.ts — entrypoint for the gta6-cover-art-01 bounty (round 4).
// Copies app/ and screenshots/ from this repository into the output
// directory and writes /output/dossier.json with buildDossier from
// vendor/makefun-app.ts. Outside the grader, MAKEFUN_OUTPUT_DIR stands
// in for /output. Node 22+ standard library only; no network, no build.

import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildDossier } from './vendor/makefun-app.ts';

const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The dossier caps are the competition's own: at most 160 KiB of source
// text, 3-4 screenshots of at most 256 KiB each, app/ at most 993 files
// and directories and 48 MiB in all, paths at most 1,000 bytes.
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 256 * 1024 },
  app_max_files: 993,
  app_max_bytes: 48 * 1024 * 1024,
  app_path_max_bytes: 1000,
} as const;

mkdirSync(outDir, { recursive: true });
cpSync('app', join(outDir, 'app'), { recursive: true });
cpSync('screenshots', join(outDir, 'screenshots'), { recursive: true });

const dossier = buildDossier(outDir, DOSSIER_CAPS);
writeFileSync(join(outDir, 'dossier.json'), dossier);

console.log(`wrote ${join(outDir, 'dossier.json')} (${dossier.length} bytes)`);
