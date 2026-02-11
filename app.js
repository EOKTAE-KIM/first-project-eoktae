// app.js - Refactored & Enhanced by Senior Dev (Final Version)

// ============================================================================
// 0. DEBUG, CONFIG & Global Error Handling
// ============================================================================
const DEBUG = true; 
console.log("App.js loaded. DEBUG status:", DEBUG);

let errorTimeoutId = null;
let lastFrameTime = 0;
let frameCount = 0;
let fps = 0;

function log(...args) { if (DEBUG) { console.log("[DEBUG]", ...args); } }
function displayError(message) {
    const errorDisplay = document.getElementById('error-overlay');
    if (errorDisplay) {
        errorDisplay.textContent = message;
        errorDisplay.classList.remove('hidden');
        if (errorTimeoutId) clearTimeout(errorTimeoutId);
        errorTimeoutId = setTimeout(() => errorDisplay.classList.add('hidden'), 5000);
    }
}
function clearErrorDisplay() {
    const errorDisplay = document.getElementById('error-overlay');
    if (errorDisplay) { errorDisplay.classList.add('hidden'); }
}
function debounce(func, delay) { let timeout; return function(...args) { clearTimeout(timeout); timeout = setTimeout(() => func.apply(this, args), delay); }; }
window.onerror = function(message, source, lineno, colno, error) {
    const errorMsg = `[Error] ${message} at ${source.split('/').pop()}:${lineno}`;
    displayError(errorMsg); log('[Global Error]', { message, source, lineno, colno, error }); return false;
};
window.onunhandledrejection = function(event) {
    const errorMsg = `[Unhandled Promise Rejection] ${event.reason}`;
    displayError(errorMsg); log('[Unhandled Promise Rejection]', event.reason);
};

// TEMPORARY STUB FOR DEBUGGING: Replay functionality will be re-added once base is stable
function startReplay() {
    log("[DEBUG STUB] Replay button clicked. Replay feature is temporarily disabled for debugging.");
    alert("Replay feature is temporarily disabled for debugging.");
}


// ============================================================================
// 1. Core Modules (Audio & Particle Engines)
// ============================================================================
const AudioEngine = {
    audioCtx: null, masterGain: null, isInitialized: false,
    init() {
        if (this.isInitialized || gameSettings.reduceMotion) return;
        try {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.audioCtx.createGain();
            this.masterGain.gain.setValueAtTime(gameSettings.soundEnabled ? 1 : 0, this.audioCtx.currentTime);
            this.masterGain.connect(this.audioCtx.destination);
            this.isInitialized = true;
            log('AudioEngine Initialized. State:', this.audioCtx.state);
        } catch (e) { console.error("Web Audio API is not supported.", e); }
    },
    resume() {
        if (!this.isInitialized) this.init();
        if (this.isInitialized && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume().then(() => log('AudioContext resumed successfully.')).catch(e => console.error("Failed to resume AudioContext:", e));
        }
    },
    toggle(enabled) {
        if (!this.isInitialized) this.init();
        if (this.isInitialized) {
            this.masterGain.gain.setValueAtTime(enabled ? 1 : 0, this.audioCtx.currentTime);
            log('Sound toggled:', enabled ? 'ON' : 'OFF');
        }
    },
    play(type, options = {}) {
        if (!this.isInitialized || this.masterGain.gain.value === 0 || gameSettings.reduceMotion) return;
        const now = this.audioCtx.currentTime;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        gain.connect(this.masterGain);

        const sounds = {
            warp: { type: 'sawtooth', freq1: 1200, freq2: 100, gain: 0.6, dur: 0.5 },
            arrival: { type: 'square', freq1: 800, freq2: 200, gain: 0.4, dur: 0.3 },
            bumper: { type: 'triangle', freq1: 400, gain: 0.8, dur: 0.2 },
            impact: { type: 'sine', freq1: options.freq || 120, gain: 0.4, dur: 0.15 },
            countdown: { type: 'sine', freq1: 300, gain: 0.5, dur: 0.2 },
            start: { type: 'sawtooth', freq1: 523.25, gain: 0.6, dur: 0.4 },
        };

        if (sounds[type]) {
            const s = sounds[type];
            osc.type = s.type;
            osc.frequency.setValueAtTime(s.freq1, now);
            if (s.freq2) osc.frequency.exponentialRampToValueAtTime(s.freq2, now + s.dur);
            gain.gain.setValueAtTime(s.gain, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + s.dur);
            osc.start(now);
            osc.stop(now + s.dur);
        } else if (type === 'win') {
            [392, 523, 659, 784].forEach((freq, i) => {
                const o = this.audioCtx.createOscillator(); const g = this.audioCtx.createGain();
                o.type = 'triangle'; o.frequency.setValueAtTime(freq, now + i * 0.1);
                g.gain.setValueAtTime(0.5, now + i * 0.1); g.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.2);
                o.connect(g); g.connect(this.masterGain);
                o.start(now + i * 0.1); o.stop(now + i * 0.1 + 0.2);
            });
        }
    }
};

const ParticleEngine = {
    pool: [], activeParticles: [], maxParticles: 500,
    getParticle() { return this.pool.length > 0 ? this.pool.pop() : {}; },
    returnParticle(p) { if (this.pool.length < this.maxParticles) this.pool.push(p); },
    update() {
        if (gameSettings.reduceMotion) { this.activeParticles.length = 0; this.pool.length = 0; return; }
        for (let i = this.activeParticles.length - 1; i >= 0; i--) {
            const p = this.activeParticles[i];
            p.x += p.vx; p.y += p.vy; p.vy += 0.02; p.life -= p.decay;
            if (p.isRing) p.size += 0.5;
            if (p.life <= 0) { this.returnParticle(p); this.activeParticles.splice(i, 1); }
        }
    },
    render(ctx) {
        if (gameSettings.reduceMotion) return;
        ctx.save();
        for (const p of this.activeParticles) {
            ctx.globalAlpha = p.life > 0 ? p.life : 0;
            if (p.isRing) {
                ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.lineWidth = 3; ctx.strokeStyle = p.color; ctx.stroke();
            } else {
                ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
            }
        }
        ctx.restore();
    },
    create(x, y, count, options = {}) {
        if (gameSettings.reduceMotion || this.activeParticles.length >= this.maxParticles) return;
        for (let i = 0; i < count; i++) {
            const p = this.getParticle();
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * (options.speed || 3);
            Object.assign(p, { x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 1, decay: Math.random() * 0.05 + 0.01, color: options.color || '#FFF', size: Math.random() * 3 + 1, isRing: false });
            this.activeParticles.push(p);
        }
    },
    createRing(x, y, color) {
        if (gameSettings.reduceMotion || this.activeParticles.length >= this.maxParticles) return;
        const p = this.getParticle();
        Object.assign(p, { x, y, vx: 0, vy: 0, life: 1, decay: 0.02, color, isRing: true, size: MARBLE_RADIUS });
        this.activeParticles.push(p);
    },
    clear() { this.pool.length = 0; this.activeParticles.length = 0; }
};

// ============================================================================
// 2. Global Constants & Utilities
// ============================================================================
const MAX_MARBLES = 300; // Increased for better visibility during debug
const MARBLE_RADIUS = 20; // Increased for better visibility during debug
const GAME_STATE = { SETUP: 'SETUP', COUNTDOWN: 'COUNTDOWN', RUNNING: 'RUNNING', FINISHED: 'FINISHED', REPLAY: 'REPLAY' };
const SELECTION_MODE = { FIRST: 'FIRST', LAST: 'LAST', SCORE: 'SCORE' };
const DROP_MODE = { ALL_AT_ONCE: 'ALL_AT_ONCE', STAGGERED: 'STAGGERED' };
const COLORS = ['#FFADAD', '#FFD6A5', '#FDFFB6', '#CAFFBF', '#9BF6FF', '#A0C4FF', '#BDB2FF', '#FFC6FF'];
const DIFFICULTY_PRESET = {
    EASY: { friction: 0.01, frictionAir: 0.008, restitution: 0.5, density: 0.001, mapObstacles: 0.1 }, // Reduced map obstacles for testing
    MID: { friction: 0.02, frictionAir: 0.004, restitution: 0.4, density: 0.0015, mapObstacles: 0.5 },
    HARD: { friction: 0.03, frictionAir: 0.002, restitution: 0.3, density: 0.002, mapObstacles: 1.0 }
};

function getRandomColor(excludeColor = null) {
    let color = COLORS[Math.floor(Math.random() * COLORS.length)];
    while (color === excludeColor && COLORS.length > 1) {
        color = COLORS[Math.floor(Math.random() * COLORS.length)];
    }
    return color;
}
function truncateString(str, num) { return str.length <= num ? str : str.slice(0, num) + '..'; }


// ============================================================================
// 3. Game State & Data
// ============================================================================
let currentGameState = GAME_STATE.SETUP;
let participants = []; let totalMarblesToDrop = 0; let parsingErrors = [];
let gameSettings = {
    selectionMode: SELECTION_MODE.FIRST, dropMode: DROP_MODE.STAGGERED, // Default to staggered for easier observation
    staggeredInterval: 200, difficulty: 'EASY', soundEnabled: true, reduceMotion: false, record: false, // Staggered interval for testing
};
let gameData = { marbles: [], activeMarbles: [], arrivedMarbles: [], winner: null, startTime: null, droppingIntervalId: null, nextMarbleIndexToDrop: 0 };
let worldElements = { boundaries: [], obstacles: [], sensors: [] };
let rankings = {};
let recorder = { state: 'IDLE', recording: [], playbackFrame: 0, replayBodies: [], replayReqId: null };

const els = {}; // Populated in DOMContentLoaded

const { Engine, Render, World, Bodies, Body, Events, Common, Runner, Constraint, Composite, Vector } = Matter;
let engine, render, world, runner;

const MAP_CONFIG = { width: 800, segmentHeight: 1200, wallThickness: 50, zones: 3 };
MAP_CONFIG.height = MAP_CONFIG.segmentHeight * MAP_CONFIG.zones;


// ============================================================================
// --- MODULE: Matter.js & Procedural Map Generation ---
// ============================================================================
function setupMatterJs() {
    if (runner) Runner.stop(runner);
    if (render) Render.stop(render);
    if (engine) { Events.off(engine); if (render) Events.off(render); World.clear(engine.world); Engine.clear(engine); }
    
    engine = Engine.create({ enableSleeping: true });
    world = engine.world;
    engine.world.gravity.y = 1.0; // Increased gravity for testing
    render = Render.create({
        element: els.canvasArea, engine: engine, canvas: els.gameCanvas,
        options: { width: window.innerWidth, height: window.innerHeight, background: 'transparent', wireframes: false }
    });
    runner = Runner.create({ isFixed: true });
    
    createProceduralMap();
    
    Events.on(engine, 'beforeUpdate', handleBeforeUpdate);
    Events.on(engine, 'afterUpdate', handleAfterUpdate);
    Events.on(engine, 'collisionStart', handleCollisionStart);
    Events.on(render, 'afterRender', handleAfterRender);
    log("Matter.js setup complete.");
}

function createProceduralMap() {
    World.clear(world, false); Composite.clear(world, false);
    worldElements = { boundaries: [], obstacles: [], sensors: [] };
    const { width, height, segmentHeight, wallThickness } = MAP_CONFIG;
    const obstacleMultiplier = DIFFICULTY_PRESET[gameSettings.difficulty].mapObstacles;

    // Boundaries
    worldElements.boundaries.push(
        Bodies.rectangle(window.innerWidth / 2, -wallThickness, window.innerWidth, wallThickness * 2, { isStatic: true, label: 'wall_top' }), // Dynamic width
        Bodies.rectangle(window.innerWidth / 2, height + wallThickness, window.innerWidth, wallThickness * 2, { isStatic: true, label: 'wall_bottom' }), // Dynamic width
        Bodies.rectangle(-wallThickness, height / 2, wallThickness * 2, height, { isStatic: true, label: 'wall_left' }),
        Bodies.rectangle(window.innerWidth + wallThickness, height / 2, wallThickness * 2, height, { isStatic: true, label: 'wall_right' }) // Dynamic width
    );

    const obstacleTypes = ['plinko', 'platform', 'funnel', 'spinner'];
    for (let i = 0; i < MAP_CONFIG.zones; i++) {
        const startY = i * segmentHeight;
        const obstacleCount = Math.floor(Common.random(4, 7) * obstacleMultiplier);
        
        for (let j = 0; j < obstacleCount; j++) {
            const x = Common.random(wallThickness * 2, window.innerWidth - wallThickness * 2); // Dynamic width
            const y = Common.random(startY + 100, startY + segmentHeight - 150);
            const type = Common.choose(obstacleTypes);

            switch(type) {
                case 'plinko':
                    worldElements.obstacles.push(Bodies.circle(x, y, Common.random(8, 12), { isStatic: true, restitution: 0.5, friction: 0.1, label: 'plinko_peg', render: { fillStyle: '#3498db' } }));
                    break;
                case 'platform':
                    worldElements.obstacles.push(Bodies.rectangle(x, y, Common.random(100, 250), 15, { isStatic: true, angle: Common.random(-Math.PI / 6, Math.PI / 6), label: 'platform', render: { fillStyle: '#2ecc71' } }));
                    break;
                case 'funnel':
                    const funnelWidth = Common.random(120, 180);
                    worldElements.obstacles.push(Bodies.rectangle(x - funnelWidth/2, y, funnelWidth, 10, { isStatic: true, angle: -Math.PI / 4, label: 'funnel_left' }));
                    worldElements.obstacles.push(Bodies.rectangle(x + funnelWidth/2, y, funnelWidth, 10, { isStatic: true, angle: Math.PI / 4, label: 'funnel_right' }));
                    break;
                case 'spinner':
                    const spinnerBar = Bodies.rectangle(x, y, 120, 15, { label: 'spinner_bar' });
                    const spinner = Constraint.create({
                        pointA: { x, y }, bodyB: spinnerBar, length: 0, stiffness: 1
                    });
                    Body.setInertia(spinnerBar, Infinity); // To make it rotate easily
                    worldElements.obstacles.push(spinnerBar, spinner);
                    break;
            }
        }
    }

    // Arrival Sensors
    const numSensors = 5;
    const sensorWidth = (window.innerWidth - 2 * wallThickness) / numSensors; // Dynamic width
    for (let k = 0; k < numSensors; k++) {
        const sensorX = wallThickness + k * sensorWidth + sensorWidth / 2;
        worldElements.sensors.push(Bodies.rectangle(sensorX, height - 30, sensorWidth - 5, 40, {
            isStatic: true, isSensor: true, label: `arrival_sensor_${k}`, score: (k === 2 ? 5 : (k === 1 || k === 3 ? 3 : 1)), // Center gives more points
            render: { fillStyle: `rgba(255, 215, 0, ${0.1 + (k * 0.05)})`, strokeStyle: '#FFD700', lineWidth: 1 }
        }));
    }

    World.add(world, [...worldElements.boundaries, ...worldElements.obstacles, ...worldElements.sensors]);
    log(`[DEBUG] Procedural map created with ${worldElements.obstacles.length} obstacles.`);
}

// ============================================================================
// --- MODULE: Game Logic & State Management ---
// ============================================================================
function parseParticipants(input) {
    const rawEntries = input.split(/(?:, ?|\n|\r\n)+/).map(e => e.trim()).filter(Boolean);
    const parsed = {}; const errors = []; let totalBalls = 0;
    for (const entry of rawEntries) {
        const parts = entry.split('*');
        const name = parts[0].trim(); let count = 1;
        if (!name) continue;
        if (parts.length > 1) {
            const num = parseInt(parts[1].trim(), 10);
            if (!isNaN(num) && num >= 1 && num <= 50) { count = num; } 
            else { errors.push(`'${name}' 공 개수 오류 (1~50)`); }
        }
        parsed[name] = (parsed[name] || 0) + count;
    }
    const result = Object.entries(parsed).map(([name, count]) => ({ name, count, score: 0 }));
    totalBalls = result.reduce((sum, p) => sum + p.count, 0); // Corrected syntax here
    if (totalBalls > MAX_MARBLES) { errors.push(`총 공 개수 초과 (${totalBalls}/${MAX_MARBLES})`); }
    return { participants: result, totalBalls, errors };
}

function updateParticipantPreview() {
    log("[DEBUG] updateParticipantPreview called.");
    const { participants: parsed, totalBalls, errors } = parseParticipants(els.participantInput.value);
    
    parsed.forEach(newP => {
        const existingP = participants.find(oldP => oldP.name === newP.name);
        newP.color = existingP ? existingP.color : getRandomColor();
        newP.score = existingP ? existingP.score : 0;
    });

    participants = parsed; totalMarblesToDrop = totalBalls; parsingErrors = errors;
    log("[DEBUG] Parsed Participants (after update):", JSON.stringify(participants));
    log("[DEBUG] Total Marbles To Drop (after update):", totalMarblesToDrop);
    
    if (errors.length > 0) { displayError(errors.join(', ')); } else { clearErrorDisplay(); }
    
    els.totalMarbleCount.textContent = totalMarblesToDrop;
    els.marbleDistribution.innerHTML = participants.map(p => {
        const scoreDisplay = gameSettings.selectionMode === SELECTION_MODE.SCORE ? ` <span class="participant-score">${p.score} pts</span>` : '';
        return `<li style="border-left-color: ${p.color};"><span>${truncateString(p.name, 15)}</span> <span>${p.count}개${scoreDisplay}</span></li>`;
    }).join('');
    updateStartButtonState();
}

function setGameState(newState) {
    log(`State changed: ${currentGameState} -> ${newState}`);
    document.body.dataset.gameState = newState;
    currentGameState = newState;
    els.gameStateDisplay.textContent = newState;
    
    const isSetup = newState === GAME_STATE.SETUP;
    if (isSetup) {
        if(window.innerWidth > 900) els.rightPanel.classList.add('open');
    } else {
        els.rightPanel.classList.remove('open');
    }
    
    els.resetButton.disabled = isSetup && gameData.marbles.length === 0;
    els.replayButton.style.display = (newState === GAME_STATE.FINISHED && recorder.recording.length > 0) ? 'block' : 'none';
    
    updateStartButtonState();
}

function updateStartButtonState() {
    const canStart = currentGameState === GAME_STATE.SETUP && totalMarblesToDrop > 0 && totalMarblesToDrop <= MAX_MARBLES && parsingErrors.length === 0;
    els.startButton.disabled = !canStart;
    
    els.gameStatus.classList.remove('error');
    if (canStart) {
        els.gameStatus.textContent = "준비 완료!";
    } else if (parsingErrors.length > 0) {
        els.gameStatus.textContent = parsingErrors[0];
        els.gameStatus.classList.add('error');
    } else if (totalMarblesToDrop === 0) {
        els.gameStatus.textContent = "참가자를 1명 이상 입력하세요.";
    } else {
        els.gameStatus.textContent = "게임 시작 불가";
    }
}

function startGame() {
    if (currentGameState !== GAME_STATE.SETUP || els.startButton.disabled) return;
    
    // Reset gameData related to marbles for a new game
    gameData.marbles = []; // Clear previous marbles
    gameData.activeMarbles = []; // Clear previous active marbles
    gameData.arrivedMarbles = [];
    gameData.winner = null;
    gameData.nextMarbleIndexToDrop = 0; // Ensure marble dropper starts from 0
    gameData.droppingIntervalId = null; // Clear any old interval

    participants.forEach(p => p.score = 0);
    updateParticipantPreview();
    els.arrivalLog.innerHTML = '';
    els.winnerDisplayContainer.classList.add('hidden');
    
    if (gameSettings.record) { recorder.state = 'RECORDING'; recorder.recording = []; }
    AudioEngine.resume();
    
    setGameState(GAME_STATE.COUNTDOWN);
    els.countdownOverlay.classList.remove('hidden');
    let countdown = 3;
    const doCountdown = () => {
        log("[DEBUG] Countdown:", countdown);
        if (countdown < 1) {
            clearInterval(countdownInterval);
            els.countdownOverlay.classList.add('hidden');
            setGameState(GAME_STATE.RUNNING);
            gameData.startTime = Date.now();
            AudioEngine.play('start');
            Runner.run(runner, engine);
            Render.run(render); // Matter.js 렌더링 시작
            dropMarbles();
            return;
        }
        els.countdownText.textContent = countdown;
        AudioEngine.play('countdown');
        countdown--;
    };
    doCountdown();
    const countdownInterval = setInterval(doCountdown, 1000);
}

function resetGame() {
    if (currentGameState === GAME_STATE.SETUP && gameData.marbles.length === 0) return;
    log("Resetting game...");
    
    if (recorder.replayReqId) cancelAnimationFrame(recorder.replayReqId);
    if (gameData.droppingIntervalId) clearInterval(gameData.droppingIntervalId);
    
    gameData = { marbles: [], activeMarbles: [], arrivedMarbles: [], winner: null, startTime: null, droppingIntervalId: null, nextMarbleIndexToDrop: 0 };
    recorder = { ...recorder, state: 'IDLE', recording: [], playbackFrame: 0, replayBodies: [], replayReqId: null };
    ParticleEngine.clear();
    
    setupMatterJs();
    
    els.arrivalLog.innerHTML = '';
    els.winnerDisplayContainer.classList.add('hidden');
    
    participants.forEach(p => p.score = 0);
    
    setGameState(GAME_STATE.SETUP);
    updateParticipantPreview();
    log("Game reset complete.");
}

function finishGame() {
    if(currentGameState === GAME_STATE.FINISHED) return;
    setGameState(GAME_STATE.FINISHED);
    
    if (recorder.state === 'RECORDING') recorder.state = 'IDLE';
    if (runner) Runner.stop(runner);
    if (gameData.droppingIntervalId) clearInterval(gameData.droppingIntervalId);
    
    determineWinner();
}

function determineWinner() {
    if (gameData.arrivedMarbles.length === 0 && participants.every(p => p.score === 0)) {
        els.gameStatus.textContent = "승자 없음"; return;
    }
    
    let finalWinner;
    if (gameSettings.selectionMode === SELECTION_MODE.SCORE) {
        const sortedByScore = [...participants].sort((a,b) => b.score - a.score);
        finalWinner = { name: sortedByScore[0].name, score: sortedByScore[0].score };
    } else {
        const arrival = gameSettings.selectionMode === SELECTION_MODE.FIRST ? gameData.arrivedMarbles[0] : gameData.arrivedMarbles[gameData.arrivedMarbles.length - 1];
        if (!arrival) { els.gameStatus.textContent = "승자 없음"; return; }
        finalWinner = { name: arrival.name, order: arrival.order, time: arrival.arrivalTime };
    }
    
    gameData.winner = finalWinner;
    displayWinner();
}

function dropMarbles() {
    log("[DEBUG] dropMarbles called.");
    if (gameData.marbles.length > 0) {
        World.remove(world, gameData.marbles.map(m => m.body));
        log("[DEBUG] Removed existing marbles from world.");
    }
    gameData.marbles = []; gameData.activeMarbles = [];

    const marbleObjectsToDrop = [];
    let currentMarbleIndex = 0;
    
    log("[DEBUG] Participants for marble drop:", JSON.stringify(participants));

    participants.forEach(p => {
        log(`[DEBUG] Participant ${p.name} wants to drop ${p.count} marbles.`);
        for (let i = 0; i < p.count; i++) {
            // Spawn marbles initially visible, slightly below the top of the canvas
            const spawnX = Common.random(MAP_CONFIG.wallThickness + MARBLE_RADIUS, window.innerWidth - MAP_CONFIG.wallThickness - MARBLE_RADIUS); // Adjusted for dynamic width
            const spawnY = MARBLE_RADIUS + 50 + Common.random(0, 20); // Spawn Y to be visible
            
            const marbleBody = Bodies.circle(spawnX, spawnY, MARBLE_RADIUS, { 
                ...DIFFICULTY_PRESET[gameSettings.difficulty], 
                label: 'marble', 
                render: { fillStyle: p.color } 
            });
            Body.setVelocity(marbleBody, { x: Common.random(-0.5, 0.5), y: Common.random(0.5, 1.5) }); // Give initial downward velocity
            Body.setAngularVelocity(marbleBody, Common.random(-0.05, 0.05));
            
            const marble = { body: marbleBody, participant: p, id: marbleBody.id, color: p.color, hasArrived: false }; 
            gameData.marbles.push(marble);
            marbleObjectsToDrop.push(marble); 
            currentMarbleIndex++;
            log(`[DEBUG] Marble created: ID ${marble.id}, for ${marble.participant.name}. Position: (${marbleBody.position.x.toFixed(2)}, ${marbleBody.position.y.toFixed(2)}), Velocity: (${marbleBody.velocity.x.toFixed(2)}, ${marbleBody.velocity.y.toFixed(2)})`);
        }
    });

    log(`[DEBUG] Total marbles prepared for drop: ${marbleObjectsToDrop.length}`);
    gameData.nextMarbleIndexToDrop = 0;
    const dropNext = () => {
        if (gameData.nextMarbleIndexToDrop >= marbleObjectsToDrop.length) {
            clearInterval(gameData.droppingIntervalId); gameData.droppingIntervalId = null;
            log("[DEBUG] All marbles dropped.");
            return;
        }
        const marble = marbleObjectsToDrop[gameData.nextMarbleIndexToDrop];
        World.add(world, marble.body);
        gameData.activeMarbles.push(marble);
        AudioEngine.play('warp'); 
        log(`[DEBUG] Dropped marble ${gameData.nextMarbleIndexToDrop + 1}/${marbleObjectsToDrop.length} for ${marble.participant.name}. World position: (${marble.body.position.x.toFixed(2)}, ${marble.body.position.y.toFixed(2)})`);
        gameData.nextMarbleIndexToDrop++;
    };

    if (gameSettings.dropMode === DROP_MODE.STAGGERED) {
        // gameSettings.staggeredInterval is already default to 200 in gameSettings init
        log(`[DEBUG] Staggered drop mode. Interval: ${gameSettings.staggeredInterval}ms`);
        gameData.droppingIntervalId = setInterval(dropNext, gameSettings.staggeredInterval);
    } else {
        log("[DEBUG] All at once drop mode.");
        marbleObjectsToDrop.forEach(marble => { World.add(world, marble.body); gameData.activeMarbles.push(marble); });
        if (marbleObjectsToDrop.length > 0) AudioEngine.play('warp');
        log(`[DEBUG] Total marbles added to world (All at once): ${gameData.activeMarbles.length}`);
    }
}

function displayWinner() {
    if (!gameData.winner) return;
    AudioEngine.play('win');
    if (!gameSettings.reduceMotion) createConfetti();
    
    saveRanking(gameData.winner.name);
    updateRankingUI();

    els.winnerName.textContent = gameData.winner.name;
    if(gameSettings.selectionMode === SELECTION_MODE.SCORE) {
        els.winnerMode.textContent = "SCORE";
        els.winnerArrivalOrder.textContent = `${gameData.winner.score} pts`;
        els.winnerArrivalTime.textContent = "";
    } else {
        els.winnerMode.textContent = gameSettings.selectionMode;
        els.winnerArrivalOrder.textContent = `#${gameData.winner.order}`;
        els.winnerArrivalTime.textContent = `${(gameData.winner.time / 1000).toFixed(2)}s`;
    }
    els.winnerDisplayContainer.classList.remove('hidden');
}

// ============================================================================
// --- MODULE: Physics, Rendering & Event Handlers ---
// ============================================================================
function handleCollisionStart(event) {
    if (currentGameState !== GAME_STATE.RUNNING) return;
    for (const pair of event.pairs) {
        const { bodyA, bodyB } = pair;
        const marbleBody = bodyA.label === 'marble' ? bodyA : (bodyB.label === 'marble' ? bodyB : null);
        if (!marbleBody) continue;

        const otherLabel = bodyA === marbleBody ? bodyB.label : bodyA.label;
        const otherBody = bodyA === marbleBody ? bodyB : bodyA;

        if (otherLabel.startsWith('arrival_sensor_')) {
            const marbleData = gameData.marbles.find(m => m.body.id === marbleBody.id);
            if (!marbleData || marbleData.hasArrived) continue;

            marbleData.hasArrived = true;
            const arrivalTime = Date.now() - gameData.startTime;
            const arrivalOrder = gameData.arrivedMarbles.length + 1;

            gameData.arrivedMarbles.push({ name: marbleData.participant.name, order: arrivalOrder, arrivalTime });
            
            if (gameSettings.selectionMode === SELECTION_MODE.SCORE) {
                marbleData.participant.score += otherBody.score;
                updateParticipantPreview(); 
            }

            const logItem = document.createElement('li');
            logItem.innerHTML = `<span class="log-order">#${arrivalOrder}</span><span class="log-name">${truncateString(marbleData.participant.name, 10)}</span><span class="log-time">${(arrivalTime / 1000).toFixed(2)}s</span>`;
            els.arrivalLog.prepend(logItem);
            if (els.arrivalLog.children.length > 10) els.arrivalLog.lastChild.remove();

            AudioEngine.play('arrival');
            ParticleEngine.createRing(marbleBody.position.x, marbleBody.position.y, marbleData.color);

            gameData.activeMarbles = gameData.activeMarbles.filter(m => m.body.id !== marbleBody.id);
            Body.setStatic(marbleBody, true); // Stop physics simulation
            World.remove(world, marbleBody); // Remove from world
        } else if (otherLabel === 'plinko_peg' || otherLabel === 'platform') {
            AudioEngine.play('impact', { freq: Common.random(100, 150) });
            ParticleEngine.create(pair.collision.supports[0].x, pair.collision.supports[0].y, 2, { speed: 0.5 });
        } else if (otherLabel === 'spinner_bar') {
            AudioEngine.play('bumper');
            Body.setAngularVelocity(otherBody, Common.random(0.2, 0.5) * (Math.random() > 0.5 ? 1 : -1));
        }
    }
}

function handleAfterUpdate() {
    if (recorder.state === 'RECORDING') {
        recorder.recording.push(gameData.activeMarbles.map(m => ({ id: m.body.id, position: { ...m.body.position }, angle: m.body.angle })));
    }
    if (DEBUG) {
        frameCount++; const time = performance.now();
        if (time - lastFrameTime >= 1000) { fps = frameCount; frameCount = 0; lastFrameTime = time; }
        updateDebugInfo();
    }
    
    // Camera Logic
    if (gameData.activeMarbles.length > 0) {
        const lowestY = gameData.activeMarbles.reduce((max, m) => Math.max(max, m.body.position.y), -Infinity);
        const targetY = lowestY + window.innerHeight * 0.25;
        const clampedY = Common.clamp(targetY, render.canvas.height / 2, MAP_CONFIG.height - render.canvas.height / 2);
        const currentCenterY = (render.bounds.min.y + render.bounds.max.y) / 2;
        const newCenterY = currentCenterY * 0.9 + clampedY * 0.1;
        Render.lookAt(render, { min: { x: 0, y: newCenterY - render.canvas.height / 2 }, max: { x: window.innerWidth, y: newCenterY + render.canvas.height / 2 } }); // Adjusted for dynamic width
        log(`[DEBUG] Camera Target Y: ${targetY.toFixed(2)}, Clamped Y: ${clampedY.toFixed(2)}, Current Center Y: ${currentCenterY.toFixed(2)}. Render bounds: min(${render.bounds.min.y.toFixed(2)}), max(${render.bounds.max.y.toFixed(2)})`);
    } else {
        log("[DEBUG] No active marbles for camera follow.");
    }
    
    if (currentGameState === GAME_STATE.RUNNING && gameData.nextMarbleIndexToDrop >= totalMarblesToDrop && gameData.activeMarbles.length === 0) {
        setTimeout(finishGame, 500); // Give a moment for the last marble to settle
    }
}

function handleBeforeUpdate() {
    ParticleEngine.update();
    world.constraints.forEach(c => { if(c.bodyB && c.bodyB.label === 'spinner_bar') Body.setAngularVelocity(c.bodyB, c.bodyB.angularVelocity * 0.98); });
}

function handleAfterRender() {
    // Matter.js의 기본 렌더링은 Render.run(render)에 의해 자동 처리됩니다.
    // 이곳에서는 커스텀 렌더링(구슬 이름, 파티클 등)만 수행합니다.

    // Custom marble name rendering
    render.context.save();
    const bodies = gameData.activeMarbles.map(m => m.body); // Matter.js 바디를 가져옵니다.
    bodies.forEach(body => {
        const marbleData = gameData.marbles.find(m => m.body.id === body.id);
        if (marbleData && marbleData.participant) {
            // 월드 좌표를 현재 뷰포트 기준의 화면 좌표로 변환합니다.
            const screenX = body.position.x - render.bounds.min.x;
            const screenY = body.position.y - render.bounds.min.y;

            render.context.font = "bold 10px Arial";
            render.context.fillStyle = '#FFF';
            render.context.textAlign = 'center';
            render.context.textBaseline = 'middle';
            const nameToDisplay = truncateString(marbleData.participant.name, 6);
            render.context.fillText(nameToDisplay, screenX, screenY - MARBLE_RADIUS - 5); // 화면 좌표에 맞춰 이름을 그립니다.
        }
    });
    render.context.restore();
    ParticleEngine.render(render.context);
}

// ============================================================================
// --- MODULE: UI, Initialization & Utilities ---
// ============================================================================
function resizeCanvas() {
    if(!render) return;
    render.canvas.width = window.innerWidth;
    render.canvas.height = window.innerHeight;
    render.options.width = window.innerWidth;
    render.options.height = window.innerHeight;

    // Adjust render bounds to match the new window size, keeping X centered
    render.bounds.max.x = render.bounds.min.x + window.innerWidth;
    render.bounds.max.y = render.bounds.min.y + window.innerHeight;
    
    // For setup/finished state, ensure the top of the map is visible
    if (currentGameState === GAME_STATE.SETUP || currentGameState === GAME_STATE.FINISHED) {
        Render.lookAt(render, {
            min: { x: 0, y: 0 },
            max: { x: window.innerWidth, y: render.canvas.height } // Adjusted for dynamic width
        });
    }
    log(`[DEBUG] Canvas resized to ${window.innerWidth}x${window.innerHeight}.`);
}

function loadRankings() { const saved = localStorage.getItem('cmrRankings'); if(saved) rankings = JSON.parse(saved); log("[DEBUG] Rankings loaded:", rankings); }
function saveRanking(name) { rankings[name] = (rankings[name] || 0) + 1; localStorage.setItem('cmrRankings', JSON.stringify(rankings)); log("[DEBUG] Ranking saved for:", name, rankings[name]); }
function updateRankingUI() {
    const sorted = Object.entries(rankings).sort(([,a],[,b])=>b-a).slice(0, 10); 
    els.rankingList.innerHTML = sorted.map(([n,s]) => `<li><span>${truncateString(n,15)}</span><span class="rank-score">${s} wins</span></li>`).join('');
    log("[DEBUG] Ranking UI updated.");
}

function createConfetti() {
    const container = document.getElementById('winner-display-container');
    // Ensure the container exists before trying to append confetti
    if (!container) {
        log("Confetti container not found.");
        return;
    }

    const confettiContainer = document.createElement('div');
    confettiContainer.className = 'confetti-container';
    container.appendChild(confettiContainer); // Append a dedicated confetti container

    for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = `${Math.random() * 100}%`;
        confetti.style.animationDelay = `${Math.random() * 3}s`;
        confetti.style.backgroundColor = COLORS[Math.floor(Math.random() * COLORS.length)];
        confettiContainer.appendChild(confetti); // Append to the dedicated container
        setTimeout(() => confetti.remove(), 3000);
    }
    setTimeout(() => confettiContainer.remove(), 3500); // Remove the container after confetti falls
}

function updateDebugInfo() {
    els.debugInfo.textContent = `FPS: ${fps} | Marbles: ${gameData.activeMarbles.length}`;
    if (!DEBUG) els.debugInfo.classList.add('hidden');
}

document.addEventListener('DOMContentLoaded', () => {
    // --- Explicit DOM Element Mapping ---
    const elementIds = {
        canvasArea: 'canvas-area', gameCanvas: 'gameCanvas', countdownOverlay: 'countdown-overlay',
        countdownText: 'countdown-text', gameStateDisplay: 'game-state-display', debugInfo: 'debug-info',
        rightPanel: 'right-panel', panelToggleBtn: 'panel-toggle-btn', rankingPanel: 'ranking-panel',
        rankingList: 'ranking-list', participantInput: 'participantInput', totalMarbleCount: 'totalMarbleCount',
        marbleDistribution: 'marbleDistribution', selectionMode: 'selectionMode', dropMode: 'dropMode',
        staggeredIntervalControl: 'staggeredIntervalControl', staggeredInterval: 'staggeredInterval',
        intervalValue: 'intervalValue', difficulty: 'difficulty', arrivalLogContainer: 'arrival-log-container',
        arrivalLog: 'arrivalLog', winnerDisplayContainer: 'winner-display-container', winnerCard: 'winnerCard',
        winnerName: 'winnerName', winnerMode: 'winnerMode', winnerArrivalOrder: 'winnerArrivalOrder',
        winnerArrivalTime: 'winnerArrivalTime', startButton: 'startButton', resetButton: 'resetButton',
        gameStatus: 'gameStatus', soundToggleCheckbox: 'soundToggleCheckbox', reduceMotionCheckbox: 'reduceMotionCheckbox',
        recordCheckbox: 'recordCheckbox', replayButton: 'replayButton', errorOverlay: 'error-overlay'
    };

    for (const key in elementIds) {
        els[key] = document.getElementById(elementIds[key]);
    }
    
    if (Object.values(els).some(el => !el)) {
        const missing = Object.keys(elementIds).find(key => !els[key]);
        displayError(`필수 UI 요소(#${elementIds[missing]}) 로딩 실패. 콘솔 확인 요망.`); 
        return;
    }

    // Event Listeners
    els.panelToggleBtn.addEventListener('click', () => els.rightPanel.classList.toggle('open'));
    els.participantInput.addEventListener('input', debounce(updateParticipantPreview, 250));
    els.startButton.addEventListener('click', startGame);
    els.resetButton.addEventListener('click', resetGame);
    els.replayButton.addEventListener('click', startReplay); // Using the stub startReplay

    els.soundToggleCheckbox.addEventListener('change', (e) => { gameSettings.soundEnabled = e.target.checked; AudioEngine.toggle(e.target.checked); });
    els.reduceMotionCheckbox.addEventListener('change', (e) => { gameSettings.reduceMotion = e.target.checked; if (e.target.checked) ParticleEngine.clear(); });
    els.recordCheckbox.addEventListener('change', e => { gameSettings.record = e.target.checked; });
    
    document.querySelectorAll('input[name="selectionMode"]').forEach(radio => radio.addEventListener('change', (e) => {
        if(currentGameState === GAME_STATE.SETUP) { gameSettings.selectionMode = e.target.value; updateParticipantPreview(); }
    }));
    document.querySelectorAll('input[name="dropMode"]').forEach(radio => radio.addEventListener('change', (e) => { 
        if(currentGameState === GAME_STATE.SETUP) {
            gameSettings.dropMode = e.target.value; 
            els.staggeredIntervalControl.style.display = e.target.value === 'STAGGERED' ? 'block' : 'none';
        }
    }));
    els.staggeredInterval.addEventListener('input', (e) => { 
        if(currentGameState === GAME_STATE.SETUP) {
            gameSettings.staggeredInterval = parseInt(e.target.value, 10); 
            els.intervalValue.textContent = e.target.value; 
        }
    });
    document.querySelectorAll('input[name="difficulty"]').forEach(radio => radio.addEventListener('change', e => { 
        if (currentGameState === GAME_STATE.SETUP) {
            gameSettings.difficulty = e.target.value;
            // When difficulty changes, we should reset and recreate the map
            log("Difficulty changed, recreating map.");
            setupMatterJs();
        }
    }));

    // Initial Setup
    loadRankings(); updateRankingUI();
    AudioEngine.init(); 
    setupMatterJs(); 
    resizeCanvas(); 
    updateParticipantPreview();
    setGameState(GAME_STATE.SETUP);

    els.staggeredIntervalControl.style.display = (gameSettings.dropMode === DROP_MODE.STAGGERED) ? 'block' : 'none';
    document.querySelector(`input[name="dropMode"][value="${gameSettings.dropMode}"]`).checked = true; // Ensure UI matches default

    window.addEventListener('resize', debounce(resizeCanvas, 200));
    log("Game initialized successfully.");
});
