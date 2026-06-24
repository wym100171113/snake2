// food.js — 道具（食物）系统
// 4 种道具：普通 / 黄金（加速 buff）/ 星空（减速 buff）/ 落日（奖励 + 时限）

export const FOOD_TYPES = {
    normal: {
        key: 'normal',
        name: '樱桃',
        emoji: '🍓',
        color: '#FF8B94',
        score: 10,
        growth: 1,
        weight: 60,           // 出现权重
        spawnable: true,      // 是否常驻生成
    },
    gold: {
        key: 'gold',
        name: '柠檬',
        emoji: '🍋',
        color: '#FFD96A',
        score: 30,
        growth: 2,
        weight: 15,
        buff: { type: 'speed', factor: 1.5, duration: 5000 },
        spawnable: true,
    },
    grape: {
        key: 'grape',
        name: '蓝莓',
        emoji: '🫐',
        color: '#C8B6FF',
        score: 5,
        growth: 1,
        weight: 15,
        buff: { type: 'slow', factor: 0.6, duration: 5000 },
        spawnable: true,
    },
    sunset: {
        key: 'sunset',
        name: '星星',
        emoji: '⭐',
        color: '#FFB347',
        score: 50,
        growth: 3,
        weight: 10,
        expiresAfter: 10000,  // 限时出现
        spawnable: true,
    },
};

const FOOD_LIST = Object.values(FOOD_TYPES);

/**
 * 按权重随机选择一种食物类型
 */
export function pickFoodType() {
    const total = FOOD_LIST.reduce((s, t) => s + t.weight, 0);
    let r = Math.random() * total;
    for (const t of FOOD_LIST) {
        r -= t.weight;
        if (r <= 0) return t;
    }
    return FOOD_LIST[0];
}

/**
 * 在指定网格范围内生成一个不与蛇身重合的食物
 */
export function spawnFood(walls, snake, typeKey) {
    const type = typeKey ? FOOD_TYPES[typeKey] : pickFoodType();
    let food;
    let attempts = 0;
    do {
        food = {
            ...type,
            x: Math.floor(Math.random() * walls.cols),
            y: Math.floor(Math.random() * walls.rows),
            spawnedAt: performance.now(),
        };
        attempts++;
        if (attempts > 60) break; // 网格几乎被占满时放弃
    } while (snake.body.some(s => s.x === food.x && s.y === food.y));
    return food;
}

/**
 * 维护场上食物数量 + 清理过期奖励。
 * 返回更新后的食物数组。
 */
export function maintainFoods(foods, walls, snake, targetCount = 4) {
    const now = performance.now();
    // 移除过期
    const alive = foods.filter(f => {
        if (f.expiresAfter && now - f.spawnedAt > f.expiresAfter) return false;
        return true;
    });
    // 补足
    while (alive.length < targetCount) {
        alive.push(spawnFood(walls, snake));
    }
    return alive;
}
