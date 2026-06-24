// renderer.js — Canvas 2D 渲染
// 负责：背景网格、食物、蛇身、粒子、HUD 联动
// 注意：所有坐标使用网格单位，渲染时乘以 cellSize

import { DIRS } from './snake.js';

const COLORS = {
    grid: 'rgba(168, 230, 207, 0.18)',
    gridStrong: 'rgba(168, 230, 207, 0.32)',
    snakeHead: '#56C596',
    snakeBody: '#A8E6CF',
    snakeTail: '#D4F4E2',
    snakeOutline: 'rgba(86, 197, 150, 0.18)',
    wall: '#FFB5A7',
    particle: '#FFD96A',
};

let particles = [];

export function spawnParticles(x, y, color, count = 12) {
    for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.6;
        const speed = 60 + Math.random() * 80;
        particles.push({
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1,
            color,
            size: 3 + Math.random() * 3,
        });
    }
}

export function updateParticles(dt) {
    for (const p of particles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 60 * dt; // 轻微重力
        p.vx *= 0.96;
        p.life -= dt * 1.6;
    }
    particles = particles.filter(p => p.life > 0);
}

export function createRenderer(canvas) {
    const ctx = canvas.getContext('2d');
    let dpr = Math.max(1, window.devicePixelRatio || 1);
    let viewW = 0;
    let viewH = 0;
    let cellSize = 24;
    let cols = 0;
    let rows = 0;
    let offsetX = 0;
    let offsetY = 0;

    function resize(viewportW, viewportH, gridCols, gridRows) {
        dpr = Math.max(1, window.devicePixelRatio || 1);
        // CSS 尺寸 = 视口尺寸（CSS 像素）
        const cssW = Math.max(280, Math.floor(viewportW));
        const cssH = Math.max(280, Math.floor(viewportH));
        canvas.style.width = cssW + 'px';
        canvas.style.height = cssH + 'px';
        canvas.width = Math.floor(cssW * dpr);
        canvas.height = Math.floor(cssH * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        viewW = cssW;
        viewH = cssH;
        cols = gridCols;
        rows = gridRows;
        // 网格单元尺寸 = 适配正方形区域
        const sizeW = Math.floor(viewW / cols);
        const sizeH = Math.floor(viewH / rows);
        cellSize = Math.max(10, Math.min(sizeW, sizeH));
        const totalW = cellSize * cols;
        const totalH = cellSize * rows;
        offsetX = Math.floor((viewW - totalW) / 2);
        offsetY = Math.floor((viewH - totalH) / 2);
    }

    function gridToPx(gx, gy) {
        return {
            x: offsetX + gx * cellSize,
            y: offsetY + gy * cellSize,
        };
    }

    function clear() {
        ctx.clearRect(0, 0, viewW, viewH);
    }

    function drawBackground() {
        // 渐变已在 CSS 上叠加；这里只画棋盘格与圆角外框
        const totalW = cellSize * cols;
        const totalH = cellSize * rows;
        // 棋盘
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                if ((x + y) % 2 === 0) {
                    const p = gridToPx(x, y);
                    ctx.fillStyle = COLORS.grid;
                    ctx.fillRect(p.x, p.y, cellSize, cellSize);
                }
            }
        }
        // 边框
        ctx.strokeStyle = COLORS.gridStrong;
        ctx.lineWidth = 2;
        roundRect(ctx, offsetX, offsetY, totalW, totalH, 14);
        ctx.stroke();
    }

    function drawFood(food, time) {
        const p = gridToPx(food.x, food.y);
        const cx = p.x + cellSize / 2;
        const cy = p.y + cellSize / 2;
        const baseR = cellSize * 0.38;
        // 限时食物的最后 3 秒脉动
        let pulse = 0;
        if (food.expiresAfter) {
            const remain = (food.expiresAfter - (time - food.spawnedAt)) / 1000;
            if (remain < 3 && remain > 0) {
                pulse = Math.sin(time / 120) * 0.15 * (3 - remain) / 3;
            }
        }
        const r = baseR * (1 + pulse);

        // 光晕
        const grd = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 1.6);
        grd.addColorStop(0, hexA(food.color, 0.55));
        grd.addColorStop(1, hexA(food.color, 0));
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(cx, cy, r * 1.6, 0, Math.PI * 2);
        ctx.fill();

        // 主体
        ctx.fillStyle = food.color;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();

        // 高光
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.beginPath();
        ctx.arc(cx - r * 0.3, cy - r * 0.35, r * 0.25, 0, Math.PI * 2);
        ctx.fill();

        // emoji 标识（按需；emoji 字体在大多数浏览器可显示）
        ctx.font = `${Math.floor(r * 1.4)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(food.emoji, cx, cy + 1);
    }

    function drawSnake(snake, time) {
        if (!snake) return;
        const body = snake.body;
        if (!body || body.length === 0) return;

        // 蛇身：圆角胶囊
        const r = cellSize * 0.36;
        for (let i = body.length - 1; i >= 0; i--) {
            const seg = body[i];
            const p = gridToPx(seg.x, seg.y);
            // 颜色：头深尾浅
            const t = i / Math.max(1, body.length - 1);
            const color = mix(COLORS.snakeHead, COLORS.snakeTail, t);
            ctx.fillStyle = color;
            roundRect(ctx, p.x + 2, p.y + 2, cellSize - 4, cellSize - 4, r);
            ctx.fill();
            // 节间柔和阴影
            ctx.strokeStyle = 'rgba(86,197,150,0.25)';
            ctx.lineWidth = 1;
            roundRect(ctx, p.x + 2, p.y + 2, cellSize - 4, cellSize - 4, r);
            ctx.stroke();
        }
        // 蛇头：眼睛 + 微笑
        const head = body[0];
        const dir = DIRS[snake.dirKey];
        drawSnakeFace(head, dir, time);
    }

    function drawSnakeFace(head, dir, time) {
        const p = gridToPx(head.x, head.y);
        const cx = p.x + cellSize / 2;
        const cy = p.y + cellSize / 2;
        const eyeOffset = cellSize * 0.18;
        const eyeR = cellSize * 0.08;

        // 计算两只眼睛的位置（垂直于移动方向偏移）
        const perp = { x: -dir.y, y: dir.x };
        const e1 = { x: cx + dir.x * eyeOffset + perp.x * eyeOffset, y: cy + dir.y * eyeOffset + perp.y * eyeOffset };
        const e2 = { x: cx + dir.x * eyeOffset - perp.x * eyeOffset, y: cy + dir.y * eyeOffset - perp.y * eyeOffset };
        ctx.fillStyle = 'white';
        ctx.beginPath(); ctx.arc(e1.x, e1.y, eyeR * 1.6, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(e2.x, e2.y, eyeR * 1.6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#3D3D5C';
        // 瞳孔随方向偏移
        const pupilOff = eyeR * 0.6;
        ctx.beginPath(); ctx.arc(e1.x + dir.x * pupilOff, e1.y + dir.y * pupilOff, eyeR * 0.9, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(e2.x + dir.x * pupilOff, e2.y + dir.y * pupilOff, eyeR * 0.9, 0, Math.PI * 2); ctx.fill();
    }

    function drawParticles() {
        for (const p of particles) {
            ctx.globalAlpha = Math.max(0, p.life);
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    function drawFlash(alpha) {
        if (alpha <= 0) return;
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.fillRect(0, 0, viewW, viewH);
    }

    function render(state, time) {
        if (viewW <= 0 || viewH <= 0) return;
        clear();
        drawBackground();
        for (const f of (state.foods || [])) drawFood(f, time);
        if (state.showSnake !== false && state.snake) drawSnake(state.snake, time);
        drawParticles();
        drawFlash(state.flashAlpha || 0);
    }

    function pointToCell(clientX, clientY) {
        const rect = canvas.getBoundingClientRect();
        const x = clientX - rect.left - offsetX;
        const y = clientY - rect.top - offsetY;
        if (x < 0 || y < 0) return null;
        const col = Math.floor(x / cellSize);
        const row = Math.floor(y / cellSize);
        if (col < 0 || col >= cols || row < 0 || row >= rows) return null;
        return { x: col, y: row };
    }

    return {
        resize,
        render,
        pointToCell,
        getMetrics: () => ({ cellSize, cols, rows, viewW, viewH, offsetX, offsetY }),
    };
}

// ---------- 工具函数 ----------
function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr);
    ctx.quadraticCurveTo(x, y, x + rr, y);
    ctx.closePath();
}

function mix(hexA, hexB, t) {
    const a = hexToRgb(hexA);
    const b = hexToRgb(hexB);
    const r = Math.round(a.r + (b.r - a.r) * t);
    const g = Math.round(a.g + (b.g - a.g) * t);
    const bl = Math.round(a.b + (b.b - a.b) * t);
    return `rgb(${r},${g},${bl})`;
}

function hexToRgb(hex) {
    const m = hex.replace('#', '');
    const v = m.length === 3
        ? m.split('').map(c => c + c).join('')
        : m;
    const num = parseInt(v, 16);
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function hexA(hex, a) {
    const { r, g, b } = hexToRgb(hex);
    return `rgba(${r},${g},${b},${a})`;
}
