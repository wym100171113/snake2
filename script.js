// script.js — 入口：UI 路由 + 设备检测 + 引擎联动（2D 自由移动版）

import { createGame } from './game/engine.js';
import { createInputController, detectCapabilities } from './game/input.js';
import { storage } from './game/storage.js';

const $ = (sel) => document.querySelector(sel);

const els = {
    menuScreen: $('#menu-screen'),
    gameScreen: $('#game-screen'),
    pauseOverlay: $('#pause-overlay'),
    overOverlay: $('#over-overlay'),
    menuBest: $('#menu-best'),
    hudScore: $('#hud-score'),
    hudLength: $('#hud-length'),
    hudBest: $('#hud-best'),
    buffBar: $('#buff-bar'),
    canvas: $('#game-canvas'),
    joystick: $('#joystick'),
    btnStart: $('#btn-start'),
    btnPause: $('#btn-pause'),
    btnResume: $('#btn-resume'),
    btnPauseHome: $('#btn-pause-home'),
    btnRestart: $('#btn-restart'),
    btnHome: $('#btn-home'),
    overEmoji: $('#over-emoji'),
    overTitle: $('#over-title'),
    overSub: $('#over-sub'),
    overScore: $('#over-score'),
    overLength: $('#over-length'),
    overBest: $('#over-best'),
};

// 启动时显示最高分
els.menuBest.textContent = storage.getBestScore();
els.hudBest.textContent = storage.getBestScore();

// 设备检测：决定是否显示虚拟遥感
const caps = detectCapabilities();
if (caps.preferJoystick) {
    document.body.classList.add('show-joystick');
}

// 游戏引擎
const game = createGame({
    canvas: els.canvas,
    callbacks: {
        onBestScore: () => storage.getBestScore(),
        stateChange: (s) => {
            if (s === 'menu') showMenu();
            if (s === 'playing') hideOverlays();
            if (s === 'paused') showPause();
        },
        scoreChange: ({ score, length }) => {
            els.hudScore.textContent = score;
            els.hudLength.textContent = length;
        },
        bestChange: (best) => {
            els.hudBest.textContent = best;
            els.menuBest.textContent = best;
        },
        buffChange: (list) => renderBuffs(list),
        tick: ({ buffs }) => renderBuffs(buffs),
        gameOver: ({ score, length, isNewBest, bestScore }) => {
            const newBest = storage.setBestScore(score);
            els.overScore.textContent = score;
            els.overLength.textContent = length;
            els.overBest.textContent = newBest;
            if (isNewBest) {
                els.overEmoji.textContent = '🎉';
                els.overTitle.textContent = '新纪录！';
                els.overSub.textContent = '太厉害啦，破纪录了 ✨';
            } else if (score >= 200) {
                els.overEmoji.textContent = '🦄';
                els.overTitle.textContent = '传奇！';
                els.overSub.textContent = '神级操作，恭喜 🎆';
            } else if (score >= 100) {
                els.overEmoji.textContent = '🌟';
                els.overTitle.textContent = '完成出色';
                els.overSub.textContent = '继续保持手感～';
            } else if (score >= 30) {
                els.overEmoji.textContent = '🌸';
                els.overTitle.textContent = '不错的开始';
                els.overSub.textContent = '再来一局，挑战更高分';
            } else {
                els.overEmoji.textContent = '🌱';
                els.overTitle.textContent = '游戏结束';
                els.overSub.textContent = '慢慢来，享受每一口';
            }
            setTimeout(() => {
                els.overOverlay.hidden = false;
            }, 700);
        },
    },
});

const input = createInputController({
    onDirection: (dx, dy) => game.setDirection(dx, dy),
    onPause: () => {
        if (game.getState() === 'playing' || game.getState() === 'paused') {
            game.togglePause();
        }
    },
});

game.start();
requestAnimationFrame(() => game.resize());

// 视图切换
function showMenu() {
    hideOverlays();
    els.menuScreen.hidden = false;
    els.gameScreen.hidden = true;
    input.setActive(false);
}

function showGame() {
    els.menuScreen.hidden = true;
    els.gameScreen.hidden = false;
    input.setActive(true);
    requestAnimationFrame(() => game.resize());
}

function showPause() {
    els.pauseOverlay.hidden = false;
}

function hideOverlays() {
    els.pauseOverlay.hidden = true;
    els.overOverlay.hidden = true;
}

// 按钮绑定
els.btnStart.addEventListener('click', () => {
    showGame();
    game.startNewGame();
});

els.btnPause.addEventListener('click', () => {
    game.togglePause();
});

els.btnResume.addEventListener('click', () => {
    game.togglePause();
});

els.btnPauseHome.addEventListener('click', () => {
    game.togglePause();
    game.stop();
    game.start();
    showMenu();
});

els.btnRestart.addEventListener('click', () => {
    els.overOverlay.hidden = true;
    game.startNewGame();
});

els.btnHome.addEventListener('click', () => {
    game.stop();
    game.start();
    showMenu();
});

// 自适应
let resizeTimer = 0;
function handleResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        game.resize();
    }, 100);
}
window.addEventListener('resize', handleResize);
window.addEventListener('orientationchange', () => {
    setTimeout(handleResize, 200);
});

// Buff 渲染（避免每帧重建 DOM）
let lastBuffsKey = '';
function renderBuffs(list) {
    if (!list || list.length === 0) {
        if (lastBuffsKey !== '') {
            els.buffBar.innerHTML = '';
            lastBuffsKey = '';
        }
        return;
    }
    const key = list.map(b => `${b.type}:${Math.ceil(b.remain / 1000)}`).join('|');
    if (key === lastBuffsKey) return;
    lastBuffsKey = key;
    els.buffBar.innerHTML = list.map(b => {
        const meta = buffMeta(b.type);
        const remain = Math.ceil(b.remain / 1000);
        return `<span class="buff-chip" style="color:${meta.color}">
            <span class="buff-chip-dot" style="background:${meta.color}"></span>
            ${meta.label} ${remain}s
        </span>`;
    }).join('');
}

function buffMeta(type) {
    if (type === 'speed') return { label: '⚡ 加速', color: '#E8A33D' };
    if (type === 'slow')  return { label: '🫧 慢动作', color: '#8B7FD8' };
    return { label: type, color: '#5C5C77' };
}

// 防止页面整体滚动 / 缩放
['gesturestart', 'gesturechange', 'gestureend'].forEach(ev => {
    document.addEventListener(ev, e => e.preventDefault());
});
document.addEventListener('dblclick', e => e.preventDefault());

// 默认显示菜单
showMenu();
