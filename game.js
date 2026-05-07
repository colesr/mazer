// =============================================
// A MAZE ZING! - Main Game Logic
// =============================================

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const bgCanvas = document.getElementById('bg-canvas');
const bgCtx = bgCanvas.getContext('2d');

const CELL_SIZE = 24;
const COLS = 25;
const ROWS = 20;

let maze = [];
let player = { x: 1, y: 1 };
let exit = { x: COLS - 2, y: ROWS - 2 };

let gameWon = false;
let gameOver = false;

let startTime = 0;
let timerInterval = null;

let bestTime = localStorage.getItem('mazeBest') ? parseFloat(localStorage.getItem('mazeBest')) : Infinity;
let totalCompleted = parseInt(localStorage.getItem('mazeCompleted') || '0');

let aiEnabled = true;
let ai = { x: 3, y: 3 };

let projectiles = [];
let powerups = [];

let playerSpeed = 1;
let hasStickyGun = false;

let lastPlayerMove = 0;
let keys = {};

// ============== BACKGROUND (already in HTML) ==============
// ============== AUDIO (already in HTML) ==============

// ============== MAZE GENERATION ==============
function generateMaze() {
    maze = Array(ROWS).fill().map(() => Array(COLS).fill(1));
    player.x = 1;
    player.y = 1;

    function carve(x, y) {
        maze[y][x] = 0;
        const dirs = [[0, -2], [2, 0], [0, 2], [-2, 0]].sort(() => Math.random() - 0.5);

        for (let [dx, dy] of dirs) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx > 0 && nx < COLS - 1 && ny > 0 && ny < ROWS - 1 && maze[ny][nx] === 1) {
                maze[y + (dy / 2) | 0][x + (dx / 2) | 0] = 0;
                carve(nx, ny);
            }
        }
    }

    carve(1, 1);

    // Clear starting area
    for (let i = -2; i <= 2; i++) {
        for (let j = -2; j <= 2; j++) {
            const cx = player.x + i;
            const cy = player.y + j;
            if (cx >= 0 && cx < COLS && cy >= 0 && cy < ROWS) {
                maze[cy][cx] = 0;
            }
        }
    }

    maze[exit.y][exit.x] = 0;

    // Reset AI position
    ai.x = COLS - 4;
    ai.y = ROWS - 4;

    // Spawn powerups
    powerups = [];
    for (let i = 0; i < 5; i++) {
        let px, py;
        do {
            px = 2 + Math.floor(Math.random() * (COLS - 4));
            py = 2 + Math.floor(Math.random() * (ROWS - 4));
        } while (maze[py][px] === 1);

        powerups.push({
            x: px,
            y: py,
            type: Math.random() > 0.5 ? 'speed' : 'gun'
        });
    }

    projectiles = [];
}

// ============== HELPER ==============
function isOpen(x, y) {
    return x >= 0 && x < COLS && y >= 0 && y < ROWS && maze[y][x] === 0;
}

// ============== DRAW ==============
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw maze
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            ctx.fillStyle = maze[y][x] ? '#440044' : '#0a001f';
            ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        }
    }

    // Exit
    ctx.fillStyle = '#00ff88';
    ctx.fillRect(exit.x * CELL_SIZE + 4, exit.y * CELL_SIZE + 4, CELL_SIZE - 8, CELL_SIZE - 8);

    // Powerups
    powerups.forEach(p => {
        ctx.fillStyle = p.type === 'speed' ? '#ffff00' : '#00ffff';
        ctx.fillRect(p.x * CELL_SIZE + 8, p.y * CELL_SIZE + 8, CELL_SIZE - 16, CELL_SIZE - 16);
    });

    // Player
    ctx.fillStyle = '#00ffff';
    ctx.beginPath();
    ctx.arc(
        player.x * CELL_SIZE + CELL_SIZE / 2,
        player.y * CELL_SIZE + CELL_SIZE / 2,
        CELL_SIZE / 2 - 5, 0, Math.PI * 2
    );
    ctx.fill();

    // AI Enemy
    if (aiEnabled) {
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#ff0088';
        ctx.fillStyle = '#ff0088';
        ctx.fillRect(ai.x * CELL_SIZE + 4, ai.y * CELL_SIZE + 4, CELL_SIZE - 8, CELL_SIZE - 8);
        ctx.shadowBlur = 0;
    }

    // Projectiles
    ctx.fillStyle = '#ff4400';
    projectiles.forEach(p => {
        ctx.fillRect(p.x - 4, p.y - 4, 8, 8);
    });

    // Win / Lose messages
    if (gameWon) {
        ctx.fillStyle = 'rgba(0,255,100,0.9)';
        ctx.font = 'bold 48px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.fillText('AMAZING!', canvas.width / 2, canvas.height / 2);
    }

    if (gameOver) {
        ctx.fillStyle = 'rgba(255,0,80,0.9)';
        ctx.font = 'bold 42px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.fillText('HIT! RESTART', canvas.width / 2, canvas.height / 2);
    }
}

// ============== PLAYER MOVEMENT ==============
function movePlayer(dx, dy) {
    if (gameWon || gameOver) return;

    const now = Date.now();
    if (now - lastPlayerMove < 70 / playerSpeed) return; // speed control

    const nx = player.x + dx;
    const ny = player.y + dy;

    if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS || maze[ny][nx] === 1) return;

    player.x = nx;
    player.y = ny;
    lastPlayerMove = now;

    // Collect powerups
    powerups = powerups.filter(p => {
        if (p.x === player.x && p.y === player.y) {
            if (p.type === 'speed') playerSpeed = 1.8;
            else hasStickyGun = true;
            return false;
        }
        return true;
    });

    checkWin();
    draw();
}

function checkWin() {
    if (player.x === exit.x && player.y === exit.y) {
        gameWon = true;
        const time = (Date.now() - startTime) / 1000;

        if (time < bestTime) bestTime = time;
        totalCompleted++;

        localStorage.setItem('mazeBest', bestTime);
        localStorage.setItem('mazeCompleted', totalCompleted);

        document.getElementById('best').textContent = bestTime.toFixed(1);
        document.getElementById('completed').textContent = totalCompleted;

        clearInterval(timerInterval);
    }
}

// ============== AI ==============
function updateAI() {
    if (!aiEnabled || gameWon || gameOver) return;

    const dx = player.x - ai.x;
    const dy = player.y - ai.y;

    let moved = false;

    // Prefer stronger axis
    if (Math.abs(dx) > Math.abs(dy)) {
        const dir = Math.sign(dx);
        if (isOpen(Math.floor(ai.x + dir), Math.floor(ai.y))) {
            ai.x += dir * 0.13;
            moved = true;
        }
    } else {
        const dir = Math.sign(dy);
        if (isOpen(Math.floor(ai.x), Math.floor(ai.y + dir))) {
            ai.y += dir * 0.13;
            moved = true;
        }
    }

    // Random movement if stuck
    if (!moved && Math.random() < 0.12) {
        const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
        const [tx, ty] = dirs[Math.floor(Math.random() * dirs.length)];
        if (isOpen(Math.floor(ai.x + tx), Math.floor(ai.y + ty))) {
            ai.x += tx * 0.1;
            ai.y += ty * 0.1;
        }
    }

    // Shooting
    if (Math.random() < 0.028) {
        projectiles.push({
            x: ai.x * CELL_SIZE + CELL_SIZE / 2,
            y: ai.y * CELL_SIZE + CELL_SIZE / 2,
            dx: Math.sign(player.x - ai.x) * 6,
            dy: Math.sign(player.y - ai.y) * 6
        });
    }

    // Direct collision
    if (Math.floor(ai.x) === player.x && Math.floor(ai.y) === player.y) {
        gameOver = true;
        clearInterval(timerInterval);
        setTimeout(resetGame, 1200);
    }
}

// ============== PROJECTILES ==============
function updateProjectiles() {
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        p.x += p.dx;
        p.y += p.dy;

        const gridX = Math.floor(p.x / CELL_SIZE);
        const gridY = Math.floor(p.y / CELL_SIZE);

        // Hit player
        if (gridX === player.x && gridY === player.y) {
            gameOver = true;
            clearInterval(timerInterval);
            setTimeout(resetGame, 1500);
            return;
        }

        // Hit wall or out of bounds
        if (!isOpen(gridX, gridY) || 
            p.x < 0 || p.x > canvas.width || 
            p.y < 0 || p.y > canvas.height) {
            projectiles.splice(i, 1);
        }
    }
}

// ============== GAME LOOP ==============
function gameLoop() {
    updateAI();
    updateProjectiles();
    draw();
}

// ============== TIMER ==============
function startTimer() {
    startTime = Date.now();
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if (gameWon || gameOver) return;
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        document.getElementById('timer').textContent = elapsed;
    }, 80);
}

// ============== RESET ==============
function resetGame() {
    gameWon = false;
    gameOver = false;
    playerSpeed = 1;
    hasStickyGun = false;

    generateMaze();
    startTimer();
    draw();
}

function toggleAI() {
    aiEnabled = document.getElementById('aiCheckbox').checked;
}

// ============== CONTROLS ==============
window.addEventListener('keydown', e => {
    if (gameWon || gameOver) return;

    switch (e.key.toLowerCase()) {
        case 'arrowup':
        case 'w': movePlayer(0, -1); break;
        case 'arrowdown':
        case 's': movePlayer(0, 1); break;
        case 'arrowleft':
        case 'a': movePlayer(-1, 0); break;
        case 'arrowright':
        case 'd': movePlayer(1, 0); break;
    }
});

// ============== STICKY GUN ==============
canvas.addEventListener('click', () => {
    if (hasStickyGun && aiEnabled) {
        ai.x = player.x; // teleport AI close for fun
        ai.y = player.y;
        hasStickyGun = false;
        playNote(800, 150, 'square', 0.3); // from your audio code
    }
});

// ============== EXPOSE TO HTML ==============
window.resetGame = resetGame;
window.toggleAI = toggleAI;

// ============== INIT ==============
document.getElementById('best').textContent = bestTime === Infinity ? '—' : bestTime.toFixed(1);
document.getElementById('completed').textContent = totalCompleted;

resetGame();
setInterval(gameLoop, 40);   // smoother than 50ms
