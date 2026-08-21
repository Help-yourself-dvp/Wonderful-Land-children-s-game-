// Рендер страницы выбора значков в PNG (пользователь видит картинки, а не код)
import chromium from '@sparticuz/chromium';
import { chromium as pw } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
chromium.setGraphicsMode = false;
const exe = await chromium.executablePath();
const bad = ['--disable-webgl', '--single-process', '--disable-gpu'];
const args = chromium.args.filter(a => !bad.some(b => a === b));
args.push('--no-sandbox', '--disable-dev-shm-usage');
const browser = await pw.launch({ executablePath: exe, args, headless: true, ignoreDefaultArgs: ['--disable-webgl', '--disable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 1150 } });
await page.goto('file:///home/user/Wonderful-Land-children-s-game-/icon-variants.html', { waitUntil: 'load' });
await page.waitForTimeout(400);
await page.screenshot({ path: '/home/user/icon-variants.png', fullPage: true });
console.log('screenshot saved');
await browser.close();
