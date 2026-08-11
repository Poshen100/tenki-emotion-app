import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
const repoRoot = '/home/user/tenki-emotion-app';
const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml' };
const server = http.createServer(async (req,res)=>{
  let c = decodeURIComponent(req.url.split('?')[0]);
  if (c==='/v3'||c==='/v3/') c='/apps/preview/v6/index.html';
  else if (c.startsWith('/v3/')) c='/apps/preview/v6/'+c.slice(4);
  else if (c.startsWith('/preview/')) c='/apps/preview/'+c.slice(9);
  try { const b=await readFile(resolve(repoRoot,'.'+c));
    res.writeHead(200,{'Content-Type':MIME[extname(c)]||'text/plain'}); res.end(b);
  } catch { res.writeHead(404); res.end('nf'); }
});
await new Promise(r=>server.listen(0,r));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:390,height:844}});
await page.goto(`${base}/v3/`,{waitUntil:'domcontentloaded'});
await page.waitForTimeout(3500);
await page.evaluate(()=>window.goTab('today'));
await page.waitForTimeout(1000);
console.log(await page.evaluate(()=>{
  const r=(s)=>{const e=document.querySelector(s); if(!e) return null;
    const b=e.getBoundingClientRect();
    const top=document.elementFromPoint(b.left+b.width/2,b.top+b.height/2);
    return {sel:s, top:Math.round(b.top), bottom:Math.round(b.bottom), clear: !!top && e.contains(top), covered: top?top.className||top.tagName:null};};
  const dock=document.querySelector('#fdcb');
  return JSON.stringify({
    dockTop: dock?Math.round(dock.getBoundingClientRect().top):null,
    viewport: window.innerHeight,
    note:r('.vitals-demo-note'), dots:r('#snapDots'), track:r('#snapTrack')
  },null,1);
}));
await browser.close(); server.close();
