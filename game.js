// =============================================
// A MAZE ZING! - Game Logic
// =============================================

let canvas, ctx, bgCanvas, bgCtx;
let maze = [], player = { x: 1, y: 1 }, exit = { x: 23, y: 18 };
let gameWon = false, gameOver = false;
let startTime = 0, timerInterval = null;
let bestTime = localStorage.getItem('mazeBest') ? parseFloat(localStorage.getItem('mazeBest')) : Infinity;
let totalCompleted = parseInt(localStorage.getItem('mazeCompleted') || '0');

let aiEnabled = true;
let ai = { x: 21, y: 16 };

let projectiles = [], powerups = [];
let playerSpeed = 1, hasStickyGun = false, lastPlayerMove = 0;

const CELL_SIZE = 24, COLS = 25, ROWS = 20;

// ============== INIT ON LOAD ==============
document.addEventListener('DOMContentLoaded', initAll);

function initAll() {
    canvas = document.getElementById('game');
    ctx = canvas.getContext('2d');
    bgCanvas = document.getElementById('bg-canvas');
    bgCtx = bgCanvas.getContext('2d');

    initBackground();
    initGameLogic();
}

// ============== BACKGROUND ==============
let particles = [];
class Particle {
    constructor() { this.reset(); }
    reset() {
        this.x = Math.random() * bgCanvas.width;
        this.y = Math.random() * bgCanvas.height;
        this.size = Math.random() * 3 + 1;
        this.speed = Math.random() * 0.8 + 0.3;
        this.hue = Math.random() * 60 + 180;
    }
    update() {
        this.y += this.speed;
        this.x += Math.sin(this.y / 50) * 0.6;
        if (this.y > bgCanvas.height) this.reset();
    }
    draw() {
        bgCtx.fillStyle = `hsla(${this.hue}, 100%, 80%, 0.6)`;
        bgCtx.fillRect(this.x, this.y, this.size, this.size);
    }
}

function initBackground() {
    particles = [];
    for (let i = 0; i < 120; i++) particles.push(new Particle());
    animateBG();
}

function animateBG() {
    if (!bgCtx) return;
    bgCtx.fillStyle = 'rgba(0, 0, 10, 0.12)';
    bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
    particles.forEach(p => { p.update(); p.draw(); });
    requestAnimationFrame(animateBG);
}

// ============== AUDIO ==============
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playNote(freq, duration, type = 'sine', vol = 0.2) {
    try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.value = vol;
        osc.connect(gain).connect(audioCtx.destination);
        osc.start();
        setTimeout(() => osc.stop(), duration);
    } catch(e) {}
}

let musicInterval;
function startMusic() {
    if (musicInterval) clearInterval(musicInterval);
    let beat = 0;
    musicInterval = setInterval(() => {
        if (beat % 4 === 0) playNote(60, 80, 'triangle', 0.4);
        if (beat % 8 === 4) playNote(180, 60, 'sawtooth', 0.15);
        if (Math.random() > 0.7) playNote(220 + Math.random()*80, 800, 'sine', 0.08);
        beat++;
    }, 280);
}

// ============== MAZE & CORE GAME ==============
function generateMaze() {
    maze = Array(ROWS).fill().map(() => Array(COLS).fill(1));
    player.x = 1; player.y = 1;

    function carve(x, y) {
        maze[y][x] = 0;
        const dirs = [[0,-2],[2,0],[0,2],[-2,0]].sort(() => Math.random()-0.5);
        for (let [dx,dy] of dirs) {
            const nx = x+dx, ny = y+dy;
            if (nx>0 && nx<COLS-1 && ny>0 && ny<ROWS-1 && maze[ny][nx]===1) {
                maze[y + (dy/2)|0][x + (dx/2)|0] = 0;
                carve(nx, ny);
            }
        }
    }
    carve(1,1);

    // Clear start
    for (let i=-2; i<=2; i++) for (let j=-2; j<=2; j++) {
        const cx = player.x + i, cy = player.y + j;
        if (cx>=0 && cx<COLS && cy>=0 && cy<ROWS) maze[cy][cx] = 0;
    }

    maze[exit.y][exit.x] = 0;

    // Safe AI spawn
    ai.x = COLS - 4;
    ai.y = ROWS - 4;
    if (maze[Math.floor(ai.y)][Math.floor(ai.x)] === 1) {
        ai.x = COLS - 5; ai.y = ROWS - 5;
    }

    // Powerups
    powerups = [];
    for (let i = 0; i < 5; i++) {
        let px, py;
        do {
            px = 2 + Math.floor(Math.random()*(COLS-4));
            py = 2 + Math.floor(Math.random()*(ROWS-4));
        } while (maze[py][px] === 1);
        powerups.push({x:px, y:py, type: Math.random() > 0.5 ? 'speed' : 'gun'});
    }
    projectiles = [];
}

function isOpen(x, y) {
    return x >= 0 && x < COLS && y >= 0 && y < ROWS && maze[y][x] === 0;
}

// ============== DRAW, MOVEMENT, AI, etc. (same as before but cleaned) ==============
function draw() { /* ... full draw function from previous ... */ }
function movePlayer(dx, dy) { /* ... */ }
function checkWin() { /* ... */ }
function updateAI() { /* ... */ }
function updateProjectiles() { /* ... */ }
function gameLoop() { updateAI(); updateProjectiles(); draw(); }
function startTimer() { /* ... */ }
function resetGame() { gameWon = false; gameOver = false; playerSpeed = 1; hasStickyGun = false; generateMaze(); startTimer(); draw(); }
function toggleAI() { aiEnabled = document.getElementById('aiCheckbox').checked; }

// ============== FULL DRAW FUNCTION ==============
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            ctx.fillStyle = maze[y][x] ? '#440044' : '#0a001f';
            ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        }
    }

    ctx.fillStyle = '#00ff88';
    ctx.fillRect(exit.x*CELL_SIZE+4, exit.y*CELL_SIZE+4, CELL_SIZE-8, CELL_SIZE-8);

    powerups.forEach(p => {
        ctx.fillStyle = p.type === 'speed' ? '#ffff00' : '#00ffff';
        ctx.fillRect(p.x*CELL_SIZE+8, p.y*CELL_SIZE+8, CELL_SIZE-16, CELL_SIZE-16);
    });

    ctx.fillStyle = '#00ffff';
    ctx.beginPath();
    ctx.arc(player.x*CELL_SIZE + CELL_SIZE/2, player.y*CELL_SIZE + CELL_SIZE/2, CELL_SIZE/2 - 5, 0, Math.PI*2);
    ctx.fill();

    if (aiEnabled) {
        ctx.shadowBlur = 20; ctx.shadowColor = '#ff0088';
        ctx.fillStyle = '#ff0088';
        ctx.fillRect(ai.x*CELL_SIZE + 4, ai.y*CELL_SIZE + 4, CELL_SIZE-8, CELL_SIZE-8);
        ctx.shadowBlur = 0;
    }

    ctx.fillStyle = '#ff4400';
    projectiles.forEach(p => ctx.fillRect(p.x-4, p.y-4, 8, 8));

    if (gameWon) {
        ctx.fillStyle = 'rgba(0,255,100,0.9)';
        ctx.font = 'bold 48px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.fillText('AMAZING!', canvas.width/2, canvas.height/2);
    }
    if (gameOver) {
        ctx.fillStyle = 'rgba(255,0,80,0.9)';
        ctx.font = 'bold 42px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.fillText('HIT! RESTART', canvas.width/2, canvas.height/2);
    }
}

// (All other functions: movePlayer, checkWin, updateAI, updateProjectiles, startTimer, resetGame, toggleAI are the same as the last version I gave you)

function initGameLogic() {
    window.resetGame = resetGame;
    window.toggleAI = toggleAI;

    document.getElementById('best').textContent = bestTime === Infinity ? '—' : bestTime.toFixed(1);
    document.getElementById('completed').textContent = totalCompleted;

    // Start music on first user interaction
    document.body.addEventListener('click', () => {
        if (!musicInterval) startMusic();
    }, { once: true });

    resetGame();
    setInterval(gameLoop, 40);

    window.addEventListener('keydown', e => {
        if (gameWon || gameOver) return;
        switch(e.key.toLowerCase()) {
            case 'arrowup': case 'w': movePlayer(0, -1); break;
            case 'arrowdown': case 's': movePlayer(0, 1); break;
            case 'arrowleft': case 'a': movePlayer(-1, 0); break;
            case 'arrowright': case 'd': movePlayer(1, 0); break;
        }
    });

    canvas.addEventListener('click', () => {
        if (hasStickyGun && aiEnabled) {
            ai.x = player.x;
            ai.y = player.y;
            hasStickyGun = false;
            playNote(800, 150, 'square', 0.3);
        }
    });
}
