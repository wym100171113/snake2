// script.js — 入口：UI 路由 + 设备检测 + 引擎联动

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
    dpad: $('#dpad'),
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

// 设备检测：决定是否显示 D-Pad
const caps = detectCapabilities();
if (caps.preferDPad) {
    document.body.classList.add('show-dpad');
}

// 游戏引擎
const game = createGame({
    canvas: els.canvas,
    callbacks: {
        onBestScore: () => storage.getBestScore(),
        stateChange: (s) => {
            // 状态变化时的 UI 同步
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
            // 写入最高分
            const newBest = storage.setBestScore(score);
            els.overScore.textContent = score;
            els.overLength.textContent = length;
            els.overBest.textContent = newBest;
            if (isNewBest) {
                els.overEmoji.textContent = '🎉';
                els.overTitle.textContent = '新纪录！';
                els.overSub.textContent = '太厉害啦，破纪录了 ✨';
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
    onDirection: (dir) => game.setDirection(dir),
    onPause: () => {
        if (game.getState() === 'playing' || game.getState() === 'paused') {
            game.togglePause();
        }
    },
});

// 启动游戏循环
game.start();
// 首帧时调整画布大小
requestAnimationFrame(() => game.resize());

// 视图切换
function showMenu() {
    els.menuScreen.hidden = false;
    els.gameScreen.hidden = true;
    input.setActive(false);
}

function showGame() {
    els.menuScreen.hidden = true;
    els.gameScreen.hidden = false;
    input.setActive(true);
    // 等布局完成再 resize
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
    game.togglePause(); // 确保解除暂停
    game.stop();
    // 重启游戏循环
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
