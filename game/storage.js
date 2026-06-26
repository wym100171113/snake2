// storage.js — 本地存储封装（最高分 / 设置）
// 失败时降级到内存对象，保证不阻塞游戏

const KEY = 'snake.game.v1';

const memoryFallback = {
    bestScore: 0,
    settings: {},
};

function read() {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return { bestScore: 0, settings: {} };
        const obj = JSON.parse(raw);
        return {
            bestScore: Number(obj.bestScore) || 0,
            settings: typeof obj.settings === 'object' && obj.settings !== null ? { ...obj.settings } : {},
        };
    } catch (e) {
        return { bestScore: 0, settings: {} };
    }
}

function write(data) {
    try {
        localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) {
        // 忽略写入失败（隐私模式 / 配额满）
    }
}

export const storage = {
    getBestScore() {
        return read().bestScore;
    },
    setBestScore(score) {
        const data = read();
        if (score > data.bestScore) {
            data.bestScore = score;
            write(data);
        }
        return data.bestScore;
    },
    getSettings() {
        return read().settings;
    },
    setSetting(key, value) {
        const data = read();
        data.settings[key] = value;
        write(data);
    },
};
