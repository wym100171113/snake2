// food.js — 道具（食物）系统（2D 像素坐标）
// 24 种食物，全有时限，包含超级大奖 + 特殊效果

export const FOOD_TYPES = {
    // ── 常见 ──
    strawberry: {
        key: 'strawberry', name: '草莓', emoji: '🍓', color: '#FF8B94',
        score: 10, growth: 2, radius: 14, lifespan: 15000, weight: 40,
        tier: 'common',
    },
    cherry: {
        key: 'cherry', name: '樱桃', emoji: '🍒', color: '#E74C3C',
        score: 10, growth: 2, radius: 13, lifespan: 15000, weight: 40,
        tier: 'common',
    },
    mango: {
        key: 'mango', name: '芒果', emoji: '🥭', color: '#FFB74D',
        score: 12, growth: 2, radius: 15, lifespan: 14000, weight: 35,
        tier: 'common',
    },
    rice: {
        key: 'rice', name: '米饭', emoji: '🍚', color: '#F5F5F5',
        score: 8, growth: 3, radius: 13, lifespan: 13000, weight: 40,
        tier: 'common',
    },
    // ── 稀有 ──
    kiwi: {
        key: 'kiwi', name: '猕猴桃', emoji: '🥝', color: '#8BC34A',
        score: 15, growth: 3, radius: 14, lifespan: 12000, weight: 20,
        tier: 'rare',
    },
    lemon: {
        key: 'lemon', name: '柠檬', emoji: '🍋', color: '#FFD96A',
        score: 30, growth: 4, radius: 16, lifespan: 12000, weight: 12,
        buff: { type: 'speed', factor: 1.5, duration: 5000 },
        tier: 'rare',
    },
    blueberry: {
        key: 'blueberry', name: '蓝莓', emoji: '🫐', color: '#C8B6FF',
        score: 15, growth: 3, radius: 13, lifespan: 12000, weight: 12,
        buff: { type: 'slow', factor: 0.6, duration: 5000 },
        tier: 'rare',
    },
    grape: {
        key: 'grape', name: '葡萄', emoji: '🍇', color: '#9B59B6',
        score: 20, growth: 3, radius: 15, lifespan: 10000, weight: 10,
        tier: 'rare',
    },
    peach: {
        key: 'peach', name: '蜜桃', emoji: '🍑', color: '#FFB5A7',
        score: 25, growth: 3, radius: 16, lifespan: 10000, weight: 10,
        tier: 'rare',
    },
    coconut: {
        key: 'coconut', name: '椰子', emoji: '🥥', color: '#A1887F',
        score: 35, growth: 5, radius: 17, lifespan: 9000, weight: 6,
        buff: { type: 'slow', factor: 0.5, duration: 6000 },
        tier: 'rare',
    },
    cookie: {
        key: 'cookie', name: '饼干', emoji: '🍪', color: '#D7CCC8',
        score: 18, growth: 3, radius: 14, lifespan: 11000, weight: 12,
        buff: { type: 'shrink', amount: 4 },
        tier: 'rare',
    },
    sushi: {
        key: 'sushi', name: '寿司', emoji: '🍣', color: '#FF8A65',
        score: 22, growth: 3, radius: 15, lifespan: 10000, weight: 10,
        buff: { type: 'magnet', duration: 8000, radius: 80 },
        tier: 'rare',
    },
    ramen: {
        key: 'ramen', name: '拉面', emoji: '🍜', color: '#FFCC80',
        score: 28, growth: 4, radius: 16, lifespan: 10000, weight: 8,
        buff: { type: 'speed', factor: 1.6, duration: 6000 },
        tier: 'rare',
    },
    // ── 史诗 ──
    watermelon: {
        key: 'watermelon', name: '西瓜', emoji: '🍉', color: '#6BCB77',
        score: 40, growth: 5, radius: 20, lifespan: 8000, weight: 6,
        tier: 'epic',
    },
    star: {
        key: 'star', name: '星星', emoji: '⭐', color: '#FFB347',
        score: 50, growth: 5, radius: 17, lifespan: 8000, weight: 5,
        tier: 'epic',
    },
    dragonfruit: {
        key: 'dragonfruit', name: '火龙果', emoji: '🐉', color: '#E91E63',
        score: 60, growth: 6, radius: 19, lifespan: 7000, weight: 4,
        buff: { type: 'speed', factor: 1.6, duration: 7000 },
        tier: 'epic',
    },
    pizza: {
        key: 'pizza', name: '披萨', emoji: '🍕', color: '#F4A460',
        score: 55, growth: 5, radius: 19, lifespan: 7500, weight: 4,
        buff: { type: 'shield', duration: 8000 },
        tier: 'epic',
    },
    donut: {
        key: 'donut', name: '甜甜圈', emoji: '🍩', color: '#FF80AB',
        score: 45, growth: 4, radius: 17, lifespan: 8000, weight: 5,
        buff: { type: 'superSpeed', duration: 3000, factor: 3 },
        tier: 'epic',
    },
    icecream: {
        key: 'icecream', name: '冰淇淋', emoji: '🍦', color: '#FFF9C4',
        score: 35, growth: 4, radius: 16, lifespan: 8500, weight: 5,
        buff: { type: 'slowTime', duration: 5000, factor: 0.5 },
        tier: 'epic',
    },
    // ── 传奇 ──
    clover: {
        key: 'clover', name: '四叶草', emoji: '🍀', color: '#2ECC71',
        score: 80, growth: 7, radius: 18, lifespan: 6000, weight: 2.5,
        buff: { type: 'speed', factor: 1.8, duration: 8000 },
        tier: 'legendary',
    },
    diamond: {
        key: 'diamond', name: '钻石', emoji: '💎', color: '#90CAF9',
        score: 100, growth: 8, radius: 19, lifespan: 5000, weight: 1.5,
        buff: { type: 'slow', factor: 0.4, duration: 6000 },
        tier: 'legendary',
    },
    rainbow: {
        key: 'rainbow', name: '彩虹糖', emoji: '🌈', color: '#FF80AB',
        score: 120, growth: 8, radius: 20, lifespan: 5000, weight: 1.2,
        tier: 'legendary',
    },
    cake: {
        key: 'cake', name: '蛋糕', emoji: '🎂', color: '#FFB6C1',
        score: 110, growth: 7, radius: 20, lifespan: 5500, weight: 1.5,
        buff: { type: 'invincible', duration: 10000 },
        tier: 'legendary',
    },
    magicMushroom: {
        key: 'magicMushroom', name: '魔法菇', emoji: '🍄', color: '#E1BEE7',
        score: 90, growth: 6, radius: 18, lifespan: 5000, weight: 1.5,
        buff: { type: 'invisible', duration: 4000 },
        tier: 'legendary',
    },
    // ── 超级大奖 ──
    unicorn: {
        key: 'unicorn', name: '独角兽', emoji: '🦄', color: '#FF6B9D',
        score: 200, growth: 10, radius: 24, lifespan: 5000, weight: 0.8,
        tier: 'jackpot', jackpot: true,
    },
    phoenix: {
        key: 'phoenix', name: '凤凰', emoji: '🔥', color: '#FF5722',
        score: 300, growth: 12, radius: 26, lifespan: 4000, weight: 0.4,
        tier: 'jackpot', jackpot: true,
    },
    heart: {
        key: 'heart', name: '生命之心', emoji: '💖', color: '#FF4081',
        score: 150, growth: 5, radius: 22, lifespan: 4500, weight: 0.6,
        buff: { type: 'life', amount: 1 },
        tier: 'jackpot', jackpot: true,
    },
};

const FOOD_LIST = Object.values(FOOD_TYPES);

function pickFoodType(cheatMode) {
    const total = FOOD_LIST.reduce((s, t) => s + t.weight, 0);
    let r = Math.random() * total;
    // 作弊模式下稀有度提升
    if (cheatMode) r *= 0.6;
    for (const t of FOOD_LIST) {
        r -= t.weight;
        if (r <= 0) return t;
    }
    return FOOD_LIST[0];
}

function pointInSnake(x, y, snake, exclude) {
    const r = snake.segmentRadius + 6;
    const r2 = r * r;
    const limit = Math.min(snake.segments.length, exclude || 0);
    for (let i = 0; i < snake.segments.length; i++) {
        const seg = snake.segments[i];
        if (limit && i < snake.segments.length - limit) continue;
        const dx = x - seg.x;
        const dy = y - seg.y;
        if (dx * dx + dy * dy < r2) return true;
    }
    return false;
}

export function spawnFood(area, snake, typeKey, cheatMode) {
    const type = typeKey ? FOOD_TYPES[typeKey] : pickFoodType(cheatMode);
    let food;
    let attempts = 0;
    const margin = type.radius + 6;
    do {
        food = {
            ...type,
            x: area.x + margin + Math.random() * (area.width - margin * 2),
            y: area.y + margin + Math.random() * (area.height - margin * 2),
            spawnedAt: performance.now(),
            expiresAt: performance.now() + (type.lifespan || 15000),
        };
        attempts++;
        if (attempts > 80) break;
    } while (pointInSnake(food.x, food.y, snake, 6));
    return food;
}

export function maintainFoods(foods, area, snake, targetCount = 8, cheatMode = false) {
    const now = performance.now();
    const alive = foods.filter(f => now < f.expiresAt);
    // 作弊模式更多食物
    const target = cheatMode ? targetCount + 4 : targetCount;
    while (alive.length < target) {
        alive.push(spawnFood(area, snake, null, cheatMode));
    }
    return alive;
}

export function burstSpawn(area, snake, count = 4, cheatMode = false) {
    const result = [];
    const burstTypes = [
        FOOD_TYPES.strawberry, FOOD_TYPES.cherry, FOOD_TYPES.mango, FOOD_TYPES.rice,
        FOOD_TYPES.kiwi, FOOD_TYPES.lemon, FOOD_TYPES.blueberry,
        FOOD_TYPES.grape, FOOD_TYPES.peach, FOOD_TYPES.coconut,
        FOOD_TYPES.cookie, FOOD_TYPES.sushi, FOOD_TYPES.ramen,
        FOOD_TYPES.watermelon, FOOD_TYPES.star, FOOD_TYPES.dragonfruit,
        FOOD_TYPES.pizza, FOOD_TYPES.donut, FOOD_TYPES.icecream,
    ];
    // 作弊模式爆发更多 + 有概率出传奇/大奖
    const cnt = cheatMode ? count + 3 : count;
    for (let i = 0; i < cnt; i++) {
        let type;
        if (cheatMode && Math.random() < 0.15) {
            const legendPool = [FOOD_TYPES.clover, FOOD_TYPES.diamond, FOOD_TYPES.rainbow, FOOD_TYPES.cake, FOOD_TYPES.magicMushroom];
            type = legendPool[Math.floor(Math.random() * legendPool.length)];
        } else {
            type = burstTypes[Math.floor(Math.random() * burstTypes.length)];
        }
        result.push(spawnFood(area, snake, type.key, cheatMode));
    }
    return result;
}