// =============================================
// A MAZE ZING! - Fixed Shooting + Shield
// =============================================

let canvas, ctx, bgCanvas, bgCtx;
let maze = [], player = { x: 1, y: 1 }, exit = { x: 37, y: 27 };
let gameWon = false, gameOver = false;
let startTime = 0, timerInterval = null;
let bestTime = localStorage.getItem('mazeBest') ? parseFloat(localStorage.getItem('mazeBest')) : Infinity;
let totalCompleted = parseInt(localStorage.getItem('mazeCompleted') || '0');
let currentLevel = parseInt(localStorage.getItem('mazeLevel') || '1');

let aiEnabled = true;
let ai = { x: 35, y: 25, stunnedUntil: 0 };

let projectiles = [], playerProjectiles = [], powerups = [];
let playerSpeed = 1, hasStickyGun = false, lastPlayerMove = 0;

let shieldActive = false;
let shieldEndTime = 0;
const MAX_SHIELD_TIME = 15000;

const CELL_SIZE = 20, COLS = 40, ROWS = 30;
let currentSeed = Date.now();
let mouseX = 400, mouseY = 300;

// ============== INIT ==============
document.addEventListener('DOMContentLoaded', initAll);

function initAll() {
    canvas = document.getElementById('game');
    ctx = canvas.getContext('2d');
    bgCanvas = document.getElementById('bg-canvas');
    bgCtx = bgCanvas.getContext('2d');

    document.getElementById('level').textContent = currentLevel;

    initBackground();
    initMouseControls();
    initGame();
}

// ============== BACKGROUND + AUDIO (unchanged) ==============
let particles = [];
class Particle { /* ... same as before ... */ }
function initBackground() { /* ... */ }
function animateBG() { /* ... */ }

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playNote(freq, duration, type = 'sine', vol = 0.2) { /* ... */ }
let musicInterval;
function startMusic() { /* ... */ }

// ============== MAZE GENERATION (same) ==============
function seededRandom(seed) { let x = Math.sin(seed++) * 10000; return x - Math.floor(x); }
/* generateMaze, clearArea, placePowerups, isOpen, isSolvable, getTheme - same as previous large version */

// ============== DRAW ==============
function draw() { /* full draw function from previous response with shield and projectiles */ }

// ============== GAME LOGIC ==============
function movePlayer(dx, dy) { /* ... */ }
function checkWin() { /* ... */ }
function updateAI() { /* ... */ }
function updateProjectiles() { /* ... */ }
function updatePlayerProjectiles() { /* ... */ }
function gameLoop() {
    updateAI();
    updateProjectiles();
    updatePlayerProjectiles();
    draw();
}
function startTimer() { /* ... */ }
function resetGame(seed = null) { /* ... */ }
function toggleAI() { aiEnabled = document.getElementById('aiCheckbox').checked; }

// ============== SHOOTING ==============
function shootPlayerProjectile() {
    const centerX = player.x * CELL_SIZE + CELL_SIZE / 2;
    const centerY = player.y * CELL_SIZE + CELL_SIZE / 2;

    const dx = mouseX - centerX;
    const dy = mouseY - centerY;
    const dist = Math.sqrt(dx*dx + dy*dy) || 1;

    playerProjectiles.push({
        x: centerX, y: centerY,
        dx: (dx / dist) * 9,
        dy: (dy / dist) * 9,
        life: 140
    });
    playNote(650, 60, 'square', 0.35);
}

// ============== MOUSE CONTROLS (Fixed) ==============
function initMouseControls() {
    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        mouseX = e.clientX - rect.left;
        mouseY = e.clientY - rect.top;
    });

    canvas.addEventListener('mousedown', (e) => {
        if (gameWon || gameOver) return;
        if (e.button === 0) shootPlayerProjectile();           // Left click = shoot
    });

    // Right click hold = shield
    document.addEventListener('mousedown', (e) => {
        if (e.button === 2 && !gameWon && !gameOver) {
            const now = Date.now();
            if (now > shieldEndTime) {
                shieldActive = true;
                shieldEndTime = now + MAX_SHIELD_TIME;
            }
        }
    });

    document.addEventListener('mouseup', (e) => {
        if (e.button === 2) shieldActive = false;
    });

    canvas.addEventListener('contextmenu', e => e.preventDefault());
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
    setInterval(gameLoop, 30);

    // Keyboard movement
    window.addEventListener('keydown', e => {
        if (gameWon || gameOver) return;
        switch(e.key.toLowerCase()) {
            case 'arrowup': case 'w': movePlayer(0, -1); break;
            case 'arrowdown': case 's': movePlayer(0, 1); break;
            case 'arrowleft': case 'a': movePlayer(-1, 0); break;
            case 'arrowright': case 'd': movePlayer(1, 0); break;
        }
    });
}
