// script.js — 入口：UI 路由 + 设备检测 + 主题 + 成就 + 皮肤 + 音效 + 音乐 + 作弊 + 道具

import { createGame, ITEMS, PERMA_ABILITIES } from './game/engine.js';
import { createInputController, detectCapabilities } from './game/input.js';
import { storage } from './game/storage.js';
import { SNAKE_SKINS } from './game/renderer.js';
import { FOOD_TYPES } from './game/food.js';

const $ = (sel) => document.querySelector(sel);

const els = {
    menuScreen: $('#menu-screen'),
    gameScreen: $('#game-screen'),
    pauseOverlay: $('#pause-overlay'),
    overOverlay: $('#over-overlay'),
    achPanel: $('#achievement-panel'),
    shopPanel: $('#skill-shop-panel'),
    statGames: $('#stat-games'),
    statAchievements: $('#stat-achievements'),
    statMaxlen: $('#stat-maxlen'),
    statScore: $('#stat-score'),
    menuBest: $('#menu-best'),
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
    itemSlots: $('#item-slots'),
    itemBtn0: $('#item-btn-0'),
    itemBtn1: $('#item-btn-1'),
    btnEncy: $('#btn-encyclopedia'),
    encyPanel: $('#encyclopedia-panel'),
    btnEncyClose: $('#btn-ency-close'),
    encyList: $('#ency-list'),
    btnPerma: $('#btn-perma'),
    permaPanel: $('#perma-panel'),
    btnPermaClose: $('#btn-perma-close'),
    permaList: $('#perma-list'),
};

// ========== 音效 ==========
let audioCtx = null;
let soundEnabled = true;
let musicEnabled = true;
let musicInterval = 0;

function getAudioCtx() {
    if (!audioCtx) { try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
    }
    return audioCtx;
}

let hasUserGesture = false;
function markGesture() {
    if (hasUserGesture) return;
    hasUserGesture = true;
    getAudioCtx();
    if (musicEnabled) startMusic();
}
document.addEventListener('click', markGesture, { once: true, capture: true });
document.addEventListener('keydown', markGesture, { once: true, capture: true });
document.addEventListener('touchstart', markGesture, { once: true, capture: true });

function playTone(freq, duration, type = 'sine', vol = 0.08) {
    if (!soundEnabled) return;
    const ctx = getAudioCtx(); if (!ctx) return;
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + duration);
}

function sfxEat()     { playTone(660,0.1,'sine',0.06); playTone(880,0.08,'sine',0.04); }
function sfxRare()    { playTone(880,0.12,'triangle',0.07); playTone(1100,0.1,'triangle',0.05); }
function sfxLegend()  { playTone(1100,0.15,'triangle',0.08); playTone(1320,0.12,'sine',0.06); }
function sfxJackpot() { playTone(1320,0.2,'sine',0.1); playTone(1760,0.15,'sine',0.08); playTone(2200,0.1,'triangle',0.06); }
function sfxDie()     { playTone(200,0.3,'sawtooth',0.06); playTone(150,0.4,'sawtooth',0.05); }
function sfxUnlock()  { playTone(660,0.08,'sine',0.05); playTone(880,0.08,'sine',0.05); playTone(1100,0.1,'sine',0.06); }

// ========== 音乐 ==========
const MENU_MELODY = [262,330,392,330,294,349,440,349,330,294,262,330];
const GAME_MELODY = [392,440,494,523,494,440,392,349,330,349,392,440,494,523,587,523];

function startMusic() {
    if (!musicEnabled || !hasUserGesture) return;
    stopMusic();
    const melody = game.getState() === 'playing' ? GAME_MELODY : MENU_MELODY;
    let idx = 0;
    musicInterval = setInterval(() => {
        if (!musicEnabled) { stopMusic(); return; }
        const ctx = getAudioCtx(); if (!ctx) return;
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.type = 'sine'; osc.frequency.setValueAtTime(melody[idx % melody.length], ctx.currentTime);
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.4);
        idx++;
    }, 500);
}

function stopMusic() { clearInterval(musicInterval); musicInterval = 0; }

function toggleMusic() {
    musicEnabled = !musicEnabled;
    els.musicIcon.textContent = musicEnabled ? '🎵' : '🔇';
    storage.setSetting('music', musicEnabled);
    if (musicEnabled) startMusic(); else stopMusic();
}

// ========== 主题 ==========
function applyTheme(name) {
    document.documentElement.className = `theme-${name}`;
    storage.setSetting('theme', name);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
        const colors = { heal:'#FFF4F0', dark:'#1A1A2E', forest:'#E8F5E9', ocean:'#E0F7FA', candy:'#FCE4EC' };
        meta.content = colors[name] || '#FFF4F0';
    }
    els.themeButtons.forEach(b => b.classList.toggle('active', b.dataset.theme === name));
}
function initTheme() { applyTheme(storage.getSettings().theme || 'heal'); }
els.themeButtons.forEach(btn => btn.addEventListener('click', () => applyTheme(btn.dataset.theme)));

// 音效/音乐
$('#btn-sound').addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    els.soundIcon.textContent = soundEnabled ? '🔊' : '🔇';
    storage.setSetting('sound', soundEnabled);
    if (soundEnabled) playTone(440,0.05,'sine',0.04);
});
$('#btn-music').addEventListener('click', toggleMusic);
if (storage.getSettings().sound === false) { soundEnabled = false; els.soundIcon.textContent = '🔇'; }
if (storage.getSettings().music === false) { musicEnabled = false; els.musicIcon.textContent = '🔇'; }

// ========== 作弊模式 ==========
let cheatKeys = [], cheatTimer = 0;
const CHEAT_SEQ = ['w','y','m'];
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
                playTone(880,0.1,'sine',0.06);
                setTimeout(() => playTone(1100,0.1,'sine',0.06), 120);
                setTimeout(() => playTone(1320,0.15,'sine',0.08), 250);
            } else {
                els.cheatIndicator.hidden = true;
                playTone(440,0.1,'sine',0.04);
            }
        }
    }
});

// ========== 成就 ==========
const ACHIEVEMENTS = [
    { id:'first_game',icon:'🎮',title:'初次尝试',desc:'完成第一局游戏' },
    { id:'score_80',icon:'🌱',title:'小有进步',desc:'单局得分达到 80' },
    { id:'score_150',icon:'🌟',title:'百尺竿头',desc:'单局得分达到 150' },
    { id:'score_300',icon:'🦄',title:'传说降临',desc:'单局得分达到 300' },
    { id:'score_750',icon:'👑',title:'蛇王加冕',desc:'单局得分达到 750' },
    { id:'score_1500',icon:'🏆',title:'不朽传奇',desc:'单局得分达到 1500' },
    { id:'combo_6',icon:'🔥',title:'连击大师',desc:'达成 6 连击' },
    { id:'combo_12',icon:'💥',title:'无双连击',desc:'达成 12 连击' },
    { id:'combo_20',icon:'⚡',title:'终极连击',desc:'达成 20 连击' },
    { id:'eat_jackpot',icon:'💎',title:'遇见独角兽',desc:'吃到超级大奖' },
    { id:'eat_phoenix',icon:'🔥',title:'凤凰涅槃',desc:'吃到凤凰' },
    { id:'eat_heart',icon:'💖',title:'生命之心',desc:'吃到生命之心' },
    { id:'eat_both_jp',icon:'🌈',title:'双重大奖',desc:'同一局吃到独角兽和凤凰' },
    { id:'len_25',icon:'🐍',title:'小蛇初长',desc:'蛇身长度达到 25' },
    { id:'len_60',icon:'🐲',title:'庞然大物',desc:'蛇身长度达到 60' },
    { id:'len_100',icon:'🦖',title:'远古巨兽',desc:'蛇身长度达到 100' },
    { id:'time_240',icon:'⏱️',title:'持久力',desc:'存活超过 4 分钟' },
    { id:'time_600',icon:'⌛',title:'时间旅者',desc:'存活超过 10 分钟' },
    { id:'games_15',icon:'🎯',title:'百折不挠',desc:'累计游玩 15 局' },
    { id:'games_50',icon:'🎪',title:'游戏常客',desc:'累计游玩 50 局' },
    { id:'taste_common',icon:'🍓',title:'美食家',desc:'吃到过所有常见品质食物' },
    { id:'taste_legend',icon:'🍀',title:'珍馐猎人',desc:'吃到过所有传奇品质食物' },
    { id:'taste_jackpot',icon:'🦄',title:'大奖猎人',desc:'吃到过所有超级大奖食物' },
    { id:'buy_skill',icon:'🛒',title:'购物达人',desc:'首次购买道具' },
    { id:'use_skill',icon:'✨',title:'道具上手',desc:'首次使用道具' },
    { id:'use_shield',icon:'🔰',title:'护盾守护',desc:'挡住一次致命碰撞' },
    { id:'use_shrink',icon:'📏',title:'瘦身达人',desc:'吃到瘦身食物' },
    { id:'get_life',icon:'💖',title:'多一条命',desc:'获得额外生命' },
];

let unlockedAchievements = [];
let achievementQueue = [];
let showingAchievement = false;
let eatenThisGame = new Set();
let skillBought = false;
let skillUsed = false;
let eatenFoodsAllTime = new Set(); // food encyclopedia

function loadEatenFoods() {
    try {
        const arr = JSON.parse(localStorage.getItem('snake.eatenFoods') || '[]');
        eatenFoodsAllTime = new Set(arr);
    } catch (e) { eatenFoodsAllTime = new Set(); }
}

function saveEatenFoods() {
    try { localStorage.setItem('snake.eatenFoods', JSON.stringify([...eatenFoodsAllTime])); } catch (e) {}
}

function unlockFoodInEncy(key) {
    if (eatenFoodsAllTime.has(key)) return;
    eatenFoodsAllTime.add(key);
    saveEatenFoods();
}

function renderEncyclopediaPanel() {
    if (!els.encyList) return;
    const foods = Object.values(FOOD_TYPES);
    const total = foods.length;
    const unlocked = eatenFoodsAllTime.size;
    const t = $('#ency-panel-title');
    if (t) t.textContent = `食物图鉴 (${unlocked}/${total})`;

    const tierLabels = { common: '常见', rare: '稀有', epic: '史诗', legendary: '传奇', jackpot: '超级大奖' };
    els.encyList.innerHTML = foods.map(f => {
        const known = eatenFoodsAllTime.has(f.key);
        const buffDesc = f.buff ? getBuffDesc(f.buff) : '无特殊效果';
        return `<div class="ency-item ${known ? 'unlocked' : 'locked'}">
            <span class="ency-emoji">${known ? f.emoji : '❓'}</span>
            <div class="ency-text">
                <span class="ency-name">${known ? f.name : '???'}</span>
                <span class="ency-desc">${known ? (f.desc || '') : '尚未吃到'}</span>
                <span class="ency-stats">${known ? `+${f.score}分 · +${f.growth}长度 · ${tierLabels[f.tier] || f.tier}` : ''}</span>
                ${known ? `<span class="ency-buff">${buffDesc}</span>` : ''}
            </div>
            <span class="ency-tier-badge tier-${f.tier}">${tierLabels[f.tier] || f.tier}</span>
        </div>`;
    }).join('');
}

function getBuffDesc(buff) {
    if (!buff) return '';
    const map = {
        speed: `加速${buff.factor}x ${buff.duration/1000}秒`,
        slow: `减速${buff.factor}x ${buff.duration/1000}秒`,
        invincible: `无敌${buff.duration/1000}秒`,
        magnet: `磁力${buff.duration/1000}秒`,
        superSpeed: `${buff.factor}x极速${buff.duration/1000}秒`,
        invisible: `隐身${buff.duration/1000}秒`,
        shield: `护盾${buff.duration/1000}秒`,
        slowTime: `慢动作${buff.factor}x ${buff.duration/1000}秒`,
        shrink: `瘦身${buff.amount}节`,
        life: `加${buff.amount}条命`,
        fat: `变粗${buff.duration/1000}秒`,
        doubleScore: `双倍积分${buff.duration/1000}秒`,
        extendBuffs: `正面效果延长60秒`,
    };
    return map[buff.type] || '';
}

els.btnEncy?.addEventListener('click', () => { renderEncyclopediaPanel(); els.encyPanel.hidden = false; });
els.btnEncyClose?.addEventListener('click', () => { els.encyPanel.hidden = true; });

// ========== 永久能力面板 ==========
function renderPermaPanel() {
    if (!els.permaList) return;
    const purchases = game.getPermaPurchases();
    const active = game.getPermaActive();
    const totalScore = game.getTotalScore();
    els.permaList.innerHTML = Object.values(PERMA_ABILITIES).map(ab => {
        const owned = purchases[ab.key];
        const isActive = active === ab.key;
        const canBuy = !owned && totalScore >= ab.cost;
        return `<div class="perma-item ${owned ? 'owned' : ''} ${isActive ? 'active' : ''}">
            <span class="perma-icon">${ab.icon}</span>
            <div class="perma-text">
                <span class="perma-name">${ab.name}</span>
                <span class="perma-desc">${ab.desc}</span>
            </div>
            ${owned
                ? `<button class="perma-select-btn ${isActive ? 'selected' : ''}" data-perma="${ab.key}">${isActive ? '已启用' : '启用'}</button>`
                : `<button class="perma-buy-btn" data-perma="${ab.key}" ${canBuy ? '' : 'disabled'}>💰${ab.cost}</button>`
            }
        </div>`;
    }).join('');
    // 购买按钮
    els.permaList.querySelectorAll('.perma-buy-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const type = btn.dataset.perma;
            if (game.buyPerma(type)) {
                sfxUnlock();
                renderPermaPanel();
                refreshStats();
            }
        });
    });
    // 选择按钮
    els.permaList.querySelectorAll('.perma-select-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const type = btn.dataset.perma;
            const isActive = active === type;
            game.selectPerma(isActive ? null : type); // 再次点击取消选择
            renderPermaPanel();
        });
    });
}
els.btnPerma?.addEventListener('click', () => { renderPermaPanel(); els.permaPanel.hidden = false; });
els.btnPermaClose?.addEventListener('click', () => { els.permaPanel.hidden = true; });

function loadAchievements() {
    try { unlockedAchievements = JSON.parse(localStorage.getItem('snake.achievements') || '[]'); } catch (e) { unlockedAchievements = []; }
}

function unlockAchievement(id) {
    if (unlockedAchievements.includes(id)) return;
    unlockedAchievements.push(id);
    try { localStorage.setItem('snake.achievements', JSON.stringify(unlockedAchievements)); } catch (e) {}
    const ach = ACHIEVEMENTS.find(a => a.id === id);
    if (ach) { achievementQueue.push(ach); if (!showingAchievement) showNextAchievement(); }
    refreshStats(); refreshSkinSelector();
}

function showNextAchievement() {
    if (achievementQueue.length === 0) { showingAchievement = false; return; }
    showingAchievement = true;
    const ach = achievementQueue.shift();
    els.achIcon.textContent = ach.icon; els.achTitle.textContent = ach.title; els.achDesc.textContent = ach.desc;
    els.achToast.hidden = false;
    requestAnimationFrame(() => els.achToast.classList.add('show'));
    playTone(880,0.1,'sine',0.06);
    setTimeout(() => playTone(1100,0.1,'sine',0.06), 120);
    setTimeout(() => { els.achToast.classList.remove('show'); setTimeout(() => { els.achToast.hidden = true; showNextAchievement(); }, 500); }, 2500);
}

function renderAchievementPanel() {
    if (!els.achList) return;
    const count = unlockedAchievements.length;
    els.achList.innerHTML = ACHIEVEMENTS.map(ach => {
        const unlocked = unlockedAchievements.includes(ach.id);
        return `<div class="ach-panel-item ${unlocked?'unlocked':'locked'}">
            <span class="ach-panel-icon">${unlocked?ach.icon:'🔒'}</span>
            <div class="ach-panel-text"><span class="ach-panel-title">${unlocked?ach.title:'???'}</span><span class="ach-panel-desc">${unlocked?ach.desc:'继续努力解锁吧'}</span></div>
        </div>`;
    }).join('');
    const t = $('#ach-panel-title'); if (t) t.textContent = `成就收藏 (${count}/${ACHIEVEMENTS.length})`;
}
els.btnAch.addEventListener('click', () => { renderAchievementPanel(); els.achPanel.hidden = false; });
els.btnAchClose.addEventListener('click', () => { els.achPanel.hidden = true; });

// ========== 道具商店 ==========
function renderItemShop() {
    if (!els.shopList) return;
    const totalScore = game.getTotalScore();
    els.shopScore.textContent = totalScore;
    const inv = game.getInventory();
    els.shopList.innerHTML = Object.entries(ITEMS).map(([id, item]) => {
        const o = inv[id] || { count:0, cooldownRemain:0 };
        const canBuy = totalScore >= item.cost;
        return `<div class="shop-item">
            <span class="shop-icon">${item.icon}</span>
            <div class="shop-text"><span class="shop-name">${item.name}</span><span class="shop-desc">${item.desc} · CD ${item.cooldown}s</span></div>
            <div class="shop-right">
                <span class="shop-count">x${o.count}</span>
                <button class="shop-buy-btn" data-item="${id}" ${canBuy?'':'disabled'}>💰${item.cost}</button>
            </div>
        </div>`;
    }).join('');
    els.shopList.querySelectorAll('.shop-buy-btn').forEach(btn => {
        btn.addEventListener('click', () => buyItem(btn.dataset.item));
    });
}

function buyItem(id) {
    if (game.buyItem(id)) {
        if (!skillBought) { skillBought = true; unlockAchievement('buy_skill'); }
        renderItemShop();
        refreshItemSlots();
        refreshStats();
    }
}

els.btnShop.addEventListener('click', () => { renderItemShop(); els.shopPanel.hidden = false; });
els.btnShopClose.addEventListener('click', () => { els.shopPanel.hidden = true; });

// ========== 道具选择（菜单中） ==========
function refreshItemSlots() {
    if (!els.itemSlots) return;
    const selected = game.getSelectedItems();
    const inv = game.getInventory();
    els.itemSlots.innerHTML = [0, 1].map(slot => {
        const si = selected[slot];
        const owned = si ? (inv[si.id] || { count: 0 }) : { count: 0 };
        return `<button class="item-slot-btn ${si ? 'filled' : 'empty'}" data-slot="${slot}" title="${si ? si.name + ' x' + owned.count : '点击选择道具'}">
            <span class="item-slot-icon">${si ? si.icon : '➕'}</span>
            ${si ? `<span class="item-slot-label">${si.name}</span><span class="item-slot-count">x${owned.count}</span>` : '<span class="item-slot-label">空</span>'}
        </button>`;
    }).join('');
    // 点击打开选择
    els.itemSlots.querySelectorAll('.item-slot-btn').forEach(btn => {
        btn.addEventListener('click', () => openItemPicker(parseInt(btn.dataset.slot)));
    });
}

function openItemPicker(slot) {
    const inv = game.getInventory();
    const selected = game.getSelectedItems();
    const currentId = selected[slot] ? selected[slot].id : null;
    const available = Object.entries(ITEMS).filter(([id, item]) => {
        const o = inv[id];
        return o && o.count > 0 && id !== (selected[1 - slot] ? selected[1 - slot].id : null);
    });
    // 始终允许打开（至少可以卸下当前道具）
    let html = `<div class="item-picker-overlay"><div class="item-picker-card"><h3>选择道具</h3><div class="item-picker-list">`;
    html += `<button class="picker-item ${!currentId ? 'active' : ''}" data-id="">🈳 空</button>`;
    for (const [id, item] of available) {
        html += `<button class="picker-item ${currentId === id ? 'active' : ''}" data-id="${id}">${item.icon} ${item.name} x${inv[id].count}</button>`;
    }
    html += `</div><button class="picker-close">关闭</button></div></div>`;
    const overlay = document.createElement('div');
    overlay.innerHTML = html;
    document.body.appendChild(overlay.firstElementChild);
    const el = document.querySelector('.item-picker-overlay');
    el.querySelectorAll('.picker-item').forEach(b => {
        b.addEventListener('click', () => {
            const id = b.dataset.id || null;
            const sel = game.getSelectedItems();
            const other = slot === 0 ? (sel[1] ? sel[1].id : null) : (sel[0] ? sel[0].id : null);
            game.selectItems(slot === 0 ? id : (sel[0] ? sel[0].id : null), slot === 1 ? id : (sel[1] ? sel[1].id : null));
            refreshItemSlots();
            el.remove();
        });
    });
    el.querySelector('.picker-close').addEventListener('click', () => el.remove());
    el.addEventListener('click', (e) => { if (e.target === el) el.remove(); });
}

// 游戏中使用道具：Q/E 键
document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'q' || e.key === 'Q') {
        if (game.useItem(0)) { if (!skillUsed) { skillUsed = true; unlockAchievement('use_skill'); } refreshItemBtns(); }
    }
    if (e.key === 'e' || e.key === 'E') {
        if (game.useItem(1)) { if (!skillUsed) { skillUsed = true; unlockAchievement('use_skill'); } refreshItemBtns(); }
    }
});

// 游戏内道具按钮
function refreshItemBtns() {
    const selected = game.getSelectedItems();
    [0, 1].forEach(slot => {
        const btn = slot === 0 ? els.itemBtn0 : els.itemBtn1;
        if (!btn) return;
        const si = selected[slot];
        if (si && si.count > 0) {
            btn.hidden = false;
            btn.querySelector('.game-item-icon').textContent = si.icon;
            btn.querySelector('.game-item-count').textContent = si.count;
            btn.querySelector('.game-item-key').textContent = slot === 0 ? 'Q' : 'E';
            if (si.cdRemain > 0) {
                btn.classList.add('cd');
                btn.querySelector('.game-item-cd').textContent = Math.ceil(si.cdRemain) + 's';
            } else {
                btn.classList.remove('cd');
                btn.querySelector('.game-item-cd').textContent = '';
            }
        } else {
            btn.hidden = true;
        }
    });
}

els.itemBtn0?.addEventListener('click', () => { if (game.useItem(0)) { if (!skillUsed) { skillUsed = true; unlockAchievement('use_skill'); } refreshItemBtns(); } });
els.itemBtn1?.addEventListener('click', () => { if (game.useItem(1)) { if (!skillUsed) { skillUsed = true; unlockAchievement('use_skill'); } refreshItemBtns(); } });

// ========== 皮肤 ==========
let selectedSkinKey = 'classic';
function getSkinKeysByUnlock() {
    return Object.entries(SNAKE_SKINS).filter(([,s]) => unlockedAchievements.length >= s.unlock).map(([k]) => k);
}
function refreshSkinSelector() {
    if (!els.skinOptions) return;
    const unlocked = getSkinKeysByUnlock();
    els.skinOptions.innerHTML = Object.entries(SNAKE_SKINS).map(([key, skin]) => {
        const isUnlocked = unlocked.includes(key);
        return `<button class="skin-btn ${key===selectedSkinKey?'active':''} ${isUnlocked?'':'locked'}"
            data-skin="${key}" ${isUnlocked?'':'disabled'} title="${skin.name}${isUnlocked?'':' (需要 '+skin.unlock+' 个成就解锁)'}">
            <span class="skin-icon">${skin.icon}</span>
            ${isUnlocked?'':`<span class="skin-lock">🔒${skin.unlock}</span>`}</button>`;
    }).join('');
    els.skinOptions.querySelectorAll('.skin-btn:not(.locked)').forEach(btn => btn.addEventListener('click', () => selectSkin(btn.dataset.skin)));
}
function selectSkin(key) {
    if (!getSkinKeysByUnlock().includes(key)) return;
    selectedSkinKey = key; storage.setSetting('skin', key); game.setSkin(key); sfxUnlock(); refreshSkinSelector();
}
function initSkin() {
    const saved = storage.getSettings().skin || 'classic';
    selectedSkinKey = getSkinKeysByUnlock().includes(saved) ? saved : 'classic';
    game.setSkin(selectedSkinKey); refreshSkinSelector();
}

// ========== 统计 ==========
function refreshStats() {
    els.statGames.textContent = storage.getSettings().totalGames || 0;
    els.statAchievements.textContent = unlockedAchievements.length;
    els.statMaxlen.textContent = storage.getSettings().maxLength || 0;
    els.statScore.textContent = game.getTotalScore();
    const bs = storage.getBestScore() || parseInt(localStorage.getItem('snake._best') || '0') || 0;
    if (els.menuBest) els.menuBest.textContent = bs;
}
function incrementGames() {
    const s = storage.getSettings(); const total = (s.totalGames || 0) + 1;
    storage.setSetting('totalGames', total);
    if (total >= 15) unlockAchievement('games_15');
    if (total >= 50) unlockAchievement('games_50');
    refreshStats();
}
function updateMaxLength(len) {
    const s = storage.getSettings(); if (len > (s.maxLength || 0)) storage.setSetting('maxLength', len);
    refreshStats();
}

// ========== 计时 ==========
let gameElapsed = 0;
function startTimer() { gameElapsed = 0; }
function stopTimer() { updateTimerUI(0); }
function stopTimerReset() { gameElapsed = 0; updateTimerUI(0); }
function updateTimerUI(elapsed) {
    if (elapsed === undefined) elapsed = gameElapsed;
    gameElapsed = elapsed;
    const e = Math.floor(elapsed);
    els.hudTime.textContent = `${Math.floor(e/60)}:${String(e%60).padStart(2,'0')}`;
}
function getElapsed() { return Math.floor(gameElapsed); }

// ========== 设备 ==========
const caps = detectCapabilities();
if (caps.preferJoystick) document.body.classList.add('show-joystick');

// ========== 游戏引擎 ==========
const game = createGame({
    canvas: els.canvas,
    callbacks: {
        onBestScore: () => storage.getBestScore(),
        stateChange: (s) => {
            if (s === 'menu') showMenu();
            if (s === 'playing') { hideOverlays(); refreshItemBtns(); }
            if (s === 'paused') showPause();
            if ((s === 'playing' || s === 'menu') && musicEnabled) { stopMusic(); startMusic(); }
        },
        scoreChange: ({ score, length }) => {
            els.hudScore.textContent = score; els.hudLength.textContent = length;
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
        bestChange: (best) => { els.hudBest.textContent = best; },
        totalScoreChange: (ts) => { els.statScore.textContent = ts; },
        itemsChange: () => { refreshItemBtns(); refreshItemSlots(); },
        buffChange: (list) => renderBuffs(list),
        tick: ({ buffs, elapsed }) => { renderBuffs(buffs); if (elapsed !== undefined) updateTimerUI(elapsed); },
        livesChange: () => {},
        cheatChange: (active) => { els.cheatIndicator.hidden = !active; },
        eatEvent: (info) => {
            if (info.jackpot) sfxJackpot();
            else if (info.tier === 'legendary') sfxLegend();
            else if (info.tier === 'epic' || info.tier === 'rare') sfxRare();
            else sfxEat();
            if (info.jackpot) {
                unlockAchievement('eat_jackpot');
                if (info.foodKey) {
                    eatenThisGame.add(info.foodKey);
                    unlockFoodInEncy(info.foodKey);
                    if (info.foodKey === 'phoenix') unlockAchievement('eat_phoenix');
                    if (info.foodKey === 'heart') unlockAchievement('eat_heart');
                }
            }
            if (info.comboCount >= 6) unlockAchievement('combo_6');
            if (info.comboCount >= 12) unlockAchievement('combo_12');
            if (info.comboCount >= 20) unlockAchievement('combo_20');
            if (info.foodKey) {
                eatenThisGame.add(info.foodKey);
                unlockFoodInEncy(info.foodKey);
                if (info.foodKey === 'cookie') unlockAchievement('use_shrink');
                if (info.foodKey === 'heart') unlockAchievement('get_life');
            }
        },
        gameOver: ({ score, length, isNewBest, bestScore, cheatMode }) => {
            const elapsed = getElapsed();
            stopTimer(); sfxDie();
            const storedBest = storage.getBestScore();
            const newBest = storage.setBestScore(score);
            if (!cheatMode && score > 0) {
                try { localStorage.setItem('snake._best', String(Math.max(score, parseInt(localStorage.getItem('snake._best') || '0') || 0))); } catch (e) {}
            }
            els.overScore.textContent = cheatMode ? 'N/A' : score;
            els.overLength.textContent = length;
            els.overTime.textContent = `${Math.floor(elapsed/60)}:${String(elapsed%60).padStart(2,'0')}`;
            els.overBest.textContent = newBest;
            if (!cheatMode) {
                incrementGames();
                unlockAchievement('first_game');
                if (elapsed >= 240) unlockAchievement('time_240');
                if (elapsed >= 600) unlockAchievement('time_600');
                const commonKeys = ['strawberry','cherry','mango','rice','apple','banana','orange'];
                const legendKeys = ['clover','diamond','rainbow','cake','magicMushroom','chocolate'];
                const jackpotKeys = ['unicorn','phoenix','heart'];
                if (commonKeys.every(k => eatenThisGame.has(k))) unlockAchievement('taste_common');
                if (legendKeys.every(k => eatenThisGame.has(k))) unlockAchievement('taste_legend');
                if (jackpotKeys.every(k => eatenThisGame.has(k))) unlockAchievement('taste_jackpot');
                if (eatenThisGame.has('unicorn') && eatenThisGame.has('phoenix')) unlockAchievement('eat_both_jp');
            }
            eatenThisGame = new Set();
            if (cheatMode) { els.overEmoji.textContent='⚡'; els.overTitle.textContent='作弊模式'; els.overSub.textContent='不计分，纯粹享受'; }
            else if (isNewBest) { els.overEmoji.textContent='🎉'; els.overTitle.textContent='新纪录！'; els.overSub.textContent='太厉害啦 ✨'; }
            else if (score >= 1000) { els.overEmoji.textContent='👑'; els.overTitle.textContent='蛇王！'; els.overSub.textContent='无人能敌 🎆'; }
            else if (score >= 500) { els.overEmoji.textContent='🦄'; els.overTitle.textContent='传奇！'; els.overSub.textContent='神级操作 🎆'; }
            else if (score >= 200) { els.overEmoji.textContent='🌟'; els.overTitle.textContent='完成出色'; els.overSub.textContent='继续保持手感～'; }
            else if (score >= 50) { els.overEmoji.textContent='🌸'; els.overTitle.textContent='不错的开始'; els.overSub.textContent='再来一局！'; }
            else { els.overEmoji.textContent='🌱'; els.overTitle.textContent='游戏结束'; els.overSub.textContent='慢慢来，享受每一口'; }
            setTimeout(() => { els.overOverlay.hidden = false; }, 700);
        },
    },
});

const input = createInputController({
    onDirection: (dx, dy) => game.setDirection(dx, dy),
    onPause: () => { const s = game.getState(); if (s === 'playing' || s === 'paused') game.togglePause(); },
});

game.start();
game.loadSelectedItems();
requestAnimationFrame(() => game.resize());

// ========== 视图切换 ==========
function showMenu() {
    hideOverlays(); stopTimer(); stopMusic();
    els.menuScreen.hidden = false; els.gameScreen.hidden = true;
    input.setActive(false);
    refreshStats(); refreshSkinSelector(); refreshItemSlots();
    if (musicEnabled) startMusic();
}
function showGame() {
    els.menuScreen.hidden = true; els.gameScreen.hidden = false;
    els.hudTime.textContent = '0:00'; input.setActive(true);
    requestAnimationFrame(() => game.resize());
}
function showPause() { els.pauseOverlay.hidden = false; }
function hideOverlays() { els.pauseOverlay.hidden = true; els.overOverlay.hidden = true; }

els.btnStart.addEventListener('click', () => { showGame(); game.startNewGame(); startTimer(); refreshItemBtns(); if (musicEnabled) { stopMusic(); startMusic(); } });
els.btnPause.addEventListener('click', () => game.togglePause());
els.btnResume.addEventListener('click', () => game.togglePause());
els.btnPauseHome.addEventListener('click', () => { game.togglePause(); game.stop(); game.start(); showMenu(); });
els.btnRestart.addEventListener('click', () => { els.overOverlay.hidden = true; game.startNewGame(); startTimer(); refreshItemBtns(); if (musicEnabled) { stopMusic(); startMusic(); } });
els.btnHome.addEventListener('click', () => { game.stop(); game.start(); showMenu(); });

// ========== 自适应 ==========
let resizeTimer = 0;
window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => game.resize(), 100); });
window.addEventListener('orientationchange', () => setTimeout(() => game.resize(), 200));

// ========== Buff 渲染 ==========
let lastBuffsKey = '';
function renderBuffs(list) {
    if (!list || list.length === 0) { if (lastBuffsKey !== '') { els.buffBar.innerHTML = ''; lastBuffsKey = ''; } return; }
    const key = list.map(b => `${b.type}:${Math.ceil(b.remain/1000)}`).join('|');
    if (key === lastBuffsKey) return;
    lastBuffsKey = key;
    els.buffBar.innerHTML = list.map(b => {
        const m = buffMeta(b.type);
        return `<span class="buff-chip" style="color:${m.color}"><span class="buff-chip-dot" style="background:${m.color}"></span>${m.label} ${Math.ceil(b.remain/1000)}s</span>`;
    }).join('');
}
function buffMeta(type) {
    const map = {
        speed:'⚡ 加速',slow:'🫧 慢动作',invincible:'🛡️ 无敌',magnet:'🧲 磁力',
        superSpeed:'⚡ 极速',invisible:'👻 隐身',shield:'🔰 护盾',slowTime:'⏳ 慢时间',
        fat:'🐍 变粗',doubleScore:'💎 双倍积分',extendBuffs:'⏳ 时光延长',
    };
    const colors = { speed:'#E8A33D',slow:'#8B7FD8',invincible:'#FFD700',magnet:'#4FC3F7',superSpeed:'#FF5722',invisible:'#CE93D8',shield:'#90CAF9',slowTime:'#81C784',fat:'#FF7043',doubleScore:'#FFD700',extendBuffs:'#FFD700' };
    return { label: map[type] || type, color: colors[type] || '#5C5C77' };
}

// ========== 防止滚动 ==========
['gesturestart','gesturechange','gestureend'].forEach(ev => document.addEventListener(ev, e => e.preventDefault()));
document.addEventListener('dblclick', e => e.preventDefault());

// ========== 初始化 ==========
loadAchievements();
loadEatenFoods();
initTheme();
initSkin();
refreshStats();
showMenu();
refreshItemSlots();