// food.js — 道具（食物）系统（2D 像素坐标）

export const FOOD_TYPES = {
    normal: {
        key: 'normal',
        name: '樱桃',
        emoji: '🍓',
        color: '#FF8B94',
        score: 10,
        growth: 1,
        radius: 14,
        weight: 60,
    },
    gold: {
        key: 'gold',
        name: '柠檬',
        emoji: '🍋',
        color: '#FFD96A',
        score: 30,
        growth: 2,
        radius: 15,
        weight: 15,
        buff: { type: 'speed', factor: 1.5, duration: 5000 },
    },
    grape: {
        key: 'grape',
        name: '蓝莓',
        emoji: '🫐',
        color: '#C8B6FF',
        score: 5,
        growth: 1,
        radius: 13,
        weight: 15,
        buff: { type: 'slow', factor: 0.6, duration: 5000 },
    },
    sunset: {
        key: 'sunset',
        name: '星星',
        emoji: '⭐',
        color: '#FFB347',
        score: 50,
        growth: 3,
        radius: 16,
        weight: 10,
        expiresAfter: 10000,
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
 * 在活动区域内生成一个不与蛇身重合的食物
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
        };
        attempts++;
        if (attempts > 80) break;
    } while (pointInSnake(food.x, food.y, snake, 6));
    return food;
}

/**
 * 维护场上食物数量 + 清理过期奖励。
 */
export function maintainFoods(foods, area, snake, targetCount = 4) {
    const now = performance.now();
    const alive = foods.filter(f => {
        if (f.expiresAfter && now - f.spawnedAt > f.expiresAfter) return false;
        return true;
    });
    while (alive.length < targetCount) {
        alive.push(spawnFood(area, snake));
    }
    return alive;
}
