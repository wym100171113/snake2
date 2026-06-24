// engine.js — 游戏主引擎：状态机 + 主循环 + 道具/buff 维护
// 适配 2D 自由移动版本（蛇在画布像素平面内自由活动）

import {
    createSnake, setTargetDirection, update as snakeUpdate,
    grow, checkWallCollision, checkSelfCollision, eats,
    setSpeedFactor,
} from './snake.js';
import { maintainFoods, burstSpawn } from './food.js';
import { createRenderer, updateParticles, spawnParticles } from './renderer.js';

const STATE = {
    MENU: 'menu',
    PLAYING: 'playing',
    PAUSED: 'paused',
    GAME_OVER: 'gameover',
};

const FOOD_TARGET = 8;       // 场上同时食物数量
const BURST_INTERVAL = 18;   // 每隔多少秒爆发一批新食物

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
    let burstTimer = 0;          // 爆发倒计时
    let comboCount = 0;          // 连击计数
    let comboTimer = 0;          // 连击窗口
    let scorePopup = null;       // 临时飘字 { x, y, text, alpha, vy }

    function emit(evt, payload) {
        if (callbacks && typeof callbacks[evt] === 'function') {
            callbacks[evt](payload);
        }
    }

    function applyBuff(buff) {
        if (!buff) return;
        const cur = buffs.get(buff.type) || { remain: 0, factor: 1, duration: 0 };
        cur.factor = buff.factor;
        cur.duration = buff.duration;
        cur.remain = buff.duration;
        buffs.set(buff.type, cur);
        refreshSpeedFactor();
    }

    function refreshSpeedFactor() {
        let factor = 1;
        for (const b of buffs.values()) factor *= b.factor;
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
    }

    function startNewGame() {
        const area = renderer.getArea();
        const startX = area.x + area.width * 0.5;
        const startY = area.y + area.height * 0.5;
        const scale = Math.min(1, Math.min(area.width, area.height) / 500);
        snake = createSnake({
            x: startX,
            y: startY,
            initialAngle: 0,
            initialLength: 4,
            baseSpeed: 120 * scale,   // 略快
            segmentRadius: 11 * scale,
            turnRate: 5.2,            // 转向更灵敏
        });
        foods = maintainFoods([], renderer.getArea(), snake, FOOD_TARGET);
        score = 0;
        buffs.clear();
        speedFactor = 1;
        flashAlpha = 0;
        burstTimer = BURST_INTERVAL;
        comboCount = 0;
        comboTimer = 0;
        scorePopup = null;
        state = STATE.PLAYING;
        lastFrame = performance.now();
        emit('stateChange', state);
        emit('scoreChange', { score, length: snake.segments.length });
        emit('bestChange', bestScore);
        emit('buffChange', serializeBuffs());
    }

    function gameOver() {
        state = STATE.GAME_OVER;
        snake.alive = false;
        const isNewBest = score > bestScore;
        if (isNewBest) bestScore = score;
        emit('stateChange', state);
        emit('gameOver', { score, length: snake.segments.length, isNewBest, bestScore });
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
            list.push({
                type, factor: b.factor,
                remain: Math.max(0, b.remain),
                duration: b.duration,
            });
        }
        return list;
    }

    function doStep(dt) {
        snakeUpdate(snake, dt);

        const area = renderer.getArea();
        const wall = checkWallCollision(snake, area);
        if (wall) {
            flashAlpha = 0.35;
            const h = snake.segments[0];
            spawnParticles(h.x, h.y, '#FF8B94', 18);
            spawnParticles(h.x, h.y, '#A8E6CF', 10);
            gameOver();
            return;
        }
        const self = checkSelfCollision(snake);
        if (self) {
            flashAlpha = 0.35;
            const h = snake.segments[0];
            spawnParticles(h.x, h.y, '#FF8B94', 18);
            spawnParticles(h.x, h.y, '#A8E6CF', 10);
            gameOver();
            return;
        }

        // 吃食物
        for (let i = 0; i < foods.length; i++) {
            const f = foods[i];
            if (eats(snake, f)) {
                // 连击
                comboCount++;
                comboTimer = 1.5;  // 1.5 秒内吃到下一个算连击
                const comboBonus = Math.min(comboCount - 1, 5) * 0.1; // 最多 +50%
                const finalScore = Math.round(f.score * (1 + comboBonus));

                score += finalScore;
                grow(snake, f.growth);
                if (f.buff) applyBuff(f.buff);

                // 粒子效果：大奖用更多粒子
                const particleCount = f.jackpot ? 30 : f.tier === 'legendary' ? 22 : f.tier === 'epic' ? 18 : 14;
                spawnParticles(f.x, f.y, f.color, particleCount);
                if (f.jackpot) {
                    spawnParticles(f.x, f.y, '#FFD700', 20);
                    spawnParticles(f.x, f.y, '#FF6B9D', 20);
                    flashAlpha = 0.15;
                }
                if (f.buff) spawnParticles(f.x, f.y, '#FFD96A', 10);

                // 飘字
                if (comboCount >= 3) {
                    scorePopup = { x: f.x, y: f.y - 20, text: `x${comboCount}`, alpha: 1, vy: -60 };
                } else if (f.jackpot) {
                    scorePopup = { x: f.x, y: f.y - 20, text: 'JACKPOT!', alpha: 1, vy: -80 };
                }

                foods.splice(i, 1);
                emit('scoreChange', { score, length: snake.segments.length });
                emit('buffChange', serializeBuffs());
                emit('eatEvent', {
                    jackpot: !!f.jackpot,
                    tier: f.tier || 'common',
                    comboCount,
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

        // 连击计时器衰减
        if (comboTimer > 0) {
            comboTimer -= delta;
            if (comboTimer <= 0) comboCount = 0;
        }

        // 飘字动画
        if (scorePopup) {
            scorePopup.y += scorePopup.vy * delta;
            scorePopup.alpha -= delta * 1.2;
            if (scorePopup.alpha <= 0) scorePopup = null;
        }

        if (state === STATE.PLAYING && snake && snake.alive) {
            tickBuffs(delta * 1000);
            doStep(delta);

            // 爆发计时器
            burstTimer -= delta;
            if (burstTimer <= 0) {
                burstTimer = BURST_INTERVAL + Math.random() * 6;
                const newFoods = burstSpawn(renderer.getArea(), snake, 3 + Math.floor(Math.random() * 3));
                foods.push(...newFoods);
            }
        }

        if (state === STATE.PLAYING && snake) {
            foods = maintainFoods(foods, renderer.getArea(), snake, FOOD_TARGET);
        }

        renderer.render({
            snake, foods, flashAlpha, scorePopup,
            showSnake: state === STATE.PLAYING || state === STATE.GAME_OVER || state === STATE.PAUSED,
        }, now);

        emit('tick', { state, score, length: snake ? snake.segments.length : 0, buffs: serializeBuffs() });
    }

    function start() {
        stopFlag = false;
        lastFrame = performance.now();
        if (callbacks.onBestScore) bestScore = callbacks.onBestScore();
        emit('bestChange', bestScore);
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

    return {
        start, stop, resize, startNewGame, togglePause,
        setDirection: setDirectionFromInput,
        getState: () => state,
        getBestScore: () => bestScore,
        setBestScore: (s) => { bestScore = s; emit('bestChange', bestScore); },
    };
}