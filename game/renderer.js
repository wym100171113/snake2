// renderer.js — 2D 自由移动蛇的 Canvas 2D 渲染
// 支持皮肤系统 + 特效 + 隐身 + 护盾 + 死亡动画 + 画质分级
// 优化：dpr 上限 / 鳞片精灵缓存 / 可视区裁剪 / 双圈描边 / 流光 / 波纹 / 震屏

const DEFAULT_SKIN = {
    name: '经典绿',
    body: '#A8E6CF', headHi: '#7FD7AC', headLo: '#3FA67A',
    scaleHi: '#C7F0DB', scaleLo: '#9CDFC0', shadow: 'rgba(168, 230, 207, 0.18)',
    outline: 'rgba(63, 166, 122, 0.3)',
};

export const SNAKE_SKINS = {
    classic: {
        ...DEFAULT_SKIN, name: '经典绿', icon: '🐍', unlock: 0,
        effect: 'sparkle', effectColor: '#A8E6CF',
    },
    ocean: {
        name: '海洋蓝', icon: '🌊',
        body: '#81D4FA', headHi: '#4FC3F7', headLo: '#0288D1',
        scaleHi: '#B3E5FC', scaleLo: '#81D4FA', shadow: 'rgba(129, 212, 250, 0.18)',
        outline: 'rgba(2, 136, 209, 0.3)', unlock: 2,
        effect: 'bubble', effectColor: '#81D4FA',
    },
    sunset: {
        name: '日落橙', icon: '🌅',
        body: '#FFCC80', headHi: '#FFB74D', headLo: '#F57C00',
        scaleHi: '#FFE0B2', scaleLo: '#FFCC80', shadow: 'rgba(255, 204, 128, 0.18)',
        outline: 'rgba(245, 124, 0, 0.3)', unlock: 4,
        effect: 'sparkle', effectColor: '#FFCC80',
    },
    forest: {
        name: '深林绿', icon: '🌲',
        body: '#A5D6A7', headHi: '#66BB6A', headLo: '#2E7D32',
        scaleHi: '#C8E6C9', scaleLo: '#A5D6A7', shadow: 'rgba(165, 214, 167, 0.18)',
        outline: 'rgba(46, 125, 50, 0.3)', unlock: 6,
        effect: 'leaf', effectColor: '#A5D6A7',
    },
    galaxy: {
        name: '银河紫', icon: '🌌',
        body: '#CE93D8', headHi: '#BA68C8', headLo: '#7B1FA2',
        scaleHi: '#E1BEE7', scaleLo: '#CE93D8', shadow: 'rgba(206, 147, 216, 0.18)',
        outline: 'rgba(123, 31, 162, 0.3)', unlock: 8,
        effect: 'star', effectColor: '#CE93D8',
    },
    fire: {
        name: '烈焰红', icon: '🔥',
        body: '#EF9A9A', headHi: '#E57373', headLo: '#C62828',
        scaleHi: '#FFCDD2', scaleLo: '#EF9A9A', shadow: 'rgba(239, 154, 154, 0.18)',
        outline: 'rgba(198, 40, 40, 0.3)', unlock: 10,
        effect: 'flame', effectColor: '#EF9A9A',
    },
    candy: {
        name: '糖果粉', icon: '🍬',
        body: '#F48FB1', headHi: '#F06292', headLo: '#C2185B',
        scaleHi: '#F8BBD0', scaleLo: '#F48FB1', shadow: 'rgba(244, 143, 177, 0.18)',
        outline: 'rgba(194, 24, 91, 0.3)', unlock: 12,
        effect: 'heart', effectColor: '#F48FB1',
    },
    golden: {
        name: '黄金蟒', icon: '👑',
        body: '#FFE082', headHi: '#FFD54F', headLo: '#F9A825',
        scaleHi: '#FFF9C4', scaleLo: '#FFE082', shadow: 'rgba(255, 224, 130, 0.18)',
        outline: 'rgba(249, 168, 37, 0.3)', unlock: 15,
        effect: 'sparkle', effectColor: '#FFD700',
    },
    rainbow: {
        name: '彩虹蛇', icon: '🌈',
        body: '#80DEEA', headHi: '#4DD0E1', headLo: '#00838F',
        scaleHi: '#B2EBF2', scaleLo: '#80DEEA', shadow: 'rgba(128, 222, 234, 0.18)',
        outline: 'rgba(0, 131, 143, 0.3)', unlock: 18,
        effect: 'rainbow', effectColor: '#80DEEA',
    },
};

let particles = [];
let trailParticles = [];
let ripples = []; // 吃食/死亡波纹
let shakeT = 0;   // 屏幕震动剩余秒数
let shakeMag = 0;

export function spawnParticles(x, y, color, count = 12) {
    for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.6;
        const speed = 60 + Math.random() * 80;
        particles.push({
            x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
            life: 1, color, size: 3 + Math.random() * 3,
            spin: Math.random() * Math.PI * 2, spinV: (Math.random() - 0.5) * 6,
        });
    }
}

export function spawnRipple(x, y, color, maxR = 60, life = 0.6) {
    ripples.push({ x, y, r: 0, maxR, color, alpha: 1, life });
}

export function shakeScreen(mag = 8, dur = 0.3) {
    shakeMag = Math.max(shakeMag, mag);
    shakeT = Math.max(shakeT, dur);
}

function spawnTrail(x, y, color, size, life) {
    trailParticles.push({
        x: x + (Math.random() - 0.5) * 8,
        y: y + (Math.random() - 0.5) * 8,
        vx: (Math.random() - 0.5) * 20,
        vy: (Math.random() - 0.5) * 20 - 15,
        life, color, size,
    });
}

export function updateParticles(dt) {
    for (const p of particles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 60 * dt;
        p.vx *= 0.96;
        p.life -= dt * 1.6;
        if (p.spin !== undefined) p.spin += p.spinV * dt;
    }
    particles = particles.filter(p => p.life > 0);
    for (const p of trailParticles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt * 2;
    }
    trailParticles = trailParticles.filter(p => p.life > 0);
    for (const r of ripples) {
        r.r += (r.maxR / r.life) * dt;
        r.alpha -= dt / r.life;
    }
    ripples = ripples.filter(r => r.alpha > 0);
    if (shakeT > 0) { shakeT -= dt; if (shakeT <= 0) { shakeT = 0; shakeMag = 0; } }
}

export function createRenderer(canvas, options = {}) {
    const ctx = canvas.getContext('2d');
    let quality = options.quality === 'low' ? 'low' : 'high'; // 'low' | 'high'
    function dprCap() { return quality === 'high' ? 2 : 1.5; }
    let dpr = Math.max(1, Math.min(dprCap(), window.devicePixelRatio || 1));
    let viewW = 0, viewH = 0;
    let area = { x: 0, y: 0, width: 0, height: 0 };
    let bgPattern = null, bgPatternW = 0, bgPatternH = 0;
    let worldW = 0, worldH = 0;
    let cameraX = 0, cameraY = 0;

    // 鳞片精灵缓存（按 skin+radius+fatMul 组合键）
    let scaleSprite = null;
    let scaleSpriteKey = '';
    function getScaleSprite(skin, r, fatMul) {
        const key = `${skin.scaleHi}|${skin.scaleLo}|${r}|${fatMul.toFixed(2)}`;
        if (scaleSpriteKey === key && scaleSprite) return scaleSprite;
        scaleSpriteKey = key;
        const radius = r * fatMul - 1.5;
        const size = Math.ceil(radius * 2 + 4);
        const off = document.createElement('canvas');
        off.width = size; off.height = size;
        const c = off.getContext('2d');
        const cx = size / 2, cy = size / 2;
        const grd = c.createRadialGradient(cx - radius * 0.3, cy - radius * 0.3, 0, cx, cy, radius);
        grd.addColorStop(0, skin.scaleHi);
        grd.addColorStop(1, skin.scaleLo);
        c.fillStyle = grd;
        c.beginPath();
        c.arc(cx, cy, radius, 0, Math.PI * 2);
        c.fill();
        // 高光小点
        c.fillStyle = 'rgba(255,255,255,0.35)';
        c.beginPath();
        c.arc(cx - radius * 0.35, cy - radius * 0.35, radius * 0.22, 0, Math.PI * 2);
        c.fill();
        scaleSprite = off;
        return off;
    }

    function buildBackground(w, h) {
        const off = document.createElement('canvas');
        off.width = w * dpr; off.height = h * dpr;
        const c = off.getContext('2d');
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        const grd = c.createRadialGradient(w * 0.3, h * 0.2, 0, w * 0.5, h * 0.5, Math.max(w, h));
        grd.addColorStop(0, '#FFFDFB'); grd.addColorStop(0.5, '#F4FAFF'); grd.addColorStop(1, '#EAF4FF');
        c.fillStyle = grd; c.fillRect(0, 0, w, h);
        for (let i = 0; i < 24; i++) {
            const x = Math.random() * w, y = Math.random() * h, r = 2 + Math.random() * 3;
            c.fillStyle = `rgba(168, 230, 207, ${0.18 + Math.random() * 0.12})`;
            c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
        }
        return off;
    }

    function resize(viewportW, viewportH) {
        dpr = Math.max(1, Math.min(dprCap(), window.devicePixelRatio || 1));
        const cssW = Math.max(280, Math.floor(viewportW));
        const cssH = Math.max(280, Math.floor(viewportH));
        canvas.style.width = cssW + 'px'; canvas.style.height = cssH + 'px';
        canvas.width = Math.floor(cssW * dpr); canvas.height = Math.floor(cssH * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        viewW = cssW; viewH = cssH;
        const pad = 14;
        area = { x: pad, y: pad, width: viewW - pad * 2, height: viewH - pad * 2 };
        bgPattern = buildBackground(viewW, viewH);
        bgPatternW = viewW; bgPatternH = viewH;
        // 重置鳞片精灵（dpr 可能变了）
        scaleSprite = null; scaleSpriteKey = '';
    }

    function setWorldSize(w, h) { worldW = w; worldH = h; }
    function setCamera(cx, cy) { cameraX = cx; cameraY = cy; }
    function getCamera() { return { x: cameraX, y: cameraY }; }
    function getViewMetrics() { return { viewW, viewH, area }; }
    function getArea() { return { x: 0, y: 0, width: worldW, height: worldH }; }
    function getVisibleArea() {
        const buf = 200;
        return {
            x: Math.max(0, cameraX - buf),
            y: Math.max(0, cameraY - buf),
            width: Math.min(worldW, cameraX + viewW + buf) - Math.max(0, cameraX - buf),
            height: Math.min(worldH, cameraY + viewH + buf) - Math.max(0, cameraY - buf),
        };
    }
    function getQuality() { return quality; }
    function setQuality(q) {
        if (q !== 'low' && q !== 'high') return;
        const changed = q !== quality;
        quality = q;
        if (changed) {
            // 重新计算 dpr 并触发外部 resize
            const newDpr = Math.max(1, Math.min(dprCap(), window.devicePixelRatio || 1));
            if (Math.abs(newDpr - dpr) > 0.01) {
                // 通知外部重新 resize
                if (typeof options.onQualityResize === 'function') options.onQualityResize();
            }
        }
    }

    function clear() { ctx.clearRect(0, 0, viewW, viewH); }

    function drawBackground(time) {
        // 屏幕坐标：贴一张背景 pattern（一次性绘制，比每帧重画便宜）
        if (bgPattern) {
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.drawImage(bgPattern, 0, 0);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.restore();
        }
        // 世界坐标：网格 + 边界 + 流动光带
        ctx.save();
        ctx.translate(-cameraX, -cameraY);

        // 网格（只画可视区）
        const gridSize = 80;
        const startX = Math.max(0, Math.floor(cameraX / gridSize) * gridSize);
        const endX = Math.min(worldW, cameraX + viewW + gridSize);
        const startY = Math.max(0, Math.floor(cameraY / gridSize) * gridSize);
        const endY = Math.min(worldH, cameraY + viewH + gridSize);
        ctx.strokeStyle = 'rgba(168, 230, 207, 0.22)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = startX; x <= endX; x += gridSize) {
            ctx.moveTo(x, Math.max(0, cameraY - 10));
            ctx.lineTo(x, Math.min(worldH, cameraY + viewH + 10));
        }
        for (let y = startY; y <= endY; y += gridSize) {
            ctx.moveTo(Math.max(0, cameraX - 10), y);
            ctx.lineTo(Math.min(worldW, cameraX + viewW + 10), y);
        }
        ctx.stroke();

        // 流动光带（高画质才有）
        if (quality === 'high') {
            const bandT = (time * 0.00008) % 1;
            const bandY = bandT * worldH;
            const bgrd = ctx.createLinearGradient(0, bandY - 80, 0, bandY + 80);
            bgrd.addColorStop(0, 'rgba(255,255,255,0)');
            bgrd.addColorStop(0.5, 'rgba(255,255,255,0.12)');
            bgrd.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = bgrd;
            ctx.fillRect(0, bandY - 80, worldW, 160);
        }

        // 世界边界（虚线红框 + 外发光）
        ctx.save();
        ctx.shadowColor = 'rgba(255, 107, 107, 0.6)';
        ctx.shadowBlur = quality === 'high' ? 16 : 0;
        ctx.strokeStyle = 'rgba(255, 107, 107, 0.85)';
        ctx.lineWidth = 4;
        ctx.setLineDash([14, 8]);
        ctx.lineDashOffset = -(time * 0.04);
        ctx.strokeRect(2, 2, worldW - 4, worldH - 4);
        ctx.setLineDash([]);
        ctx.restore();

        ctx.restore();
    }

    function drawFood(food, time) {
        // 视口裁剪
        if (food.x < cameraX - 60 || food.x > cameraX + viewW + 60 ||
            food.y < cameraY - 60 || food.y > cameraY + viewH + 60) return;

        const cx = food.x, cy = food.y, baseR = food.radius;
        let pulse = 0;
        const remain = Math.max(0, food.expiresAt - time) / 1000;
        if (remain < 3 && remain > 0) pulse = Math.sin(time / 80) * 0.18 * (3 - remain) / 3;
        const r = baseR * (1 + pulse);

        // 外光晕（径向）
        const grd = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 1.8);
        grd.addColorStop(0, hexA(food.color, 0.55)); grd.addColorStop(1, hexA(food.color, 0));
        ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(cx, cy, r * 1.8, 0, Math.PI * 2); ctx.fill();

        // jackpot/legendary 旋转光环
        if (food.jackpot) {
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(time * 0.002);
            for (let i = 0; i < 3; i++) {
                const ringR = r * (1.4 + i * 0.25) + Math.sin(time / 200 + i) * 3;
                ctx.strokeStyle = `rgba(255, 215, 0, ${0.45 - i * 0.1})`;
                ctx.lineWidth = 2 - i * 0.5;
                ctx.setLineDash([6, 6]);
                ctx.lineDashOffset = -time * 0.05 + i * 10;
                ctx.beginPath(); ctx.arc(0, 0, ringR, 0, Math.PI * 2); ctx.stroke();
            }
            ctx.setLineDash([]);
            ctx.restore();
        } else if (food.tier === 'legendary') {
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(time * 0.0015);
            const ringR = r * 1.4 + Math.sin(time / 200) * 3;
            ctx.strokeStyle = 'rgba(46, 204, 113, 0.5)'; ctx.lineWidth = 1.5;
            ctx.setLineDash([5, 5]);
            ctx.lineDashOffset = -time * 0.04;
            ctx.beginPath(); ctx.arc(0, 0, ringR, 0, Math.PI * 2); ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
        } else if (food.tier === 'epic' && quality === 'high') {
            const ringR = r * 1.25 + Math.sin(time / 250) * 2;
            ctx.strokeStyle = 'rgba(186, 104, 200, 0.4)'; ctx.lineWidth = 1.2;
            ctx.beginPath(); ctx.arc(cx, cy, ringR, 0, Math.PI * 2); ctx.stroke();
        }

        // 主体
        ctx.fillStyle = food.color; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
        // 内部高光
        ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath();
        ctx.arc(cx - r * 0.32, cy - r * 0.36, r * 0.26, 0, Math.PI * 2); ctx.fill();
        // emoji
        ctx.font = `${Math.floor(r * 1.4)}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(food.emoji, cx, cy + 1);
    }

    function drawSnake(snake, skin, time, opts) {
        if (!snake || !snake.segments || snake.segments.length === 0) return;
        const sk = skin || DEFAULT_SKIN;
        const segs = snake.segments;
        const r = snake.segmentRadius;
        const inv = opts.invincible;
        const invis = opts.invisible;
        const shield = opts.shield;
        const fat = opts.fat;
        const fatMul = fat ? 1.8 : 1;

        ctx.save();
        if (invis) ctx.globalAlpha = 0.06;

        // 皮肤拖尾
        if (sk.effect && segs.length > 2) {
            const tail = segs[segs.length - 1];
            const spawnRate = quality === 'high' ? 0.5 : 0.25;
            if (Math.random() < spawnRate) {
                const colors = sk.effect === 'rainbow'
                    ? ['#FF6B6B', '#FFB347', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'][Math.floor(Math.random() * 7)]
                    : sk.effectColor || sk.body;
                spawnTrail(tail.x, tail.y, colors, 2.5 + Math.random() * 2, 0.7 + Math.random() * 0.3);
            }
        }

        // 无敌光环
        if (inv) {
            const head = segs[0];
            const glowR = r * 2.5 + Math.sin(time / 150) * 4;
            const grd = ctx.createRadialGradient(head.x, head.y, r, head.x, head.y, glowR);
            grd.addColorStop(0, 'rgba(255, 215, 0, 0.5)'); grd.addColorStop(1, 'rgba(255, 215, 0, 0)');
            ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(head.x, head.y, glowR, 0, Math.PI * 2); ctx.fill();
        }

        // 护盾
        if (shield) {
            const head = segs[0];
            const shieldR = r * 1.9 + Math.sin(time / 200) * 3;
            ctx.save();
            ctx.strokeStyle = 'rgba(144, 202, 249, 0.85)'; ctx.lineWidth = 3;
            ctx.shadowColor = 'rgba(144, 202, 249, 0.6)'; ctx.shadowBlur = quality === 'high' ? 12 : 0;
            ctx.beginPath(); ctx.arc(head.x, head.y, shieldR, 0, Math.PI * 2); ctx.stroke();
            // 六边形装饰
            if (quality === 'high') {
                ctx.strokeStyle = 'rgba(144, 202, 249, 0.4)'; ctx.lineWidth = 1.5;
                ctx.beginPath();
                for (let i = 0; i < 6; i++) {
                    const a = (i / 6) * Math.PI * 2 + time * 0.001;
                    const px = head.x + Math.cos(a) * shieldR;
                    const py = head.y + Math.sin(a) * shieldR;
                    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
                }
                ctx.closePath(); ctx.stroke();
            }
            ctx.restore();
        }

        // 阴影描边（外圈）
        ctx.lineWidth = r * 2 * fatMul + 4;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.strokeStyle = sk.shadow;
        ctx.beginPath(); ctx.moveTo(segs[0].x, segs[0].y);
        for (let i = 1; i < segs.length; i++) ctx.lineTo(segs[i].x, segs[i].y);
        ctx.stroke();

        // 主线（双圈：先深后浅制造立体感）
        ctx.lineWidth = r * 2 * fatMul;
        ctx.strokeStyle = sk.body;
        ctx.beginPath(); ctx.moveTo(segs[0].x, segs[0].y);
        for (let i = 1; i < segs.length; i++) ctx.lineTo(segs[i].x, segs[i].y);
        ctx.stroke();

        // 顶部高光线（让蛇身有 3D 光泽）
        if (quality === 'high' && segs.length > 2) {
            ctx.save();
            ctx.lineWidth = r * 0.5 * fatMul;
            ctx.strokeStyle = 'rgba(255,255,255,0.35)';
            ctx.beginPath();
            // 沿身体绘制一条偏上的高光（用每段法向偏移）
            for (let i = 0; i < segs.length; i++) {
                const cur = segs[i];
                const next = segs[Math.min(i + 1, segs.length - 1)];
                const prev = segs[Math.max(i - 1, 0)];
                const dx = next.x - prev.x, dy = next.y - prev.y;
                const d = Math.sqrt(dx * dx + dy * dy) || 1;
                // 法线（向上偏）
                const nx = -dy / d, ny = dx / d;
                const px = cur.x + nx * r * 0.55 * fatMul;
                const py = cur.y + ny * r * 0.55 * fatMul;
                if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.stroke();
            ctx.restore();
        }

        // 鳞片（用精灵缓存代替每帧 createRadialGradient）
        const sprite = getScaleSprite(sk, r, fatMul);
        const half = sprite.width / 2;
        // 间隔绘制减少开销（每隔一节画一次）
        const step = quality === 'high' ? 1 : 2;
        for (let i = 1; i < segs.length; i += step) {
            const b = segs[i];
            // 视口裁剪
            if (b.x < cameraX - r || b.x > cameraX + viewW + r ||
                b.y < cameraY - r || b.y > cameraY + viewH + r) continue;
            ctx.drawImage(sprite, b.x - half, b.y - half);
        }

        // 蛇头
        const head = segs[0];
        const hgrd = ctx.createRadialGradient(head.x - r * 0.3, head.y - r * 0.3, 0, head.x, head.y, r * fatMul);
        hgrd.addColorStop(0, sk.headHi); hgrd.addColorStop(1, sk.headLo);
        ctx.fillStyle = hgrd; ctx.beginPath(); ctx.arc(head.x, head.y, r * fatMul, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = sk.outline; ctx.lineWidth = 1.5; ctx.stroke();
        drawSnakeFace(head, snake.angle, r * fatMul);

        ctx.restore();
    }

    function drawSnakeFace(head, angle, r) {
        const cosA = Math.cos(angle), sinA = Math.sin(angle);
        const perpX = -sinA, perpY = cosA;
        const eyeOff = r * 0.5, eyeR = r * 0.32;
        const e1 = { x: head.x + cosA * eyeOff * 0.4 + perpX * eyeOff * 0.7, y: head.y + sinA * eyeOff * 0.4 + perpY * eyeOff * 0.7 };
        const e2 = { x: head.x + cosA * eyeOff * 0.4 - perpX * eyeOff * 0.7, y: head.y + sinA * eyeOff * 0.4 - perpY * eyeOff * 0.7 };
        // 眼白
        ctx.fillStyle = 'white';
        ctx.beginPath(); ctx.arc(e1.x, e1.y, eyeR, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(e2.x, e2.y, eyeR, 0, Math.PI * 2); ctx.fill();
        // 瞳孔
        ctx.fillStyle = '#2F2F4A';
        const pOff = eyeR * 0.35;
        ctx.beginPath(); ctx.arc(e1.x + cosA * pOff, e1.y + sinA * pOff, eyeR * 0.55, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(e2.x + cosA * pOff, e2.y + sinA * pOff, eyeR * 0.55, 0, Math.PI * 2); ctx.fill();
        // 瞳孔高光
        ctx.fillStyle = 'white';
        ctx.beginPath(); ctx.arc(e1.x + cosA * pOff - eyeR * 0.18, e1.y + sinA * pOff - eyeR * 0.18, eyeR * 0.15, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(e2.x + cosA * pOff - eyeR * 0.18, e2.y + sinA * pOff - eyeR * 0.18, eyeR * 0.15, 0, Math.PI * 2); ctx.fill();
        // 嘴巴
        ctx.strokeStyle = 'rgba(47, 47, 74, 0.6)'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        const mx = head.x + cosA * r * 0.65, my = head.y + sinA * r * 0.65;
        ctx.arc(mx, my, r * 0.35, angle - 0.5, angle + 0.5); ctx.stroke();
    }

    function drawTrailParticles() {
        for (const p of trailParticles) {
            ctx.globalAlpha = Math.max(0, p.life);
            ctx.fillStyle = p.color;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    function drawParticles() {
        for (const p of particles) {
            ctx.globalAlpha = Math.max(0, p.life);
            ctx.fillStyle = p.color;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    function drawRipples() {
        for (const r of ripples) {
            ctx.globalAlpha = Math.max(0, r.alpha);
            ctx.strokeStyle = r.color;
            ctx.lineWidth = 3 * r.alpha;
            ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.globalAlpha = 1;
    }

    function drawDeathAnimation(anim, time) {
        if (!anim) return;
        const t = anim.t;
        // 多层扩散环
        for (let i = 0; i < 5; i++) {
            const ringR = 30 + t * 220 + i * 35;
            const alpha = Math.max(0, 1 - t / 1.2 - i * 0.13);
            ctx.strokeStyle = `rgba(255, 139, 148, ${alpha})`;
            ctx.lineWidth = 4 - t * 2;
            ctx.beginPath(); ctx.arc(anim.x, anim.y, ringR, 0, Math.PI * 2); ctx.stroke();
        }
        // 中心闪光
        const flashAlpha = Math.max(0, 0.7 - t * 0.7);
        const grd = ctx.createRadialGradient(anim.x, anim.y, 0, anim.x, anim.y, 80);
        grd.addColorStop(0, `rgba(255, 255, 255, ${flashAlpha})`);
        grd.addColorStop(0.5, `rgba(255, 215, 0, ${flashAlpha * 0.5})`);
        grd.addColorStop(1, 'rgba(255, 139, 148, 0)');
        ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(anim.x, anim.y, 80, 0, Math.PI * 2); ctx.fill();
    }

    function drawScorePopup(popup) {
        if (!popup || popup.alpha <= 0) return;
        ctx.save();
        ctx.globalAlpha = Math.max(0, popup.alpha);
        ctx.font = 'bold 22px "Quicksand", "Nunito", sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 3;
        ctx.strokeText(popup.text, popup.x, popup.y);
        ctx.fillStyle = popup.text === 'JACKPOT!' ? '#FF6B9D' : '#FFB347';
        ctx.fillText(popup.text, popup.x, popup.y);
        ctx.restore();
    }

    function drawFlash(alpha) {
        if (alpha <= 0) return;
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`; ctx.fillRect(0, 0, viewW, viewH);
    }

    function drawLives(lives, cheatMode) {
        if (lives <= 0 && !cheatMode) return;
        ctx.save();
        ctx.font = 'bold 16px "Quicksand", sans-serif';
        ctx.textAlign = 'right'; ctx.textBaseline = 'top';
        const x = area.x + area.width - 8;
        const y = area.y + 4;
        if (cheatMode) {
            ctx.fillStyle = 'rgba(255, 152, 0, 0.9)';
            ctx.fillText('⚡ WYM 作弊模式', x, y);
        }
        let hearts = '';
        for (let i = 0; i < lives; i++) hearts += '❤️';
        if (hearts) {
            ctx.fillStyle = '#FF4081';
            ctx.fillText(hearts, x, cheatMode ? y + 22 : y);
        }
        ctx.restore();
    }

    function render(state, time) {
        if (viewW <= 0 || viewH <= 0) return;
        clear();

        // 屏幕震动
        let sx = 0, sy = 0;
        if (shakeT > 0 && shakeMag > 0) {
            sx = (Math.random() - 0.5) * shakeMag;
            sy = (Math.random() - 0.5) * shakeMag;
        }
        ctx.save();
        if (sx || sy) ctx.translate(sx, sy);

        drawBackground(time);
        ctx.save();
        ctx.translate(-cameraX, -cameraY);
        drawRipples();
        for (const f of (state.foods || [])) drawFood(f, time);
        if (state.showSnake !== false && state.snake) {
            drawSnake(state.snake, state.skin, time, {
                invincible: state.invincible,
                invisible: state.invisible,
                shield: state.shield,
                fat: state.fat,
            });
        }
        drawTrailParticles();
        drawParticles();
        drawDeathAnimation(state.deathAnimation, time);
        drawScorePopup(state.scorePopup);
        ctx.restore();
        drawFlash(state.flashAlpha || 0);
        drawLives(state.lives, state.cheatMode);

        ctx.restore();
    }

    return {
        resize, render, getArea, getVisibleArea, setWorldSize, setCamera, getCamera,
        getMetrics: () => ({ viewW, viewH, area }),
        getQuality, setQuality,
    };
}

function hexA(hex, a) {
    const m = hex.replace('#', '');
    const v = m.length === 3 ? m.split('').map(c => c + c).join('') : m;
    const num = parseInt(v, 16);
    return `rgba(${(num >> 16) & 255},${(num >> 8) & 255},${num & 255},${a})`;
}
