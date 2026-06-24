// snake.js — 蛇身逻辑（移动、碰撞、生长）
// 坐标使用网格单位（col, row），渲染时由 renderer 转换为像素

export const DIRS = {
    up:    { x:  0, y: -1 },
    down:  { x:  0, y:  1 },
    left:  { x: -1, y:  0 },
    right: { x:  1, y:  0 },
};

export function createSnake(startCol, startRow, length = 3, dirKey = 'right') {
    const dir = DIRS[dirKey];
    const body = [];
    for (let i = 0; i < length; i++) {
        body.push({
            x: startCol - dir.x * i,
            y: startRow - dir.y * i,
        });
    }
    return {
        body,                    // [head, ..., tail]
        dirKey,                  // 当前方向
        pendingDirKey: dirKey,   // 待生效方向（防反向：每次 tick 提交一次）
        growCount: 0,            // 待生长节数
    };
}

/**
 * 设置下一个方向（仅当不与当前方向相反时才接受）
 * 防止同一 tick 内连按两次导致 180° 自杀
 */
export function setDirection(snake, newDirKey) {
    if (!DIRS[newDirKey]) return;
    const current = DIRS[snake.dirKey];
    const next = DIRS[newDirKey];
    if (current.x + next.x === 0 && current.y + next.y === 0) return;
    snake.pendingDirKey = newDirKey;
}

/**
 * 推进一步。返回新头部坐标。
 */
export function step(snake) {
    snake.dirKey = snake.pendingDirKey;
    const dir = DIRS[snake.dirKey];
    const head = snake.body[0];
    return {
        x: head.x + dir.x,
        y: head.y + dir.y,
    };
}

/**
 * 把新头部加入蛇身，并按 growCount 决定是否缩减尾巴。
 */
export function commitMove(snake, newHead) {
    snake.body.unshift(newHead);
    if (snake.growCount > 0) {
        snake.growCount -= 1;
    } else {
        snake.body.pop();
    }
}

export function grow(snake, amount) {
    snake.growCount += amount;
}

/**
 * 碰撞检测。
 * walls: { cols, rows, wrap: boolean }
 */
export function checkCollision(snake, walls) {
    const head = snake.body[0];
    if (walls.wrap) {
        // 穿墙模式：模运算
        if (head.x < 0) snake.body[0].x = walls.cols - 1;
        if (head.x >= walls.cols) snake.body[0].x = 0;
        if (head.y < 0) snake.body[0].y = walls.rows - 1;
        if (head.y >= walls.rows) snake.body[0].y = 0;
        return false;
    }
    if (
        head.x < 0 ||
        head.y < 0 ||
        head.x >= walls.cols ||
        head.y >= walls.rows
    ) {
        return 'wall';
    }
    // 撞自己（从第 4 节开始判断，避免头部刚好压住第 1 节）
    for (let i = 4; i < snake.body.length; i++) {
        if (snake.body[i].x === head.x && snake.body[i].y === head.y) {
            return 'self';
        }
    }
    return false;
}

/**
 * 头部是否与某食物坐标重合。
 */
export function eats(snake, food) {
    const head = snake.body[0];
    return head.x === food.x && head.y === food.y;
}
