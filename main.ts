// Vice City Cover Studio — entrypoint for make.fun gta6-cover-art-01.
// Copies app/ and screenshots/ from this repository into the output
// directory and writes output/dossier.json with buildDossier.
//
// Every repository path is anchored to this file, never to the working
// directory: the grader runs main.ts with a cwd outside the repo root,
// so no relative path and no process.cwd() may name a repo file.

import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const REPO_ROOT = dirname(fileURLToPath(import.meta.url));
const APP_DIR = join(REPO_ROOT, 'app');
const SHOTS_DIR = join(REPO_ROOT, 'screenshots');
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const OUT_APP_DIR = join(OUTPUT_DIR, 'app');
const OUT_SHOTS_DIR = join(OUTPUT_DIR, 'screenshots');

mkdirSync(OUT_APP_DIR, { recursive: true });
mkdirSync(OUT_SHOTS_DIR, { recursive: true });
cpSync(APP_DIR, OUT_APP_DIR, { recursive: true });
cpSync(SHOTS_DIR, OUT_SHOTS_DIR, { recursive: true });

const dossier = buildDossier(OUTPUT_DIR, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 48 * 1024 * 1024,
  app_path_max_bytes: 1000,
});
writeFileSync(join(OUTPUT_DIR, 'dossier.json'), dossier);
