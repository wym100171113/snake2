// renderer.js — 2D 自由移动蛇的 Canvas 2D 渲染
// 支持皮肤系统 + 特效 + 隐身 + 护盾 + 死亡动画

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
let trailParticles = []; // 皮肤拖尾粒子

export function spawnParticles(x, y, color, count = 12) {
    for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.6;
        const speed = 60 + Math.random() * 80;
        particles.push({
            x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
            life: 1, color, size: 3 + Math.random() * 3,
        });
    }
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
    }
    particles = particles.filter(p => p.life > 0);
    for (const p of trailParticles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt * 2;
    }
    trailParticles = trailParticles.filter(p => p.life > 0);
}

export function createRenderer(canvas) {
    const ctx = canvas.getContext('2d');
    let dpr = Math.max(1, window.devicePixelRatio || 1);
    let viewW = 0, viewH = 0;
    let area = { x: 0, y: 0, width: 0, height: 0 };
    let bgPattern = null, bgPatternW = 0, bgPatternH = 0;

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
        dpr = Math.max(1, window.devicePixelRatio || 1);
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
    }

    function getArea() { return area; }

    function clear() { ctx.clearRect(0, 0, viewW, viewH); }

    function drawBackground() {
        if (bgPattern) { ctx.drawImage(bgPattern, 0, 0, bgPatternW, bgPatternH); }
        else {
            const grd = ctx.createRadialGradient(viewW * 0.3, viewH * 0.2, 0, viewW * 0.5, viewH * 0.5, Math.max(viewW, viewH));
            grd.addColorStop(0, '#FFFDFB'); grd.addColorStop(1, '#EAF4FF');
            ctx.fillStyle = grd; ctx.fillRect(0, 0, viewW, viewH);
        }
        ctx.save();
        ctx.strokeStyle = 'rgba(168, 230, 207, 0.6)'; ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        roundRect(ctx, area.x, area.y, area.width, area.height, 18);
        ctx.stroke();
        ctx.restore();
    }

    function drawFood(food, time) {
        const cx = food.x, cy = food.y, baseR = food.radius;
        let pulse = 0;
        const remain = Math.max(0, food.expiresAt - time) / 1000;
        if (remain < 3 && remain > 0) pulse = Math.sin(time / 80) * 0.18 * (3 - remain) / 3;
        const r = baseR * (1 + pulse);

        const grd = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 1.8);
        grd.addColorStop(0, hexA(food.color, 0.55)); grd.addColorStop(1, hexA(food.color, 0));
        ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(cx, cy, r * 1.8, 0, Math.PI * 2); ctx.fill();

        if (food.jackpot) {
            const ringR = r * 1.5 + Math.sin(time / 200) * 4;
            ctx.strokeStyle = 'rgba(255, 215, 0, 0.5)'; ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(cx, cy, ringR, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
        }
        if (food.tier === 'legendary') {
            const ringR = r * 1.4 + Math.sin(time / 200) * 3;
            ctx.strokeStyle = 'rgba(46, 204, 113, 0.45)'; ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(cx, cy, ringR, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
        }

        ctx.fillStyle = food.color; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath();
        ctx.arc(cx - r * 0.32, cy - r * 0.36, r * 0.26, 0, Math.PI * 2); ctx.fill();
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

        ctx.save();
        if (invis) ctx.globalAlpha = 0.3;

        // 皮肤拖尾
        if (sk.effect && segs.length > 2) {
            const tail = segs[segs.length - 1];
            if (Math.random() < 0.4) {
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
            const shieldR = r * 1.8 + Math.sin(time / 200) * 3;
            ctx.strokeStyle = 'rgba(144, 202, 249, 0.7)'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(head.x, head.y, shieldR, 0, Math.PI * 2); ctx.stroke();
        }

        // 蛇身阴影
        ctx.lineWidth = r * 2 + 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.strokeStyle = sk.shadow;
        ctx.beginPath(); ctx.moveTo(segs[0].x, segs[0].y);
        for (let i = 1; i < segs.length; i++) ctx.lineTo(segs[i].x, segs[i].y);
        ctx.stroke();

        // 蛇身主线
        ctx.lineWidth = r * 2 - 2;
        ctx.strokeStyle = sk.body;
        ctx.beginPath(); ctx.moveTo(segs[0].x, segs[0].y);
        for (let i = 1; i < segs.length; i++) ctx.lineTo(segs[i].x, segs[i].y);
        ctx.stroke();

        // 鳞片
        for (let i = 1; i < segs.length; i++) {
            const b = segs[i];
            const grd = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r);
            grd.addColorStop(0, sk.scaleHi); grd.addColorStop(1, sk.scaleLo);
            ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(b.x, b.y, r - 1.5, 0, Math.PI * 2); ctx.fill();
        }

        // 蛇头
        const head = segs[0];
        const grd = ctx.createRadialGradient(head.x - r * 0.3, head.y - r * 0.3, 0, head.x, head.y, r);
        grd.addColorStop(0, sk.headHi); grd.addColorStop(1, sk.headLo);
        ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(head.x, head.y, r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = sk.outline; ctx.lineWidth = 1.5; ctx.stroke();
        drawSnakeFace(head, snake.angle, r);

        ctx.restore();
    }

    function drawSnakeFace(head, angle, r) {
        const cosA = Math.cos(angle), sinA = Math.sin(angle);
        const perpX = -sinA, perpY = cosA;
        const eyeOff = r * 0.5, eyeR = r * 0.32;
        const e1 = { x: head.x + cosA * eyeOff * 0.4 + perpX * eyeOff * 0.7, y: head.y + sinA * eyeOff * 0.4 + perpY * eyeOff * 0.7 };
        const e2 = { x: head.x + cosA * eyeOff * 0.4 - perpX * eyeOff * 0.7, y: head.y + sinA * eyeOff * 0.4 - perpY * eyeOff * 0.7 };
        ctx.fillStyle = 'white';
        ctx.beginPath(); ctx.arc(e1.x, e1.y, eyeR, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(e2.x, e2.y, eyeR, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#2F2F4A';
        const pOff = eyeR * 0.35;
        ctx.beginPath(); ctx.arc(e1.x + cosA * pOff, e1.y + sinA * pOff, eyeR * 0.55, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(e2.x + cosA * pOff, e2.y + sinA * pOff, eyeR * 0.55, 0, Math.PI * 2); ctx.fill();
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

    function drawDeathAnimation(anim, time) {
        if (!anim) return;
        const t = anim.t;
        // 扩散环
        for (let i = 0; i < 4; i++) {
            const ringR = 30 + t * 200 + i * 30;
            const alpha = Math.max(0, 1 - t / 1.2 - i * 0.15);
            ctx.strokeStyle = `rgba(255, 139, 148, ${alpha})`;
            ctx.lineWidth = 3 - t * 2;
            ctx.beginPath(); ctx.arc(anim.x, anim.y, ringR, 0, Math.PI * 2); ctx.stroke();
        }
        // 中心闪光
        const flashAlpha = Math.max(0, 0.6 - t * 0.6);
        const grd = ctx.createRadialGradient(anim.x, anim.y, 0, anim.x, anim.y, 60);
        grd.addColorStop(0, `rgba(255, 255, 255, ${flashAlpha})`);
        grd.addColorStop(1, 'rgba(255, 139, 148, 0)');
        ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(anim.x, anim.y, 60, 0, Math.PI * 2); ctx.fill();
    }

    function drawScorePopup(popup) {
        if (!popup || popup.alpha <= 0) return;
        ctx.save();
        ctx.globalAlpha = Math.max(0, popup.alpha);
        ctx.font = 'bold 22px "Quicksand", "Nunito", sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 3;
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
        if (lives <= 0) return;
        ctx.save();
        ctx.font = 'bold 16px "Quicksand", sans-serif';
        ctx.textAlign = 'right'; ctx.textBaseline = 'top';
        const x = area.x + area.width - 8;
        const y = area.y + 4;
        // 作弊模式提示
        if (cheatMode) {
            ctx.fillStyle = 'rgba(255, 152, 0, 0.9)';
            ctx.fillText('⚡ WYM 作弊模式', x, y);
        }
        // 生命
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
        drawBackground();
        for (const f of (state.foods || [])) drawFood(f, time);
        if (state.showSnake !== false && state.snake) {
            drawSnake(state.snake, state.skin, time, {
                invincible: state.invincible,
                invisible: state.invisible,
                shield: state.shield,
            });
        }
        drawTrailParticles();
        drawParticles();
        drawDeathAnimation(state.deathAnimation, time);
        drawScorePopup(state.scorePopup);
        drawFlash(state.flashAlpha || 0);
        drawLives(state.lives, state.cheatMode);
    }

    return { resize, render, getArea, getMetrics: () => ({ viewW, viewH, area }) };
}

function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y); ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr); ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr); ctx.quadraticCurveTo(x, y, x + rr, y);
    ctx.closePath();
}

function hexA(hex, a) {
    const m = hex.replace('#', '');
    const v = m.length === 3 ? m.split('').map(c => c + c).join('') : m;
    const num = parseInt(v, 16);
    return `rgba(${(num >> 16) & 255},${(num >> 8) & 255},${num & 255},${a})`;
}