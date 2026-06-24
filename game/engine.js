// engine.js — 游戏主引擎：状态机 + 主循环 + 道具/buff 维护
// 适配 2D 自由移动版本（蛇在画布像素平面内自由活动）

import {
    createSnake, setTargetDirection, update as snakeUpdate,
    grow, checkWallCollision, checkSelfCollision, eats,
    setSpeedFactor,
} from './snake.js';
import { maintainFoods } from './food.js';
import { createRenderer, updateParticles, spawnParticles } from './renderer.js';

const STATE = {
    MENU: 'menu',
    PLAYING: 'playing',
    PAUSED: 'paused',
    GAME_OVER: 'gameover',
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
        const m = renderer.getMetrics();
        const area = renderer.getArea();
        const startX = area.x + area.width * 0.5;
        const startY = area.y + area.height * 0.5;
        // 速度根据画布尺寸微调（手机屏幕小 → 速度略低）
        const scale = Math.min(1, Math.min(area.width, area.height) / 500);
        snake = createSnake({
            x: startX,
            y: startY,
            initialAngle: 0,
            initialLength: 4,
            baseSpeed: 110 * scale,
            segmentRadius: 11 * scale,
            turnRate: 4.8,
        });
        // 初始在中心放一个食物
        foods = maintainFoods([], renderer.getArea(), snake, 4);
        score = 0;
        buffs.clear();
        speedFactor = 1;
        flashAlpha = 0;
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
                type,
                factor: b.factor,
                remain: Math.max(0, b.remain),
                duration: b.duration,
            });
        }
        return list;
    }

    function doStep(dt) {
        // 推进蛇
        snakeUpdate(snake, dt);

        // 碰撞：墙
        const area = renderer.getArea();
        const wall = checkWallCollision(snake, area);
        if (wall) {
            flashAlpha = 0.35;
            const head = snake.segments[0];
            spawnParticles(head.x, head.y, '#FF8B94', 18);
            spawnParticles(head.x, head.y, '#A8E6CF', 10);
            gameOver();
            return;
        }
        // 碰撞：自身
        const self = checkSelfCollision(snake);
        if (self) {
            flashAlpha = 0.35;
            const head = snake.segments[0];
            spawnParticles(head.x, head.y, '#FF8B94', 18);
            spawnParticles(head.x, head.y, '#A8E6CF', 10);
            gameOver();
            return;
        }

        // 吃食物
        for (let i = 0; i < foods.length; i++) {
            const f = foods[i];
            if (eats(snake, f)) {
                score += f.score;
                grow(snake, f.growth);
                if (f.buff) applyBuff(f.buff);
                spawnParticles(f.x, f.y, f.color, 14);
                if (f.buff) spawnParticles(f.x, f.y, '#FFD96A', 8);
                foods.splice(i, 1);
                emit('scoreChange', { score, length: snake.segments.length });
                emit('buffChange', serializeBuffs());
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

        if (state === STATE.PLAYING && snake && snake.alive) {
            tickBuffs(delta * 1000);
            doStep(delta);
        }

        if (state === STATE.PLAYING && snake) {
            foods = maintainFoods(foods, renderer.getArea(), snake, 4);
        }

        renderer.render({
            snake, foods, flashAlpha,
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
    }

    function resize() {
        // 优先用 canvas-wrap 的尺寸
        const wrap = canvas.parentElement;
        let wrapW = 0;
        let wrapH = 0;
        if (wrap) {
            const r = wrap.getBoundingClientRect();
            wrapW = r.width;
            wrapH = r.height;
        }
        if (wrapW <= 0 || wrapH <= 0) {
            wrapW = window.innerWidth;
            wrapH = window.innerHeight;
        }
        // canvas 内 padding（CSS 12px）
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
        start,
        stop,
        resize,
        startNewGame,
        togglePause,
        setDirection: setDirectionFromInput,
        getState: () => state,
        getBestScore: () => bestScore,
        setBestScore: (s) => { bestScore = s; emit('bestChange', bestScore); },
    };
}
