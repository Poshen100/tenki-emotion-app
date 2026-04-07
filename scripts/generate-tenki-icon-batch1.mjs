import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const outputRoot = path.join(repoRoot, 'docs', 'assets', 'icons', 'batch1');
const outlineDir = path.join(outputRoot, 'outline');
const fillDir = path.join(outputRoot, 'fill');

const LIGHT = '#F5F7FA';

function svg(content) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">\n${content}\n</svg>\n`;
}

function outline(body) {
  return svg(`  <g fill="none" stroke="${LIGHT}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">\n${body}\n  </g>`);
}

function fill(body) {
  return svg(body);
}

function maskFill(id, whiteShapes, blackShapes = '') {
  return `  <defs>\n    <mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">\n      <rect x="0" y="0" width="24" height="24" fill="#000"/>\n${whiteShapes}\n${blackShapes}\n    </mask>\n  </defs>\n  <rect x="0" y="0" width="24" height="24" fill="${LIGHT}" mask="url(#${id})"/>`;
}

const heartPath = 'M12 19.25 6.2 13.65c-1.77-1.7-1.77-4.46 0-6.16 1.56-1.5 4.08-1.5 5.63 0l.17.16.17-.16c1.55-1.5 4.07-1.5 5.63 0 1.77 1.7 1.77 4.46 0 6.16L12 19.25Z';
const hrvHeartPath = 'M12 18.9 6.7 13.88c-1.55-1.47-1.55-3.87 0-5.34 1.34-1.27 3.53-1.27 4.88 0L12 8.95l.42-.41c1.35-1.27 3.54-1.27 4.88 0 1.55 1.47 1.55 3.87 0 5.34L12 18.9Z';
const sleepPath = 'M15.6 5.2c-4.35.45-7.75 4.13-7.75 8.6 0 3.02 1.55 5.68 3.9 7.2-3.7-.12-6.75-3.15-6.75-6.95 0-4.36 3.54-7.9 7.9-7.9.92 0 1.8.16 2.7.45Z';

const icons = [
  {
    slug: 'heart-rate',
    label: 'Heart Rate',
    category: 'Biometrics',
    priority: 'MVP',
    outlineBody: `    <path d="${heartPath}"/>`,
    fillBody: `  <path d="${heartPath}" fill="${LIGHT}"/>`,
  },
  {
    slug: 'hrv',
    label: 'HRV',
    category: 'Biometrics',
    priority: 'MVP',
    outlineBody: `    <path d="${hrvHeartPath}"/>\n    <line x1="8.2" y1="15.1" x2="15.8" y2="15.1"/>\n    <line x1="9.2" y1="15.1" x2="9.2" y2="12.8"/>\n    <line x1="12" y1="15.1" x2="12" y2="11.9"/>\n    <line x1="14.8" y1="15.1" x2="14.8" y2="13.4"/>`,
    fillBody: maskFill(
      'mask-hrv',
      `      <path d="${hrvHeartPath}" fill="#fff"/>`,
      `      <rect x="8.1" y="14.4" width="7.8" height="1.4" rx="0.7" fill="#000"/>\n      <rect x="8.5" y="12.5" width="1.4" height="2.9" rx="0.7" fill="#000"/>\n      <rect x="11.3" y="11.6" width="1.4" height="3.8" rx="0.7" fill="#000"/>\n      <rect x="14.1" y="13.1" width="1.4" height="2.3" rx="0.7" fill="#000"/>`,
    ),
  },
  {
    slug: 'stress',
    label: 'Stress',
    category: 'Biometrics',
    priority: 'MVP',
    outlineBody: `    <path d="M5 15.5a7 7 0 0 1 14 0"/>\n    <circle cx="12" cy="15.5" r="1.25"/>\n    <path d="M12 15.5 16.6 10.9"/>`,
    fillBody: `  <path fill="${LIGHT}" fill-rule="evenodd" clip-rule="evenodd" d="M12 6a7 7 0 0 1 7 7h-2.2A4.8 4.8 0 0 0 12 8.2 4.8 4.8 0 0 0 7.2 13H5a7 7 0 0 1 7-7Zm0 8.15a1.35 1.35 0 1 0 0 2.7 1.35 1.35 0 0 0 0-2.7Z"/>\n  <path d="M11.25 14.72 15.92 10.05a1 1 0 1 1 1.42 1.41l-4.67 4.67a1 1 0 0 1-1.42-1.41Z" fill="${LIGHT}"/>`,
  },
  {
    slug: 'breathing',
    label: 'Breathing',
    category: 'Biometrics',
    priority: 'MVP',
    outlineBody: `    <path d="M9 6.7C6.92 7.46 5.6 9.48 5.6 12S6.92 16.54 9 17.3"/>\n    <path d="M15 6.7c2.08.76 3.4 2.78 3.4 5.3s-1.32 4.54-3.4 5.3"/>\n    <circle cx="12" cy="12" r="1.2"/>`,
    fillBody: `  <g fill="none" stroke="${LIGHT}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round">\n    <path d="M8.8 6.9C6.9 7.7 5.8 9.52 5.8 12s1.1 4.3 3 5.1"/>\n    <path d="M15.2 6.9c1.9.8 3 2.62 3 5.1s-1.1 4.3-3 5.1"/>\n  </g>\n  <circle cx="12" cy="12" r="1.6" fill="${LIGHT}"/>`,
  },
  {
    slug: 'body-battery',
    label: 'Body Battery',
    category: 'Biometrics',
    priority: 'Batch 2',
    outlineBody: `    <rect x="4.5" y="8" width="13.6" height="8" rx="2.4"/>\n    <rect x="18.4" y="10" width="1.8" height="4" rx="0.7"/>\n    <rect x="7" y="10.6" width="6.4" height="2.8" rx="1.2"/>`,
    fillBody: maskFill(
      'mask-body-battery',
      `      <rect x="4.5" y="8" width="13.6" height="8" rx="2.4" fill="#fff"/>\n      <rect x="18.4" y="10" width="1.8" height="4" rx="0.7" fill="#fff"/>`,
      `      <rect x="7" y="10.6" width="6.4" height="2.8" rx="1.2" fill="#000"/>`,
    ),
  },
  {
    slug: 'ans-balance',
    label: 'ANS Balance',
    category: 'Biometrics',
    priority: 'Batch 2',
    outlineBody: `    <path d="M10.2 6.5C7.7 7.4 6 9.48 6 12s1.7 4.6 4.2 5.5"/>\n    <path d="M13.8 6.5c2.5.9 4.2 2.98 4.2 5.5s-1.7 4.6-4.2 5.5"/>\n    <line x1="12" y1="8.6" x2="12" y2="15.4"/>`,
    fillBody: `  <g fill="none" stroke="${LIGHT}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round">\n    <path d="M9.95 6.85C8.15 7.7 6.9 9.48 6.9 12s1.25 4.3 3.05 5.15"/>\n    <path d="M14.05 6.85c1.8.85 3.05 2.63 3.05 5.15s-1.25 4.3-3.05 5.15"/>\n  </g>\n  <rect x="11" y="8.5" width="2" height="7" rx="1" fill="${LIGHT}"/>`,
  },
  {
    slug: 'deep-scan',
    label: 'Deep Scan',
    category: 'Scan / Analysis',
    priority: 'MVP',
    outlineBody: `    <path d="M8.2 5.6A7.4 7.4 0 1 1 5.5 16"/>\n    <path d="M10.1 8.2A4.8 4.8 0 1 1 8.6 15.3"/>\n    <line x1="8.4" y1="15.7" x2="15.6" y2="15.7"/>`,
    fillBody: `  <g fill="none" stroke="${LIGHT}" stroke-width="3.1" stroke-linecap="round" stroke-linejoin="round">\n    <path d="M8.2 5.6A7.4 7.4 0 1 1 5.5 16"/>\n    <path d="M10.1 8.2A4.8 4.8 0 1 1 8.6 15.3"/>\n  </g>\n  <rect x="8.2" y="14.95" width="7.6" height="1.5" rx="0.75" fill="${LIGHT}"/>`,
  },
  {
    slug: 'signal-quality',
    label: 'Signal Quality',
    category: 'Scan / Analysis',
    priority: 'MVP',
    outlineBody: `    <rect x="5.3" y="13.2" width="2.4" height="4.8" rx="1"/>\n    <rect x="8.9" y="11.1" width="2.4" height="6.9" rx="1"/>\n    <rect x="12.5" y="9" width="2.4" height="9" rx="1"/>\n    <rect x="16.1" y="6.9" width="2.4" height="11.1" rx="1"/>`,
    fillBody: `  <rect x="5.3" y="13.2" width="2.4" height="4.8" rx="1" fill="${LIGHT}"/>\n  <rect x="8.9" y="11.1" width="2.4" height="6.9" rx="1" fill="${LIGHT}"/>\n  <rect x="12.5" y="9" width="2.4" height="9" rx="1" fill="${LIGHT}"/>\n  <rect x="16.1" y="6.9" width="2.4" height="11.1" rx="1" fill="${LIGHT}"/>`,
  },
  {
    slug: 'insights',
    label: 'Insights',
    category: 'Scan / Analysis',
    priority: 'MVP',
    outlineBody: `    <rect x="5.5" y="5.5" width="13" height="13" rx="3"/>\n    <path d="M8 15.3 10.8 12.5 13 14.7 16 10.4"/>\n    <circle cx="16" cy="10.4" r="1"/>`,
    fillBody: maskFill(
      'mask-insights',
      `      <rect x="5.5" y="5.5" width="13" height="13" rx="3" fill="#fff"/>`,
      `      <path d="M8 15.3 10.8 12.5 13 14.7 16 10.4" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>\n      <circle cx="16" cy="10.4" r="1.1" fill="#000"/>`,
    ),
  },
  {
    slug: 'expand-details',
    label: 'Expand Details',
    category: 'Scan / Analysis',
    priority: 'Batch 2',
    outlineBody: `    <path d="M9 5.5H5.5V9"/>\n    <path d="M15 5.5h3.5V9"/>\n    <path d="M9 18.5H5.5V15"/>\n    <path d="M15 18.5h3.5V15"/>`,
    fillBody: `  <path d="M5.5 5.5h4V7.2H7.2v2.3H5.5V5.5Zm9 0h4v4h-1.7V7.2h-2.3V5.5Zm-9 9.5h1.7v2.3h2.3v1.7h-4v-4Zm11.3 0h1.7v4h-4v-1.7h2.3V15Z" fill="${LIGHT}"/>`,
  },
  {
    slug: 'quick-check-in',
    label: 'Quick Check-in',
    category: 'Emotional / Wellness',
    priority: 'Batch 2',
    outlineBody: `    <path d="M7.5 7h9a2.5 2.5 0 0 1 2.5 2.5v5a2.5 2.5 0 0 1-2.5 2.5h-4.3L9.6 19v-2h-2.1A2.5 2.5 0 0 1 5 14.5v-5A2.5 2.5 0 0 1 7.5 7Z"/>\n    <circle cx="12" cy="12" r="1.2"/>`,
    fillBody: maskFill(
      'mask-quick-check-in',
      `      <path d="M7.5 7h9a2.5 2.5 0 0 1 2.5 2.5v5a2.5 2.5 0 0 1-2.5 2.5h-4.3L9.6 19v-2h-2.1A2.5 2.5 0 0 1 5 14.5v-5A2.5 2.5 0 0 1 7.5 7Z" fill="#fff"/>`,
      `      <circle cx="12" cy="12" r="1.3" fill="#000"/>`,
    ),
  },
  {
    slug: 'mood',
    label: 'Mood',
    category: 'Emotional / Wellness',
    priority: 'Batch 2',
    outlineBody: `    <circle cx="12" cy="12" r="7"/>\n    <line x1="9.5" y1="10.3" x2="9.5" y2="11.7"/>\n    <line x1="14.5" y1="10.3" x2="14.5" y2="11.7"/>\n    <path d="M9.4 14.8c1.4-.5 3.8-.5 5.2 0"/>`,
    fillBody: maskFill(
      'mask-mood',
      `      <circle cx="12" cy="12" r="7" fill="#fff"/>`,
      `      <rect x="8.9" y="9.8" width="1.2" height="2.4" rx="0.6" fill="#000"/>\n      <rect x="13.9" y="9.8" width="1.2" height="2.4" rx="0.6" fill="#000"/>\n      <rect x="9.4" y="14.3" width="5.2" height="1.3" rx="0.65" fill="#000"/>`,
    ),
  },
  {
    slug: 'sleep',
    label: 'Sleep',
    category: 'Emotional / Wellness',
    priority: 'Batch 2',
    outlineBody: `    <path d="${sleepPath}"/>`,
    fillBody: `  <path d="${sleepPath}" fill="${LIGHT}"/>`,
  },
  {
    slug: 'recovery',
    label: 'Recovery',
    category: 'Emotional / Wellness',
    priority: 'Batch 2',
    outlineBody: `    <path d="M7 8.3a7 7 0 1 1 8.9 8.55"/>\n    <path d="M16.4 7.7A4.7 4.7 0 0 1 15.5 16"/>`,
    fillBody: `  <g fill="none" stroke="${LIGHT}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">\n    <path d="M7 8.3a7 7 0 1 1 8.9 8.55"/>\n    <path d="M16.4 7.7A4.7 4.7 0 0 1 15.5 16"/>\n  </g>`,
  },
  {
    slug: 'focus',
    label: 'Focus',
    category: 'Emotional / Wellness',
    priority: 'Batch 2',
    outlineBody: `    <circle cx="12" cy="12" r="1.5"/>\n    <line x1="12" y1="6.5" x2="12" y2="8.4"/>\n    <line x1="12" y1="15.6" x2="12" y2="17.5"/>\n    <line x1="6.5" y1="12" x2="8.4" y2="12"/>\n    <line x1="15.6" y1="12" x2="17.5" y2="12"/>`,
    fillBody: `  <circle cx="12" cy="12" r="1.8" fill="${LIGHT}"/>\n  <rect x="11.1" y="6.4" width="1.8" height="2.3" rx="0.9" fill="${LIGHT}"/>\n  <rect x="11.1" y="15.3" width="1.8" height="2.3" rx="0.9" fill="${LIGHT}"/>\n  <rect x="6.4" y="11.1" width="2.3" height="1.8" rx="0.9" fill="${LIGHT}"/>\n  <rect x="15.3" y="11.1" width="2.3" height="1.8" rx="0.9" fill="${LIGHT}"/>`,
  },
  {
    slug: 'garmin-source',
    label: 'Garmin Source',
    category: 'System / Source',
    priority: 'Batch 2',
    outlineBody: `    <line x1="10" y1="5.5" x2="14" y2="5.5"/>\n    <rect x="8" y="7" width="8" height="10" rx="2.4"/>\n    <line x1="10" y1="18.5" x2="14" y2="18.5"/>\n    <circle cx="12" cy="12" r="1.2"/>`,
    fillBody: maskFill(
      'mask-garmin',
      `      <rect x="10" y="4.7" width="4" height="1.7" rx="0.85" fill="#fff"/>\n      <rect x="8" y="7" width="8" height="10" rx="2.4" fill="#fff"/>\n      <rect x="10" y="17.6" width="4" height="1.7" rx="0.85" fill="#fff"/>`,
      `      <circle cx="12" cy="12" r="1.3" fill="#000"/>`,
    ),
  },
  {
    slug: 'rppg-source',
    label: 'rPPG Source',
    category: 'System / Source',
    priority: 'Batch 2',
    outlineBody: `    <rect x="5.5" y="8" width="13" height="8" rx="3"/>\n    <circle cx="12" cy="12" r="3"/>\n    <circle cx="16" cy="10" r="1"/>\n    <line x1="9" y1="16" x2="15" y2="16"/>`,
    fillBody: maskFill(
      'mask-rppg',
      `      <rect x="5.5" y="8" width="13" height="8" rx="3" fill="#fff"/>`,
      `      <circle cx="12" cy="12" r="3.1" fill="#000"/>\n      <circle cx="16" cy="10" r="1.1" fill="#000"/>\n      <rect x="9" y="15.2" width="6" height="1.4" rx="0.7" fill="#000"/>`,
    ),
  },
  {
    slug: 'close',
    label: 'Close',
    category: 'System / Source',
    priority: 'Batch 2',
    outlineBody: `    <path d="M7 7 17 17"/>\n    <path d="M17 7 7 17"/>`,
    fillBody: `  <g fill="none" stroke="${LIGHT}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round">\n    <path d="M7 7 17 17"/>\n    <path d="M17 7 7 17"/>\n  </g>`,
  },
  {
    slug: 'confirm',
    label: 'Confirm',
    category: 'System / Source',
    priority: 'Batch 2',
    outlineBody: `    <path d="M6.7 12.6 10.3 16.2 17.3 9.2"/>`,
    fillBody: `  <g fill="none" stroke="${LIGHT}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round">\n    <path d="M6.7 12.6 10.3 16.2 17.3 9.2"/>\n  </g>`,
  },
  {
    slug: 'warning',
    label: 'Warning',
    category: 'System / Source',
    priority: 'MVP',
    accent: '#F5A623',
    outlineBody: `    <path d="M12 5.5 18.7 17.3a1.2 1.2 0 0 1-1.04 1.8H6.34a1.2 1.2 0 0 1-1.04-1.8L12 5.5Z"/>\n    <line x1="12" y1="10.1" x2="12" y2="13.6"/>\n    <circle cx="12" cy="16.2" r="1"/>`,
    fillBody: maskFill(
      'mask-warning',
      `      <path d="M12 5.5 18.7 17.3a1.2 1.2 0 0 1-1.04 1.8H6.34a1.2 1.2 0 0 1-1.04-1.8L12 5.5Z" fill="#fff"/>`,
      `      <rect x="11.2" y="10.1" width="1.6" height="3.9" rx="0.8" fill="#000"/>\n      <circle cx="12" cy="16.2" r="1.05" fill="#000"/>`,
    ),
  },
];

function previewTile(icon, variant) {
  const file = variant === 'outline' || variant === 'disabled'
    ? `./outline/${icon.slug}.svg`
    : `./fill/${icon.slug}.svg`;

  const accentStyle = variant === 'selected' && icon.accent
    ? ` style="box-shadow: inset 0 0 0 1px ${icon.accent};"`
    : '';

  const className = variant === 'disabled' ? 'tile disabled' : variant === 'selected' ? 'tile selected' : 'tile';

  return `<figure class="${className}"${accentStyle}><img src="${file}" alt="${icon.label} ${variant}"/><figcaption>${variant}</figcaption></figure>`;
}

function buildPreviewHtml(iconDefs) {
  const cards = iconDefs.map((icon) => `
      <section class="card">
        <div class="card-head">
          <div>
            <h2>${icon.label}</h2>
            <p>${icon.category}</p>
          </div>
          <span class="priority ${icon.priority === 'MVP' ? 'mvp' : 'batch2'}">${icon.priority}</span>
        </div>
        <div class="variant-grid">
          ${previewTile(icon, 'outline')}
          ${previewTile(icon, 'fill')}
          ${previewTile(icon, 'selected')}
          ${previewTile(icon, 'disabled')}
        </div>
      </section>
  `).join('\n');

  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>TENKI Icon Batch 1 Preview</title>
  <style>
    :root {
      color-scheme: dark;
      --bg-0: #06080c;
      --bg-1: #0d1218;
      --bg-2: rgba(255,255,255,0.04);
      --bg-3: rgba(255,255,255,0.08);
      --line: rgba(255,255,255,0.1);
      --text-1: rgba(255,255,255,0.92);
      --text-2: rgba(255,255,255,0.62);
      --mvp: #00B4D8;
      --batch2: rgba(255,255,255,0.22);
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      min-height: 100vh;
      font-family: "SF Pro Display", "Segoe UI", sans-serif;
      background:
        radial-gradient(circle at top, rgba(0,180,216,0.14), transparent 35%),
        radial-gradient(circle at 20% 20%, rgba(255,255,255,0.05), transparent 20%),
        linear-gradient(180deg, var(--bg-1), var(--bg-0));
      color: var(--text-1);
    }

    main {
      width: min(1320px, calc(100vw - 48px));
      margin: 0 auto;
      padding: 40px 0 56px;
    }

    h1 {
      margin: 0 0 10px;
      font-size: 28px;
      font-weight: 600;
      letter-spacing: 0.02em;
    }

    .intro {
      margin: 0 0 32px;
      color: var(--text-2);
      line-height: 1.6;
      max-width: 760px;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 18px;
    }

    .card {
      border: 1px solid var(--line);
      background: linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.025));
      border-radius: 18px;
      padding: 16px;
      backdrop-filter: blur(18px);
    }

    .card-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 14px;
    }

    .card-head h2 {
      margin: 0 0 4px;
      font-size: 15px;
      font-weight: 600;
    }

    .card-head p {
      margin: 0;
      color: var(--text-2);
      font-size: 12px;
      letter-spacing: 0.02em;
    }

    .priority {
      flex: none;
      padding: 6px 10px;
      border-radius: 999px;
      font-size: 11px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      border: 1px solid var(--line);
    }

    .priority.mvp {
      border-color: rgba(0,180,216,0.4);
      color: var(--mvp);
    }

    .priority.batch2 {
      color: var(--text-2);
    }

    .variant-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
    }

    .tile {
      margin: 0;
      border-radius: 14px;
      border: 1px solid var(--line);
      background: var(--bg-2);
      min-height: 92px;
      display: grid;
      place-items: center;
      padding: 12px 8px 10px;
    }

    .tile.selected {
      background: var(--bg-3);
    }

    .tile.disabled img {
      opacity: 0.34;
    }

    .tile img {
      width: 28px;
      height: 28px;
      display: block;
    }

    figcaption {
      margin-top: 10px;
      font-size: 11px;
      color: var(--text-2);
      text-transform: capitalize;
      letter-spacing: 0.04em;
    }

    @media (max-width: 720px) {
      main { width: min(100vw - 24px, 1320px); padding-top: 24px; }
      .variant-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
  </style>
</head>
<body>
  <main>
    <h1>TENKI Icon Batch 1</h1>
    <p class="intro">Batch 1 preview for dark premium biometric dashboard usage. Each card shows outline, fill, selected, and disabled states using the exported SVG masters. Use the outline set as canonical construction reference and the fill set for selected / high-emphasis variants.</p>
    <div class="grid">
${cards}
    </div>
  </main>
</body>
</html>
`;
}

async function main() {
  await mkdir(outlineDir, { recursive: true });
  await mkdir(fillDir, { recursive: true });

  for (const icon of icons) {
    await writeFile(path.join(outlineDir, `${icon.slug}.svg`), outline(icon.outlineBody), 'utf8');
    await writeFile(path.join(fillDir, `${icon.slug}.svg`), fill(icon.fillBody), 'utf8');
  }

  const manifest = icons.map((icon) => ({
    slug: icon.slug,
    label: icon.label,
    category: icon.category,
    priority: icon.priority,
    accent: icon.accent ?? null,
    outline: `docs/assets/icons/batch1/outline/${icon.slug}.svg`,
    fill: `docs/assets/icons/batch1/fill/${icon.slug}.svg`,
    previewBehavior: {
      selected: 'Use fill asset for selected and high-emphasis state.',
      disabled: 'Use outline asset with 32% opacity on dark surfaces.',
    },
  }));

  await writeFile(path.join(outputRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  await writeFile(path.join(outputRoot, 'preview.html'), buildPreviewHtml(icons), 'utf8');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
