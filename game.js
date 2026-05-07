// =============================================
// A MAZE ZING! - Polished + Procedural Campaign
// =============================================

let canvas, ctx, bgCanvas, bgCtx;
let maze = [], player = { x: 1, y: 1 }, exit = { x: 23, y: 18 };
let gameWon = false, gameOver = false;
let startTime = 0, timerInterval = null;
let bestTime = localStorage.getItem('mazeBest') ? parseFloat(localStorage.getItem('mazeBest')) : Infinity;
let totalCompleted = parseInt(localStorage.getItem('mazeCompleted') || '0');
let currentLevel = parseInt(localStorage.getItem('mazeLevel') || '1');

let aiEnabled = true;
let ai = { x: 21, y: 16 };

let projectiles = [], powerups = [];
let playerSpeed = 1, hasStickyGun = false, lastPlayerMove = 0;

const CELL_SIZE = 24, COLS = 25, ROWS = 20;
let currentSeed = Date.now();

// ============== INIT ==============
document.addEventListener('DOMContentLoaded', () => {
    canvas = document.getElementById('game');
    ctx = canvas.getContext('2d');
    bgCanvas = document.getElementById('bg-canvas');
    bgCtx = bgCanvas.getContext('2d');

    initBackground();
    initGame();
});

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
        osc.type = type; osc.frequency.value = freq;
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

// ============== PROCEDURAL MAZE GENERATION ==============
function seededRandom(seed) {
    let x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
}

function generateMaze(level = 1, seed = null) {
    if (seed) currentSeed = seed;
    else currentSeed = Date.now();

    maze = Array(ROWS).fill().map(() => Array(COLS).fill(1));
    player.x = 1; player.y = 1;

    const rng = () => seededRandom(currentSeed++);

    // Core recursive backtracker
    function carve(x, y) {
        maze[y][x] = 0;
        const dirs = [[0,-2],[2,0],[0,2],[-2,0]].sort(() => rng()-0.5);
        for (let [dx, dy] of dirs) {
            const nx = x + dx, ny = y + dy;
            if (nx > 0 && nx < COLS-1 && ny > 0 && ny < ROWS-1 && maze[ny][nx] === 1) {
                maze[y + (dy/2)|0][x + (dx/2)|0] = 0;
                carve(nx, ny);
            }
        }
    }
    carve(1, 1);

    // Rooms
    const roomCount = 3 + Math.floor(level / 2);
    for (let i = 0; i < roomCount; i++) {
        const rx = 3 + Math.floor(rng() * (COLS - 10));
        const ry = 3 + Math.floor(rng() * (ROWS - 10));
        const rw = 3 + Math.floor(rng() * 5);
        const rh = 3 + Math.floor(rng() * 5);
        for (let y = ry; y < ry + rh && y < ROWS; y++)
            for (let x = rx; x < rx + rw && x < COLS; x++)
                maze[y][x] = 0;
    }

    // Extra complexity
    const complexity = 8 + level * 6;
    for (let i = 0; i < complexity; i++) {
        const x = 2 + Math.floor(rng() * (COLS-4));
        const y = 2 + Math.floor(rng() * (ROWS-4));
        if (rng() < 0.65) maze[y][x] = 1;
    }

    // Clear start & exit
    clearArea(1, 1, 3);
    clearArea(COLS-3, ROWS-3, 3);
    maze[exit.y][exit.x] = 0;

    // Safe AI spawn
    ai.x = COLS - 4; ai.y = ROWS - 4;
    if (!isOpen(Math.floor(ai.x), Math.floor(ai.y))) {
        ai.x = COLS - 6; ai.y = ROWS - 5;
    }

    placePowerups(5);

    // Guarantee solvable
    if (!isSolvable()) {
        console.log("Regenerating unsolvable maze...");
        generateMaze(level, seed || Date.now() + 1);
    }
}

function clearArea(cx, cy, radius) {
    for (let y = cy - radius; y <= cy + radius; y++) {
        for (let x = cx - radius; x <= cx + radius; x++) {
            if (x >= 0 && x < COLS && y >= 0 && y < ROWS) maze[y][x] = 0;
        }
    }
}

function placePowerups(count) {
    powerups = [];
    for (let i = 0; i < count; i++) {
        let px, py, attempts = 0;
        do {
            px = 3 + Math.floor(seededRandom(currentSeed++) * (COLS - 6));
            py = 3 + Math.floor(seededRandom(currentSeed++) * (ROWS - 6));
            attempts++;
        } while (!isOpen(px, py) && attempts < 60);
        if (isOpen(px, py)) {
            powerups.push({x: px, y: py, type: Math.random() > 0.5 ? 'speed' : 'gun'});
        }
    }
}

function isOpen(x, y) {
    return x >= 0 && x < COLS && y >= 0 && y < ROWS && maze[y][x] === 0;
}

// ============== SOLVABILITY CHECK (BFS) ==============
function isSolvable() {
    const visited = Array(ROWS).fill().map(() => Array(COLS).fill(false));
    const queue = [{x: player.x, y: player.y}];
    visited[player.y][player.x] = true;

    const dirs = [[0,1],[1,0],[0,-1],[-1,0]];

    while (queue.length) {
        const {x, y} = queue.shift();
        if (x === exit.x && y === exit.y) return true;

        for (let [dx, dy] of dirs) {
            const nx = x + dx, ny = y + dy;
            if (isOpen(nx, ny) && !visited[ny][nx]) {
                visited[ny][nx] = true;
                queue.push({x: nx, y: ny});
            }
        }
    }
    return false;
}

// ============== THEMED DRAWING ==============
function getTheme(level) {
    const themes = [
        {wall: '#440044', path: '#0a001f', name: "NEON VOID"},
        {wall: '#004400', path: '#001a00', name: "TOXIC JUNGLE"},
        {wall: '#440000', path: '#1a0000', name: "CRIMSON DEPTHS"},
        {wall: '#444400', path: '#1a1a00', name: "GOLDEN RUINS"}
    ];
    return themes[(level-1) % themes.length];
}

function draw() {
    const theme = getTheme(currentLevel);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Maze
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            ctx.fillStyle = maze[y][x] ? theme.wall : theme.path;
            ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        }
    }

    // Exit
    ctx.fillStyle = '#00ff88';
    ctx.fillRect(exit.x*CELL_SIZE+4, exit.y*CELL_SIZE+4, CELL_SIZE-8, CELL_SIZE-8);

    // Powerups
    powerups.forEach(p => {
        ctx.fillStyle = p.type === 'speed' ? '#ffff00' : '#00ffff';
        ctx.fillRect(p.x*CELL_SIZE+8, p.y*CELL_SIZE+8, CELL_SIZE-16, CELL_SIZE-16);
    });

    // Player
    ctx.fillStyle = '#00ffff';
    ctx.beginPath();
    ctx.arc(player.x*CELL_SIZE + CELL_SIZE/2, player.y*CELL_SIZE + CELL_SIZE/2, CELL_SIZE/2 - 5, 0, Math.PI*2);
    ctx.fill();

    // AI
    if (aiEnabled) {
        ctx.shadowBlur = 25; ctx.shadowColor = '#ff0088';
        ctx.fillStyle = '#ff0088';
        ctx.fillRect(ai.x*CELL_SIZE + 4, ai.y*CELL_SIZE + 4, CELL_SIZE-8, CELL_SIZE-8);
        ctx.shadowBlur = 0;
    }

    // Projectiles
    ctx.shadowBlur = 12; ctx.shadowColor = '#ff4400';
    ctx.fillStyle = '#ff4400';
    projectiles.forEach(p => ctx.fillRect(p.x-4, p.y-4, 8, 8));
    ctx.shadowBlur = 0;

    ctx.textAlign = 'center';
    if (gameWon) {
        ctx.fillStyle = 'rgba(0,255,100,0.95)';
        ctx.font = 'bold 48px "Press Start 2P"';
        ctx.fillText('AMAZING!', canvas.width/2, canvas.height/2 - 20);
        ctx.font = 'bold 20px "Press Start 2P"';
        ctx.fillText(`LEVEL ${currentLevel} COMPLETE`, canvas.width/2, canvas.height/2 + 30);
    }
    if (gameOver) {
        ctx.fillStyle = 'rgba(255,0,80,0.95)';
        ctx.font = 'bold 42px "Press Start 2P"';
        ctx.fillText('HIT!', canvas.width/2, canvas.height/2);
    }
}

// ============== GAME LOGIC (unchanged core) ==============
function movePlayer(dx, dy) { /* ... same as previous polished version ... */ }
function checkWin() {
    if (player.x === exit.x && player.y === exit.y) {
        gameWon = true;
        const time = (Date.now() - startTime) / 1000;
        if (time < bestTime) bestTime = time;
        totalCompleted++;
        currentLevel++;

        localStorage.setItem('mazeBest', bestTime);
        localStorage.setItem('mazeCompleted', totalCompleted);
        localStorage.setItem('mazeLevel', currentLevel);

        document.getElementById('best').textContent = bestTime.toFixed(1);
        document.getElementById('completed').textContent = totalCompleted;
        clearInterval(timerInterval);
    }
}

// ... (updateAI, updateProjectiles, gameLoop, startTimer, resetGame, toggleAI remain the same as last version)

function resetGame(seed = null) {
    gameWon = false; gameOver = false;
    playerSpeed = 1; hasStickyGun = false;
    const difficulty = Math.min(4, Math.floor((currentLevel-1) / 6) + 1);
    generateMaze(currentLevel, seed);
    startTimer();
    draw();
}

function toggleAI() {
    aiEnabled = document.getElementById('aiCheckbox').checked;
}

// ============== FULL INIT ==============
function initGame() {
    window.resetGame = resetGame;
    window.toggleAI = toggleAI;

    document.getElementById('best').textContent = bestTime === Infinity ? '—' : bestTime.toFixed(1);
    document.getElementById('completed').textContent = totalCompleted;

    document.body.addEventListener('click', () => {
        if (!musicInterval) startMusic();
    }, { once: true });

    resetGame();
    setInterval(gameLoop, 35);

    // Keyboard
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
            ai.x = player.x; ai.y = player.y;
            hasStickyGun = false;
            playNote(900, 120, 'square', 0.4);
        }
    });
}

// Note: I kept movePlayer, updateAI, etc. from the previous polished version.
// If you need me to paste the full file with every single function, just say "full file" and I'll expand it.
