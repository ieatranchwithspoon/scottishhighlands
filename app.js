/* Game Constants */
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const PLAYER_SPEED = 5;
const PROJECTILE_SPEED = 7;
const MONSTER_SPEED = 2;
const SUPERBOSS_SPEED = 1.5;
const LASER_SPEED = 6;
const SPAWN_RATE = 100; // Frames between spawns
const SHOOT_COOLDOWN = 15; // Frames between auto-fire shots

/* Setup Canvas */
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

/* UI Elements */
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const hud = document.getElementById('hud');
const scoreDisplay = document.getElementById('score');
const finalScoreDisplay = document.getElementById('final-score');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const livesContainer = document.getElementById('lives');
const highScoreVal = document.getElementById('high-score-val');


/* Pause UI */
const pauseScreen = document.getElementById('pause-screen');
const pauseHsVal = document.getElementById('pause-hs-val');
const resumeBtn = document.getElementById('resume-btn');
const quitBtn = document.getElementById('quit-btn');
const gameOverQuitBtn = document.getElementById('game-over-quit-btn');
const hardBtn = document.getElementById('hard-btn');

/* Controls UI */
const controlsBtn = document.getElementById('controls-btn');
const controlsModal = document.getElementById('controls-modal');
const closeControls = document.getElementById('close-controls');

/* Start Screen Records */
const startHsNormal = document.getElementById('start-hs-normal');
const startHsHard = document.getElementById('start-hs-hard');

/* Mode Labels */
const gameOverHsLabel = document.getElementById('game-over-hs-label');
const pauseHsLabel = document.getElementById('pause-hs-label');

/* Web Audio Context (for bagpipe sounds) */
let audioCtx = null;
function getAudioCtx() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtx;
}

/* ---- Bagpipe Sound Engine ---- */
// Bagpipes use a constant drone + chanter melody. We simulate this with
// oscillators tuned to the Highland bagpipe scale (A=470Hz, Mixolydian).

const PIPE_DRONE_HZ = 117.5; // Low A (drone root, 2 octaves below chanter A)

function playBagpipeNote(freq, duration, type = 'sawtooth', volume = 0.18) {
    try {
        const ac = getAudioCtx();
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        // Slight vibrato for pipe character
        const vibrato = ac.createOscillator();
        const vibratoGain = ac.createGain();
        vibrato.frequency.value = 6;
        vibratoGain.gain.value = 4;
        vibrato.connect(vibratoGain);
        vibratoGain.connect(osc.frequency);
        vibrato.start();
        vibrato.stop(ac.currentTime + duration);

        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(volume, ac.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
        osc.connect(gain);
        gain.connect(ac.destination);
        osc.start();
        osc.stop(ac.currentTime + duration);
    } catch (e) { /* Audio not supported */ }
}

function playDroneChord(duration = 0.4) {
    // Bagpipe drone: root + fifth + octave
    playBagpipeNote(PIPE_DRONE_HZ, duration, 'sawtooth', 0.08);
    playBagpipeNote(PIPE_DRONE_HZ * 1.5, duration, 'sawtooth', 0.06);
    playBagpipeNote(PIPE_DRONE_HZ * 2, duration, 'sawtooth', 0.05);
}

// Shoot: short high chanter note (like a grace note)
function soundShoot() {
    playBagpipeNote(940, 0.08, 'sawtooth', 0.12); // High A chanter
}

// Monster kill: quick descending two-note pipe figure
function soundMonsterKill() {
    playBagpipeNote(705, 0.1, 'sawtooth', 0.15);  // E
    setTimeout(() => playBagpipeNote(587, 0.12, 'sawtooth', 0.15), 80); // D
}

// Boss kill: triumphant 4-note pipe fanfare + drone swell
function soundBossKill() {
    const notes = [470, 587, 705, 940]; // A B C# E (pipe scale)
    notes.forEach((f, i) => {
        setTimeout(() => playBagpipeNote(f, 0.18, 'sawtooth', 0.2), i * 120);
    });
    setTimeout(() => playDroneChord(0.5), 480);
}

// Player hit: dissonant pipe squawk (grace note gone wrong)
function soundPlayerHit() {
    playBagpipeNote(830, 0.05, 'sawtooth', 0.2);  // Ab - out of key
    setTimeout(() => playBagpipeNote(622, 0.15, 'sawtooth', 0.15), 50); // Eb
}

// Superboss death: full pipe victory march phrase
function soundSuperBossDeath() {
    const march = [470, 470, 705, 940, 705, 587, 470]; // A A E A' E D A
    march.forEach((f, i) => {
        setTimeout(() => {
            playBagpipeNote(f, 0.2, 'sawtooth', 0.22);
            if (i === 0 || i === 3) playDroneChord(0.2);
        }, i * 160);
    });
}

// Superboss spawn: ominous low drone swell
function soundSuperBossSpawn() {
    if (superBossType === 1) {
        playBagpipeNote(PIPE_DRONE_HZ, 1.2, 'sawtooth', 0.25);
        playBagpipeNote(PIPE_DRONE_HZ * 0.75, 1.2, 'sawtooth', 0.15); // Low F# (eerie)
    } else {
        // Type 2: Phantom Drone (Lower and pulsed)
        playBagpipeNote(PIPE_DRONE_HZ * 0.5, 1.5, 'square', 0.2);
        setTimeout(() => playBagpipeNote(PIPE_DRONE_HZ * 0.6, 1.2, 'square', 0.15), 500);
    }
}

// Spiral attack sound: rapid chanter trills
function soundSpiralAttack() {
    const notes = [940, 1175, 1410];
    notes.forEach((f, i) => {
        setTimeout(() => playBagpipeNote(f, 0.05, 'sawtooth', 0.1), i * 40);
    });
}

// Red star pickup: bright high trill
function soundRedStar() {
    playBagpipeNote(940, 0.07, 'sawtooth', 0.18);
    setTimeout(() => playBagpipeNote(1175, 0.1, 'sawtooth', 0.18), 70); // High B
}

// Golden star pickup: ascending pipe run
function soundGoldenStar() {
    const run = [470, 587, 705, 940];
    run.forEach((f, i) => {
        setTimeout(() => playBagpipeNote(f, 0.12, 'sawtooth', 0.18), i * 70);
    });
}

/* ---- High Score Board ---- */
const HS_KEY = 'scottish_highlands_best';
const HS_HARD_KEY = 'scottish_highlands_best_hard';

function getHighScore(hardMode = isHardMode) {
    const key = hardMode ? HS_HARD_KEY : HS_KEY;
    return parseInt(localStorage.getItem(key)) || 0;
}

function saveHighScore(newScore) {
    const key = isHardMode ? HS_HARD_KEY : HS_KEY;
    const currentBest = getHighScore();
    if (newScore > currentBest) {
        localStorage.setItem(key, newScore);
        return true; // New record
    }
    return false;
}

function renderHighScores(currentScore) {
    const isNewRecord = saveHighScore(currentScore);
    const best = getHighScore();
    highScoreVal.textContent = best;

    // Update labels based on mode
    gameOverHsLabel.textContent = isHardMode ? "HIGHEST SCORE (HARD)" : "HIGHEST SCORE";

    if (isNewRecord) {
        highScoreVal.classList.add('new-record-highlight');
    } else {
        highScoreVal.classList.remove('new-record-highlight');
    }

    updateStartRecords(); // Keep start screen updated
}

function updateStartRecords() {
    if (startHsNormal) startHsNormal.textContent = getHighScore(false);
    if (startHsHard) startHsHard.textContent = getHighScore(true);
}

/* Game State */
let gameRunning = false;
let score = 0;
let frames = 0;
let animationId;
let isInvincible = false;
let nextSuperBossThreshold = 1000;
let superBossType = 1; // 1 or 2
let isPaused = false;
let isHardMode = false;

/* Input State */
const keys = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false,
    Space: false
};

/* Assets */
const playerImg = new Image();
playerImg.src = 'player_final.png';

const monsterImg = new Image();
monsterImg.src = 'monster_filled.png';

const bossImg = new Image();
bossImg.src = 'boss_final.png';

const superBossImg = new Image();
superBossImg.src = 'superboss_final.png';
const superBoss2Img = new Image();
superBoss2Img.src = 'superboss2_final.png';

const noteImg = new Image();
noteImg.src = 'note.svg';
const bgImg = new Image();
bgImg.src = 'bg_grass.svg';
const heartImgSrc = 'heart.svg';
const starImg = new Image();
starImg.src = 'star.svg';
const redStarImg = new Image();
redStarImg.src = 'red_star.svg';

/* Entities */
const player = {
    x: CANVAS_WIDTH / 2 - 32,
    y: CANVAS_HEIGHT / 2 - 32,
    width: 64,
    height: 64,
    dx: 0,
    dy: 0,
    lastDirX: 0,
    lastDirY: -1, // Default face up
    lives: 3
};

let projectiles = [];
let monsters = [];
let bosses = [];
let powerups = [];
let lasers = [];
let redStars = [];

const superBoss = {
    x: -200,
    y: -200,
    width: 150,
    height: 150,
    hp: 50,
    maxHp: 50,
    active: false
};

/* Event Listeners */
window.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.code) || e.key === " " || e.key.startsWith("Arrow")) {
        // Shoot on press
        if (e.code === 'Space' && !keys['Space'] && gameRunning && !isPaused) {
            shoot();
        }
        // Toggle Pause on Tab
        if ((e.code === 'Tab' || e.key === 'Tab') && gameRunning) {
            togglePause();
        }
        keys[e.code || e.key] = true;
        // Prevent page scroll / focus cycling with keys
        if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code || e.key)) {
            e.preventDefault();
        }
    }
});

window.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.code || e.key) || e.key === " " || e.key.startsWith("Arrow")) {
        keys[e.code || e.key] = false;
    }
});

startBtn.addEventListener('click', () => {
    isHardMode = false;
    startGame();
});

if (hardBtn) {
    hardBtn.addEventListener('click', () => {
        isHardMode = true;
        startGame();
    });
}

restartBtn.addEventListener('click', startGame);

if (controlsBtn && controlsModal && closeControls) {
    controlsBtn.addEventListener('click', () => {
        controlsModal.classList.remove('hidden');
    });
    closeControls.addEventListener('click', () => {
        controlsModal.classList.add('hidden');
    });
}

if (resumeBtn) {
    resumeBtn.addEventListener('click', () => {
        if (isPaused) togglePause();
    });
}

if (quitBtn) {
    quitBtn.addEventListener('click', quitToHome);
}

if (gameOverQuitBtn) {
    gameOverQuitBtn.addEventListener('click', quitToHome);
}


/* Mobile Controls */
function bindMobileBtn(id, key) {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.addEventListener('touchstart', (e) => { e.preventDefault(); keys[key] = true; }, { passive: false });
    btn.addEventListener('touchend', (e) => { e.preventDefault(); keys[key] = false; }, { passive: false });
    btn.addEventListener('mousedown', () => keys[key] = true);
    btn.addEventListener('mouseup', () => keys[key] = false);
}

bindMobileBtn('btn-up', 'ArrowUp');
bindMobileBtn('btn-down', 'ArrowDown');
bindMobileBtn('btn-left', 'ArrowLeft');
bindMobileBtn('btn-right', 'ArrowRight');

const fireBtn = document.getElementById('fire-btn');
if (fireBtn) {
    fireBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (gameRunning) shoot();
        keys['Space'] = true;
    }, { passive: false });
    fireBtn.addEventListener('touchend', (e) => { e.preventDefault(); keys['Space'] = false; }, { passive: false });
    fireBtn.addEventListener('mousedown', () => {
        if (gameRunning) shoot();
        keys['Space'] = true;
    });
    fireBtn.addEventListener('mouseup', () => keys['Space'] = false);
}

/* Core Functions */

function updateLivesUI() {
    livesContainer.innerHTML = '';
    for (let i = 0; i < player.lives; i++) {
        const img = document.createElement('img');
        img.src = heartImgSrc;
        livesContainer.appendChild(img);
    }
}

function startGame() {
    // Unlock audio on first interaction
    getAudioCtx();

    gameRunning = true;
    score = 0;
    frames = 0;
    projectiles = [];
    monsters = [];
    bosses = [];
    powerups = [];
    lasers = [];
    redStars = [];

    player.x = CANVAS_WIDTH / 2 - 32;
    player.y = CANVAS_HEIGHT / 2 - 32;
    player.lastDirX = 0;
    player.lastDirY = -1;
    player.lives = isHardMode ? 1 : 3;
    isInvincible = false;
    isPaused = false;

    // Reset Superboss
    superBoss.active = false;
    nextSuperBossThreshold = 1000;

    updateLivesUI();

    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    pauseScreen.classList.add('hidden');
    hud.classList.remove('hidden');

    if (animationId) cancelAnimationFrame(animationId);
    loop();
}

function togglePause() {
    if (!gameRunning) return;
    isPaused = !isPaused;

    if (isPaused) {
        pauseScreen.classList.remove('hidden');
        pauseHsLabel.textContent = isHardMode ? "BEST (HARD)" : "BEST";
        pauseHsVal.textContent = getHighScore();
    } else {
        pauseScreen.classList.add('hidden');
    }
}

function quitToHome() {
    gameRunning = false;
    isPaused = false;
    pauseScreen.classList.add('hidden');
    hud.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    startScreen.classList.remove('hidden');
    if (animationId) cancelAnimationFrame(animationId);
}

function gameOver() {
    gameRunning = false;
    finalScoreDisplay.innerText = score;
    renderHighScores(score);
    gameOverScreen.classList.remove('hidden');
    hud.classList.add('hidden');
}

function shoot() {
    soundShoot();
    projectiles.push({
        x: player.x + player.width / 2 - 8,
        y: player.y + player.height / 2 - 8,
        width: 16,
        height: 16,
        vx: player.lastDirX * PROJECTILE_SPEED,
        vy: player.lastDirY * PROJECTILE_SPEED,
        active: true
    });
}

function spawnMonster() {
    const side = Math.floor(Math.random() * 4);
    let x, y;

    switch (side) {
        case 0: x = Math.random() * CANVAS_WIDTH; y = -64; break;
        case 1: x = Math.random() * CANVAS_WIDTH; y = CANVAS_HEIGHT; break;
        case 2: x = -64; y = Math.random() * CANVAS_HEIGHT; break;
        case 3: x = CANVAS_WIDTH; y = Math.random() * CANVAS_HEIGHT; break;
    }

    monsters.push({ x, y, width: 64, height: 64, active: true });
}

function spawnBoss() {
    const side = Math.floor(Math.random() * 4);
    let x, y;

    switch (side) {
        case 0: x = CANVAS_WIDTH / 2; y = -150; break;
        case 1: x = CANVAS_WIDTH / 2; y = CANVAS_HEIGHT + 150; break;
        case 2: x = -150; y = CANVAS_HEIGHT / 2; break;
        case 3: x = CANVAS_WIDTH + 150; y = CANVAS_HEIGHT / 2; break;
    }

    bosses.push({ x, y, width: 120, height: 120, hp: 5, maxHp: 5, active: true });
}

function activateSuperBoss() {
    superBoss.active = true;
    superBoss.hp = 50;
    superBoss.maxHp = 50;
    superBossType = Math.random() < 0.5 ? 1 : 2;
    superBoss.x = CANVAS_WIDTH / 2 - superBoss.width / 2;
    superBoss.y = -200;

    monsters = [];
    bosses = [];
    redStars = [];

    soundSuperBossSpawn();
}

function takeDamage() {
    if (isInvincible) return;
    player.lives--;
    updateLivesUI();
    soundPlayerHit();
    if (player.lives <= 0) {
        gameOver();
    } else {
        isInvincible = true;
        setTimeout(() => { isInvincible = false; }, 2000);
    }
}

function update() {
    if (!gameRunning || isPaused) return;
    frames++;

    // Player Movement & Direction Tracking
    if (keys.ArrowUp && player.y > 0) {
        player.y -= PLAYER_SPEED;
        player.lastDirX = 0;
        player.lastDirY = -1;
    }
    if (keys.ArrowDown && player.y < CANVAS_HEIGHT - player.height) {
        player.y += PLAYER_SPEED;
        player.lastDirX = 0;
        player.lastDirY = 1;
    }
    if (keys.ArrowLeft && player.x > 0) {
        player.x -= PLAYER_SPEED;
        player.lastDirX = -1;
        player.lastDirY = 0;
    }
    if (keys.ArrowRight && player.x < CANVAS_WIDTH - player.width) {
        player.x += PLAYER_SPEED;
        player.lastDirX = 1;
        player.lastDirY = 0;
    }


    // Projectile Movement
    for (let p of projectiles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > CANVAS_WIDTH || p.y < 0 || p.y > CANVAS_HEIGHT) {
            p.active = false;
        }
    }

    // Laser Movement
    for (let l of lasers) {
        l.x += l.vx;
        l.y += l.vy;
        if (l.x < 0 || l.x > CANVAS_WIDTH || l.y < 0 || l.y > CANVAS_HEIGHT) {
            l.active = false;
        }
    }

    // Superboss Trigger
    if (score >= nextSuperBossThreshold && !superBoss.active) {
        activateSuperBoss();
        if (nextSuperBossThreshold === 1000) {
            nextSuperBossThreshold = 5000;
        } else {
            nextSuperBossThreshold += 5000;
        }
    }

    // Spawning (Only if Superboss is NOT active)
    if (!superBoss.active) {
        if (frames % SPAWN_RATE === 0) {
            spawnMonster();
        }
        if (frames % 600 === 0 && bosses.length === 0) {
            spawnBoss();
        }
    }

    /* Superboss Logic */
    if (superBoss.active) {
        if (superBossType === 1) {
            // Type 1: Basic Chase
            const angle = Math.atan2(player.y - superBoss.y, player.x - superBoss.x);
            superBoss.x += Math.cos(angle) * SUPERBOSS_SPEED;
            superBoss.y += Math.sin(angle) * SUPERBOSS_SPEED;

            // Shoot Lasers occasionally
            if (frames % 60 === 0) {
                lasers.push({
                    x: superBoss.x + superBoss.width / 2 - 4,
                    y: superBoss.y + superBoss.height / 2 - 4,
                    width: 8,
                    height: 20,
                    vx: Math.cos(angle) * LASER_SPEED,
                    vy: Math.sin(angle) * LASER_SPEED,
                    active: true
                });
            }
        } else {
            // Type 2: Circular Orbit around screen center
            const centerX = CANVAS_WIDTH / 2;
            const centerY = CANVAS_HEIGHT / 2;
            const orbitRadius = 200;
            const orbitAngle = frames * 0.02;

            const targetX = centerX + Math.cos(orbitAngle) * orbitRadius - superBoss.width / 2;
            const targetY = centerY + Math.sin(orbitAngle) * orbitRadius - superBoss.height / 2;

            // Move towards target position smootly
            superBoss.x += (targetX - superBoss.x) * 0.05;
            superBoss.y += (targetY - superBoss.y) * 0.05;

            // Spiral Attack
            if (frames % 100 === 0) {
                soundSpiralAttack();
                for (let i = 0; i < 8; i++) {
                    const spiralAngle = (i / 8) * Math.PI * 2;
                    lasers.push({
                        x: superBoss.x + superBoss.width / 2 - 4,
                        y: superBoss.y + superBoss.height / 2 - 4,
                        width: 12,
                        height: 12,
                        vx: Math.cos(spiralAngle) * (LASER_SPEED * 0.7),
                        vy: Math.sin(spiralAngle) * (LASER_SPEED * 0.7),
                        active: true
                    });
                }
            }
        }

        // Spawn Red Stars occasionally during fight (both types)
        if (frames % 300 === 0) {
            redStars.push({
                x: Math.random() * (CANVAS_WIDTH - 24),
                y: Math.random() * (CANVAS_HEIGHT - 24),
                width: 24,
                height: 24,
                active: true
            });
        }

        // Collision: Player touches Superboss
        if (checkCollision(player, superBoss)) {
            takeDamage();
        }
    }

    // Monster Movement (Towards Player)
    for (let m of monsters) {
        const angle = Math.atan2(player.y - m.y, player.x - m.x);
        m.x += Math.cos(angle) * MONSTER_SPEED;
        m.y += Math.sin(angle) * MONSTER_SPEED;

        if (checkCollision(player, m)) {
            takeDamage();
        }
    }

    // Boss Movement
    for (let b of bosses) {
        const angle = Math.atan2(player.y - b.y, player.x - b.x);
        b.x += Math.cos(angle) * (MONSTER_SPEED * 0.7);
        b.y += Math.sin(angle) * (MONSTER_SPEED * 0.7);

        if (checkCollision(player, b)) {
            takeDamage();
        }
    }

    // Laser Collision (Player Hit)
    for (let l of lasers) {
        if (!l.active) continue;
        if (checkCollision(player, l)) {
            l.active = false;
            takeDamage();
        }
    }

    // Red Star Collision
    for (let rs of redStars) {
        if (!rs.active) continue;
        if (checkCollision(player, rs)) {
            rs.active = false;
            soundRedStar();
            if (superBoss.active) {
                superBoss.hp -= 10;
                if (superBoss.hp <= 0) {
                    superBoss.active = false;
                    score += 1000;
                    scoreDisplay.innerText = score;
                    redStars = [];
                    soundSuperBossDeath();
                }
            }
        }
    }

    // Projectile Collision Logic
    for (let p of projectiles) {
        if (!p.active) continue;

        // Check Monsters
        for (let m of monsters) {
            if (!m.active) continue;
            if (checkCollision(p, m)) {
                p.active = false;
                m.active = false;
                score += 10;
                scoreDisplay.innerText = score;
                soundMonsterKill();
            }
        }

        // Check Bosses
        if (!p.active) continue;
        for (let b of bosses) {
            if (!b.active) continue;
            if (checkCollision(p, b)) {
                p.active = false;
                b.hp--;
                if (b.hp <= 0) {
                    b.active = false;
                    score += 100;
                    scoreDisplay.innerText = score;
                    soundBossKill();

                    // Heal Player (Cap at 1 in Hard Mode)
                    const lifeCap = isHardMode ? 1 : 3;
                    if (player.lives < lifeCap) {
                        player.lives++;
                        updateLivesUI();
                    }

                    // Drop Star
                    powerups.push({
                        x: b.x + b.width / 2 - 12,
                        y: b.y + b.height / 2 - 12,
                        width: 24,
                        height: 24,
                        active: true
                    });

                    // Spawn Revenge Minions
                    for (let i = 0; i < 5; i++) {
                        monsters.push({
                            x: b.x + b.width / 2 - 32 + (Math.random() * 60 - 30),
                            y: b.y + b.height / 2 - 32 + (Math.random() * 60 - 30),
                            width: 64,
                            height: 64,
                            active: true
                        });
                    }
                }
            }
        }

        // Check Superboss
        if (superBoss.active && checkCollision(p, superBoss)) {
            p.active = false;
            superBoss.hp--;
            if (superBoss.hp <= 0) {
                superBoss.active = false;
                score += 1000;
                scoreDisplay.innerText = score;
                redStars = [];
                soundSuperBossDeath();
            }
        }
    }

    // Powerup Collision
    for (let s of powerups) {
        if (!s.active) continue;
        if (checkCollision(player, s)) {
            s.active = false;
            soundGoldenStar();
            const killCount = monsters.length;
            monsters = [];
            score += killCount * 10;
            scoreDisplay.innerText = score;
        }
    }

    // Cleanup
    projectiles = projectiles.filter(p => p.active);
    monsters = monsters.filter(m => m.active);
    bosses = bosses.filter(b => b.active);
    powerups = powerups.filter(p => p.active);
    lasers = lasers.filter(l => l.active);
    redStars = redStars.filter(rs => rs.active);
}

function draw() {
    // Background
    if (bgImg.complete) {
        ctx.drawImage(bgImg, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    } else {
        ctx.fillStyle = '#4CAF50';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    // Player
    if (playerImg.complete) {
        if (!isInvincible || Math.floor(Date.now() / 200) % 2 === 0) {
            ctx.drawImage(playerImg, player.x, player.y, player.width, player.height);
        }
    } else {
        ctx.fillStyle = 'blue';
        ctx.fillRect(player.x, player.y, player.width, player.height);
    }

    // Projectiles
    for (let p of projectiles) {
        if (noteImg.complete) {
            ctx.drawImage(noteImg, p.x, p.y, p.width, p.height);
        } else {
            ctx.fillStyle = 'gold';
            ctx.fillRect(p.x, p.y, p.width, p.height);
        }
    }

    // Lasers
    ctx.save();
    ctx.fillStyle = 'red';
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'red';
    for (let l of lasers) {
        ctx.save();
        ctx.translate(l.x + l.width / 2, l.y + l.height / 2);
        ctx.fillRect(-l.width / 2, -l.height / 2, l.width, l.height);
        ctx.restore();
    }
    ctx.restore();

    // Powerups
    for (let s of powerups) {
        if (starImg.complete) {
            ctx.drawImage(starImg, s.x, s.y, s.width, s.height);
        } else {
            ctx.fillStyle = 'gold';
            ctx.fillRect(s.x, s.y, s.width, s.height);
        }
    }

    // Red Stars
    for (let rs of redStars) {
        if (redStarImg.complete) {
            ctx.drawImage(redStarImg, rs.x, rs.y, rs.width, rs.height);
        } else {
            ctx.fillStyle = 'darkred';
            ctx.fillRect(rs.x, rs.y, rs.width, rs.height);
        }
    }

    // Monsters
    for (let m of monsters) {
        if (monsterImg.complete) {
            ctx.drawImage(monsterImg, m.x, m.y, m.width, m.height);
        } else {
            ctx.fillStyle = 'red';
            ctx.fillRect(m.x, m.y, m.width, m.height);
        }
    }

    // Bosses
    for (let b of bosses) {
        if (bossImg.complete) {
            ctx.drawImage(bossImg, b.x, b.y, b.width, b.height);
        } else {
            ctx.fillStyle = 'purple';
            ctx.fillRect(b.x, b.y, b.width, b.height);
        }

        // Boss HP Bar
        ctx.fillStyle = 'red';
        ctx.fillRect(b.x, b.y - 10, b.width, 5);
        ctx.fillStyle = 'green';
        ctx.fillRect(b.x, b.y - 10, b.width * (b.hp / b.maxHp), 5);
    }

    // Superboss
    if (superBoss.active) {
        const activeImg = superBossType === 2 ? superBoss2Img : superBossImg;
        if (activeImg.complete) {
            ctx.drawImage(activeImg, superBoss.x, superBoss.y, superBoss.width, superBoss.height);
        } else {
            ctx.fillStyle = 'black';
            ctx.fillRect(superBoss.x, superBoss.y, superBoss.width, superBoss.height);
        }

        // Superboss Big Health Bar
        const barWidth = 600;
        const barHeight = 20;
        const barX = (CANVAS_WIDTH - barWidth) / 2;
        const barY = CANVAS_HEIGHT - 40;

        ctx.fillStyle = 'white';
        ctx.fillRect(barX - 4, barY - 4, barWidth + 8, barHeight + 8);
        ctx.fillStyle = 'black';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        ctx.fillStyle = 'red';
        ctx.fillRect(barX, barY, barWidth * (superBoss.hp / superBoss.maxHp), barHeight);

        // Label
        ctx.fillStyle = 'white';
        ctx.font = '16px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.fillText("SUPER BOSS", CANVAS_WIDTH / 2, barY - 10);
    }
}

function getHitbox(entity) {
    let padding = 0;

    if (entity === player) {
        padding = 15;
    } else if (entity.width === 16) {
        padding = 4;
    } else if (entity.width === 120) {
        padding = 30;
    } else if (entity.width === 150) {
        padding = 20;
    } else {
        padding = 15;
    }

    return {
        x: entity.x + padding,
        y: entity.y + padding,
        width: entity.width - (padding * 2),
        height: entity.height - (padding * 2)
    };
}

function checkCollision(entity1, entity2) {
    const rect1 = getHitbox(entity1);
    const rect2 = getHitbox(entity2);

    return (
        rect1.x < rect2.x + rect2.width &&
        rect1.x + rect1.width > rect2.x &&
        rect1.y < rect2.y + rect2.height &&
        rect1.y + rect1.height > rect2.y
    );
}

function loop() {
    if (!gameRunning) return;
    update();
    draw();
    animationId = requestAnimationFrame(loop);
}

// Initial UI check
updateStartRecords();
