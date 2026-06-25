// script.js — 入口：UI 路由 + 设备检测 + 主题 + 成就 + 皮肤 + 音效 + 音乐 + 作弊 + 技能商店

import { createGame, SKILLS } from './game/engine.js';
import { createInputController, detectCapabilities } from './game/input.js';
import { storage } from './game/storage.js';
import { SNAKE_SKINS } from './game/renderer.js';

const $ = (sel) => document.querySelector(sel);

const els = {
    menuScreen: $('#menu-screen'),
    gameScreen: $('#game-screen'),
    pauseOverlay: $('#pause-overlay'),
    overOverlay: $('#over-overlay'),
    achPanel: $('#achievement-panel'),
    shopPanel: $('#skill-shop-panel'),
    menuBest: $('#menu-best'),
    statGames: $('#stat-games'),
    statAchievements: $('#stat-achievements'),
    statMaxlen: $('#stat-maxlen'),
    statScore: $('#stat-score'),
    hudScore: $('#hud-score'),
    hudLength: $('#hud-length'),
    hudBest: $('#hud-best'),
    hudTime: $('#hud-time'),
    buffBar: $('#buff-bar'),
    canvas: $('#game-canvas'),
    joystick: $('#joystick'),
    btnStart: $('#btn-start'),
    btnPause: $('#btn-pause'),
    btnResume: $('#btn-resume'),
    btnPauseHome: $('#btn-pause-home'),
    btnRestart: $('#btn-restart'),
    btnHome: $('#btn-home'),
    btnAch: $('#btn-achievements'),
    btnAchClose: $('#btn-ach-close'),
    btnShop: $('#btn-shop'),
    btnShopClose: $('#btn-shop-close'),
    shopList: $('#shop-list'),
    shopScore: $('#shop-score'),
    achList: $('#ach-list'),
    overEmoji: $('#over-emoji'),
    overTitle: $('#over-title'),
    overSub: $('#over-sub'),
    overScore: $('#over-score'),
    overLength: $('#over-length'),
    overTime: $('#over-time'),
    overBest: $('#over-best'),
    achToast: $('#achievement-toast'),
    achIcon: $('#ach-icon'),
    achTitle: $('#ach-title'),
    achDesc: $('#ach-desc'),
    soundIcon: $('#sound-icon'),
    musicIcon: $('#music-icon'),
    themeButtons: document.querySelectorAll('.theme-btn'),
    skinOptions: $('#skin-options'),
    cheatIndicator: $('#cheat-indicator'),
};

// ========== 音效系统 ==========
let audioCtx = null;
let soundEnabled = true;
let musicEnabled = true;
let musicInterval = 0;
let musicNotes = [];

function getAudioCtx() {
    if (!audioCtx) {
        try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
    }
    return audioCtx;
}

function playTone(freq, duration, type = 'sine', vol = 0.08) {
    if (!soundEnabled) return;
    const ctx = getAudioCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
}

function sfxEat()     { playTone(660, 0.1, 'sine', 0.06); playTone(880, 0.08, 'sine', 0.04); }
function sfxRare()    { playTone(880, 0.12, 'triangle', 0.07); playTone(1100, 0.1, 'triangle', 0.05); }
function sfxLegend()  { playTone(1100, 0.15, 'triangle', 0.08); playTone(1320, 0.12, 'sine', 0.06); }
function sfxJackpot() { playTone(1320, 0.2, 'sine', 0.1); playTone(1760, 0.15, 'sine', 0.08); playTone(2200, 0.1, 'triangle', 0.06); }
function sfxDie()     { playTone(200, 0.3, 'sawtooth', 0.06); playTone(150, 0.4, 'sawtooth', 0.05); }
function sfxUnlock()  { playTone(660, 0.08, 'sine', 0.05); playTone(880, 0.08, 'sine', 0.05); playTone(1100, 0.1, 'sine', 0.06); }

// ========== 音乐系统（程序化生成） ==========
const MENU_MELODY = [262, 330, 392, 330, 294, 349, 440, 349, 330, 294, 262, 330];
const GAME_MELODY = [392, 440, 494, 523, 494, 440, 392, 349, 330, 349, 392, 440, 494, 523, 587, 523];

function startMusic() {
    if (!musicEnabled) return;
    stopMusic();
    const state = game.getState();
    const melody = state === 'playing' ? GAME_MELODY : MENU_MELODY;
    let idx = 0;
    musicInterval = setInterval(() => {
        if (!musicEnabled) { stopMusic(); return; }
        const ctx = getAudioCtx();
        if (!ctx) return;
        const freq = melody[idx % melody.length];
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.4);
        idx++;
    }, 500);
}

function stopMusic() {
    clearInterval(musicInterval);
    musicInterval = 0;
}

function toggleMusic() {
    musicEnabled = !musicEnabled;
    els.musicIcon.textContent = musicEnabled ? '🎵' : '🔇';
    storage.setSetting('music', musicEnabled);
    if (musicEnabled) startMusic();
    else stopMusic();
}

// ========== 主题系统 ==========
function applyTheme(name) {
    document.documentElement.className = `theme-${name}`;
    storage.setSetting('theme', name);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
        const colors = { heal: '#FFF4F0', dark: '#1A1A2E', forest: '#E8F5E9', ocean: '#E0F7FA', candy: '#FCE4EC' };
        meta.content = colors[name] || '#FFF4F0';
    }
    els.themeButtons.forEach(b => b.classList.toggle('active', b.dataset.theme === name));
}

function initTheme() {
    applyTheme(storage.getSettings().theme || 'heal');
}

els.themeButtons.forEach(btn => {
    btn.addEventListener('click', () => applyTheme(btn.dataset.theme));
});

// 音效/音乐开关
$('#btn-sound').addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    els.soundIcon.textContent = soundEnabled ? '🔊' : '🔇';
    storage.setSetting('sound', soundEnabled);
    if (soundEnabled) playTone(440, 0.05, 'sine', 0.04);
});

$('#btn-music').addEventListener('click', toggleMusic);

if (storage.getSettings().sound === false) {
    soundEnabled = false;
    els.soundIcon.textContent = '🔇';
}
if (storage.getSettings().music === false) {
    musicEnabled = false;
    els.musicIcon.textContent = '🔇';
}

// ========== 作弊模式 ==========
let cheatKeys = [];
let cheatTimer = 0;
const CHEAT_SEQ = ['w', 'y', 'm'];
let cheatActive = false;

document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    const k = e.key.toLowerCase();
    if (k === CHEAT_SEQ[cheatKeys.length]) {
        cheatKeys.push(k);
        clearTimeout(cheatTimer);
        cheatTimer = setTimeout(() => { cheatKeys = []; }, 2000);
        if (cheatKeys.length === CHEAT_SEQ.length) {
            cheatKeys = [];
            cheatActive = !cheatActive;
            game.setCheatMode(cheatActive);
            if (cheatActive) {
                els.cheatIndicator.hidden = false;
                playTone(880, 0.1, 'sine', 0.06);
                setTimeout(() => playTone(1100, 0.1, 'sine', 0.06), 120);
                setTimeout(() => playTone(1320, 0.15, 'sine', 0.08), 250);
            } else {
                els.cheatIndicator.hidden = true;
                playTone(440, 0.1, 'sine', 0.04);
            }
        }
    }
});

// ========== 成就系统 ==========
const ACHIEVEMENTS = [
    // 基础
    { id: 'first_game',   icon: '🎮', title: '初次尝试', desc: '完成第一局游戏' },
    // 得分
    { id: 'score_80',     icon: '🌱', title: '小有进步', desc: '单局得分达到 80' },
    { id: 'score_150',    icon: '🌟', title: '百尺竿头', desc: '单局得分达到 150' },
    { id: 'score_300',    icon: '🦄', title: '传说降临', desc: '单局得分达到 300' },
    { id: 'score_750',    icon: '👑', title: '蛇王加冕', desc: '单局得分达到 750' },
    { id: 'score_1500',   icon: '🏆', title: '不朽传奇', desc: '单局得分达到 1500' },
    // 连击
    { id: 'combo_6',      icon: '🔥', title: '连击大师', desc: '达成 6 连击' },
    { id: 'combo_12',     icon: '💥', title: '无双连击', desc: '达成 12 连击' },
    { id: 'combo_20',     icon: '⚡', title: '终极连击', desc: '达成 20 连击' },
    // 大奖
    { id: 'eat_jackpot',   icon: '💎', title: '遇见独角兽', desc: '吃到超级大奖' },
    { id: 'eat_phoenix',   icon: '🔥', title: '凤凰涅槃', desc: '吃到凤凰' },
    { id: 'eat_heart',     icon: '💖', title: '生命之心', desc: '吃到生命之心' },
    { id: 'eat_both_jp',   icon: '🌈', title: '双重大奖', desc: '同一局吃到独角兽和凤凰' },
    // 长度
    { id: 'len_25',       icon: '🐍', title: '小蛇初长', desc: '蛇身长度达到 25' },
    { id: 'len_60',       icon: '🐲', title: '庞然大物', desc: '蛇身长度达到 60' },
    { id: 'len_100',      icon: '🦖', title: '远古巨兽', desc: '蛇身长度达到 100' },
    // 时间
    { id: 'time_240',     icon: '⏱️', title: '持久力', desc: '存活超过 4 分钟' },
    { id: 'time_600',     icon: '⌛', title: '时间旅者', desc: '存活超过 10 分钟' },
    // 局数
    { id: 'games_15',     icon: '🎯', title: '百折不挠', desc: '累计游玩 15 局' },
    { id: 'games_50',     icon: '🎪', title: '游戏常客', desc: '累计游玩 50 局' },
    // 食物收集
    { id: 'taste_common', icon: '🍓', title: '美食家', desc: '吃到过所有常见品质食物' },
    { id: 'taste_legend', icon: '🍀', title: '珍馐猎人', desc: '吃到过所有传奇品质食物' },
    { id: 'taste_jackpot',icon: '🦄', title: '大奖猎人', desc: '吃到过所有超级大奖食物' },
    // 技能
    { id: 'buy_skill',    icon: '🛒', title: '技能学徒', desc: '首次购买技能' },
    { id: 'use_skill',    icon: '✨', title: '技能上手', desc: '首次使用技能' },
    // 新效果
    { id: 'use_shield',   icon: '🔰', title: '护盾守护', desc: '挡住一次致命碰撞' },
    { id: 'use_shrink',   icon: '📏', title: '瘦身达人', desc: '吃到瘦身食物' },
    { id: 'get_life',     icon: '💖', title: '多一条命', desc: '获得额外生命' },
];

let unlockedAchievements = [];
let achievementQueue = [];
let showingAchievement = false;
let eatenThisGame = new Set();
let shieldUsed = false;
let shrinkUsed = false;
let lifeUsed = false;
let skillBought = false;
let skillUsed = false;

function loadAchievements() {
    try { unlockedAchievements = JSON.parse(localStorage.getItem('snake.achievements') || '[]'); } catch (e) { unlockedAchievements = []; }
}

function unlockAchievement(id) {
    if (unlockedAchievements.includes(id)) return;
    unlockedAchievements.push(id);
    try { localStorage.setItem('snake.achievements', JSON.stringify(unlockedAchievements)); } catch (e) {}
    const ach = ACHIEVEMENTS.find(a => a.id === id);
    if (ach) {
        achievementQueue.push(ach);
        if (!showingAchievement) showNextAchievement();
    }
    refreshStats();
    refreshSkinSelector();
}

function showNextAchievement() {
    if (achievementQueue.length === 0) { showingAchievement = false; return; }
    showingAchievement = true;
    const ach = achievementQueue.shift();
    els.achIcon.textContent = ach.icon;
    els.achTitle.textContent = ach.title;
    els.achDesc.textContent = ach.desc;
    els.achToast.hidden = false;
    requestAnimationFrame(() => els.achToast.classList.add('show'));
    playTone(880, 0.1, 'sine', 0.06);
    setTimeout(() => playTone(1100, 0.1, 'sine', 0.06), 120);
    setTimeout(() => {
        els.achToast.classList.remove('show');
        setTimeout(() => { els.achToast.hidden = true; showNextAchievement(); }, 500);
    }, 2500);
}

// ========== 成就面板 ==========
function renderAchievementPanel() {
    if (!els.achList) return;
    const count = unlockedAchievements.length;
    const total = ACHIEVEMENTS.length;
    els.achList.innerHTML = ACHIEVEMENTS.map(ach => {
        const unlocked = unlockedAchievements.includes(ach.id);
        return `<div class="ach-panel-item ${unlocked ? 'unlocked' : 'locked'}">
            <span class="ach-panel-icon">${unlocked ? ach.icon : '🔒'}</span>
            <div class="ach-panel-text">
                <span class="ach-panel-title">${unlocked ? ach.title : '???'}</span>
                <span class="ach-panel-desc">${unlocked ? ach.desc : '继续努力解锁吧'}</span>
            </div>
        </div>`;
    }).join('');
    const titleEl = $('#ach-panel-title');
    if (titleEl) titleEl.textContent = `成就收藏 (${count}/${total})`;
}

els.btnAch.addEventListener('click', () => {
    renderAchievementPanel();
    els.achPanel.hidden = false;
});
els.btnAchClose.addEventListener('click', () => { els.achPanel.hidden = true; });

// ========== 技能商店 ==========
function renderSkillShop() {
    if (!els.shopList) return;
    const totalScore = game.getTotalScore();
    els.shopScore.textContent = totalScore;
    const owned = game.getOwnedSkills();
    els.shopList.innerHTML = Object.entries(SKILLS).map(([id, skill]) => {
        const o = owned[id] || { count: 0, cooldownRemain: 0 };
        const cooldownSec = o.cooldownRemain > 0 ? Math.ceil(o.cooldownRemain) : 0;
        const canBuy = totalScore >= skill.cost;
        return `<div class="shop-item">
            <span class="shop-icon">${skill.icon}</span>
            <div class="shop-text">
                <span class="shop-name">${skill.name}</span>
                <span class="shop-desc">${skill.desc} · CD ${skill.cooldown}s</span>
            </div>
            <div class="shop-right">
                <span class="shop-count">x${o.count}</span>
                ${cooldownSec > 0 ? `<span class="shop-cd">${cooldownSec}s</span>` : ''}
                <button class="shop-buy-btn" data-skill="${id}" ${canBuy ? '' : 'disabled'}>
                    💰${skill.cost}
                </button>
            </div>
        </div>`;
    }).join('');
    els.shopList.querySelectorAll('.shop-buy-btn').forEach(btn => {
        btn.addEventListener('click', () => buySkill(btn.dataset.skill));
    });
}

function buySkill(id) {
    if (game.buySkill(id)) {
        if (!skillBought) { skillBought = true; unlockAchievement('buy_skill'); }
        renderSkillShop();
        refreshStats();
    }
}

els.btnShop.addEventListener('click', () => {
    renderSkillShop();
    els.shopPanel.hidden = false;
});
els.btnShopClose.addEventListener('click', () => { els.shopPanel.hidden = true; });

// 游戏中使用技能：数字键 1-7
document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    const skillKeys = ['1', '2', '3', '4', '5', '6', '7'];
    const idx = skillKeys.indexOf(e.key);
    if (idx >= 0) {
        const ids = Object.keys(SKILLS);
        if (idx < ids.length) {
            if (game.useSkill(ids[idx])) {
                if (!skillUsed) { skillUsed = true; unlockAchievement('use_skill'); }
            }
        }
    }
});

// ========== 皮肤系统 ==========
let selectedSkinKey = 'classic';

function getSkinKeysByUnlock() {
    const count = unlockedAchievements.length;
    return Object.entries(SNAKE_SKINS)
        .filter(([, s]) => count >= s.unlock)
        .map(([k]) => k);
}

function refreshSkinSelector() {
    if (!els.skinOptions) return;
    const unlocked = getSkinKeysByUnlock();
    els.skinOptions.innerHTML = Object.entries(SNAKE_SKINS).map(([key, skin]) => {
        const isUnlocked = unlocked.includes(key);
        const isActive = key === selectedSkinKey;
        const need = skin.unlock;
        return `<button class="skin-btn ${isActive ? 'active' : ''} ${isUnlocked ? '' : 'locked'}"
            data-skin="${key}" ${isUnlocked ? '' : 'disabled'}
            title="${skin.name}${isUnlocked ? '' : ' (需要 ' + need + ' 个成就解锁)'}">
            <span class="skin-icon">${skin.icon}</span>
            ${isUnlocked ? '' : `<span class="skin-lock">🔒${need}</span>`}
        </button>`;
    }).join('');
    els.skinOptions.querySelectorAll('.skin-btn:not(.locked)').forEach(btn => {
        btn.addEventListener('click', () => selectSkin(btn.dataset.skin));
    });
}

function selectSkin(key) {
    if (!getSkinKeysByUnlock().includes(key)) return;
    selectedSkinKey = key;
    storage.setSetting('skin', key);
    game.setSkin(key);
    sfxUnlock();
    refreshSkinSelector();
}

function initSkin() {
    const saved = storage.getSettings().skin || 'classic';
    if (getSkinKeysByUnlock().includes(saved)) selectedSkinKey = saved;
    else selectedSkinKey = 'classic';
    game.setSkin(selectedSkinKey);
    refreshSkinSelector();
}

// ========== 统计系统 ==========
function refreshStats() {
    els.statGames.textContent = storage.getSettings().totalGames || 0;
    els.statAchievements.textContent = unlockedAchievements.length;
    els.statMaxlen.textContent = storage.getSettings().maxLength || 0;
    els.statScore.textContent = game.getTotalScore();
    els.menuBest.textContent = storage.getBestScore();
}

function incrementGames() {
    const s = storage.getSettings();
    const total = (s.totalGames || 0) + 1;
    storage.setSetting('totalGames', total);
    if (total >= 15) unlockAchievement('games_15');
    if (total >= 50) unlockAchievement('games_50');
    refreshStats();
}

function updateMaxLength(len) {
    const s = storage.getSettings();
    if (len > (s.maxLength || 0)) storage.setSetting('maxLength', len);
    refreshStats();
}

// ========== 计时系统 ==========
let gameStartTime = 0;
let timerInterval = 0;

function startTimer() {
    gameStartTime = Date.now();
    clearInterval(timerInterval);
    timerInterval = setInterval(updateTimer, 500);
}

function stopTimer() { clearInterval(timerInterval); }

function updateTimer() {
    const elapsed = Math.floor((Date.now() - gameStartTime) / 1000);
    els.hudTime.textContent = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;
}

function getElapsed() { return Math.floor((Date.now() - gameStartTime) / 1000); }

// ========== 设备检测 ==========
const caps = detectCapabilities();
if (caps.preferJoystick) document.body.classList.add('show-joystick');

// ========== 游戏引擎 ==========
const game = createGame({
    canvas: els.canvas,
    callbacks: {
        onBestScore: () => storage.getBestScore(),
        stateChange: (s) => {
            if (s === 'menu') showMenu();
            if (s === 'playing') hideOverlays();
            if (s === 'paused') showPause();
            // 音乐切换
            if (s === 'playing' && musicEnabled) {
                stopMusic();
                startMusic();
            }
            if (s === 'menu' && musicEnabled) {
                stopMusic();
                startMusic();
            }
        },
        scoreChange: ({ score, length }) => {
            els.hudScore.textContent = score;
            els.hudLength.textContent = length;
            if (score >= 80) unlockAchievement('score_80');
            if (score >= 150) unlockAchievement('score_150');
            if (score >= 300) unlockAchievement('score_300');
            if (score >= 750) unlockAchievement('score_750');
            if (score >= 1500) unlockAchievement('score_1500');
            if (length >= 25) unlockAchievement('len_25');
            if (length >= 60) unlockAchievement('len_60');
            if (length >= 100) unlockAchievement('len_100');
            updateMaxLength(length);
        },
        bestChange: (best) => { els.hudBest.textContent = best; els.menuBest.textContent = best; },
        totalScoreChange: (ts) => { els.statScore.textContent = ts; },
        buffChange: (list) => renderBuffs(list),
        tick: ({ buffs }) => renderBuffs(buffs),
        livesChange: (lives) => { /* lives rendered in canvas */ },
        cheatChange: (active) => {
            els.cheatIndicator.hidden = !active;
        },
        eatEvent: (info) => {
            if (info.jackpot) sfxJackpot();
            else if (info.tier === 'legendary') sfxLegend();
            else if (info.tier === 'epic' || info.tier === 'rare') sfxRare();
            else sfxEat();
            if (info.jackpot) {
                unlockAchievement('eat_jackpot');
                if (info.foodKey) {
                    eatenThisGame.add(info.foodKey);
                    if (info.foodKey === 'phoenix') unlockAchievement('eat_phoenix');
                    if (info.foodKey === 'heart') unlockAchievement('eat_heart');
                }
            }
            if (info.comboCount >= 6) unlockAchievement('combo_6');
            if (info.comboCount >= 12) unlockAchievement('combo_12');
            if (info.comboCount >= 20) unlockAchievement('combo_20');
            if (info.foodKey) {
                eatenThisGame.add(info.foodKey);
                if (info.foodKey === 'cookie') { shrinkUsed = true; unlockAchievement('use_shrink'); }
                if (info.foodKey === 'heart') { lifeUsed = true; unlockAchievement('get_life'); }
            }
        },
        gameOver: ({ score, length, isNewBest, bestScore, cheatMode }) => {
            stopTimer();
            sfxDie();
            const elapsed = getElapsed();
            const newBest = storage.setBestScore(score);
            els.overScore.textContent = cheatMode ? 'N/A' : score;
            els.overLength.textContent = length;
            const em = Math.floor(elapsed / 60);
            const es = elapsed % 60;
            els.overTime.textContent = `${em}:${String(es).padStart(2, '0')}`;
            els.overBest.textContent = newBest;
            if (!cheatMode) {
                incrementGames();
                unlockAchievement('first_game');
                if (elapsed >= 240) unlockAchievement('time_240');
                if (elapsed >= 600) unlockAchievement('time_600');
                const commonKeys = ['strawberry', 'cherry', 'mango', 'rice'];
                const legendKeys = ['clover', 'diamond', 'rainbow', 'cake', 'magicMushroom'];
                const jackpotKeys = ['unicorn', 'phoenix', 'heart'];
                if (commonKeys.every(k => eatenThisGame.has(k))) unlockAchievement('taste_common');
                if (legendKeys.every(k => eatenThisGame.has(k))) unlockAchievement('taste_legend');
                if (jackpotKeys.every(k => eatenThisGame.has(k))) unlockAchievement('taste_jackpot');
                if (eatenThisGame.has('unicorn') && eatenThisGame.has('phoenix')) unlockAchievement('eat_both_jp');
            }
            eatenThisGame = new Set();
            if (cheatMode) {
                els.overEmoji.textContent = '⚡';
                els.overTitle.textContent = '作弊模式';
                els.overSub.textContent = '不计分，纯粹享受';
            } else if (isNewBest) {
                els.overEmoji.textContent = '🎉';
                els.overTitle.textContent = '新纪录！';
                els.overSub.textContent = '太厉害啦，破纪录了 ✨';
            } else if (score >= 1000) {
                els.overEmoji.textContent = '👑'; els.overTitle.textContent = '蛇王！'; els.overSub.textContent = '无人能敌 🎆';
            } else if (score >= 500) {
                els.overEmoji.textContent = '🦄'; els.overTitle.textContent = '传奇！'; els.overSub.textContent = '神级操作 🎆';
            } else if (score >= 200) {
                els.overEmoji.textContent = '🌟'; els.overTitle.textContent = '完成出色'; els.overSub.textContent = '继续保持手感～';
            } else if (score >= 50) {
                els.overEmoji.textContent = '🌸'; els.overTitle.textContent = '不错的开始'; els.overSub.textContent = '再来一局！';
            } else {
                els.overEmoji.textContent = '🌱'; els.overTitle.textContent = '游戏结束'; els.overSub.textContent = '慢慢来，享受每一口';
            }
            setTimeout(() => { els.overOverlay.hidden = false; }, 700);
        },
    },
});

const input = createInputController({
    onDirection: (dx, dy) => game.setDirection(dx, dy),
    onPause: () => {
        const s = game.getState();
        if (s === 'playing' || s === 'paused') game.togglePause();
    },
});

game.start();
requestAnimationFrame(() => game.resize());

// ========== 视图切换 ==========
function showMenu() {
    hideOverlays();
    stopTimer();
    stopMusic();
    els.menuScreen.hidden = false;
    els.gameScreen.hidden = true;
    input.setActive(false);
    refreshStats();
    refreshSkinSelector();
    if (musicEnabled) startMusic();
}

function showGame() {
    els.menuScreen.hidden = true;
    els.gameScreen.hidden = false;
    els.hudTime.textContent = '0:00';
    input.setActive(true);
    requestAnimationFrame(() => game.resize());
}

function showPause() { els.pauseOverlay.hidden = false; }

function hideOverlays() {
    els.pauseOverlay.hidden = true;
    els.overOverlay.hidden = true;
}

// ========== 按钮绑定 ==========
els.btnStart.addEventListener('click', () => {
    showGame();
    game.startNewGame();
    startTimer();
    if (musicEnabled) { stopMusic(); startMusic(); }
});

els.btnPause.addEventListener('click', () => game.togglePause());
els.btnResume.addEventListener('click', () => game.togglePause());

els.btnPauseHome.addEventListener('click', () => {
    game.togglePause();
    game.stop();
    game.start();
    showMenu();
});

els.btnRestart.addEventListener('click', () => {
    els.overOverlay.hidden = true;
    game.startNewGame();
    startTimer();
    if (musicEnabled) { stopMusic(); startMusic(); }
});

els.btnHome.addEventListener('click', () => {
    game.stop();
    game.start();
    showMenu();
});

// ========== 自适应 ==========
let resizeTimer = 0;
function handleResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => game.resize(), 100);
}
window.addEventListener('resize', handleResize);
window.addEventListener('orientationchange', () => setTimeout(handleResize, 200));

// ========== Buff 渲染 ==========
let lastBuffsKey = '';
function renderBuffs(list) {
    if (!list || list.length === 0) {
        if (lastBuffsKey !== '') { els.buffBar.innerHTML = ''; lastBuffsKey = ''; }
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
    const map = {
        speed: { label: '⚡ 加速', color: '#E8A33D' },
        slow: { label: '🫧 慢动作', color: '#8B7FD8' },
        invincible: { label: '🛡️ 无敌', color: '#FFD700' },
        magnet: { label: '🧲 磁力', color: '#4FC3F7' },
        superSpeed: { label: '⚡ 极速', color: '#FF5722' },
        invisible: { label: '👻 隐身', color: '#CE93D8' },
        shield: { label: '🔰 护盾', color: '#90CAF9' },
        slowTime: { label: '⏳ 慢时间', color: '#81C784' },
    };
    return map[type] || { label: type, color: '#5C5C77' };
}

// ========== 防止页面滚动/缩放 ==========
['gesturestart', 'gesturechange', 'gestureend'].forEach(ev => {
    document.addEventListener(ev, e => e.preventDefault());
});
document.addEventListener('dblclick', e => e.preventDefault());

// ========== 初始化 ==========
loadAchievements();
initTheme();
initSkin();
refreshStats();
showMenu();