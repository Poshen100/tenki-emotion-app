import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const repoRoot = '/home/user/tenki-emotion-app';
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml' };
const server = http.createServer(async (req,res)=>{
  let clean = decodeURIComponent(req.url.split('?')[0]);
  if (clean === '/v3' || clean === '/v3/') clean = '/apps/preview/v6/index.html';
  else if (clean.startsWith('/v3/')) clean = '/apps/preview/v6/' + clean.slice('/v3/'.length);
  else if (clean.startsWith('/preview/')) clean = '/apps/preview/' + clean.slice('/preview/'.length);
  try { const buf = await readFile(resolve(repoRoot, '.'+clean));
    res.writeHead(200,{'Content-Type':MIME[extname(clean)]||'text/plain'}); res.end(buf);
  } catch { res.writeHead(404); res.end('nf'); }
});
await new Promise(r=>server.listen(0,r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport:{width:390,height:844}, deviceScaleFactor:2 });
await page.goto(`${base}/v3/`, { waitUntil:'domcontentloaded' });
await page.waitForTimeout(4000);
await page.evaluate(()=>window.goTab('today'));
await page.waitForTimeout(1200);
await page.evaluate(()=>{ const t=document.querySelector('#snapTrack'); if(t) t.scrollIntoView({block:'center'}); });
await page.waitForTimeout(800);
const out = '/tmp/claude-0/-home-user-tenki-emotion-app/21c064e7-3314-50a7-acee-b3ad1dde8457/scratchpad/today.png';
await page.screenshot({ path: out });
console.log('saved', out);
await browser.close(); server.close();
