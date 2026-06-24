// food.js — 道具（食物）系统（2D 像素坐标）
// 16 种食物，全有时限，包含超级大奖 + 随机爆发

export const FOOD_TYPES = {
    strawberry: {
        key: 'strawberry', name: '草莓', emoji: '🍓', color: '#FF8B94',
        score: 10, growth: 2, radius: 14, lifespan: 15000, weight: 55,
        tier: 'common',
    },
    cherry: {
        key: 'cherry', name: '樱桃', emoji: '🍒', color: '#E74C3C',
        score: 10, growth: 2, radius: 13, lifespan: 15000, weight: 55,
        tier: 'common',
    },
    mango: {
        key: 'mango', name: '芒果', emoji: '🥭', color: '#FFB74D',
        score: 12, growth: 2, radius: 15, lifespan: 14000, weight: 45,
        tier: 'common',
    },
    kiwi: {
        key: 'kiwi', name: '猕猴桃', emoji: '🥝', color: '#8BC34A',
        score: 15, growth: 3, radius: 14, lifespan: 12000, weight: 30,
        tier: 'rare',
    },
    lemon: {
        key: 'lemon', name: '柠檬', emoji: '🍋', color: '#FFD96A',
        score: 30, growth: 4, radius: 16, lifespan: 12000, weight: 16,
        buff: { type: 'speed', factor: 1.5, duration: 5000 },
        tier: 'rare',
    },
    blueberry: {
        key: 'blueberry', name: '蓝莓', emoji: '🫐', color: '#C8B6FF',
        score: 15, growth: 3, radius: 13, lifespan: 12000, weight: 16,
        buff: { type: 'slow', factor: 0.6, duration: 5000 },
        tier: 'rare',
    },
    grape: {
        key: 'grape', name: '葡萄', emoji: '🍇', color: '#9B59B6',
        score: 20, growth: 3, radius: 15, lifespan: 10000, weight: 14,
        tier: 'rare',
    },
    peach: {
        key: 'peach', name: '蜜桃', emoji: '🍑', color: '#FFB5A7',
        score: 25, growth: 3, radius: 16, lifespan: 10000, weight: 12,
        tier: 'rare',
    },
    coconut: {
        key: 'coconut', name: '椰子', emoji: '🥥', color: '#A1887F',
        score: 35, growth: 5, radius: 17, lifespan: 9000, weight: 8,
        buff: { type: 'slow', factor: 0.5, duration: 6000 },
        tier: 'rare',
    },
    watermelon: {
        key: 'watermelon', name: '西瓜', emoji: '🍉', color: '#6BCB77',
        score: 40, growth: 5, radius: 20, lifespan: 8000, weight: 8,
        tier: 'epic',
    },
    star: {
        key: 'star', name: '星星', emoji: '⭐', color: '#FFB347',
        score: 50, growth: 5, radius: 17, lifespan: 8000, weight: 7,
        tier: 'epic',
    },
    dragonfruit: {
        key: 'dragonfruit', name: '火龙果', emoji: '🐉', color: '#E91E63',
        score: 60, growth: 6, radius: 19, lifespan: 7000, weight: 5,
        buff: { type: 'speed', factor: 1.6, duration: 7000 },
        tier: 'epic',
    },
    clover: {
        key: 'clover', name: '四叶草', emoji: '🍀', color: '#2ECC71',
        score: 80, growth: 7, radius: 18, lifespan: 6000, weight: 3,
        buff: { type: 'speed', factor: 1.8, duration: 8000 },
        tier: 'legendary',
    },
    diamond: {
        key: 'diamond', name: '钻石', emoji: '💎', color: '#90CAF9',
        score: 100, growth: 8, radius: 19, lifespan: 5000, weight: 2,
        buff: { type: 'slow', factor: 0.4, duration: 6000 },
        tier: 'legendary',
    },
    rainbow: {
        key: 'rainbow', name: '彩虹糖', emoji: '🌈', color: '#FF80AB',
        score: 120, growth: 8, radius: 20, lifespan: 5000, weight: 1.5,
        tier: 'legendary',
    },
    unicorn: {
        key: 'unicorn', name: '独角兽', emoji: '🦄', color: '#FF6B9D',
        score: 200, growth: 10, radius: 24, lifespan: 5000, weight: 1,
        tier: 'jackpot',
        jackpot: true,
    },
    phoenix: {
        key: 'phoenix', name: '凤凰', emoji: '🔥', color: '#FF5722',
        score: 300, growth: 12, radius: 26, lifespan: 4000, weight: 0.5,
        tier: 'jackpot',
        jackpot: true,
    },
};

const FOOD_LIST = Object.values(FOOD_TYPES);

function pickFoodType() {
    const total = FOOD_LIST.reduce((s, t) => s + t.weight, 0);
    let r = Math.random() * total;
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

/**
 * 在活动区域内生成一个不与蛇身重合的食物。
 * typeKey 可选，不传则随机。
 */
export function spawnFood(area, snake, typeKey) {
    const type = typeKey ? FOOD_TYPES[typeKey] : pickFoodType();
    let food;
    let attempts = 0;
    const margin = type.radius + 6;
    do {
        food = {
            ...type,
            x: area.x + margin + Math.random() * (area.width - margin * 2),
            y: area.y + margin + Math.random() * (area.height - margin * 2),
            spawnedAt: performance.now(),
            // 每个食物特有的过期时间
            expiresAt: performance.now() + (type.lifespan || 15000),
        };
        attempts++;
        if (attempts > 80) break;
    } while (pointInSnake(food.x, food.y, snake, 6));
    return food;
}

/**
 * 维护场上食物数量 + 清理过期食物。
 * 所有食物都有 lifespan，超时自动消失。
 * targetCount 默认 8，让场上更热闹。
 */
export function maintainFoods(foods, area, snake, targetCount = 8) {
    const now = performance.now();
    const alive = foods.filter(f => now < f.expiresAt);
    while (alive.length < targetCount) {
        alive.push(spawnFood(area, snake));
    }
    return alive;
}

/**
 * 爆发补充：随机生成一批食物（普通 + 稀有混合），用于周期性刷新。
 */
export function burstSpawn(area, snake, count = 4) {
    const result = [];
    // 爆发中稀有概率提升
    const burstTypes = [
        FOOD_TYPES.strawberry, FOOD_TYPES.cherry, FOOD_TYPES.mango,
        FOOD_TYPES.kiwi, FOOD_TYPES.lemon, FOOD_TYPES.blueberry,
        FOOD_TYPES.grape, FOOD_TYPES.peach, FOOD_TYPES.coconut,
        FOOD_TYPES.watermelon, FOOD_TYPES.star, FOOD_TYPES.dragonfruit,
    ];
    for (let i = 0; i < count; i++) {
        const type = burstTypes[Math.floor(Math.random() * burstTypes.length)];
        result.push(spawnFood(area, snake, type.key));
    }
    return result;
}