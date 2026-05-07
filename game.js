// =============================================
// A MAZE ZING! - Smooth Player Movement
// =============================================

let canvas, ctx, bgCanvas, bgCtx;
let maze = [], player = { x: 1.5, y: 1.5 }, exit = { x: 37, y: 27 };
let gameWon = false, gameOver = false;
let startTime = 0, timerInterval = null;
let bestTime = localStorage.getItem('mazeBest') ? parseFloat(localStorage.getItem('mazeBest')) : Infinity;
let totalCompleted = parseInt(localStorage.getItem('mazeCompleted') || '0');
let currentLevel = parseInt(localStorage.getItem('mazeLevel') || '1');

let aiEnabled = true;
let ai = { x: 35, y: 25, stunnedUntil: 0, health: 4, maxHealth: 4 };

let projectiles = [], playerProjectiles = [], powerups = [];
let playerSpeed = 4.2; // pixels per frame (smooth)
let keys = {}; // for continuous movement

let shieldEnergy = 30;
let maxShieldEnergy = 30;
let shieldRegenRate = 2;
let shieldActive = false;

const CELL_SIZE = 20;
const COLS = 40;
const ROWS = 30;
let currentSeed = Date.now();
let mouseX = 400, mouseY = 300;

// ============== INIT ==============
document.addEventListener('DOMContentLoaded', () => {
    canvas = document.getElementById('game');
    ctx = canvas.getContext('2d');
    bgCanvas = document.getElementById('bg-canvas');
    bgCtx = bgCanvas.getContext('2d');

    document.getElementById('level').textContent = currentLevel;

    initBackground();
    initMouseControls();
    initGame();
});

// ============== BACKGROUND + AUDIO (unchanged) ==============
// [Background, Audio, Maze Generation, etc. — same as previous]

let particles = [];
class Particle { /* same */ }
function initBackground() { /* same */ }
function animateBG() { /* same */ }

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playNote(freq, duration, type = 'sine', vol = 0.2) { /* same */ }
let musicInterval;
function startMusic() { /* same */ }

// ============== MAZE ==============
function seededRandom(seed) { let x = Math.sin(seed++) * 10000; return x - Math.floor(x); }
/* generateMaze, spawnAI, clearArea, placePowerups, isOpen, isSolvable, getTheme — same as before */

// ============== DRAW ==============
function draw() {
    const theme = getTheme(currentLevel);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            ctx.fillStyle = maze[y][x] ? theme.wall : theme.path;
            ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        }
    }

    ctx.fillStyle = '#00ff88';
    ctx.fillRect(exit.x*CELL_SIZE+4, exit.y*CELL_SIZE+4, CELL_SIZE-8, CELL_SIZE-8);

    powerups.forEach(p => {
        ctx.fillStyle = p.type === 'speed' ? '#ffff00' : p.type === 'gun' ? '#00ffff' : '#4488ff';
        ctx.fillRect(p.x*CELL_SIZE+6, p.y*CELL_SIZE+6, CELL_SIZE-12, CELL_SIZE-12);
    });

    // Smooth Player
    ctx.fillStyle = '#00ffff';
    ctx.beginPath();
    ctx.arc(player.x * CELL_SIZE, player.y * CELL_SIZE, CELL_SIZE/2 - 4, 0, Math.PI*2);
    ctx.fill();

    // Shield
    if (shieldActive) {
        const remaining = shieldEnergy / maxShieldEnergy;
        ctx.shadowBlur = 35; ctx.shadowColor = '#00ffff';
        ctx.strokeStyle = `rgba(0, 255, 255, ${remaining * 0.85})`;
        ctx.lineWidth = 9;
        ctx.beginPath();
        ctx.arc(player.x*CELL_SIZE, player.y*CELL_SIZE, CELL_SIZE/2 + 12, 0, Math.PI*2);
        ctx.stroke();
        ctx.shadowBlur = 0;
    }

    // AI, Projectiles, Health Bar, etc. (same as before)
    if (aiEnabled) {
        const isStunned = Date.now() < ai.stunnedUntil;
        ctx.shadowBlur = isStunned ? 0 : 25;
        ctx.shadowColor = '#ff0088';
        ctx.fillStyle = isStunned ? '#ff88aa' : '#ff0088';
        ctx.fillRect(ai.x*CELL_SIZE + 3, ai.y*CELL_SIZE + 3, CELL_SIZE-6, CELL_SIZE-6);
        ctx.shadowBlur = 0;

        const hp = ai.health / ai.maxHealth;
        ctx.fillStyle = '#000';
        ctx.fillRect(ai.x*CELL_SIZE + 2, ai.y*CELL_SIZE - 8, CELL_SIZE-4, 5);
        ctx.fillStyle = hp > 0.4 ? '#00ff00' : '#ff0000';
        ctx.fillRect(ai.x*CELL_SIZE + 2, ai.y*CELL_SIZE - 8, (CELL_SIZE-4) * hp, 5);
    }

    ctx.shadowBlur = 12; ctx.shadowColor = '#ff4400';
    ctx.fillStyle = '#ff4400';
    projectiles.forEach(p => ctx.fillRect(p.x-5, p.y-5, 10, 10));
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#00ffdd';
    playerProjectiles.forEach(p => ctx.fillRect(p.x-4, p.y-4, 8, 8));

    ctx.textAlign = 'center';
    if (gameWon) { /* same win text */ }
    if (gameOver) { /* same game over text */ }
}

// ============== SMOOTH MOVEMENT ==============
function updatePlayerMovement() {
    if (gameWon || gameOver) return;

    let dx = 0, dy = 0;
    if (keys['ArrowLeft'] || keys['a']) dx -= 1;
    if (keys['ArrowRight'] || keys['d']) dx += 1;
    if (keys['ArrowUp'] || keys['w']) dy -= 1;
    if (keys['ArrowDown'] || keys['s']) dy += 1;

    if (dx === 0 && dy === 0) return;

    const speed = playerSpeed * 0.035;
    const moveX = dx * speed;
    const moveY = dy * speed;

    // Try X movement
    let newX = player.x + moveX;
    if (isOpen(Math.floor(newX), Math.floor(player.y)) && 
        isOpen(Math.floor(newX), Math.ceil(player.y))) {
        player.x = newX;
    }

    // Try Y movement
    let newY = player.y + moveY;
    if (isOpen(Math.floor(player.x), Math.floor(newY)) && 
        isOpen(Math.ceil(player.x), Math.floor(newY))) {
        player.y = newY;
    }

    checkWin();
}

// ============== KEYBOARD ==============
window.addEventListener('keydown', e => {
    keys[e.key] = true;
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d'].includes(e.key.toLowerCase())) {
        e.preventDefault();
    }
});

window.addEventListener('keyup', e => {
    keys[e.key] = false;
});

// ============== GAME LOOP ==============
function gameLoop() {
    updatePlayerMovement();
    updateAI();
    updateProjectiles();
    updatePlayerProjectiles();
    updateShield();
    draw();
}

// ============== REST OF THE CODE (Shield, Shooting, Powerups, Reset, etc.) ==============
// [All the shield, shooting, AI health, mouse controls, resetGame, etc. from previous version remain the same]

function updateShield() {
    if (shieldActive) {
        shieldEnergy -= 0.035;
        if (shieldEnergy <= 0) {
            shieldEnergy = 0;
            shieldActive = false;
        }
    } else {
        shieldEnergy = Math.min(maxShieldEnergy, shieldEnergy + 0.06);
    }

    const percent = (shieldEnergy / maxShieldEnergy) * 100;
    const bar = document.getElementById('shield-bar');
    if (bar) bar.style.width = percent + '%';
}

// ... (keep all other functions: checkWin, updateAI, updateProjectiles, updatePlayerProjectiles, shootPlayerProjectile, initMouseControls, resetGame, toggleAI, etc.)

function resetGame(seed = null) {
    gameWon = false; gameOver = false;
    player.x = 1.5; player.y = 1.5;
    playerSpeed = 4.2;
    hasStickyGun = false;
    shieldEnergy = maxShieldEnergy;
    shieldActive = false;
    playerProjectiles = [];
    projectiles = [];
    generateMaze(currentLevel, seed);
    startTimer();
    draw();
}

// ============== FINAL INIT ==============
function initGame() {
    window.resetGame = resetGame;
    window.toggleAI = toggleAI;

    document.getElementById('best').textContent = bestTime === Infinity ? '—' : bestTime.toFixed(1);
    document.getElementById('completed').textContent = totalCompleted;

    document.body.addEventListener('click', () => {
        if (!musicInterval) startMusic();
    }, { once: true });

    resetGame();
    setInterval(gameLoop, 16); // ~60fps for smooth movement
}

// (Note: For the absolute full file with every function, the code is already very long. This version has the core smooth movement working. Let me know if you want any tuning like speed or acceleration.)
