// engine.js — 游戏主引擎：状态机 + 主循环 + 道具/buff + 生命 + 道具 + 作弊 + 相机滚动

import {
    createSnake, setTargetDirection, update as snakeUpdate,
    grow, shrink, checkWallCollision, checkSelfCollision, eats,
    setSpeedFactor,
} from './snake.js';
import { maintainFoods, burstSpawn } from './food.js';
import { createRenderer, updateParticles, spawnParticles, SNAKE_SKINS } from './renderer.js';

const STATE = {
    MENU: 'menu',
    PLAYING: 'playing',
    PAUSED: 'paused',
    GAME_OVER: 'gameover',
};

const FOOD_TARGET = 20;
const BURST_INTERVAL = 5;
const MAX_LIVES = 3;
const WORLD_W = 2000;
const WORLD_H = 2000;
const OBSTACLE_COUNT = 8;
const OBSTACLE_INTERVAL = 8;

// 道具定义（积分购买，消耗品，每轮携带2个）
export const ITEMS = {
    invincible: { name: '无敌护盾', icon: '🛡️', desc: '10秒无敌', cost: 500, cooldown: 60, buff: { type: 'invincible', duration: 10000 } },
    magnet:     { name: '磁力吸引', icon: '🧲', desc: '8秒吸引食物', cost: 300, cooldown: 45, buff: { type: 'magnet', duration: 8000, radius: 200 } },
    superSpeed: { name: '极限加速', icon: '⚡', desc: '15秒3倍速', cost: 200, cooldown: 30, buff: { type: 'superSpeed', duration: 15000, factor: 3 } },
    extraLife:  { name: '额外生命', icon: '💖', desc: '加一条命(最多3)', cost: 1000, cooldown: 120, buff: { type: 'life', amount: 1 } },
    invisible:  { name: '隐身', icon: '👻', desc: '4秒隐身', cost: 400, cooldown: 50, buff: { type: 'invisible', duration: 4000 } },
    shrink:     { name: '瘦身', icon: '📏', desc: '减少5节', cost: 150, cooldown: 20, buff: { type: 'shrink', amount: 5 } },
    shield:     { name: '护盾', icon: '🔰', desc: '8秒护盾', cost: 350, cooldown: 50, buff: { type: 'shield', duration: 8000 } },
};

export function createGame({ canvas, callbacks }) {
    const renderer = createRenderer(canvas);
    let state = STATE.MENU;
    let snake = null;
    let foods = [];
    let score = 0;
    let bestScore = 0;
    let buffs = new Map();
    let lastFrame = 0;
    let flashAlpha = 0;
    let rafId = 0;
    let stopFlag = false;
    let speedFactor = 1;
    let burstTimer = 0;
    let comboCount = 0;
    let comboTimer = 0;
    let scorePopup = null;
    let currentSkin = SNAKE_SKINS.classic;
    let lives = 1;
    let invincibleTimer = 0;
    let magnetTimer = 0;
    let magnetRadius = 80;
    let superSpeedTimer = 0;
    let invisibleTimer = 0;
    let shieldTimer = 0;
    let slowTimeTimer = 0;
    let cheatMode = false;
    let cheatScoreDisabled = false;
    let totalScore = 0;
    let inventory = new Map();
    let selectedItems = [null, null];
    let deathAnimation = null;
    let camera = { x: 0, y: 0 };
    let obstacles = [];
    let obstacleTimer = 0;

    renderer.setWorldSize(WORLD_W, WORLD_H);

    function emit(evt, payload) {
        if (callbacks && typeof callbacks[evt] === 'function') {
            callbacks[evt](payload);
        }
    }

    function applyBuff(buff) {
        if (!buff) return;
        switch (buff.type) {
            case 'speed':
            case 'slow': {
                const cur = buffs.get(buff.type) || { remain: 0, factor: 1, duration: 0 };
                cur.factor = buff.factor;
                cur.duration = buff.duration;
                cur.remain = buff.duration;
                buffs.set(buff.type, cur);
                refreshSpeedFactor();
                break;
            }
            case 'invincible':
                invincibleTimer = Math.max(invincibleTimer, buff.duration);
                break;
            case 'magnet':
                magnetTimer = Math.max(magnetTimer, buff.duration);
                magnetRadius = buff.radius || 80;
                break;
            case 'superSpeed':
                superSpeedTimer = Math.max(superSpeedTimer, buff.duration);
                setSpeedFactor(snake, buff.factor || 3);
                break;
            case 'life':
                lives = Math.min(lives + (buff.amount || 1), MAX_LIVES);
                emit('livesChange', lives);
                break;
            case 'invisible':
                invisibleTimer = Math.max(invisibleTimer, buff.duration);
                break;
            case 'shield':
                shieldTimer = Math.max(shieldTimer, buff.duration);
                break;
            case 'slowTime':
                slowTimeTimer = Math.max(slowTimeTimer, buff.duration);
                setSpeedFactor(snake, buff.factor || 0.5);
                break;
            case 'shrink':
                if (snake) shrink(snake, buff.amount || 3);
                spawnParticles(snake.segments[snake.segments.length - 1]?.x || 0, snake.segments[snake.segments.length - 1]?.y || 0, '#FFD96A', 12);
                break;
        }
    }

    function refreshSpeedFactor() {
        let factor = 1;
        for (const b of buffs.values()) {
            if (b.factor) factor *= b.factor;
        }
        speedFactor = factor;
        if (snake) setSpeedFactor(snake, factor);
    }

    function tickBuffs(deltaMs) {
        let changed = false;
        for (const [type, b] of buffs) {
            b.remain -= deltaMs;
            if (b.remain <= 0) { buffs.delete(type); changed = true; }
        }
        if (changed) refreshSpeedFactor();
        if (invincibleTimer > 0) { invincibleTimer -= deltaMs; if (invincibleTimer <= 0) invincibleTimer = 0; }
        if (magnetTimer > 0) { magnetTimer -= deltaMs; if (magnetTimer <= 0) magnetTimer = 0; }
        if (superSpeedTimer > 0) { superSpeedTimer -= deltaMs; if (superSpeedTimer <= 0) { superSpeedTimer = 0; refreshSpeedFactor(); } }
        if (invisibleTimer > 0) { invisibleTimer -= deltaMs; if (invisibleTimer <= 0) invisibleTimer = 0; }
        if (shieldTimer > 0) { shieldTimer -= deltaMs; if (shieldTimer <= 0) shieldTimer = 0; }
        if (slowTimeTimer > 0) { slowTimeTimer -= deltaMs; if (slowTimeTimer <= 0) { slowTimeTimer = 0; refreshSpeedFactor(); } }
    }

    function saveInventory() {
        const obj = {};
        for (const [id, v] of inventory) {
            obj[id] = { count: v.count, cooldownRemain: v.cooldownRemain };
        }
        try { localStorage.setItem('snake.inventory', JSON.stringify(obj)); } catch (e) {}
    }

    function loadInventory() {
        try {
            const obj = JSON.parse(localStorage.getItem('snake.inventory') || '{}');
            for (const [id, v] of Object.entries(obj)) {
                inventory.set(id, { count: v.count, cooldownRemain: v.cooldownRemain || 0 });
            }
        } catch (e) { inventory = new Map(); }
    }

    function startNewGame() {
        const startX = WORLD_W * 0.5;
        const startY = WORLD_H * 0.5;
        const scale = Math.min(1, Math.min(WORLD_W, WORLD_H) / 500);
        snake = createSnake({
            x: startX, y: startY,
            initialAngle: 0, initialLength: 4,
            baseSpeed: 120 * scale,
            segmentRadius: 11 * scale,
            turnRate: 5.2,
        });
        camera = { x: startX - (renderer.getMetrics().viewW || 400) / 2, y: startY - (renderer.getMetrics().viewH || 400) / 2 };
        foods = maintainFoods([], renderer.getVisibleArea(), snake, FOOD_TARGET, cheatMode);
        score = 0;
        buffs.clear();
        speedFactor = 1;
        flashAlpha = 0;
        burstTimer = BURST_INTERVAL;
        comboCount = 0;
        comboTimer = 0;
        scorePopup = null;
        invincibleTimer = 0;
        magnetTimer = 0;
        superSpeedTimer = 0;
        invisibleTimer = 0;
        shieldTimer = 0;
        slowTimeTimer = 0;
        deathAnimation = null;
        cheatScoreDisabled = cheatMode;
        lives = cheatMode ? MAX_LIVES : 1;
        obstacles = [];
        obstacleTimer = OBSTACLE_INTERVAL;
        state = STATE.PLAYING;
        lastFrame = performance.now();
        emit('stateChange', state);
        emit('scoreChange', { score: cheatScoreDisabled ? 0 : score, length: snake.segments.length });
        emit('bestChange', bestScore);
        emit('buffChange', serializeBuffs());
        emit('livesChange', lives);
        emit('cheatChange', cheatMode);
        emit('itemsChange', getSelectedItems());
    }

    function respawn() {
        if (lives <= 0) { gameOver(); return; }
        lives--;
        emit('livesChange', lives);
        const startX = WORLD_W * 0.5;
        const startY = WORLD_H * 0.5;
        const scale = Math.min(1, Math.min(WORLD_W, WORLD_H) / 500);
        snake = createSnake({
            x: startX, y: startY,
            initialAngle: 0, initialLength: Math.max(4, Math.floor(snake.segments.length * 0.6)),
            baseSpeed: 120 * scale,
            segmentRadius: 11 * scale,
            turnRate: 5.2,
        });
        camera = { x: startX - (renderer.getMetrics().viewW || 400) / 2, y: startY - (renderer.getMetrics().viewH || 400) / 2 };
        buffs.clear();
        speedFactor = 1;
        invincibleTimer = 3000;
        superSpeedTimer = 0;
        invisibleTimer = 0;
        shieldTimer = 0;
        slowTimeTimer = 0;
        flashAlpha = 0;
        scorePopup = null;
        deathAnimation = null;
        obstacles = [];
        obstacleTimer = OBSTACLE_INTERVAL;
        refreshSpeedFactor();
        state = STATE.PLAYING;
        lastFrame = performance.now();
        emit('stateChange', state);
        emit('buffChange', serializeBuffs());
    }

    function gameOver() {
        state = STATE.GAME_OVER;
        if (snake) {
            snake.alive = false;
            const head = snake.segments[0];
            deathAnimation = { x: head.x, y: head.y, t: 0, segs: snake.segments.length };
        }
        const isNewBest = !cheatScoreDisabled && score > bestScore;
        if (isNewBest) bestScore = score;
        if (!cheatScoreDisabled) {
            totalScore += score;
            try { localStorage.setItem('snake.totalScore', totalScore); } catch (e) {}
            emit('totalScoreChange', totalScore);
        }
        emit('stateChange', state);
        emit('gameOver', { score: cheatScoreDisabled ? 0 : score, length: snake ? snake.segments.length : 0, isNewBest, bestScore, cheatMode });
    }

    function setDirectionFromInput(dx, dy) {
        if (state !== STATE.PLAYING || !snake) return;
        setTargetDirection(snake, dx, dy);
    }

    function togglePause(force) {
        if (typeof force === 'boolean') {
            if (force && state === STATE.PLAYING) { state = STATE.PAUSED; emit('stateChange', state); }
            else if (!force && state === STATE.PAUSED) { state = STATE.PLAYING; lastFrame = performance.now(); emit('stateChange', state); }
            return;
        }
        if (state === STATE.PLAYING) { state = STATE.PAUSED; emit('stateChange', state); }
        else if (state === STATE.PAUSED) { state = STATE.PLAYING; lastFrame = performance.now(); emit('stateChange', state); }
    }

    function serializeBuffs() {
        const list = [];
        for (const [type, b] of buffs) {
            list.push({ type, factor: b.factor, remain: Math.max(0, b.remain), duration: b.duration });
        }
        if (invincibleTimer > 0) list.push({ type: 'invincible', remain: invincibleTimer, duration: invincibleTimer });
        if (magnetTimer > 0) list.push({ type: 'magnet', remain: magnetTimer, duration: magnetTimer });
        if (superSpeedTimer > 0) list.push({ type: 'superSpeed', remain: superSpeedTimer, duration: superSpeedTimer });
        if (invisibleTimer > 0) list.push({ type: 'invisible', remain: invisibleTimer, duration: invisibleTimer });
        if (shieldTimer > 0) list.push({ type: 'shield', remain: shieldTimer, duration: shieldTimer });
        if (slowTimeTimer > 0) list.push({ type: 'slowTime', remain: slowTimeTimer, duration: slowTimeTimer });
        return list;
    }

    function doStep(dt) {
        snakeUpdate(snake, dt);

        const area = { x: 0, y: 0, width: WORLD_W, height: WORLD_H };
        const wall = checkWallCollision(snake, area);
        if (wall) {
            if (invincibleTimer > 0) {
                const head = snake.segments[0];
                if (head.x - snake.segmentRadius < area.x) head.x = area.x + snake.segmentRadius;
                if (head.x + snake.segmentRadius > area.x + area.width) head.x = area.x + area.width - snake.segmentRadius;
                if (head.y - snake.segmentRadius < area.y) head.y = area.y + snake.segmentRadius;
                if (head.y + snake.segmentRadius > area.y + area.height) head.y = area.y + area.height - snake.segmentRadius;
            } else if (shieldTimer > 0) {
                shieldTimer = 0;
                const head = snake.segments[0];
                if (head.x - snake.segmentRadius < area.x) head.x = area.x + snake.segmentRadius;
                if (head.x + snake.segmentRadius > area.x + area.width) head.x = area.x + area.width - snake.segmentRadius;
                if (head.y - snake.segmentRadius < area.y) head.y = area.y + snake.segmentRadius;
                if (head.y + snake.segmentRadius > area.y + area.height) head.y = area.y + area.height - snake.segmentRadius;
                invincibleTimer = 500;
                flashAlpha = 0.25;
                spawnParticles(snake.segments[0].x, snake.segments[0].y, '#90CAF9', 20);
            } else {
                flashAlpha = 0.35;
                spawnParticles(snake.segments[0].x, snake.segments[0].y, '#FF8B94', 18);
                spawnParticles(snake.segments[0].x, snake.segments[0].y, '#A8E6CF', 10);
                if (lives > 0) { respawn(); return; }
                gameOver(); return;
            }
        }

        const self = checkSelfCollision(snake);
        if (self) {
            if (cheatMode || invincibleTimer > 0) {
                // 不死亡
            } else if (shieldTimer > 0) {
                shieldTimer = 0;
                invincibleTimer = 500;
                flashAlpha = 0.25;
                spawnParticles(snake.segments[0].x, snake.segments[0].y, '#90CAF9', 20);
            } else {
                flashAlpha = 0.35;
                spawnParticles(snake.segments[0].x, snake.segments[0].y, '#FF8B94', 18);
                spawnParticles(snake.segments[0].x, snake.segments[0].y, '#A8E6CF', 10);
                if (lives > 0) { respawn(); return; }
                gameOver(); return;
            }
        }

        // obstacle collision
        if (!cheatMode && !invincibleTimer && !shieldTimer) {
            for (const ob of obstacles) {
                const head = snake.segments[0];
                const dx = head.x - ob.x;
                const dy = head.y - ob.y;
                const r = snake.segmentRadius + ob.size;
                if (dx * dx + dy * dy < r * r) {
                    flashAlpha = 0.35;
                    spawnParticles(head.x, head.y, '#E74C3C', 18);
                    if (lives > 0) { respawn(); return; }
                    gameOver(); return;
                }
            }
        }

        // 磁力
        if (magnetTimer > 0 && snake && snake.segments.length > 0) {
            const head = snake.segments[0];
            for (const f of foods) {
                const dx = head.x - f.x, dy = head.y - f.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < magnetRadius && dist > 0.1) {
                    const force = (1 - dist / magnetRadius) * 120 * dt;
                    f.x += (dx / dist) * force;
                    f.y += (dy / dist) * force;
                }
            }
        }

        // 吃食物
        for (let i = 0; i < foods.length; i++) {
            const f = foods[i];
            if (eats(snake, f)) {
                comboCount++;
                comboTimer = 1.5;
                const comboBonus = Math.min(comboCount - 1, 5) * 0.1;
                const finalScore = Math.round(f.score * (1 + comboBonus));
                if (!cheatScoreDisabled) score += finalScore;
                grow(snake, f.growth);
                if (f.buff) applyBuff(f.buff);

                const pc = f.jackpot ? 30 : f.tier === 'legendary' ? 22 : f.tier === 'epic' ? 18 : 14;
                spawnParticles(f.x, f.y, f.color, pc);
                if (f.jackpot) {
                    spawnParticles(f.x, f.y, '#FFD700', 20);
                    spawnParticles(f.x, f.y, '#FF6B9D', 20);
                    flashAlpha = 0.15;
                }
                if (f.buff && f.tier !== 'common') spawnParticles(f.x, f.y, '#FFD96A', 10);

                if (comboCount >= 3) {
                    scorePopup = { x: f.x, y: f.y - 20, text: `x${comboCount}`, alpha: 1, vy: -60 };
                } else if (f.jackpot) {
                    scorePopup = { x: f.x, y: f.y - 20, text: 'JACKPOT!', alpha: 1, vy: -80 };
                }

                foods.splice(i, 1);
                emit('scoreChange', { score: cheatScoreDisabled ? 0 : score, length: snake.segments.length });
                emit('buffChange', serializeBuffs());
                emit('eatEvent', {
                    jackpot: !!f.jackpot,
                    tier: f.tier || 'common',
                    comboCount,
                    foodKey: f.key || '',
                });
                break;
            }
        }
    }

    function loop(now) {
        if (stopFlag) return;
        rafId = requestAnimationFrame(loop);
        try {
        const delta = Math.min(64, now - lastFrame) / 1000;
        lastFrame = now;

        updateParticles(delta);
        if (flashAlpha > 0) flashAlpha = Math.max(0, flashAlpha - delta / 0.6);

        if (comboTimer > 0) { comboTimer -= delta; if (comboTimer <= 0) comboCount = 0; }

        if (scorePopup) {
            scorePopup.y += scorePopup.vy * delta;
            scorePopup.alpha -= delta * 1.2;
            if (scorePopup.alpha <= 0) scorePopup = null;
        }

        if (deathAnimation) {
            deathAnimation.t += delta;
            if (deathAnimation.t > 1.2) deathAnimation = null;
        }

        if (state === STATE.PLAYING && snake && snake.alive) {
            tickBuffs(delta * 1000);

            // tick inventory item cooldowns (in seconds)
            for (const [id, owned] of inventory) {
                if (owned.cooldownRemain > 0) {
                    owned.cooldownRemain -= delta;
                    if (owned.cooldownRemain <= 0) owned.cooldownRemain = 0;
                }
            }

            doStep(delta);

            // camera follow snake head
            if (snake.segments.length > 0) {
                const head = snake.segments[0];
                const m = renderer.getMetrics();
                const targetX = head.x - m.viewW / 2;
                const targetY = head.y - m.viewH / 2;
                camera.x += (targetX - camera.x) * 0.08;
                camera.y += (targetY - camera.y) * 0.08;
                camera.x = Math.max(0, Math.min(WORLD_W - m.viewW, camera.x));
                camera.y = Math.max(0, Math.min(WORLD_H - m.viewH, camera.y));
                renderer.setCamera(camera.x, camera.y);
            }

            burstTimer -= delta;
            if (burstTimer <= 0) {
                burstTimer = BURST_INTERVAL + Math.random() * 6;
                const newFoods = burstSpawn(renderer.getVisibleArea(), snake, 5 + Math.floor(Math.random() * 4), cheatMode);
                foods.push(...newFoods);
            }

            // obstacle spawn
            obstacleTimer -= delta;
            if (obstacleTimer <= 0) {
                obstacleTimer = OBSTACLE_INTERVAL + Math.random() * 5;
                const va = renderer.getVisibleArea();
                for (let i = 0; i < 2; i++) {
                    const size = 20 + Math.random() * 30;
                    const ox = va.x + size + Math.random() * (va.width - size * 2);
                    const oy = va.y + size + Math.random() * (va.height - size * 2);
                    // don't spawn too close to snake head
                    if (snake && snake.segments.length > 0) {
                        const hdx = snake.segments[0].x - ox;
                        const hdy = snake.segments[0].y - oy;
                        if (Math.sqrt(hdx*hdx + hdy*hdy) < 120) continue;
                    }
                    obstacles.push({ x: ox, y: oy, size, color: `hsl(${Math.random()*360},60%,45%)` });
                    if (obstacles.length > 30) obstacles.shift();
                }
            }
        }

        if (state === STATE.PLAYING && snake) {
            foods = maintainFoods(foods, renderer.getVisibleArea(), snake, FOOD_TARGET, cheatMode);
        }

        renderer.render({
            snake, foods, obstacles, flashAlpha, scorePopup,
            skin: currentSkin,
            showSnake: state === STATE.PLAYING || state === STATE.GAME_OVER || state === STATE.PAUSED,
            invincible: invincibleTimer > 0,
            invisible: invisibleTimer > 0,
            shield: shieldTimer > 0,
            deathAnimation,
            lives,
            cheatMode,
        }, now);

        emit('tick', { state, score: cheatScoreDisabled ? 0 : score, length: snake ? snake.segments.length : 0, buffs: serializeBuffs() });
        emit('itemsChange', getSelectedItems());
        } catch (e) {
            console.error('Game loop error:', e);
        }
    }

    function start() {
        stopFlag = false;
        lastFrame = performance.now();
        if (callbacks.onBestScore) bestScore = callbacks.onBestScore();
        try { totalScore = parseInt(localStorage.getItem('snake.totalScore') || '0') || 0; } catch (e) { totalScore = 0; }
        loadInventory();
        emit('bestChange', bestScore);
        emit('totalScoreChange', totalScore);
        state = STATE.MENU;
        emit('stateChange', state);
        rafId = requestAnimationFrame(loop);
    }

    function stop() {
        stopFlag = true;
        cancelAnimationFrame(rafId);
        snake = null;
        foods = [];
        buffs.clear();
        flashAlpha = 0;
        scorePopup = null;
        deathAnimation = null;
    }

    function resize() {
        const wrap = canvas.parentElement;
        let wrapW = 0, wrapH = 0;
        if (wrap) {
            const r = wrap.getBoundingClientRect();
            wrapW = r.width;
            wrapH = r.height;
        }
        if (wrapW <= 0 || wrapH <= 0) {
            wrapW = window.innerWidth;
            wrapH = window.innerHeight;
        }
        const padding = 24;
        renderer.resize(wrapW - padding, wrapH - padding);
    }

    function onVisibilityChange() {
        if (document.hidden && state === STATE.PLAYING) togglePause(true);
    }
    document.addEventListener('visibilitychange', onVisibilityChange);

    function getSelectedItems() {
        return selectedItems.map(id => {
            if (!id) return null;
            const item = ITEMS[id];
            if (!item) return null;
            const owned = inventory.get(id) || { count: 0, cooldownRemain: 0 };
            return { id, ...item, count: owned.count, cdRemain: owned.cooldownRemain };
        });
    }

    return {
        start, stop, resize, startNewGame, togglePause,
        setDirection: setDirectionFromInput,
        getState: () => state,
        getBestScore: () => bestScore,
        setBestScore: (s) => { bestScore = s; emit('bestChange', bestScore); },
        setSkin: (key) => { currentSkin = SNAKE_SKINS[key] || SNAKE_SKINS.classic; },
        getSkin: () => currentSkin,
        setCheatMode: (v) => { cheatMode = v; },
        getCheatMode: () => cheatMode,
        getTotalScore: () => totalScore,
        getLives: () => lives,

        // 道具系统
        buyItem: (id) => {
            const item = ITEMS[id];
            if (!item) return false;
            if (totalScore < item.cost) return false;
            totalScore -= item.cost;
            try { localStorage.setItem('snake.totalScore', totalScore); } catch (e) {}
            const owned = inventory.get(id) || { count: 0, cooldownRemain: 0 };
            owned.count++;
            inventory.set(id, owned);
            saveInventory();
            emit('totalScoreChange', totalScore);
            return true;
        },

        selectItems: (id1, id2) => {
            selectedItems = [id1 || null, id2 || null];
            try { localStorage.setItem('snake.selectedItems', JSON.stringify(selectedItems)); } catch (e) {}
            emit('itemsChange', selectedItems);
        },

        useItem: (slot) => {
            if (slot !== 0 && slot !== 1) return false;
            const id = selectedItems[slot];
            if (!id) return false;
            const owned = inventory.get(id);
            if (!owned || owned.count <= 0) return false;
            if (owned.cooldownRemain > 0) return false;
            const item = ITEMS[id];
            if (!item) return false;
            if (state !== STATE.PLAYING || !snake) return false;
            owned.count--;
            owned.cooldownRemain = item.cooldown;
            if (owned.count <= 0) inventory.delete(id);
            saveInventory();
            applyBuff(item.buff);
            emit('itemsChange', getSelectedItems());
            return true;
        },

        getInventory: () => {
            const result = {};
            for (const [id, v] of inventory) {
                result[id] = { count: v.count, cooldownRemain: v.cooldownRemain, cooldown: ITEMS[id].cooldown };
            }
            return result;
        },

        getItems: () => ITEMS,
        getSelectedItems,
        loadSelectedItems: () => {
            try { selectedItems = JSON.parse(localStorage.getItem('snake.selectedItems') || '[null,null]'); } catch (e) { selectedItems = [null, null]; }
            return selectedItems;
        },
    };
}