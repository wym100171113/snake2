// engine.js — 游戏主引擎：状态机 + 主循环 + 道具/buff + 生命 + 技能 + 作弊

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
    RESPAWNING: 'respawning',
};

const FOOD_TARGET = 8;
const BURST_INTERVAL = 18;
const MAX_LIVES = 3;

// 技能定义（积分购买）
export const SKILLS = {
    invincible: { name: '无敌护盾', icon: '🛡️', desc: '10秒无敌', cost: 500, cooldown: 60, buff: { type: 'invincible', duration: 10000 } },
    magnet:     { name: '磁力吸引', icon: '🧲', desc: '8秒吸引食物', cost: 300, cooldown: 45, buff: { type: 'magnet', duration: 8000, radius: 80 } },
    superSpeed: { name: '极限加速', icon: '⚡', desc: '3秒3倍速', cost: 200, cooldown: 30, buff: { type: 'superSpeed', duration: 3000, factor: 3 } },
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
    // 新系统
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
    let totalScore = 0;          // 累积积分
    let ownedSkills = new Map(); // 已购买技能: { count, cooldownRemain }
    let deathAnimation = null;  // { x, y, t, segs }
    let respawnTimer = 0;

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
            if (b.remain <= 0) {
                buffs.delete(type);
                changed = true;
            }
        }
        if (changed) refreshSpeedFactor();
        // 独立计时器
        if (invincibleTimer > 0) { invincibleTimer -= deltaMs; if (invincibleTimer <= 0) invincibleTimer = 0; }
        if (magnetTimer > 0) { magnetTimer -= deltaMs; if (magnetTimer <= 0) magnetTimer = 0; }
        if (superSpeedTimer > 0) {
            superSpeedTimer -= deltaMs;
            if (superSpeedTimer <= 0) { superSpeedTimer = 0; refreshSpeedFactor(); }
        }
        if (invisibleTimer > 0) { invisibleTimer -= deltaMs; if (invisibleTimer <= 0) invisibleTimer = 0; }
        if (shieldTimer > 0) { shieldTimer -= deltaMs; if (shieldTimer <= 0) shieldTimer = 0; }
        if (slowTimeTimer > 0) {
            slowTimeTimer -= deltaMs;
            if (slowTimeTimer <= 0) { slowTimeTimer = 0; refreshSpeedFactor(); }
        }
    }

    function startNewGame() {
        const area = renderer.getArea();
        const startX = area.x + area.width * 0.5;
        const startY = area.y + area.height * 0.5;
        const scale = Math.min(1, Math.min(area.width, area.height) / 500);
        snake = createSnake({
            x: startX, y: startY,
            initialAngle: 0, initialLength: 4,
            baseSpeed: 120 * scale,
            segmentRadius: 11 * scale,
            turnRate: 5.2,
        });
        foods = maintainFoods([], renderer.getArea(), snake, FOOD_TARGET, cheatMode);
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
        respawnTimer = 0;
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
    }

    function respawn() {
        if (lives <= 0) { gameOver(); return; }
        lives--;
        emit('livesChange', lives);
        const area = renderer.getArea();
        const startX = area.x + area.width * 0.5;
        const startY = area.y + area.height * 0.5;
        const scale = Math.min(1, Math.min(area.width, area.height) / 500);
        snake = createSnake({
            x: startX, y: startY,
            initialAngle: 0, initialLength: Math.max(4, Math.floor(snake.segments.length * 0.6)),
            baseSpeed: 120 * scale,
            segmentRadius: 11 * scale,
            turnRate: 5.2,
        });
        buffs.clear();
        speedFactor = 1;
        invincibleTimer = 3000; // 重生后3秒无敌
        superSpeedTimer = 0;
        invisibleTimer = 0;
        shieldTimer = 0;
        slowTimeTimer = 0;
        flashAlpha = 0;
        scorePopup = null;
        deathAnimation = null;
        respawnTimer = 0;
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
        // 积分累积（作弊模式不计分）
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
            if (force && state === STATE.PLAYING) {
                state = STATE.PAUSED;
                emit('stateChange', state);
            } else if (!force && state === STATE.PAUSED) {
                state = STATE.PLAYING;
                lastFrame = performance.now();
                emit('stateChange', state);
            }
            return;
        }
        if (state === STATE.PLAYING) {
            state = STATE.PAUSED;
            emit('stateChange', state);
        } else if (state === STATE.PAUSED) {
            state = STATE.PLAYING;
            lastFrame = performance.now();
            emit('stateChange', state);
        }
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

        const area = renderer.getArea();
        const wall = checkWallCollision(snake, area);
        if (wall) {
            if (invincibleTimer > 0) {
                // 无敌：穿墙反弹
                const head = snake.segments[0];
                if (head.x - snake.segmentRadius < area.x) head.x = area.x + snake.segmentRadius;
                if (head.x + snake.segmentRadius > area.x + area.width) head.x = area.x + area.width - snake.segmentRadius;
                if (head.y - snake.segmentRadius < area.y) head.y = area.y + snake.segmentRadius;
                if (head.y + snake.segmentRadius > area.y + area.height) head.y = area.y + area.height - snake.segmentRadius;
            } else if (shieldTimer > 0) {
                shieldTimer = 0;
                flashAlpha = 0.25;
                spawnParticles(snake.segments[0].x, snake.segments[0].y, '#90CAF9', 20);
            } else {
                flashAlpha = 0.35;
                const h = snake.segments[0];
                spawnParticles(h.x, h.y, '#FF8B94', 18);
                spawnParticles(h.x, h.y, '#A8E6CF', 10);
                if (lives > 0) { respawn(); return; }
                gameOver();
                return;
            }
        }

        const self = checkSelfCollision(snake);
        if (self) {
            if (cheatMode) {
                // 作弊模式：不死亡
            } else if (invincibleTimer > 0) {
                // 无敌：不死亡
            } else if (shieldTimer > 0) {
                shieldTimer = 0;
                flashAlpha = 0.25;
                spawnParticles(snake.segments[0].x, snake.segments[0].y, '#90CAF9', 20);
            } else {
                flashAlpha = 0.35;
                const h = snake.segments[0];
                spawnParticles(h.x, h.y, '#FF8B94', 18);
                spawnParticles(h.x, h.y, '#A8E6CF', 10);
                if (lives > 0) { respawn(); return; }
                gameOver();
                return;
            }
        }

        // 磁力：吸引食物
        if (magnetTimer > 0 && snake && snake.segments.length > 0) {
            const head = snake.segments[0];
            for (const f of foods) {
                const dx = head.x - f.x;
                const dy = head.y - f.y;
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

                const particleCount = f.jackpot ? 30 : f.tier === 'legendary' ? 22 : f.tier === 'epic' ? 18 : 14;
                spawnParticles(f.x, f.y, f.color, particleCount);
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

        if (comboTimer > 0) {
            comboTimer -= delta;
            if (comboTimer <= 0) comboCount = 0;
        }

        if (scorePopup) {
            scorePopup.y += scorePopup.vy * delta;
            scorePopup.alpha -= delta * 1.2;
            if (scorePopup.alpha <= 0) scorePopup = null;
        }

        // 死亡动画
        if (deathAnimation) {
            deathAnimation.t += delta;
            if (deathAnimation.t > 1.2) deathAnimation = null;
        }

        if (state === STATE.PLAYING && snake && snake.alive) {
            tickBuffs(delta * 1000);
            doStep(delta);

            burstTimer -= delta;
            if (burstTimer <= 0) {
                burstTimer = BURST_INTERVAL + Math.random() * 6;
                const newFoods = burstSpawn(renderer.getArea(), snake, 3 + Math.floor(Math.random() * 3), cheatMode);
                foods.push(...newFoods);
            }
        }

        if (state === STATE.PLAYING && snake) {
            foods = maintainFoods(foods, renderer.getArea(), snake, FOOD_TARGET, cheatMode);
        }

        renderer.render({
            snake, foods, flashAlpha, scorePopup,
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
    }

    function start() {
        stopFlag = false;
        lastFrame = performance.now();
        if (callbacks.onBestScore) bestScore = callbacks.onBestScore();
        try { totalScore = parseInt(localStorage.getItem('snake.totalScore') || '0') || 0; } catch (e) { totalScore = 0; }
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
        if (document.hidden && state === STATE.PLAYING) {
            togglePause(true);
        }
    }
    document.addEventListener('visibilitychange', onVisibilityChange);

    // 技能冷却
    function tickSkillCooldowns(delta) {
        for (const [, skill] of ownedSkills) {
            if (skill.cooldownRemain > 0) skill.cooldownRemain -= delta;
        }
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
        buySkill: (id) => {
            const skill = SKILLS[id];
            if (!skill) return false;
            if (totalScore < skill.cost) return false;
            totalScore -= skill.cost;
            try { localStorage.setItem('snake.totalScore', totalScore); } catch (e) {}
            const owned = ownedSkills.get(id) || { count: 0, cooldownRemain: 0 };
            owned.count++;
            ownedSkills.set(id, owned);
            emit('totalScoreChange', totalScore);
            return true;
        },
        useSkill: (id) => {
            const owned = ownedSkills.get(id);
            if (!owned || owned.count <= 0) return false;
            if (owned.cooldownRemain > 0) return false;
            const skill = SKILLS[id];
            if (state !== STATE.PLAYING || !snake) return false;
            owned.count--;
            owned.cooldownRemain = skill.cooldown;
            if (owned.count <= 0) ownedSkills.delete(id);
            applyBuff(skill.buff);
            return true;
        },
        getOwnedSkills: () => {
            const result = {};
            for (const [id, v] of ownedSkills) {
                result[id] = { count: v.count, cooldownRemain: v.cooldownRemain, cooldown: SKILLS[id].cooldown };
            }
            return result;
        },
        tickSkillCooldowns: (dt) => tickSkillCooldowns(dt),
        getSkills: () => SKILLS,
    };
}