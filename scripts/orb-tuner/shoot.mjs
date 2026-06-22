/**
 * orb-tuner/shoot.mjs — headless render→screenshot feedback loop for the gold-sand
 * processing orb (drawProcessingOrb in apps/preview/soul-enroll.js).
 *
 * Loads harness.html (which exposes window.TENKI_ORB without booting the app),
 * renders the orb at several animation times and both production radii (R=76 the
 * processing screen, R=98 the baseline result screens — plus a large R=150 for a
 * crisp side-by-side against scripts/orb-tuner/reference.png / IMG_8437), and
 * writes PNGs to scripts/orb-tuner/out/.
 *
 * Run: node scripts/orb-tuner/shoot.mjs
 * (Playwright is installed globally; we import it by absolute path so ESM resolves.)
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, 'out');
mkdirSync(outDir, { recursive: true });

const FRAMES = [1200, 3000, 5200, 8000]; // ms — spread across the animation cycle
const RADII = [76, 98, 150];

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage({ deviceScaleFactor: 2 });
await page.goto(pathToFileURL(join(here, 'harness.html')).href);

const ready = await page.evaluate(() => window.__ready === true);
if (!ready) {
  console.error('FAIL: window.TENKI_ORB not exposed — check the harness flag/script order');
  await browser.close();
  process.exit(1);
}

const orb = page.locator('#orb');
for (const R of RADII) {
  for (const t of FRAMES) {
    await page.evaluate(([tt, rr]) => window.__renderAt(tt, rr), [t, R]);
    const file = join(outDir, `orb_R${R}_t${t}.png`);
    await orb.screenshot({ path: file });
    console.log('wrote', file);
  }
}

await browser.close();
console.log('done →', outDir);
