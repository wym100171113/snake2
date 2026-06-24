// engine.js — 游戏主引擎：状态机 + 主循环 + 道具/buff 维护

import {
    createSnake, setDirection, step, commitMove,
    checkCollision, eats, grow,
} from './snake.js';
import { maintainFoods } from './food.js';
import { createRenderer, updateParticles, spawnParticles } from './renderer.js';

const STATE = {
    MENU: 'menu',
    PLAYING: 'playing',
    PAUSED: 'paused',
    GAME_OVER: 'gameover',
};

// 网格规格
const GRID_COLS = 18;
const GRID_ROWS = 18;
const WALLS = { cols: GRID_COLS, rows: GRID_ROWS, wrap: false };

// 速度（毫秒/格）
const BASE_TICK_MS = 140;
const MIN_TICK_MS = 70;

export function createGame({ canvas, callbacks }) {
    const renderer = createRenderer(canvas);
    let state = STATE.MENU;
    let snake = null;
    let foods = [];
    let score = 0;
    let bestScore = 0;
    let buffs = new Map();           // type -> { remain, factor, duration }
    let lastTick = 0;
    let accumulator = 0;
    let lastFrame = 0;
    let flashAlpha = 0;
    let rafId = 0;
    let pausedByBlur = false;
    let stopFlag = false;

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
    }

    function tickBuffs(deltaMs) {
        for (const [type, b] of buffs) {
            b.remain -= deltaMs;
            if (b.remain <= 0) buffs.delete(type);
        }
    }

    function currentTick() {
        let t = BASE_TICK_MS;
        // 加速 buff 减少 tick，减速 buff 增大 tick
        for (const b of buffs.values()) {
            t = t / b.factor; // factor > 1 → 更快（tick 更小）
        }
        return Math.max(MIN_TICK_MS, Math.round(t));
    }

    function startNewGame() {
        snake = createSnake(Math.floor(GRID_COLS / 2) - 1, Math.floor(GRID_ROWS / 2), 3, 'right');
        foods = maintainFoods([], WALLS, snake, 4);
        score = 0;
        buffs.clear();
        flashAlpha = 0;
        state = STATE.PLAYING;
        emit('stateChange', state);
        emit('scoreChange', { score, length: snake.body.length });
        emit('bestChange', bestScore);
        emit('buffChange', serializeBuffs());
    }

    function gameOver() {
        state = STATE.GAME_OVER;
        const isNewBest = score > bestScore;
        if (isNewBest) bestScore = score;
        emit('stateChange', state);
        emit('gameOver', { score, length: snake.body.length, isNewBest, bestScore });
    }

    function setDirectionFromInput(dir) {
        if (state !== STATE.PLAYING || !snake) return;
        setDirection(snake, dir);
    }

    function togglePause(force) {
        if (typeof force === 'boolean') {
            // 强制到指定状态
            if (force && state === STATE.PLAYING) {
                state = STATE.PAUSED;
                emit('stateChange', state);
            } else if (!force && state === STATE.PAUSED) {
                state = STATE.PLAYING;
                lastFrame = performance.now();
                accumulator = 0;
                emit('stateChange', state);
            }
            return;
        }
        // 切换
        if (state === STATE.PLAYING) {
            state = STATE.PAUSED;
            emit('stateChange', state);
        } else if (state === STATE.PAUSED) {
            state = STATE.PLAYING;
            lastFrame = performance.now();
            accumulator = 0;
            emit('stateChange', state);
        }
    }

    function doStep() {
        const newHead = step(snake);
        commitMove(snake, newHead);
        const collision = checkCollision(snake, WALLS);
        if (collision) {
            // 死亡时屏幕轻微白闪
            flashAlpha = 0.35;
            // 在头部位置生成碎裂粒子
            const head = snake.body[0];
            const m = renderer.getMetrics();
            const px = m.offsetX + head.x * m.cellSize + m.cellSize / 2;
            const py = m.offsetY + head.y * m.cellSize + m.cellSize / 2;
            spawnParticles(px, py, '#FF8B94', 18);
            spawnParticles(px, py, '#A8E6CF', 10);
            gameOver();
            return;
        }
        // 检测吃食物
        for (let i = 0; i < foods.length; i++) {
            const f = foods[i];
            if (eats(snake, f)) {
                // 加分 + 生长
                score += f.score;
                grow(snake, f.growth);
                if (f.buff) applyBuff(f.buff);
                // 粒子
                const m = renderer.getMetrics();
                const px = m.offsetX + f.x * m.cellSize + m.cellSize / 2;
                const py = m.offsetY + f.y * m.cellSize + m.cellSize / 2;
                spawnParticles(px, py, f.color, 14);
                if (f.buff) spawnParticles(px, py, '#FFD96A', 8);
                foods.splice(i, 1);
                emit('scoreChange', { score, length: snake.body.length });
                emit('buffChange', serializeBuffs());
                break;
            }
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

    function loop(now) {
        if (stopFlag) return;
        rafId = requestAnimationFrame(loop);
        const delta = Math.min(64, now - lastFrame); // 限制 delta 防卡顿后大跳
        lastFrame = now;

        // 背景粒子动画总是跑
        updateParticles(delta / 1000);

        // 闪屏衰减
        if (flashAlpha > 0) flashAlpha = Math.max(0, flashAlpha - delta / 600);

        if (state === STATE.PLAYING) {
            accumulator += delta;
            tickBuffs(delta);
            const tick = currentTick();
            while (accumulator >= tick) {
                accumulator -= tick;
                if (state === STATE.PLAYING) doStep();
            }
        } else {
            accumulator = 0;
        }

        // 食物维持
        if (state === STATE.PLAYING && snake) {
            foods = maintainFoods(foods, WALLS, snake, 4);
        }

        // 渲染
        const time = now;
        renderer.render({
            snake, foods, flashAlpha,
            showSnake: state === STATE.PLAYING || state === STATE.GAME_OVER || state === STATE.PAUSED,
        }, time);

        // 周期性通知 buff 倒计时变化（HUD 显示）
        emit('tick', { state, score, length: snake ? snake.body.length : 0, buffs: serializeBuffs() });
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
        // 优先用 canvas-wrap 的尺寸（弹性容器），如果没有则用 window
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
        // 减去 wrap 的 padding（CSS: 12px）
        const padding = 24;
        renderer.resize(wrapW - padding, wrapH - padding, GRID_COLS, GRID_ROWS);
    }

    // 切后台自动暂停
    function onVisibilityChange() {
        if (document.hidden && state === STATE.PLAYING) {
            pausedByBlur = true;
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
