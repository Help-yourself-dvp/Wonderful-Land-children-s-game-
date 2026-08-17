import chromium from '@sparticuz/chromium';
import { chromium as pw } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..', '..');
chromium.setGraphicsMode = false;
const exe = await chromium.executablePath();
const bad = ['--disable-webgl','--single-process','--disable-gpu'];
const args = chromium.args.filter(a => !bad.some(b => a === b));
args.push('--no-sandbox','--enable-webgl','--use-angle=swiftshader','--ignore-gpu-blocklist','--enable-unsafe-swiftshader','--disable-dev-shm-usage');
const browser = await pw.launch({ executablePath: exe, args, headless: true, ignoreDefaultArgs:['--disable-webgl','--disable-gpu'] });
const out = [];
for (const [w,h] of [[1280,800],[812,375]]) {
  const ctx = await browser.newContext({ viewport:{width:w,height:h}, deviceScaleFactor:1 });
  const page = await ctx.newPage();
  const errs=[]; page.on('pageerror',e=>errs.push(e.message));
  // 5-6 лет (больше предметов)
  await ctx.addInitScript(()=>localStorage.setItem('wm_age_group','1'));
  await page.goto('file://'+REPO+'/wonder-meadow-preview.html#shot-owl',{waitUntil:'load',timeout:60000});
  await page.waitForTimeout(7000);
  const data = await page.evaluate(()=>{
    const field = document.getElementById('cgItems');
    const fr = field.getBoundingClientRect();
    const items = [...field.querySelectorAll('.cg-item')].map(el=>{
      const r = el.getBoundingClientRect();
      return { top: Math.round(r.top - fr.top), left: Math.round(r.left - fr.left), w: Math.round(r.width), h: Math.round(r.height), overflowTop: r.top < fr.top, overflowBottom: r.bottom > fr.bottom };
    });
    const ans = [...document.getElementById('cgAnswers').children].map(b=>{const r=b.getBoundingClientRect();return {top:Math.round(r.top-fr.top),bottom:Math.round(r.bottom-fr.bottom),h:Math.round(r.height)};});
    return { field:{w:Math.round(fr.width),h:Math.round(fr.height)}, n:items.length, items, ans, anyTopOverflow: items.some(i=>i.overflowTop), anyBottomOverflow: items.some(i=>i.overflowBottom) };
  });
  out.push({viewport:`${w}x${h}`, ...data, errors:errs});
  await page.screenshot({path:path.join(__dirname,`owl-diag-${w}.png`)});
  await ctx.close();
}
console.log(JSON.stringify(out,null,2));
await browser.close();
