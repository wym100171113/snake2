// Test script for the snake game at http://localhost:8080/
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = '/tmp/chrome_extract/opt/google/chrome/chrome';
const URL = 'http://localhost:8080/';
const OUT_DIR = '/workspace/test_output';

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

function log(...args) {
    const line = args.map(a => typeof a === 'string' ? a : JSON.stringify(a, null, 2)).join(' ');
    console.log(line);
    fs.appendFileSync(path.join(OUT_DIR, 'test.log'), line + '\n');
}

async function snap(page, name) {
    const file = path.join(OUT_DIR, `${name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    log(`📸 Saved ${file}`);
    return file;
}

async function canvasSnap(page, name) {
    const dataUrl = await page.evaluate(() => {
        const c = document.querySelector('#game-canvas');
        if (!c) return null;
        return c.toDataURL('image/png');
    });
    if (!dataUrl) {
        log(`⚠️  No canvas to snap for ${name}`);
        return null;
    }
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
    const file = path.join(OUT_DIR, `${name}.png`);
    fs.writeFileSync(file, Buffer.from(base64, 'base64'));
    log(`🎨 Canvas ${name} -> ${file} (${base64.length} bytes)`);
    return file;
}

async function pixelHash(page) {
    return page.evaluate(() => {
        const c = document.querySelector('#game-canvas');
        if (!c) return null;
        const tmp = document.createElement('canvas');
        tmp.width = 64; tmp.height = 64;
        const tctx = tmp.getContext('2d');
        tctx.drawImage(c, 0, 0, 64, 64);
        const data = tctx.getImageData(0, 0, 64, 64).data;
        let nonBg = 0;
        let sumR = 0, sumG = 0, sumB = 0;
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
            if (a > 0) {
                sumR += r; sumG += g; sumB += b;
                const max = Math.max(r, g, b);
                const min = Math.min(r, g, b);
                if (max - min > 30) nonBg++;
            }
        }
        let hash = 0;
        for (let i = 0; i < data.length; i += 16) {
            hash = ((hash << 5) - hash + data[i]) | 0;
        }
        return {
            width: c.width,
            height: c.height,
            nonBgPixels: nonBg,
            avgR: Math.round(sumR / (data.length / 4)),
            avgG: Math.round(sumG / (data.length / 4)),
            avgB: Math.round(sumB / (data.length / 4)),
            hash,
        };
    });
}

async function main() {
    log('🚀 Starting headless Chrome test for', URL);
    log('🕐 Time:', new Date().toISOString());

    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-first-run',
            '--no-default-browser-check',
            '--autoplay-policy=no-user-gesture-required',
        ],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 800, height: 1200, deviceScaleFactor: 1 });

    const consoleMsgs = [];
    const pageErrors = [];
    const requestFails = [];

    page.on('console', (msg) => {
        const entry = { type: msg.type(), text: msg.text() };
        consoleMsgs.push(entry);
        log(`[console.${msg.type()}]`, msg.text());
    });
    page.on('pageerror', (err) => {
        pageErrors.push({ message: err.message, stack: err.stack });
        log(`[pageerror]`, err.message);
        log(err.stack);
    });
    page.on('requestfailed', (req) => {
        const f = { url: req.url(), method: req.method(), failure: req.failure()?.errorText };
        requestFails.push(f);
        log(`[requestfailed]`, f.url, f.failure);
    });

    // 1. 加载页面
    log('\n========== STEP 1: load page ==========');
    const resp = await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });
    log('Status:', resp.status());
    log('Final URL:', page.url());

    await new Promise(r => setTimeout(r, 1500));

    const initialState = await page.evaluate(() => {
        const menu = document.querySelector('#menu-screen');
        const game = document.querySelector('#game-screen');
        const btn = document.querySelector('#btn-start');
        const canvas = document.querySelector('#game-canvas');
        return {
            menuExists: !!menu,
            gameExists: !!game,
            btnExists: !!btn,
            btnText: btn ? btn.textContent.trim().replace(/\s+/g, ' ') : null,
            canvasExists: !!canvas,
            canvasSize: canvas ? { w: canvas.width, h: canvas.height, cssW: canvas.clientWidth, cssH: canvas.clientHeight } : null,
            menuHidden: menu ? menu.hidden : null,
            menuVisible: menu ? getComputedStyle(menu).display !== 'none' : null,
            gameHidden: game ? game.hidden : null,
            gameVisible: game ? getComputedStyle(game).display !== 'none' : null,
            theme: document.documentElement.className,
        };
    });
    log('Initial state:', initialState);
    await snap(page, '01_initial');

    // 2. 模拟点击 #btn-start
    log('\n========== STEP 2: click #btn-start via page.evaluate ==========');
    const clickResult = await page.evaluate(() => {
        const btn = document.querySelector('#btn-start');
        if (!btn) return { clicked: false, reason: 'button not found' };
        let dispatched = false;
        try {
            btn.click();
            dispatched = true;
        } catch (e) {
            events.push({ where: 'btn.click()', err: String(e) });
        }
        const rect = btn.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const topEl = document.elementFromPoint(cx, cy);
        return {
            clicked: dispatched,
            disabled: btn.disabled,
            rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
            topElementAtCenter: topEl ? (topEl.id || topEl.tagName + '.' + topEl.className) : null,
        };
    });
    log('Click result:', clickResult);

    await new Promise(r => setTimeout(r, 800));
    await snap(page, '02_after_click_800ms');

    // 3. 检查 gameScreen / menuScreen 可见性
    log('\n========== STEP 3: check screen visibility ==========');
    const afterClick = await page.evaluate(() => {
        const menu = document.querySelector('#menu-screen');
        const game = document.querySelector('#game-screen');
        return {
            menuHidden: menu.hidden,
            menuDisplay: getComputedStyle(menu).display,
            menuOpacity: getComputedStyle(menu).opacity,
            gameHidden: game.hidden,
            gameDisplay: getComputedStyle(game).display,
            gameOpacity: getComputedStyle(game).opacity,
            hudScore: document.querySelector('#hud-score')?.textContent,
            hudLength: document.querySelector('#hud-length')?.textContent,
            hudTime: document.querySelector('#hud-time')?.textContent,
        };
    });
    log('After click state:', afterClick);

    // 4. console / pageerror 总结
    log('\n========== STEP 4: console / errors summary ==========');
    log('Total console msgs:', consoleMsgs.length);
    const byType = {};
    for (const m of consoleMsgs) byType[m.type] = (byType[m.type] || 0) + 1;
    log('  by type:', byType);
    if (pageErrors.length > 0) {
        log('❌ Page errors:');
        for (const e of pageErrors) log('   -', e.message);
    } else {
        log('✅ No page errors');
    }
    if (requestFails.length > 0) {
        log('❌ Failed requests:');
        for (const r of requestFails) log('   -', r.url, r.failure);
    } else {
        log('✅ No failed requests');
    }

    // 5. 画布截图对比
    log('\n========== STEP 5: canvas diff (two frames) ==========');
    const before = await pixelHash(page);
    log('Frame A:', before);
    await canvasSnap(page, '03_canvas_frame_A');

    await new Promise(r => setTimeout(r, 1500));

    const after = await pixelHash(page);
    log('Frame B (1.5s later):', after);
    await canvasSnap(page, '04_canvas_frame_B');

    const nonZeroPixels = (before?.nonBgPixels || 0) + (after?.nonBgPixels || 0);
    const hashChanged = before && after && before.hash !== after.hash;
    log('Snake/food present? (nonBgPixels>0):', before?.nonBgPixels > 0, after?.nonBgPixels > 0);
    log('Frame changed? (hash diff):', hashChanged);

    const gameState = await page.evaluate(() => {
        return {
            hasGame: typeof window.game !== 'undefined',
            gameState: typeof window.game !== 'undefined' ? window.game.getState?.() : null,
        };
    });
    log('Game state from window.game:', gameState);

    // 6. 额外
    log('\n========== STEP 6: try clicking again & wait longer ==========');
    await page.evaluate(() => document.querySelector('#btn-start')?.click());
    await new Promise(r => setTimeout(r, 2000));
    const after2 = await page.evaluate(() => {
        const menu = document.querySelector('#menu-screen');
        const game = document.querySelector('#game-screen');
        return {
            menuHidden: menu.hidden,
            gameHidden: game.hidden,
            gameState: typeof window.game !== 'undefined' ? window.game.getState?.() : null,
        };
    });
    log('After 2nd click:', after2);
    await canvasSnap(page, '05_canvas_frame_C');
    await snap(page, '06_final_state');

    // 总结
    log('\n========== SUMMARY ==========');
    log('initialState:', JSON.stringify(initialState));
    log('clickResult:', JSON.stringify(clickResult));
    log('afterClick:', JSON.stringify(afterClick));
    log('frame A nonBg:', before?.nonBgPixels, 'frame B nonBg:', after?.nonBgPixels);
    log('frame hash changed:', hashChanged);
    log('pageErrors count:', pageErrors.length);
    log('console count:', consoleMsgs.length);

    fs.writeFileSync(path.join(OUT_DIR, 'summary.json'), JSON.stringify({
        initialState, clickResult, afterClick, before, after, hashChanged, pageErrors, consoleMsgs, requestFails, after2
    }, null, 2));

    await browser.close();
    log('🏁 Done');
}

main().catch(err => {
    console.error('TEST FAILED:', err);
    fs.appendFileSync(path.join(OUT_DIR, 'test.log'), 'TEST FAILED: ' + err.stack + '\n');
    process.exit(1);
});
