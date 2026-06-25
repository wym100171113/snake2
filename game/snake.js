// snake.js — 2D 自由移动蛇身（链式跟随 + 平滑转向）
// 坐标使用画布像素单位，支持 360° 任意方向

const TAU = Math.PI * 2;

function normalizeAngle(a) {
    while (a > Math.PI) a -= TAU;
    while (a < -Math.PI) a += TAU;
    return a;
}

/**
 * 创建一个 2D 蛇。
 * startX, startY: 初始位置（画布像素）
 * 蛇身由若干段（segments）组成，首段为头部。
 * 每段之间的固定距离 = segmentSpacing。
 */
export function createSnake({
    x,
    y,
    initialAngle = 0,
    initialLength = 3,
    baseSpeed = 110,
    segmentRadius = 11,
    turnRate = 4.8,   // 弧度/秒，最大转向速度
} = {}) {
    const segmentSpacing = segmentRadius * 2 - 1; // 略小于直径，让节之间有视觉连接
    const segments = [];
    for (let i = 0; i < initialLength; i++) {
        segments.push({
            x: x - Math.cos(initialAngle) * segmentSpacing * i,
            y: y - Math.sin(initialAngle) * segmentSpacing * i,
        });
    }
    return {
        segments,                 // [head, ..., tail]
        angle: initialAngle,      // 当前朝向（弧度）
        targetAngle: initialAngle,
        speed: baseSpeed,
        baseSpeed,
        segmentRadius,
        segmentSpacing,
        turnRate,
        alive: true,
    };
}

/**
 * 设置目标方向。dx/dy 为归一化方向向量；如果为零向量则保持当前角度不变。
 */
export function setTargetDirection(snake, dx, dy) {
    if (dx === 0 && dy === 0) return;
    snake.targetAngle = Math.atan2(dy, dx);
}

/**
 * 直接覆盖当前角度（用于初始化 / 重置）
 */
export function setAngle(snake, angle) {
    snake.angle = angle;
    snake.targetAngle = angle;
}

/**
 * 推进一步（按 dt 秒）。
 * - 头部按当前 speed 沿 angle 方向移动
 * - 每段向后段（朝向其前段）拉回到固定距离
 */
export function update(snake, dt) {
    if (!snake.alive) return;
    // 平滑转向
    let da = normalizeAngle(snake.targetAngle - snake.angle);
    const maxStep = snake.turnRate * dt;
    if (Math.abs(da) <= maxStep) {
        snake.angle = snake.targetAngle;
    } else {
        snake.angle += Math.sign(da) * maxStep;
    }
    snake.angle = normalizeAngle(snake.angle);

    // 头部位移
    const head = snake.segments[0];
    head.x += Math.cos(snake.angle) * snake.speed * dt;
    head.y += Math.sin(snake.angle) * snake.speed * dt;

    // 后续节跟随前一节
    for (let i = 1; i < snake.segments.length; i++) {
        const front = snake.segments[i - 1];
        const back = snake.segments[i];
        const dx = front.x - back.x;
        const dy = front.y - back.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > snake.segmentSpacing * snake.segmentSpacing) {
            const d = Math.sqrt(d2);
            const t = (d - snake.segmentSpacing) / d;
            back.x += dx * t;
            back.y += dy * t;
        }
    }
}

/**
 * 在尾部延长 amount 节（吃食物时调用）
 */
export function grow(snake, amount = 1) {
    const tail = snake.segments[snake.segments.length - 1];
    const prev = snake.segments[snake.segments.length - 2] || tail;
    let dx = tail.x - prev.x;
    let dy = tail.y - prev.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < 0.0001) { dx = 1; dy = 0; } else { dx /= d; dy /= d; }
    for (let i = 0; i < amount; i++) {
        snake.segments.push({
            x: tail.x + dx * snake.segmentSpacing * (i + 1),
            y: tail.y + dy * snake.segmentSpacing * (i + 1),
        });
    }
}

/**
 * 墙壁碰撞：area = { x, y, width, height }（蛇的活动区域）
 * 返回 'wall' 或 false
 */
export function checkWallCollision(snake, area) {
    const head = snake.segments[0];
    const r = snake.segmentRadius;
    if (
        head.x - r < area.x ||
        head.x + r > area.x + area.width ||
        head.y - r < area.y ||
        head.y + r > area.y + area.height
    ) {
        return 'wall';
    }
    return false;
}

/**
 * 自身碰撞：头部进入任意非相邻节的"身体半径"时算撞到自己
 */
export function checkSelfCollision(snake) {
    const head = snake.segments[0];
    const r = snake.segmentRadius;
    const minDist = r * 2.2;
    const minDist2 = minDist * minDist;
    // 从第 6 节开始检查（前几节紧贴头部，避免误判）
    for (let i = 6; i < snake.segments.length; i++) {
        const seg = snake.segments[i];
        const dx = head.x - seg.x;
        const dy = head.y - seg.y;
        if (dx * dx + dy * dy < minDist2) {
            return 'self';
        }
    }
    return false;
}

/**
 * 头部是否吃到某个食物（按距离 + 半径）
 */
export function eats(snake, food) {
    const head = snake.segments[0];
    const dx = head.x - food.x;
    const dy = head.y - food.y;
    const r = snake.segmentRadius + food.radius;
    return (dx * dx + dy * dy) < r * r;
}

/**
 * 缩小蛇身：从尾部移除 amount 节，最少保留 3 节
 */
export function shrink(snake, amount = 3) {
    const minLen = 3;
    if (snake.segments.length <= minLen) return;
    const remove = Math.min(amount, snake.segments.length - minLen);
    snake.segments.splice(snake.segments.length - remove, remove);
}

/**
 * 应用速度倍率（buff 触发 / 解除时调用）
 */
export function setSpeedFactor(snake, factor) {
    snake.speed = snake.baseSpeed * factor;
}
