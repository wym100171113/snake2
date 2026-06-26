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
const BURST_INTERVAL = 12;
const MAX_LIVES = 3;
const WORLD_W = 2000;
const WORLD_H = 2000;

// 道具定义（积分购买，消耗品，每轮携带2个）
export const ITEMS = {
    invincible: { name: '无敌护盾', icon: '🛡️', desc: '10秒无敌', cost: 500, cooldown: 60, buff: { type: 'invincible', duration: 10000 } },
    magnet:     { name: '磁力吸引', icon: '🧲', desc: '8秒吸引食物', cost: 300, cooldown: 45, buff: { type: 'magnet', duration: 8000, radius: 150 } },
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
    let magnetRadius = 150;
    let superSpeedTimer = 0;
    let invisibleTimer = 0;
    let shieldTimer = 0;
    let slowTimeTimer = 0;
    let fatTimer = 0;
    let doubleScoreTimer = 0;
    let cheatMode = false;
    let cheatScoreDisabled = false;
    let totalScore = 0;
    let elapsedTime = 0;
    let inventory = new Map();
    let selectedItems = [null, null];
    let deathAnimation = null;
    let camera = { x: 0, y: 0 };
    let permanentAbility = false;
    let buffStacks = new Map(); // track how many stacks of each effect

    renderer.setWorldSize(WORLD_W, WORLD_H);

    function emit(evt, payload) {
        if (callbacks && typeof callbacks[evt] === 'function') {
            callbacks[evt](payload);
        }
    }

    function applyBuff(buff) {
        if (!buff || !snake) return;
        // 作弊模式：取消负面效果，增强正面效果
        const negativeTypes = ['slow', 'slowTime', 'invisible', 'shrink'];
        // 永久能力下免疫减速
        if (permanentAbility && (buff.type === 'slow' || buff.type === 'slowTime')) return;
        if (cheatMode && negativeTypes.includes(buff.type)) return;
        const dur = cheatMode ? (buff.duration || 0) * 2 : buff.duration;
        const factor = cheatMode && buff.factor ? Math.max(buff.factor, 2) : buff.factor;
        // 永久能力：效果可叠加（最多3层）
        const stackKey = buff.type;
        const currentStacks = buffStacks.get(stackKey) || 0;
        const maxStacks = permanentAbility ? 3 : 1;
        if (currentStacks >= maxStacks) return; // 已达最大层数
        buffStacks.set(stackKey, currentStacks + 1);
        const useDur = permanentAbility ? dur : dur;
        switch (buff.type) {
            case 'speed':
            case 'slow': {
                const cur = buffs.get(buff.type) || { remain: 0, factor: 1, duration: 0 };
                cur.factor = factor;
                cur.duration = dur;
                cur.remain = dur;
                buffs.set(buff.type, cur);
                refreshSpeedFactor();
                break;
            }
            case 'invincible':
                invincibleTimer = permanentAbility ? invincibleTimer + dur : Math.max(invincibleTimer, dur);
                break;
            case 'magnet':
                magnetTimer = permanentAbility ? magnetTimer + dur : Math.max(magnetTimer, dur);
                magnetRadius = buff.radius || 150;
                break;
            case 'superSpeed':
                superSpeedTimer = permanentAbility ? superSpeedTimer + dur : Math.max(superSpeedTimer, dur);
                setSpeedFactor(snake, factor || 3);
                break;
            case 'life':
                lives = Math.min(lives + (buff.amount || 1), MAX_LIVES);
                emit('livesChange', lives);
                break;
            case 'invisible':
                invisibleTimer = permanentAbility ? invisibleTimer + dur : Math.max(invisibleTimer, dur);
                break;
            case 'shield':
                shieldTimer = permanentAbility ? shieldTimer + dur : Math.max(shieldTimer, dur);
                break;
            case 'slowTime':
                slowTimeTimer = permanentAbility ? slowTimeTimer + dur : Math.max(slowTimeTimer, dur);
                setSpeedFactor(snake, factor || buff.factor || 0.5);
                break;
            case 'fat':
                fatTimer = permanentAbility ? fatTimer + dur : Math.max(fatTimer, dur);
                break;
            case 'doubleScore':
                doubleScoreTimer = permanentAbility ? doubleScoreTimer + dur : Math.max(doubleScoreTimer, dur);
                break;
            case 'extendBuffs':
                // 延长所有正面效果60秒
                invincibleTimer = Math.max(invincibleTimer, invincibleTimer > 0 ? invincibleTimer + 60 : 0);
                magnetTimer = Math.max(magnetTimer, magnetTimer > 0 ? magnetTimer + 60 : 0);
                superSpeedTimer = Math.max(superSpeedTimer, superSpeedTimer > 0 ? superSpeedTimer + 60 : 0);
                shieldTimer = Math.max(shieldTimer, shieldTimer > 0 ? shieldTimer + 60 : 0);
                fatTimer = Math.max(fatTimer, fatTimer > 0 ? fatTimer + 60 : 0);
                doubleScoreTimer = Math.max(doubleScoreTimer, doubleScoreTimer > 0 ? doubleScoreTimer + 60 : 0);
                // 也延长speed buff
                ['speed'].forEach(t => {
                    const b = buffs.get(t);
                    if (b && b.remain > 0) { b.remain += 60; b.duration += 60; }
                });
                spawnParticles(snake.segments[0].x, snake.segments[0].y, '#FFD700', 30);
                break;
            case 'shrink':
                if (snake) {
                    const oldLen = snake.segments.length;
                    shrink(snake, buff.amount || 3);
                    const newLen = snake.segments.length;
                    if (newLen < oldLen) {
                        flashAlpha = 0.15;
                        const tail = snake.segments[snake.segments.length - 1];
                        spawnParticles(tail.x, tail.y, '#FFD96A', 20);
                        spawnParticles(tail.x, tail.y, '#FF8B94', 10);
                    }
                }
                break;
        }
    }

    function refreshSpeedFactor() {
        let factor = permanentAbility ? 1.25 : 1;
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
        if (fatTimer > 0) { fatTimer -= deltaMs; if (fatTimer <= 0) fatTimer = 0; }
        if (doubleScoreTimer > 0) { doubleScoreTimer -= deltaMs; if (doubleScoreTimer <= 0) doubleScoreTimer = 0; }
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
        elapsedTime = 0;
        buffStacks = new Map();
        scorePopup = null;
        invincibleTimer = 0;
        magnetTimer = 0;
        superSpeedTimer = 0;
        invisibleTimer = 0;
        shieldTimer = 0;
        slowTimeTimer = 0;
        fatTimer = 0;
        doubleScoreTimer = 0;
        deathAnimation = null;
        cheatScoreDisabled = cheatMode;
        lives = cheatMode ? MAX_LIVES : 1;
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
        fatTimer = 0;
        doubleScoreTimer = 0;
        elapsedTime = 0;
        buffStacks = new Map();
        flashAlpha = 0;
        scorePopup = null;
        deathAnimation = null;
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
        if (fatTimer > 0) list.push({ type: 'fat', remain: fatTimer, duration: fatTimer });
        if (doubleScoreTimer > 0) list.push({ type: 'doubleScore', remain: doubleScoreTimer, duration: doubleScoreTimer });
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
                flashAlpha = 0.25;
                const head = snake.segments[0];
                if (head.x - snake.segmentRadius < area.x) head.x = area.x + snake.segmentRadius;
                if (head.x + snake.segmentRadius > area.x + area.width) head.x = area.x + area.width - snake.segmentRadius;
                if (head.y - snake.segmentRadius < area.y) head.y = area.y + snake.segmentRadius;
                if (head.y + snake.segmentRadius > area.y + area.height) head.y = area.y + area.height - snake.segmentRadius;
                invincibleTimer = Math.max(invincibleTimer, 500);
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
                flashAlpha = 0.25;
                invincibleTimer = Math.max(invincibleTimer, 500);
                spawnParticles(snake.segments[0].x, snake.segments[0].y, '#90CAF9', 20);
            } else {
                flashAlpha = 0.35;
                spawnParticles(snake.segments[0].x, snake.segments[0].y, '#FF8B94', 18);
                spawnParticles(snake.segments[0].x, snake.segments[0].y, '#A8E6CF', 10);
                if (lives > 0) { respawn(); return; }
                gameOver(); return;
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
                const finalScore = Math.round(f.score * (1 + comboBonus) * (doubleScoreTimer > 0 ? 2 : 1));
                if (!cheatScoreDisabled) score += finalScore;
                grow(snake, f.growth);
                if (f.buff) applyBuff(f.buff);
                if (f.jackpot) {
                    lives = Math.min(lives + 1, MAX_LIVES);
                    emit('livesChange', lives);
                }

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

        // tick inventory cooldowns
        let invChanged = false;
        for (const [id, v] of inventory) {
            if (v.cooldownRemain > 0) {
                v.cooldownRemain -= delta;
                if (v.cooldownRemain <= 0) v.cooldownRemain = 0;
                invChanged = true;
            }
        }
        if (invChanged) emit('itemsChange', getSelectedItems());

        if (state === STATE.PLAYING && snake && snake.alive) {
            tickBuffs(delta * 1000);
            doStep(delta);
            elapsedTime += delta;

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
        }

        if (state === STATE.PLAYING && snake) {
            foods = maintainFoods(foods, renderer.getVisibleArea(), snake, FOOD_TARGET, cheatMode);
        }

        renderer.render({
            snake, foods, flashAlpha, scorePopup,
            skin: currentSkin,
            showSnake: state === STATE.PLAYING || state === STATE.GAME_OVER || state === STATE.PAUSED,
            invincible: invincibleTimer > 0,
            invisible: invisibleTimer > 0,
            shield: shieldTimer > 0,
            fat: fatTimer > 0,
            deathAnimation,
            lives,
            cheatMode,
        }, now);

        emit('tick', { state, score: cheatScoreDisabled ? 0 : score, length: snake ? snake.segments.length : 0, buffs: serializeBuffs(), elapsed: elapsedTime });
    }

    function start() {
        stopFlag = false;
        lastFrame = performance.now();
        if (callbacks.onBestScore) bestScore = callbacks.onBestScore();
        try { totalScore = parseInt(localStorage.getItem('snake.totalScore') || '0') || 0; } catch (e) { totalScore = 0; }
        try { permanentAbility = localStorage.getItem('snake.permanentAbility') === '1'; } catch (e) { permanentAbility = false; }
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
        getPermanentAbility: () => permanentAbility,
        setPermanentAbility: (v) => {
            permanentAbility = v;
            refreshSpeedFactor();
            try { localStorage.setItem('snake.permanentAbility', v ? '1' : '0'); } catch (e) {}
        },
        buyPermanentAbility: (cost) => {
            if (permanentAbility) return false;
            if (totalScore < cost) return false;
            totalScore -= cost;
            try { localStorage.setItem('snake.totalScore', totalScore); } catch (e) {}
            permanentAbility = true;
            refreshSpeedFactor();
            try { localStorage.setItem('snake.permanentAbility', '1'); } catch (e) {}
            emit('totalScoreChange', totalScore);
            return true;
        },

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
            if (owned.count <= 0) {
                inventory.delete(id);
                selectedItems[slot] = null;
                try { localStorage.setItem('snake.selectedItems', JSON.stringify(selectedItems)); } catch (e) {}
            }
            applyBuff(item.buff);
            emit('itemsChange', getSelectedItems());
            return true;
        },

        getSelectedItems: () => {
            return selectedItems.map(id => id ? { id, ...ITEMS[id], count: (inventory.get(id) || { count: 0 }).count, cdRemain: (inventory.get(id) || { cooldownRemain: 0 }).cooldownRemain } : null);
        },

        getInventory: () => {
            const result = {};
            for (const [id, v] of inventory) {
                result[id] = { count: v.count, cooldownRemain: v.cooldownRemain, cooldown: ITEMS[id].cooldown };
            }
            return result;
        },

        getItems: () => ITEMS,
        loadSelectedItems: () => {
            try { selectedItems = JSON.parse(localStorage.getItem('snake.selectedItems') || '[null,null]'); } catch (e) { selectedItems = [null, null]; }
            return selectedItems;
        },
    };
}