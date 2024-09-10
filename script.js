const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const startPanel = document.getElementById('start-panel');
const startBtn = document.getElementById('start-btn');
const scoreElement = document.getElementById('score');

let snake = [{ x: 100, y: 100 }];
let snakeLength = 5;
let foods = [];
let score = 0;
let gameInterval;
let mousePosition = { x: 100, y: 100 };
let baseSpeed = 3;
let speedMultiplier = 0.05; // 每增加一节，速度增加的比例
const maxFoods = 50;
const minFoods = 30;
const foodRadius = 10;
let headWidth = 20; // 初始蛇头宽度
const maxHeadWidth = 40; // 最大蛇头宽度

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

function startGame() {
    resetGame();
    startPanel.style.display = 'none';
    canvas.style.display = 'block';
    gameInterval = setInterval(update, 20);
}

function resetGame() {
    snake = [{ x: canvas.width / 2, y: canvas.height / 2 }];
    snakeLength = 5;
    score = 0;
    foods = [];
    scoreElement.textContent = score;
    generateFood();
}

function update() {
    updateSnakePosition();
    checkFoodCollisions();
    manageFoodLifeCycle();
    draw();
}

function updateSnakePosition() {
    const head = snake[0];
    const dx = mousePosition.x - head.x;
    const dy = mousePosition.y - head.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const speed = baseSpeed + (snakeLength - 5) * speedMultiplier; // 随着蛇的长度增加速度

    if (distance > speed) {
        const angle = Math.atan2(dy, dx);
        const newHead = {
            x: head.x + Math.cos(angle) * speed,
            y: head.y + Math.sin(angle) * speed,
        };
        snake.unshift(newHead);
    }

    if (snake.length > snakeLength) {
        snake.pop();
    }

    // 随着蛇的成长，蛇头逐渐变宽
    headWidth = Math.min(maxHeadWidth, 20 + (snakeLength - 5) * 2);
}

function generateFood() {
    if (foods.length < minFoods) {
        const foodType = randomFoodType();
        const food = createFood(foodType);
        foods.push(food);
    }
}

function createFood(foodType) {
    return {
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        type: foodType.type,
        color: foodType.color,
        radius: foodRadius,
        lifetime: foodType.lifetime,
        opacity: 1,
    };
}

function randomFoodType() {
    const r = Math.random();
    if (r < 0.6) {
        return { type: 'red', color: 'red', lifetime: 30000 }; // 红色食物30秒
    } else if (r < 0.9) {
        return { type: 'yellow', color: 'yellow', lifetime: 30000 }; // 黄色食物30秒
    } else if (r < 0.98) {
        return { type: 'green', color: 'green', lifetime: 30000 }; // 绿色食物30秒
    } else {
        return { type: 'super', color: 'rainbow', lifetime: 30000 }; // 超级彩色食物30秒
    }
}

function manageFoodLifeCycle() {
    foods.forEach(food => {
        food.lifetime -= 20;
        if (food.lifetime <= 1000) {
            food.opacity = food.lifetime / 1000;
        }
    });

    foods = foods.filter(food => food.lifetime > 0);

    if (foods.length < minFoods) {
        generateFood();
    } else if (foods.length > maxFoods) {
        const randomIndex = Math.floor(Math.random() * foods.length);
        foods[randomIndex].lifetime = Math.min(foods[randomIndex].lifetime, 1000); // Start fading out
    }
}

function checkFoodCollisions() {
    const head = snake[0];

    foods = foods.filter(food => {
        const distance = Math.sqrt((head.x - food.x) ** 2 + (head.y - food.y) ** 2);
        if (distance < food.radius + headWidth / 2) { // 蛇头面积增加后更新碰撞检测
            handleFoodCollision(food);
            return false;
        }
        return true;
    });
}

function handleFoodCollision(food) {
    switch (food.type) {
        case 'red':
            score++;
            snakeLength += 1;
            break;
        case 'yellow':
            score += 2;
            snakeLength += 2;
            break;
        case 'green':
            score -= 3;
            snakeLength = Math.max(5, snakeLength - 3);
            break;
        case 'super':
            score += 10;
            snakeLength += 10;
            break;
    }
    scoreElement.textContent = score;
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    foods.forEach(food => {
        ctx.fillStyle = food.color === 'rainbow' ? getRainbowColor() : food.color;
        ctx.globalAlpha = food.opacity;
        ctx.beginPath();
        ctx.arc(food.x, food.y, food.radius, 0, 2 * Math.PI);
        ctx.fill();
        ctx.globalAlpha = 1;
    });

    ctx.strokeStyle = 'lime';
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = headWidth; // 根据当前蛇头宽度绘制
    ctx.beginPath();
    ctx.moveTo(snake[0].x, snake[0].y);
    for (let i = 1; i < snake.length; i++) {
        ctx.lineTo(snake[i].x, snake[i].y);
    }
    ctx.stroke();
}

function getRainbowColor() {
    const time = Date.now() * 0.001;
    const r = Math.sin(time * 2) * 127 + 128;
    const g = Math.sin(time * 2 + 2) * 127 + 128;
    const b = Math.sin(time * 2 + 4) * 127 + 128;
    return `rgb(${r},${g},${b})`;
}

window.addEventListener('mousemove', (e) => {
    mousePosition.x = e.clientX;
    mousePosition.y = e.clientY;
});

startBtn.addEventListener('click', startGame);

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});
