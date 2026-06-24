// renderer.js — 2D 自由移动蛇的 Canvas 2D 渲染
// 蛇身：圆角胶囊体，沿 segment 列表用粗线条 + 圆形头尾绘制

const COLORS = {
    bgInner: '#FFFAF5',
    bgOuter: '#E8F4FF',
    snakeBody: '#A8E6CF',
    snakeHead: '#56C596',
    snakeTail: '#D4F4E2',
    snakeOutline: 'rgba(86, 197, 150, 0.25)',
    wall: '#FFB5A7',
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
        p.vy += 60 * dt;
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
    let area = { x: 0, y: 0, width: 0, height: 0 };
    let bgPattern = null;
    let bgPatternW = 0;
    let bgPatternH = 0;

    function buildBackground(w, h) {
        // 离屏 canvas 画一次渐变 + 漂浮圆点，性能更好
        const off = document.createElement('canvas');
        off.width = w * dpr;
        off.height = h * dpr;
        const c = off.getContext('2d');
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        // 底色渐变
        const grd = c.createRadialGradient(w * 0.3, h * 0.2, 0, w * 0.5, h * 0.5, Math.max(w, h));
        grd.addColorStop(0, '#FFFDFB');
        grd.addColorStop(0.5, '#F4FAFF');
        grd.addColorStop(1, '#EAF4FF');
        c.fillStyle = grd;
        c.fillRect(0, 0, w, h);
        // 柔和斑点
        for (let i = 0; i < 24; i++) {
            const x = Math.random() * w;
            const y = Math.random() * h;
            const r = 2 + Math.random() * 3;
            c.fillStyle = `rgba(168, 230, 207, ${0.18 + Math.random() * 0.12})`;
            c.beginPath();
            c.arc(x, y, r, 0, Math.PI * 2);
            c.fill();
        }
        return off;
    }

    function resize(viewportW, viewportH) {
        dpr = Math.max(1, window.devicePixelRatio || 1);
        const cssW = Math.max(280, Math.floor(viewportW));
        const cssH = Math.max(280, Math.floor(viewportH));
        canvas.style.width = cssW + 'px';
        canvas.style.height = cssH + 'px';
        canvas.width = Math.floor(cssW * dpr);
        canvas.height = Math.floor(cssH * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        viewW = cssW;
        viewH = cssH;
        // 活动区域：留出 12px 内边距防止视觉被切
        const pad = 14;
        area = { x: pad, y: pad, width: viewW - pad * 2, height: viewH - pad * 2 };
        bgPattern = buildBackground(viewW, viewH);
        bgPatternW = viewW;
        bgPatternH = viewH;
    }

    function getArea() {
        return area;
    }

    function clear() {
        ctx.clearRect(0, 0, viewW, viewH);
    }

    function drawBackground() {
        if (bgPattern) {
            ctx.drawImage(bgPattern, 0, 0, bgPatternW, bgPatternH);
        } else {
            const grd = ctx.createRadialGradient(viewW * 0.3, viewH * 0.2, 0, viewW * 0.5, viewH * 0.5, Math.max(viewW, viewH));
            grd.addColorStop(0, '#FFFDFB');
            grd.addColorStop(1, '#EAF4FF');
            ctx.fillStyle = grd;
            ctx.fillRect(0, 0, viewW, viewH);
        }
        // 活动区描边
        ctx.save();
        ctx.strokeStyle = 'rgba(168, 230, 207, 0.6)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        roundRect(ctx, area.x, area.y, area.width, area.height, 18);
        ctx.stroke();
        ctx.restore();
    }

    function drawFood(food, time) {
        const cx = food.x;
        const cy = food.y;
        const baseR = food.radius;
        let pulse = 0;
        // 过期前 3 秒脉动
        const remain = Math.max(0, food.expiresAt - time) / 1000;
        if (remain < 3 && remain > 0) {
            pulse = Math.sin(time / 80) * 0.18 * (3 - remain) / 3;
        }
        const r = baseR * (1 + pulse);

        // 光晕
        const grd = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 1.8);
        grd.addColorStop(0, hexA(food.color, 0.55));
        grd.addColorStop(1, hexA(food.color, 0));
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(cx, cy, r * 1.8, 0, Math.PI * 2);
        ctx.fill();

        // 大奖额外光环
        if (food.jackpot) {
            const ringR = r * 1.5 + Math.sin(time / 200) * 4;
            ctx.strokeStyle = 'rgba(255, 215, 0, 0.5)';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }
        if (food.tier === 'legendary') {
            const ringR = r * 1.4 + Math.sin(time / 200) * 3;
            ctx.strokeStyle = 'rgba(46, 204, 113, 0.45)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // 主体
        ctx.fillStyle = food.color;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();

        // 高光
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.beginPath();
        ctx.arc(cx - r * 0.32, cy - r * 0.36, r * 0.26, 0, Math.PI * 2);
        ctx.fill();

        // emoji
        ctx.font = `${Math.floor(r * 1.4)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(food.emoji, cx, cy + 1);
    }

    function drawSnake(snake, time) {
        if (!snake || !snake.segments || snake.segments.length === 0) return;
        const segs = snake.segments;
        const r = snake.segmentRadius;

        // 1) 蛇身阴影
        ctx.save();
        ctx.lineWidth = r * 2 + 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(168, 230, 207, 0.18)';
        ctx.beginPath();
        ctx.moveTo(segs[0].x, segs[0].y);
        for (let i = 1; i < segs.length; i++) ctx.lineTo(segs[i].x, segs[i].y);
        ctx.stroke();
        ctx.restore();

        // 2) 蛇身主线：分段上色（头深尾浅）
        ctx.save();
        ctx.lineWidth = r * 2 - 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = COLORS.snakeBody;
        ctx.beginPath();
        ctx.moveTo(segs[0].x, segs[0].y);
        for (let i = 1; i < segs.length; i++) ctx.lineTo(segs[i].x, segs[i].y);
        ctx.stroke();
        ctx.restore();

        // 3) 沿路径画小圆"鳞片"以增加立体感
        for (let i = 1; i < segs.length; i++) {
            const a = segs[i - 1];
            const b = segs[i];
            const grd = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r);
            grd.addColorStop(0, '#C7F0DB');
            grd.addColorStop(1, '#9CDFC0');
            ctx.fillStyle = grd;
            ctx.beginPath();
            ctx.arc(b.x, b.y, r - 1.5, 0, Math.PI * 2);
            ctx.fill();
        }

        // 4) 蛇头：单独更深的圆
        const head = segs[0];
        const grd = ctx.createRadialGradient(head.x - r * 0.3, head.y - r * 0.3, 0, head.x, head.y, r);
        grd.addColorStop(0, '#7FD7AC');
        grd.addColorStop(1, '#3FA67A');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(head.x, head.y, r, 0, Math.PI * 2);
        ctx.fill();
        // 描边
        ctx.strokeStyle = 'rgba(63, 166, 122, 0.3)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // 5) 眼睛 + 微笑
        drawSnakeFace(head, snake.angle, r);
    }

    function drawSnakeFace(head, angle, r) {
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);
        // 眼睛垂直于运动方向
        const perpX = -sinA;
        const perpY = cosA;
        const eyeOff = r * 0.5;
        const eyeR = r * 0.32;
        const e1 = { x: head.x + cosA * eyeOff * 0.4 + perpX * eyeOff * 0.7, y: head.y + sinA * eyeOff * 0.4 + perpY * eyeOff * 0.7 };
        const e2 = { x: head.x + cosA * eyeOff * 0.4 - perpX * eyeOff * 0.7, y: head.y + sinA * eyeOff * 0.4 - perpY * eyeOff * 0.7 };
        // 眼白
        ctx.fillStyle = 'white';
        ctx.beginPath(); ctx.arc(e1.x, e1.y, eyeR, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(e2.x, e2.y, eyeR, 0, Math.PI * 2); ctx.fill();
        // 瞳孔（朝运动方向偏）
        ctx.fillStyle = '#2F2F4A';
        const pOff = eyeR * 0.35;
        ctx.beginPath(); ctx.arc(e1.x + cosA * pOff, e1.y + sinA * pOff, eyeR * 0.55, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(e2.x + cosA * pOff, e2.y + sinA * pOff, eyeR * 0.55, 0, Math.PI * 2); ctx.fill();
        // 嘴巴（朝运动方向延伸的小弧线）
        ctx.strokeStyle = 'rgba(47, 47, 74, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        const mx = head.x + cosA * r * 0.65;
        const my = head.y + sinA * r * 0.65;
        ctx.arc(mx, my, r * 0.35, angle - 0.5, angle + 0.5);
        ctx.stroke();
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

    function drawScorePopup(popup) {
        if (!popup || popup.alpha <= 0) return;
        ctx.save();
        ctx.globalAlpha = Math.max(0, popup.alpha);
        ctx.font = 'bold 22px "Quicksand", "Nunito", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // 描边
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 3;
        ctx.strokeText(popup.text, popup.x, popup.y);
        // 填充
        ctx.fillStyle = popup.text === 'JACKPOT!' ? '#FF6B9D' : '#FFB347';
        ctx.fillText(popup.text, popup.x, popup.y);
        ctx.restore();
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
        drawScorePopup(state.scorePopup);
        drawFlash(state.flashAlpha || 0);
    }

    return {
        resize,
        render,
        getArea,
        getMetrics: () => ({ viewW, viewH, area }),
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

function hexA(hex, a) {
    const m = hex.replace('#', '');
    const v = m.length === 3 ? m.split('').map(c => c + c).join('') : m;
    const num = parseInt(v, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r},${g},${b},${a})`;
}
