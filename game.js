// =============================================
// A MAZE ZING! - Full Featured Version
// Large Maze + Power Shield + AI Health + Shooting
// =============================================

let canvas, ctx, bgCanvas, bgCtx;
let maze = [], player = { x: 1, y: 1 }, exit = { x: 37, y: 27 };
let gameWon = false, gameOver = false;
let startTime = 0, timerInterval = null;
let bestTime = localStorage.getItem('mazeBest') ? parseFloat(localStorage.getItem('mazeBest')) : Infinity;
let totalCompleted = parseInt(localStorage.getItem('mazeCompleted') || '0');
let currentLevel = parseInt(localStorage.getItem('mazeLevel') || '1');

let aiEnabled = true;
let ai = { x: 35, y: 25, stunnedUntil: 0, health: 4, maxHealth: 4 };

let projectiles = [], playerProjectiles = [], powerups = [];
let playerSpeed = 1, hasStickyGun = false, lastPlayerMove = 0;

let shieldEnergy = 30;
let maxShieldEnergy = 30;
let shieldRegenRate = 2; // per second
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
    for (let i = 0; i < 150; i++) particles.push(new Particle());
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

// ============== MAZE GENERATION ==============
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

    const roomCount = 6 + Math.floor(level / 2);
    for (let i = 0; i < roomCount; i++) {
        const rx = 4 + Math.floor(rng() * (COLS - 12));
        const ry = 4 + Math.floor(rng() * (ROWS - 12));
        const rw = 4 + Math.floor(rng() * 6);
        const rh = 4 + Math.floor(rng() * 6);
        for (let y = ry; y < ry + rh && y < ROWS; y++)
            for (let x = rx; x < rx + rw && x < COLS; x++) maze[y][x] = 0;
    }

    const complexity = 15 + level * 10;
    for (let i = 0; i < complexity; i++) {
        const x = 3 + Math.floor(rng() * (COLS-6));
        const y = 3 + Math.floor(rng() * (ROWS-6));
        if (rng() < 0.7) maze[y][x] = 1;
    }

    clearArea(1, 1, 4);
    clearArea(COLS-4, ROWS-4, 4);
    maze[exit.y][exit.x] = 0;

    spawnAI();
    placePowerups(8);
    if (!isSolvable()) generateMaze(level, currentSeed + 1);
}

function spawnAI() {
    ai.health = ai.maxHealth = 3 + Math.floor(currentLevel / 3);
    ai.x = COLS - 6;
    ai.y = ROWS - 6;
    ai.stunnedUntil = 0;
    if (!isOpen(Math.floor(ai.x), Math.floor(ai.y))) {
        ai.x = 25 + Math.floor(Math.random() * 10);
        ai.y = 15 + Math.floor(Math.random() * 10);
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
            px = 4 + Math.floor(seededRandom(currentSeed++) * (COLS - 8));
            py = 4 + Math.floor(seededRandom(currentSeed++) * (ROWS - 8));
            attempts++;
        } while (!isOpen(px, py) && attempts < 80);

        let type = 'speed';
        const roll = Math.random();
        if (roll < 0.35) type = 'gun';
        else if (roll < 0.65) type = 'shield';

        if (isOpen(px, py)) powerups.push({x: px, y: py, type: type});
    }
}

function isOpen(x, y) {
    return x >= 0 && x < COLS && y >= 0 && y < ROWS && maze[y][x] === 0;
}

function isSolvable() {
    const visited = Array(ROWS).fill().map(() => Array(COLS).fill(false));
    const queue = [{x: player.x, y: player.y}];
    visited[player.y][player.x] = true;
    const dirs = [[0,1],[1,0],[0,-1],[-1,0]];

    while (queue.length) {
        const curr = queue.shift();
        if (curr.x === exit.x && curr.y === exit.y) return true;
        for (let [dx, dy] of dirs) {
            const nx = curr.x + dx, ny = curr.y + dy;
            if (isOpen(nx, ny) && !visited[ny][nx]) {
                visited[ny][nx] = true;
                queue.push({x: nx, y: ny});
            }
        }
    }
    return false;
}

function getTheme(level) {
    const themes = [
        {wall: '#440044', path: '#0a001f'},
        {wall: '#004400', path: '#001a00'},
        {wall: '#440000', path: '#1a0000'},
        {wall: '#444400', path: '#1a1a00'}
    ];
    return themes[(level-1) % themes.length];
}

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

    // Player
    ctx.fillStyle = '#00ffff';
    ctx.beginPath();
    ctx.arc(player.x*CELL_SIZE + CELL_SIZE/2, player.y*CELL_SIZE + CELL_SIZE/2, CELL_SIZE/2 - 4, 0, Math.PI*2);
    ctx.fill();

    // Shield
    if (shieldActive) {
        const remaining = shieldEnergy / maxShieldEnergy;
        ctx.shadowBlur = 35;
        ctx.shadowColor = '#00ffff';
        ctx.strokeStyle = `rgba(0, 255, 255, ${remaining * 0.85})`;
        ctx.lineWidth = 9;
        ctx.beginPath();
        ctx.arc(player.x*CELL_SIZE + CELL_SIZE/2, player.y*CELL_SIZE + CELL_SIZE/2, CELL_SIZE/2 + 12, 0, Math.PI*2);
        ctx.stroke();
        ctx.shadowBlur = 0;
    }

    // AI
    if (aiEnabled) {
        const isStunned = Date.now() < ai.stunnedUntil;
        ctx.shadowBlur = isStunned ? 0 : 25;
        ctx.shadowColor = '#ff0088';
        ctx.fillStyle = isStunned ? '#ff88aa' : '#ff0088';
        ctx.fillRect(ai.x*CELL_SIZE + 3, ai.y*CELL_SIZE + 3, CELL_SIZE-6, CELL_SIZE-6);
        ctx.shadowBlur = 0;

        // Health bar
        const hp = ai.health / ai.maxHealth;
        ctx.fillStyle = '#000';
        ctx.fillRect(ai.x*CELL_SIZE + 2, ai.y*CELL_SIZE - 8, CELL_SIZE-4, 5);
        ctx.fillStyle = hp > 0.4 ? '#00ff00' : '#ff0000';
        ctx.fillRect(ai.x*CELL_SIZE + 2, ai.y*CELL_SIZE - 8, (CELL_SIZE-4) * hp, 5);
    }

    // Projectiles
    ctx.shadowBlur = 12; ctx.shadowColor = '#ff4400';
    ctx.fillStyle = '#ff4400';
    projectiles.forEach(p => ctx.fillRect(p.x-5, p.y-5, 10, 10));
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#00ffdd';
    playerProjectiles.forEach(p => ctx.fillRect(p.x-4, p.y-4, 8, 8));

    ctx.textAlign = 'center';
    if (gameWon) {
        ctx.fillStyle = 'rgba(0,255,100,0.95)';
        ctx.font = 'bold 52px "Press Start 2P"';
        ctx.fillText('AMAZING!', canvas.width/2, canvas.height/2 - 30);
        ctx.font = 'bold 24px "Press Start 2P"';
        ctx.fillText(`LEVEL ${currentLevel} COMPLETE`, canvas.width/2, canvas.height/2 + 40);
    }
    if (gameOver) {
        ctx.fillStyle = 'rgba(255,0,80,0.95)';
        ctx.font = 'bold 48px "Press Start 2P"';
        ctx.fillText('HIT!', canvas.width/2, canvas.height/2);
    }
}

// ============== GAME LOGIC ==============
function movePlayer(dx, dy) {
    if (gameWon || gameOver) return;
    if (Date.now() - lastPlayerMove < 55 / playerSpeed) return;

    const nx = player.x + dx, ny = player.y + dy;
    if (!isOpen(nx, ny)) return;

    player.x = nx; player.y = ny;
    lastPlayerMove = Date.now();

    powerups = powerups.filter(p => {
        if (p.x === player.x && p.y === player.y) {
            if (p.type === 'speed') playerSpeed = 1.9;
            else if (p.type === 'gun') hasStickyGun = true;
            else if (p.type === 'shield') {
                maxShieldEnergy = Math.min(60, maxShieldEnergy + 10);
                shieldRegenRate = Math.min(5, shieldRegenRate + 0.6);
                shieldEnergy = maxShieldEnergy;
                playNote(1200, 400, 'sine', 0.6);
            }
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
        currentLevel++;

        localStorage.setItem('mazeBest', bestTime);
        localStorage.setItem('mazeCompleted', totalCompleted);
        localStorage.setItem('mazeLevel', currentLevel);

        document.getElementById('best').textContent = bestTime.toFixed(1);
        document.getElementById('completed').textContent = totalCompleted;
        document.getElementById('level').textContent = currentLevel;
        clearInterval(timerInterval);
    }
}

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

function updateAI() {
    if (!aiEnabled || gameWon || gameOver || Date.now() < ai.stunnedUntil) return;

    const dx = player.x - ai.x;
    const dy = player.y - ai.y;
    if (Math.abs(dx) > Math.abs(dy)) {
        const dir = Math.sign(dx);
        if (isOpen(Math.floor(ai.x + dir), Math.floor(ai.y))) ai.x += dir * 0.16;
    } else {
        const dir = Math.sign(dy);
        if (isOpen(Math.floor(ai.x), Math.floor(ai.y + dir))) ai.y += dir * 0.16;
    }

    if (Math.random() < 0.035) {
        projectiles.push({
            x: ai.x * CELL_SIZE + CELL_SIZE/2,
            y: ai.y * CELL_SIZE + CELL_SIZE/2,
            dx: Math.sign(player.x - ai.x) * 7,
            dy: Math.sign(player.y - ai.y) * 7
        });
    }

    if (Math.floor(ai.x) === player.x && Math.floor(ai.y) === player.y && !shieldActive) {
        gameOver = true;
        clearInterval(timerInterval);
        setTimeout(resetGame, 1400);
    }
}

function updateProjectiles() { /* same as before */ 
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        p.x += p.dx; p.y += p.dy;
        const gx = Math.floor(p.x / CELL_SIZE);
        const gy = Math.floor(p.y / CELL_SIZE);
        if (gx === player.x && gy === player.y && !shieldActive) {
            gameOver = true; clearInterval(timerInterval); setTimeout(resetGame, 1400); return;
        }
        if (!isOpen(gx, gy) || p.x < 0 || p.x > canvas.width || p.y < 0 || p.y > canvas.height) projectiles.splice(i, 1);
    }
}

function updatePlayerProjectiles() {
    for (let i = playerProjectiles.length - 1; i >= 0; i--) {
        const p = playerProjectiles[i];
        p.x += p.dx; p.y += p.dy;
        p.life = (p.life || 140) - 1;

        const gx = Math.floor(p.x / CELL_SIZE);
        const gy = Math.floor(p.y / CELL_SIZE);

        if (aiEnabled && Math.floor(ai.x) === gx && Math.floor(ai.y) === gy) {
            ai.health--;
            playerProjectiles.splice(i, 1);
            playNote(180, 200, 'sawtooth', 0.6);

            if (ai.health <= 0) {
                playNote(80, 600, 'triangle', 0.7);
                setTimeout(spawnAI, 1600);
            } else {
                ai.stunnedUntil = Date.now() + 800;
            }
            continue;
        }

        if (p.life <= 0 || !isOpen(gx, gy)) playerProjectiles.splice(i, 1);
    }
}

function gameLoop() {
    updateAI();
    updateProjectiles();
    updatePlayerProjectiles();
    updateShield();
    draw();
}

function startTimer() {
    startTime = Date.now();
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if (gameWon || gameOver) return;
        document.getElementById('timer').textContent = ((Date.now() - startTime)/1000).toFixed(1);
    }, 100);
}

function resetGame(seed = null) {
    gameWon = false; gameOver = false;
    playerSpeed = 1; hasStickyGun = false;
    shieldEnergy = maxShieldEnergy;
    shieldActive = false;
    playerProjectiles = [];
    projectiles = [];
    generateMaze(currentLevel, seed);
    startTimer();
    draw();
}

function toggleAI() {
    aiEnabled = document.getElementById('aiCheckbox').checked;
}

function shootPlayerProjectile() {
    const centerX = player.x * CELL_SIZE + CELL_SIZE / 2;
    const centerY = player.y * CELL_SIZE + CELL_SIZE / 2;
    const dx = mouseX - centerX;
    const dy = mouseY - centerY;
    const dist = Math.sqrt(dx*dx + dy*dy) || 1;

    playerProjectiles.push({
        x: centerX, y: centerY,
        dx: (dx / dist) * 9.5,
        dy: (dy / dist) * 9.5,
        life: 140
    });
    playNote(650, 60, 'square', 0.4);
}

// ============== MOUSE ==============
function initMouseControls() {
    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        mouseX = (e.clientX - rect.left) / 0.85;
        mouseY = (e.clientY - rect.top) / 0.85;
    });

    canvas.addEventListener('mousedown', (e) => {
        if (gameWon || gameOver) return;
        if (e.button === 0) shootPlayerProjectile();
    });

    document.addEventListener('mousedown', (e) => {
        if (e.button === 2 && !gameWon && !gameOver && shieldEnergy > 0.2) {
            shieldActive = true;
        }
    });

    document.addEventListener('mouseup', (e) => {
        if (e.button === 2) shieldActive = false;
    });

    canvas.addEventListener('contextmenu', e => e.preventDefault());
}

// ============== INIT GAME ==============
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
