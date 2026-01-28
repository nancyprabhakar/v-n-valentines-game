/**
 * Run For Love ❤️
 * Side-scrolling runner: jump obstacles, collect cappuccinos, win after 40s.
 * Canvas API only, no frameworks.
 */

(function () {
  "use strict";

  // --- DOM references ---
  const canvas = document.getElementById("game-canvas");
  const ctx = canvas.getContext("2d");
  const startScreen = document.getElementById("start-screen");
  const introScreen = document.getElementById("intro-screen");
  const introPrompt = document.getElementById("intro-prompt");
  const gameOverScreen = document.getElementById("game-over-screen");
  const winScreen = document.getElementById("win-screen");
  const hud = document.getElementById("hud");
  const scoreEl = document.getElementById("score-value");
  const timeEl = document.getElementById("time-value");
  const finalScoreEl = document.getElementById("final-score");

  // --- Game constants (easy to tune) ---
  const GRAVITY = 0.6;
  const JUMP_FORCE = -14;
  const GROUND_Y = 380;
  const PLAYER_WIDTH = 40;
  const PLAYER_HEIGHT = 56;
  const WIN_TIME_SEC = 40;
  const BASE_SPEED = 4;
  const MAX_SPEED = 14;
  const SPEED_INCREASE_PER_SEC = 0.15;

  // --- Game state ---
  let state = "intro"; // intro | start | playing | gameover | win
  let score = 0;
  let collectibleScore = 0;
  let cupsCollected = 0;
  let nightMode = false; // true after 3 coffee cups = night city + Batman
  let level3Mode = false; // true after 11s in Batman mode = Seattle + original outfit
  let gameStartTime = 0;
  let speed = BASE_SPEED;
  let groundOffset = 0;
  let animId = null;
  let totalTime = 0; // for smooth time-based animations
  let freeHitRemaining = 1; // one obstacle hit allowed without game over
  let batmanModeStartTime = -1; // totalTime when Batman mode started (ms)
  let level3StartTime = -1; // totalTime when Level 3 started (ms)
  let winAnimStartTime = 0;
  let winRunnerX = 0;
  let winHearts = [];
  let winTrophyX = 0;
  let winTrophyY = 0;
  let winTrumpetL = 0;
  let winTrumpetR = 0;
  let winHeartsSpawned = false;
  let winNancyX = -90;
  let winNancyReachedTime = -1;
  let winFireworks = [];
  let applausePlayed = false;
  let lastObstacleSpawnTime = -1;
  let lastCollectibleSpawnTime = -1;

  // Intro letter sequence: envelope | opening | letter
  let introPhase = "envelope";
  let introOpeningStartTime = 0;
  let introHearts = [];

  // Player
  const player = {
    x: 120,
    y: GROUND_Y - PLAYER_HEIGHT,
    vy: 0,
    frame: 0,
    frameTimer: 0,
  };

  // Obstacles and collectibles
  let obstacles = [];
  let collectibles = [];
  let particles = [];

  // Bobble-head face image (place your PNG at assets/head.png)
  const headImage = new Image();
  headImage.src = "assets/head.png";

  // Batman mode head (assets/batmanhead.png) – used when night mode is on
  const batmanHeadImage = new Image();
  batmanHeadImage.src = "assets/batmanhead.png";

  const cakeImage = new Image();
  cakeImage.src = "assets/cake.png";

  const turtleImage = new Image();
  turtleImage.src = "assets/turtle.png";

  const trophyImage = new Image();
  trophyImage.src = "assets/trophy.png";

  const nancyImage = new Image();
  nancyImage.src = "assets/nancy.png";

  const winningImage = new Image();
  winningImage.src = "assets/winning.png";

  const dogImage = new Image();
  dogImage.src = "assets/dog.png";

  const rainbowImage = new Image();
  rainbowImage.src = "assets/rainbow.png";

  let batmanBannerStart = -1;
  let level3BannerStart = -1;
  let level1BannerStart = -1;

  // Rubber duck obstacles (assets/duck1.png and assets/duck2.png)
  const duckImages = [new Image(), new Image()];
  duckImages[0].src = "assets/duck1.png";
  duckImages[1].src = "assets/duck2.png";

  // Audio (Web Audio API - no external files)
  let audioCtx = null;
  let bgmGain = null;
  let bgmOsc = null;
  let bgmInterval = null;
  let musicOn = false;

  // --- Init ---
  function initAudio() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    bgmGain = audioCtx.createGain();
    bgmGain.gain.value = 0.12;
    bgmGain.connect(audioCtx.destination);
  }

  function playJumpSound() {
    if (!audioCtx) initAudio();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.value = 440;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.12);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.12);
  }

  function playCollectSound() {
    if (!audioCtx) initAudio();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.value = 523;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.1);
  }

  function startBGM() {
    if (!audioCtx) initAudio();
    if (bgmInterval) return;
    const notes = [261.63, 293.66, 329.63, 261.63, 349.23, 329.63];
    let i = 0;
    function tick() {
      if (!musicOn || state !== "playing") return;
      const osc = audioCtx.createOscillator();
      osc.connect(bgmGain);
      osc.frequency.value = notes[i % notes.length];
      osc.type = "sine";
      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + 0.25);
      i++;
    }
    tick();
    bgmInterval = setInterval(tick, 280);
  }

  function stopBGM() {
    if (bgmInterval) {
      clearInterval(bgmInterval);
      bgmInterval = null;
    }
  }

  function playPaperRustle() {
    if (!audioCtx) initAudio();
    const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.15, audioCtx.sampleRate);
    const channel = buf.getChannelData(0);
    for (let i = 0; i < channel.length; i++) {
      channel[i] = (Math.random() * 2 - 1) * Math.exp(-i / (channel.length * 0.3));
    }
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    const filter = audioCtx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 2000;
    filter.Q.value = 1;
    const gain = audioCtx.createGain();
    gain.gain.value = 0.08;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    src.start(audioCtx.currentTime);
    src.stop(audioCtx.currentTime + 0.15);
  }

  function playApplause() {
    if (!audioCtx) initAudio();
    const duration = 3.5;
    const sampleRate = audioCtx.sampleRate;
    const buf = audioCtx.createBuffer(2, sampleRate * duration, sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const channel = buf.getChannelData(ch);
      for (let i = 0; i < channel.length; i++) {
        const t = i / sampleRate;
        const fadeIn = Math.min(1, t / 0.3);
        const fadeOut = Math.min(1, (duration - t) / 0.5);
        const envelope = fadeIn * fadeOut;
        const noise = (Math.random() * 2 - 1) * 0.3;
        const clapPattern = Math.sin(t * 8) * Math.sin(t * 12) * Math.sin(t * 15);
        channel[i] = (noise + clapPattern * 0.4) * envelope;
      }
    }
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    const filter = audioCtx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 800;
    filter.Q.value = 2;
    const gain = audioCtx.createGain();
    gain.gain.value = 0.25;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    src.start(audioCtx.currentTime);
    src.stop(audioCtx.currentTime + duration);
  }

  // --- Draw sky (sunset, night city, or Seattle) ---
  function drawSky() {
    if (level3Mode) {
      // Overcast Seattle sky - muted grey
      const gr = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gr.addColorStop(0, "#7d7d7d");
      gr.addColorStop(0.4, "#8a8a8a");
      gr.addColorStop(0.7, "#9a9a9a");
      gr.addColorStop(1, "#a8a8a8");
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Rain/snow effect - diagonal white streaks
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      for (let i = 0; i < 120; i++) {
        const x = ((i * 47 + groundOffset * 0.3) % (canvas.width + 100)) - 50;
        const y = ((i * 31 + totalTime * 0.2) % (canvas.height + 80)) - 40;
        ctx.fillRect(x, y, 2, 8);
      }
      return;
    }
    if (nightMode) {
      const gr = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gr.addColorStop(0, "#0a0a1a");
      gr.addColorStop(0.4, "#1a1a3e");
      gr.addColorStop(0.7, "#252550");
      gr.addColorStop(1, "#2d2d4a");
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const moonX = (canvas.width * 0.78 + groundOffset * 0.05) % (canvas.width + 40) - 20;
      const moonY = 55;
      ctx.fillStyle = "rgba(255,248,220,0.95)";
      ctx.beginPath();
      ctx.arc(moonX, moonY, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(10,10,26,0.4)";
      ctx.beginPath();
      ctx.arc(moonX - 4, moonY - 3, 16, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 80; i++) {
        const x = ((i * 37 + groundOffset * 0.15) % (canvas.width + 60)) - 30;
        const y = (i * 29 % 320) + 12;
        const twinkle = 0.4 + 0.5 * Math.sin(totalTime * 0.002 + i * 0.5);
        ctx.fillStyle = `rgba(255,255,255,${twinkle})`;
        ctx.beginPath();
        ctx.arc(x, y, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }
    const gr = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gr.addColorStop(0, "#2d1b4e");
    gr.addColorStop(0.3, "#4a2c6a");
    gr.addColorStop(0.55, "#8b5a7a");
    gr.addColorStop(0.75, "#c98b8b");
    gr.addColorStop(0.9, "#e8b4a0");
    gr.addColorStop(1, "#f5d0c5");
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < 50; i++) {
      const x = ((i * 37 + groundOffset * 0.2) % (canvas.width + 40)) - 20;
      const y = (i * 31 % 200) + 16;
      const twinkle = 0.35 + 0.4 * Math.sin(totalTime * 0.002 + i * 0.5);
      ctx.fillStyle = `rgba(255,255,255,${twinkle})`;
      ctx.beginPath();
      ctx.arc(x + 1, y + 1, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // --- City skyline (night mode) ---
  function drawCitySkyline() {
    const top = canvas.height - GROUND_H;
    const buildings = [
      { w: 50, h: 120, windows: 4 },
      { w: 35, h: 90, windows: 3 },
      { w: 70, h: 180, windows: 6 },
      { w: 40, h: 100, windows: 3 },
      { w: 55, h: 150, windows: 5 },
      { w: 45, h: 80, windows: 3 },
      { w: 60, h: 140, windows: 5 },
    ];
    const stripWidth = 400;
    const scroll = (groundOffset * 0.25) % stripWidth;
    for (let strip = -1; strip * stripWidth - scroll < canvas.width + 100; strip++) {
      let x = strip * stripWidth - scroll - 30;
      buildings.forEach((b) => {
        if (x < -b.w - 10 || x > canvas.width + 80) { x += b.w + 4; return; }
        ctx.fillStyle = "#1a1a2e";
        ctx.fillRect(x, top - b.h, b.w, b.h);
        ctx.strokeStyle = "#0d0d1a";
        ctx.lineWidth = 1;
        ctx.strokeRect(x, top - b.h, b.w, b.h);
        const cellW = b.w / (b.windows + 1);
        const cellH = b.h / 8;
        ctx.fillStyle = "#ffeb3b";
        for (let row = 0; row < 6; row++) {
          for (let col = 0; col < b.windows; col++) {
            if ((b.h + row * 7 + col * 11) % 3 !== 0) {
              const lx = x + (col + 1) * cellW - cellW * 0.35;
              const ly = top - b.h + row * cellH + cellH * 0.2;
              ctx.globalAlpha = 0.7 + Math.sin(totalTime * 0.002 + row * 2 + col) * 0.15;
              ctx.fillRect(lx, ly, cellW * 0.5, cellH * 0.6);
              ctx.globalAlpha = 1;
            }
          }
        }
        x += b.w + 4;
      });
    }
  }

  // --- Seattle skyline (Level 3) - pixel art style ---
  function drawSeattleSkyline() {
    const top = canvas.height - GROUND_H;
    const stripWidth = 600;
    const scroll = (groundOffset * 0.25) % stripWidth;
    
    // Draw distant mountains (background layer)
    for (let strip = -1; strip * stripWidth - scroll < canvas.width + 200; strip++) {
      const baseX = strip * stripWidth - scroll;
      const mountainY = top - 180;
      ctx.fillStyle = "#d0d0d0";
      ctx.beginPath();
      ctx.moveTo(baseX - 100, top);
      ctx.lineTo(baseX + 50, mountainY);
      ctx.lineTo(baseX + 150, mountainY - 20);
      ctx.lineTo(baseX + 250, mountainY + 10);
      ctx.lineTo(baseX + 350, mountainY - 15);
      ctx.lineTo(baseX + 450, mountainY);
      ctx.lineTo(baseX + 600, top);
      ctx.closePath();
      ctx.fill();
      
      // Snow caps
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(baseX + 150, mountainY - 20);
      ctx.lineTo(baseX + 180, mountainY - 35);
      ctx.lineTo(baseX + 210, mountainY - 20);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(baseX + 350, mountainY - 15);
      ctx.lineTo(baseX + 380, mountainY - 30);
      ctx.lineTo(baseX + 410, mountainY - 15);
      ctx.closePath();
      ctx.fill();
    }
    
    // Draw buildings (midground) - pixel art style with olive green
    const buildings = [
      { w: 42, h: 95, windows: 3, color: "#556b2f" },
      { w: 58, h: 135, windows: 5, color: "#4a5d23" },
      { w: 48, h: 115, windows: 4, color: "#556b2f" },
      { w: 38, h: 85, windows: 3, color: "#4a5d23" },
      { w: 52, h: 125, windows: 4, color: "#556b2f" },
      { w: 45, h: 105, windows: 3, color: "#4a5d23" },
    ];
    
    for (let strip = -1; strip * stripWidth - scroll < canvas.width + 100; strip++) {
      let x = strip * stripWidth - scroll - 30;
      buildings.forEach((b) => {
        if (x < -b.w - 10 || x > canvas.width + 80) { x += b.w + 3; return; }
        
        // Building body - pixel art style
        ctx.fillStyle = b.color;
        ctx.fillRect(x, top - b.h, b.w, b.h);
        ctx.strokeStyle = "#3d4e1f";
        ctx.lineWidth = 1;
        ctx.strokeRect(x, top - b.h, b.w, b.h);
        
        // Windows - pixel style
        const cellW = Math.floor(b.w / (b.windows + 1));
        const cellH = Math.floor(b.h / 8);
        ctx.fillStyle = "#ffffff";
        for (let row = 0; row < 7; row++) {
          for (let col = 0; col < b.windows; col++) {
            if ((row * 7 + col * 11 + b.h) % 3 !== 0) {
              const lx = Math.floor(x + (col + 1) * cellW);
              const ly = Math.floor(top - b.h + row * cellH);
              ctx.fillRect(lx, ly, Math.floor(cellW * 0.6), Math.floor(cellH * 0.7));
            }
          }
        }
        x += b.w + 3;
      });
      
      // Draw Space Needle (left side, more prominent and recognizable)
      const spaceNeedleX = x - 400;
      if (spaceNeedleX > -100 && spaceNeedleX < canvas.width + 100) {
        const baseY = top;
        const deckY = top - 200;
        const topY = top - 250;
        
        // Base tripod legs (three legs spreading out)
        ctx.fillStyle = "#556b2f";
        ctx.strokeStyle = "#3d4e1f";
        ctx.lineWidth = 2;
        
        // Left leg
        ctx.beginPath();
        ctx.moveTo(spaceNeedleX - 15, baseY);
        ctx.lineTo(spaceNeedleX - 35, baseY - 15);
        ctx.lineTo(spaceNeedleX - 30, baseY - 15);
        ctx.lineTo(spaceNeedleX - 12, baseY - 5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // Right leg
        ctx.beginPath();
        ctx.moveTo(spaceNeedleX + 15, baseY);
        ctx.lineTo(spaceNeedleX + 35, baseY - 15);
        ctx.lineTo(spaceNeedleX + 30, baseY - 15);
        ctx.lineTo(spaceNeedleX + 12, baseY - 5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // Center/back leg
        ctx.beginPath();
        ctx.moveTo(spaceNeedleX, baseY);
        ctx.lineTo(spaceNeedleX, baseY - 20);
        ctx.lineTo(spaceNeedleX - 3, baseY - 20);
        ctx.lineTo(spaceNeedleX - 3, baseY - 5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // Main tower - narrow, tapering upward
        ctx.fillStyle = "#556b2f";
        ctx.strokeStyle = "#3d4e1f";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(spaceNeedleX - 8, baseY - 20);
        ctx.lineTo(spaceNeedleX - 6, deckY + 25);
        ctx.lineTo(spaceNeedleX + 6, deckY + 25);
        ctx.lineTo(spaceNeedleX + 8, baseY - 20);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // Observation deck - distinctive flying saucer shape
        const deckRadius = 28;
        const deckThickness = 8;
        
        // Top of saucer
        ctx.fillStyle = "#6b7d3f";
        ctx.beginPath();
        ctx.ellipse(spaceNeedleX, deckY, deckRadius, deckThickness, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#3d4e1f";
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Bottom of saucer
        ctx.fillStyle = "#556b2f";
        ctx.beginPath();
        ctx.ellipse(spaceNeedleX, deckY + deckThickness, deckRadius, deckThickness * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Windows on observation deck
        ctx.fillStyle = "#ffffff";
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2;
          const wx = spaceNeedleX + Math.cos(angle) * (deckRadius * 0.7);
          const wy = deckY + Math.sin(angle) * 3;
          ctx.fillRect(wx - 2, wy - 1, 4, 2);
        }
        
        // Narrow section above deck
        ctx.fillStyle = "#556b2f";
        ctx.beginPath();
        ctx.moveTo(spaceNeedleX - 4, deckY - deckThickness);
        ctx.lineTo(spaceNeedleX - 3, deckY - 35);
        ctx.lineTo(spaceNeedleX + 3, deckY - 35);
        ctx.lineTo(spaceNeedleX + 4, deckY - deckThickness);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // Top spire - very thin, pointed
        ctx.fillStyle = "#3d4e1f";
        ctx.beginPath();
        ctx.moveTo(spaceNeedleX, deckY - 35);
        ctx.lineTo(spaceNeedleX - 2, topY);
        ctx.lineTo(spaceNeedleX + 2, topY);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // Top antenna
        ctx.fillStyle = "#2d3e0f";
        ctx.fillRect(spaceNeedleX - 1, topY - 20, 2, 20);
      }
    }
  }

  // --- Draw clouds (soft gradient + gentle float) ---
  const cloudShapes = [
    { x: 0.1, y: 38, w: 90, h: 32 },
    { x: 0.35, y: 78, w: 68, h: 26 },
    { x: 0.6, y: 52, w: 78, h: 28 },
    { x: 0.85, y: 68, w: 72, h: 26 },
  ];

  function drawClouds() {
    if (nightMode) return;
    const cw = canvas.width;
    cloudShapes.forEach((c, i) => {
      const baseX = (c.x * (cw + 140) - (groundOffset * 0.12) % (cw + 140)) - 50;
      const float = Math.sin(totalTime * 0.0008 + i * 1.5) * 4;
      const x = baseX;
      const y = c.y + float;

      // Soft cloud body (gradient)
      const cgr = ctx.createLinearGradient(x, y, x + c.w, y + c.h);
      cgr.addColorStop(0, "rgba(255,255,255,0.95)");
      cgr.addColorStop(0.5, "rgba(255,255,255,0.92)");
      cgr.addColorStop(1, "rgba(230,230,245,0.88)");
      ctx.fillStyle = cgr;
      roundRect(ctx, x, y, c.w, c.h, 14);
      ctx.fill();
      // Bottom shadow band
      ctx.fillStyle = "rgba(200,200,220,0.35)";
      roundRect(ctx, x, y + c.h - 8, c.w, 8, 4);
      ctx.fill();
    });
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // --- Draw ground (grass gradient + dirt texture) ---
  const TILE_W = 60;
  const GROUND_H = 80;

  function drawGround() {
    const top = canvas.height - GROUND_H;
    if (nightMode) {
      ctx.fillStyle = "#1e1e2e";
      ctx.fillRect(0, top, canvas.width + TILE_W * 2, GROUND_H);
      const scroll = (groundOffset * 0.98) % (TILE_W * 2);
      ctx.fillStyle = "#ffeb3b";
      ctx.globalAlpha = 0.6;
      for (let x = -TILE_W; x < canvas.width + TILE_W * 2; x += 24) {
        const sx = (x + scroll) % (TILE_W * 2);
        ctx.fillRect(sx, top + 38, 12, 3);
      }
      ctx.globalAlpha = 1;
      return;
    }
    const scroll = (groundOffset * 0.98) % (TILE_W * 2);
    const dirtGr = ctx.createLinearGradient(0, top, 0, canvas.height);
    dirtGr.addColorStop(0, "#6d4c41");
    dirtGr.addColorStop(1, "#4e342e");
    ctx.fillStyle = dirtGr;
    ctx.fillRect(0, top, canvas.width + TILE_W * 2, GROUND_H);
    for (let x = -TILE_W; x < canvas.width + TILE_W * 2; x += TILE_W) {
      const sx = (x + scroll) % (TILE_W * 2);
      const grassGr = ctx.createLinearGradient(sx, top, sx + TILE_W, top + 24);
      grassGr.addColorStop(0, "#8bc34a");
      grassGr.addColorStop(0.4, "#7cb342");
      grassGr.addColorStop(1, "#558b2f");
      ctx.fillStyle = grassGr;
      ctx.fillRect(sx, top, TILE_W + 2, 24);
      ctx.fillStyle = "rgba(106, 176, 76, 0.6)";
      for (let j = 0; j < 6; j++) {
        const bx = sx + 8 + j * 11 + Math.sin((sx + j) * 0.1) * 2;
        ctx.beginPath();
        ctx.ellipse(bx, top + 6, 5, 3, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.fillStyle = "#9ccc65";
    ctx.fillRect(0, top, canvas.width + TILE_W * 2, 4);
  }

  // --- Draw distant trees (parallax; skip in night city) ---
  function drawTrees() {
    if (nightMode) return;
    const top = canvas.height - GROUND_H;
    const treePositions = [
      { x: 0.0, scale: 1.2 },
      { x: 0.45, scale: 0.9 },
      { x: 0.85, scale: 1.0 },
    ];
    treePositions.forEach((t) => {
      const x = (t.x * (canvas.width + 100) - (groundOffset * 0.28) % (canvas.width + 100)) - 30;
      const th = 70 * t.scale;
      const r = 34 * t.scale;
      const cx = x + 11;
      const cy = top - th - 22 * t.scale;

      // Trunk gradient
      const trunkGr = ctx.createLinearGradient(x, top - th, x + 18 * t.scale, top);
      trunkGr.addColorStop(0, "#5d4037");
      trunkGr.addColorStop(0.5, "#6d4c41");
      trunkGr.addColorStop(1, "#4e342e");
      ctx.fillStyle = trunkGr;
      roundRect(ctx, x + 4, top - th, 14 * t.scale, th, 3);
      ctx.fill();

      // Foliage (two-tone for depth)
      ctx.fillStyle = "#558b2f";
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(129, 199, 132, 0.6)";
      ctx.beginPath();
      ctx.ellipse(cx - 8, cy - 5, r * 0.6, r * 0.9, 0.2, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // --- Floating platforms (shadow + grass; skip in night city) ---
  function drawPlatforms() {
    if (nightMode) return;
    const top = canvas.height - GROUND_H;
    const platforms = [
      { x: 0.2, y: top - 90, w: 55, h: 18 },
      { x: 0.5, y: top - 130, w: 45, h: 14 },
      { x: 0.75, y: top - 70, w: 50, h: 16 },
    ];
    platforms.forEach((p) => {
      const x = (p.x * (canvas.width + 80) - (groundOffset * 0.38) % (canvas.width + 80)) - 40;
      const float = Math.sin(totalTime * 0.001 + p.x * 10) * 2;
      const py = p.y + float;
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.25)";
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 4;
      ctx.fillStyle = "#5d4037";
      roundRect(ctx, x, py, p.w, p.h, 4);
      ctx.fill();
      ctx.restore();
      const gGr = ctx.createLinearGradient(x, py, x + p.w, py + 8);
      gGr.addColorStop(0, "#8bc34a");
      gGr.addColorStop(1, "#558b2f");
      ctx.fillStyle = gGr;
      roundRect(ctx, x, py, p.w, 7, 3);
      ctx.fill();
    });
  }

  // --- Player: cartoon runner (smooth run cycle + shadow) ---
  function drawPlayer() {
    const x = player.x;
    const y = player.y;
    const cycle = (totalTime * 0.012) % (Math.PI * 2);
    const bob = Math.sin(cycle * 2) * 2.5;
    const legPhase = Math.sin(cycle);
    const armPhase = Math.sin(cycle + Math.PI * 0.3);
    const legSwing = legPhase * 7;
    const armSwing = armPhase * 6;
    const onGround = player.y >= GROUND_Y - PLAYER_HEIGHT - 3;
    const squash = onGround ? 1 - Math.abs(legPhase) * 0.03 : 1;
    const stretchY = 1 / squash;

    ctx.save();

    // Shadow under feet (big head = wider shadow)
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.beginPath();
    ctx.ellipse(x + PLAYER_WIDTH / 2, GROUND_Y - 2, 32, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(x, y + bob);
    ctx.scale(1, squash);
    ctx.translate(0, (1 - stretchY) * -20);

    // Cape (Batman mode only) – behind character, blowing in wind
    if (nightMode && !level3Mode) {
      const wind = totalTime * 0.004;
      ctx.save();
      ctx.translate(22, 22);
      ctx.fillStyle = "#0d0d12";
      ctx.strokeStyle = "#2a2a35";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-18, 0);
      ctx.lineTo(-20, 8);
      ctx.lineTo(-22 + Math.sin(wind) * 8, 25);
      ctx.lineTo(-25 + Math.sin(wind + 0.8) * 12, 50);
      ctx.lineTo(-28 + Math.sin(wind + 1.6) * 14, 80);
      ctx.lineTo(-25 + Math.sin(wind + 2.4) * 16, 110);
      ctx.lineTo(-15 + Math.sin(wind + 3) * 12, 130);
      ctx.lineTo(8 + Math.sin(wind + 3.5) * 6, 128);
      ctx.lineTo(25 + Math.sin(wind + 2.8) * 10, 100);
      ctx.lineTo(28 + Math.sin(wind + 2) * 8, 65);
      ctx.lineTo(25 + Math.sin(wind + 1.2) * 6, 35);
      ctx.lineTo(20, 10);
      ctx.lineTo(18, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Legs (smooth run cycle)
    if (nightMode) {
      ctx.fillStyle = "#2d2d35";
      ctx.strokeStyle = "#4a4a55";
      ctx.lineWidth = 1;
      ctx.fillRect(10, 44, 8, 14 + legSwing);
      ctx.fillRect(24, 44, 8, 14 - legSwing);
      ctx.strokeRect(10, 44, 8, 14 + legSwing);
      ctx.strokeRect(24, 44, 8, 14 - legSwing);
    } else {
      ctx.fillStyle = "#37474f";
      ctx.fillRect(10, 44, 8, 14 + legSwing);
      ctx.fillRect(24, 44, 8, 14 - legSwing);
    }

    // Body: red t-shirt or Batman suit (high contrast in night mode)
    if (nightMode && !level3Mode) {
      ctx.fillStyle = "#2d2d35";
      ctx.strokeStyle = "#5a5a65";
      ctx.lineWidth = 1.5;
      ctx.fillRect(8, 20, 26, 28);
      ctx.strokeRect(8, 20, 26, 28);
      ctx.fillStyle = "#f9a825";
      ctx.strokeStyle = "#fff3cd";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(21, 28);
      ctx.lineTo(18, 42);
      ctx.lineTo(21, 38);
      ctx.lineTo(24, 42);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#2d2d35";
      ctx.fillRect(20, 30, 2, 10);
    } else {
      const bodyGr = ctx.createLinearGradient(8, 20, 34, 48);
      bodyGr.addColorStop(0, "#ef5350");
      bodyGr.addColorStop(0.5, "#e53935");
      bodyGr.addColorStop(1, "#c62828");
      ctx.fillStyle = bodyGr;
      ctx.fillRect(8, 20, 26, 28);
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fillRect(10, 22, 6, 12);
    }

    // Arms (smooth pump)
    if (nightMode && !level3Mode) {
      ctx.fillStyle = "#2d2d35";
      ctx.strokeStyle = "#4a4a55";
      ctx.lineWidth = 1;
      ctx.fillRect(2, 24 + armSwing, 8, 6);
      ctx.fillRect(32, 24 - armSwing, 8, 6);
      ctx.strokeRect(2, 24 + armSwing, 8, 6);
      ctx.strokeRect(32, 24 - armSwing, 8, 6);
    } else {
      ctx.fillStyle = "#ffcc80";
      ctx.fillRect(2, 24 + armSwing, 8, 6);
      ctx.fillRect(32, 24 - armSwing, 8, 6);
    }

    // Bobble head: comically large (bigger than body)
    const headCx = 21;
    const headCy = -10;
    const headR = 34;
    const wobbleTilt = Math.sin(cycle * 2.2) * 0.06;
    const wobbleBob = Math.sin(cycle * 2 + 0.5) * 2;
    const wobbleScale = 1 + Math.sin(cycle * 2.5) * 0.03;

    ctx.save();
    ctx.translate(headCx, headCy + wobbleBob);
    ctx.rotate(wobbleTilt);
    ctx.scale(wobbleScale, wobbleScale);
    ctx.translate(-headCx, -headCy);

    const headImg = level3Mode ? headImage : (nightMode ? batmanHeadImage : headImage);
    if (headImg && headImg.complete && headImg.naturalWidth > 0) {
      ctx.beginPath();
      ctx.arc(headCx, headCy, headR, 0, Math.PI * 2);
      ctx.closePath();
      ctx.save();
      ctx.clip();
      ctx.drawImage(
        headImg,
        headCx - headR,
        headCy - headR - 2,
        headR * 2,
        headR * 2.15
      );
      ctx.restore();
      ctx.strokeStyle = (nightMode && !level3Mode) ? "rgba(90,90,100,0.6)" : "rgba(0,0,0,0.2)";
      ctx.lineWidth = (nightMode && !level3Mode) ? 2.5 : 2;
      ctx.beginPath();
      ctx.arc(headCx, headCy, headR, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = "#ffcc80";
      ctx.beginPath();
      ctx.arc(headCx, headCy, headR, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#263238";
      ctx.beginPath();
      ctx.arc(headCx, headCy - 8, headR * 0.7, 0, Math.PI);
      ctx.fill();
      ctx.fillRect(headCx - headR * 0.6, headCy - headR * 0.5, headR * 1.2, headR * 0.4);
      ctx.fillStyle = "#212121";
      ctx.fillRect(headCx - 8, headCy - 4, 5, 4);
      ctx.fillRect(headCx + 3, headCy - 4, 5, 4);
    }

    ctx.restore();
    ctx.restore();
  }

  // --- Obstacles (ducks in normal mode, green turtles in Batman mode) ---
  const DUCK_W = 44;
  const DUCK_H = 52;
  const TURTLE_W = 48;
  const TURTLE_H = 38;

  function spawnObstacle() {
    const duckIndex = Math.random() < 0.5 ? 0 : 1;
    obstacles.push({
      x: canvas.width + 50,
      y: GROUND_Y - 42,
      w: 32,
      h: 42,
      duckIndex: duckIndex,
    });
  }

  function drawObstacles() {
    obstacles.forEach((o) => {
      if (level3Mode) {
        // --- Dog image (Level 3) ---
        const DOG_W = 50;
        const DOG_H = 50;
        const dx = o.x - (DOG_W - o.w) / 2;
        const dy = o.y + o.h - DOG_H;
        if (dogImage.complete && dogImage.naturalWidth > 0) {
          ctx.save();
          ctx.shadowColor = "rgba(0,0,0,0.25)";
          ctx.shadowBlur = 6;
          ctx.shadowOffsetY = 3;
          ctx.drawImage(dogImage, dx, dy, DOG_W, DOG_H);
          ctx.restore();
        } else {
          ctx.fillStyle = "#8d6e63";
          ctx.fillRect(o.x, o.y, o.w, o.h);
        }
      } else if (nightMode) {
        const dx = o.x - (TURTLE_W - o.w) / 2;
        const dy = o.y + o.h - TURTLE_H;
        if (turtleImage.complete && turtleImage.naturalWidth > 0) {
          ctx.save();
          ctx.shadowColor = "rgba(0,0,0,0.25)";
          ctx.shadowBlur = 6;
          ctx.shadowOffsetY = 3;
          ctx.drawImage(turtleImage, dx, dy, TURTLE_W, TURTLE_H);
          ctx.restore();
        } else {
          ctx.save();
          ctx.translate(dx + TURTLE_W / 2, dy + TURTLE_H - 8);
          ctx.fillStyle = "#2e7d32";
          ctx.beginPath();
          ctx.ellipse(0, 4, 18, 14, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#1b5e20";
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.fillStyle = "#388e3c";
          ctx.beginPath();
          ctx.ellipse(0, -8, 10, 8, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = "#1b5e20";
          ctx.beginPath();
          ctx.ellipse(-2, -8, 2, 2.5, 0, 0, Math.PI * 2);
          ctx.ellipse(2, -8, 2, 2.5, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#558b2f";
          ctx.fillRect(-14, 10, 8, 4);
          ctx.fillRect(6, 10, 8, 4);
          ctx.restore();
        }
      } else {
        const img = duckImages[o.duckIndex];
        if (img && img.complete && img.naturalWidth > 0) {
          const dx = o.x - (DUCK_W - o.w) / 2;
          const dy = o.y + o.h - DUCK_H;
          ctx.save();
          ctx.shadowColor = "rgba(0,0,0,0.25)";
          ctx.shadowBlur = 6;
          ctx.shadowOffsetY = 3;
          ctx.drawImage(img, dx, dy, DUCK_W, DUCK_H);
          ctx.restore();
        } else {
          ctx.save();
          ctx.shadowColor = "rgba(0,0,0,0.3)";
          ctx.shadowBlur = 6;
          ctx.shadowOffsetY = 3;
          const oGr = ctx.createLinearGradient(o.x, o.y, o.x + o.w, o.y + o.h);
          oGr.addColorStop(0, "#8d6e63");
          oGr.addColorStop(0.3, "#6d4c41");
          oGr.addColorStop(1, "#4e342e");
          ctx.fillStyle = oGr;
          ctx.fillRect(o.x, o.y, o.w, o.h);
          ctx.restore();
          ctx.fillStyle = "rgba(129, 199, 132, 0.5)";
          ctx.fillRect(o.x, o.y, o.w, 4);
        }
      }
    });
  }

  // --- Collectibles (cappuccino cups) ---
  function spawnCollectible() {
    collectibles.push({
      x: canvas.width + 60,
      y: GROUND_Y - 80 - Math.random() * 120,
      r: 14,
    });
  }

  function drawCollectibles() {
    collectibles.forEach((c) => {
      const pulse = 1 + Math.sin(totalTime * 0.006 + c.x * 0.02) * 0.05;
      const float = Math.sin(totalTime * 0.004 + c.x * 0.03) * 5;
      const cx = c.x + c.r;
      const cy = c.y + c.r + float;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(pulse, pulse);

      if (level3Mode) {
        // --- Rainbow image (Level 3) ---
        const rainbowSize = 50;
        if (rainbowImage.complete && rainbowImage.naturalWidth > 0) {
          ctx.drawImage(rainbowImage, -rainbowSize / 2, -rainbowSize / 2, rainbowSize, rainbowSize);
        } else {
          ctx.fillStyle = "#ff6b6b";
          ctx.beginPath();
          ctx.arc(0, 0, 20, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (nightMode) {
        // --- Birthday cake image (Batman mode) ---
        const cakeSize = 62;
        if (cakeImage.complete && cakeImage.naturalWidth > 0) {
          ctx.drawImage(cakeImage, -cakeSize / 2, -cakeSize / 2, cakeSize, cakeSize);
        } else {
          ctx.fillStyle = "#f5deb3";
          ctx.fillRect(-18, -10, 36, 28);
          ctx.fillStyle = "#5d4037";
          ctx.fillRect(-4, -18, 3, 12);
          ctx.fillRect(-1, -20, 3, 14);
          ctx.fillRect(2, -18, 3, 12);
        }
      } else {
        // --- Cappuccino cup (normal mode) ---
        const outlineBrown = "#3e2723";
        const steamBrown = "#4e342e";
        const topW = 28;
        const bottomW = 20;
        const cupH = 30;
        const left = (topW - bottomW) / 2;
        ctx.translate(-topW / 2, -cupH / 2);
        ctx.strokeStyle = outlineBrown;
        ctx.lineWidth = 2.5;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.moveTo(2, 4);
        ctx.lineTo(topW - 2, 4);
        ctx.lineTo(topW - 2 - left, cupH - 4);
        ctx.lineTo(2 + left, cupH - 4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#5d4037";
        ctx.strokeStyle = outlineBrown;
        ctx.beginPath();
        ctx.moveTo(4, 10);
        ctx.lineTo(topW - 4, 10);
        ctx.lineTo(topW - 4 - left + 2, 14);
        ctx.lineTo(4 + left - 2, 14);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = outlineBrown;
        ctx.beginPath();
        ctx.arc(topW + 4, cupH / 2, 6, -Math.PI * 0.55, Math.PI * 0.55);
        ctx.stroke();
        const heartCx = topW / 2;
        const heartCy = cupH / 2 + 2;
        const heartR = 5;
        ctx.fillStyle = "#e53935";
        ctx.strokeStyle = outlineBrown;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(heartCx, heartCy + heartR * 0.4);
        ctx.bezierCurveTo(heartCx - heartR, heartCy - heartR * 0.4, heartCx - heartR * 1.2, heartCy + heartR * 0.6, heartCx, heartCy + heartR);
        ctx.bezierCurveTo(heartCx + heartR * 1.2, heartCy + heartR * 0.6, heartCx + heartR, heartCy - heartR * 0.4, heartCx, heartCy + heartR * 0.4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        const steamT = totalTime * 0.008 + c.x * 0.04;
        ctx.strokeStyle = steamBrown;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(6, 2);
        ctx.quadraticCurveTo(7 + Math.sin(steamT) * 3, -4, 8, -8);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(topW / 2, 2);
        ctx.quadraticCurveTo(topW / 2 + Math.sin(steamT + 1.5) * 4, -5, topW / 2, -10);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(topW - 6, 2);
        ctx.quadraticCurveTo(topW - 7 + Math.sin(steamT + 3) * 3, -4, topW - 8, -8);
        ctx.stroke();
      }

      ctx.restore();
    });
  }

  // --- Collect particles (coffee-themed when collecting) ---
  function spawnCollectParticles(cx, cy) {
    for (let i = 0; i < 18; i++) {
      particles.push({
        x: cx,
        y: cy,
        vx: (Math.random() - 0.5) * 7,
        vy: -3 - Math.random() * 5,
        life: 1,
        size: 5 + Math.random() * 8,
        rotation: (Math.random() - 0.5) * 4,
        rot: (Math.random() - 0.5) * 0.15,
      });
    }
  }

  function drawParticles(dt) {
    particles = particles.filter((p) => {
      p.x += p.vx * (dt / 16);
      p.y += p.vy * (dt / 16);
      p.vy += 0.18;
      p.life -= 0.012;
      p.rotation += p.rot;
      if (p.life <= 0) return false;
      const s = p.size * p.life;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.globalAlpha = p.life;
      ctx.fillStyle = "#8b6f47";
      ctx.beginPath();
      ctx.arc(0, 0, s, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();
      return true;
    });
  }

  // --- Collision (AABB) ---
  function collides(a, b) {
    return (
      a.x < b.x + b.w &&
      a.x + a.w > b.x &&
      a.y < b.y + b.h &&
      a.y + a.h > b.y
    );
  }

  function circleRect(cx, cy, r, rx, ry, rw, rh) {
    const dx = Math.max(rx, Math.min(cx, rx + rw)) - cx;
    const dy = Math.max(ry, Math.min(cy, ry + rh)) - cy;
    return dx * dx + dy * dy <= r * r;
  }

  // --- Update ---
  function update(dt) {
    if (state !== "playing") return;

    const t = (Date.now() - gameStartTime) / 1000;
    speed = BASE_SPEED;

    // Level 1 -> Level 2 (Batman) after 11 seconds, regardless of cups
    if (!nightMode && !level3Mode && t >= 11) {
      nightMode = true;
      if (batmanBannerStart < 0) batmanBannerStart = totalTime;
      if (batmanModeStartTime < 0) batmanModeStartTime = totalTime;
    }

    groundOffset += speed * (dt / 16);
    player.frameTimer += dt;
    if (player.frameTimer > 80) {
      player.frameTimer = 0;
      player.frame++;
    }

    // Gravity and jump
    player.vy += GRAVITY * (dt / 16);
    player.y += player.vy * (dt / 16);
    if (player.y >= GROUND_Y - PLAYER_HEIGHT) {
      player.y = GROUND_Y - PLAYER_HEIGHT;
      player.vy = 0;
    }

    const playerBox = {
      x: player.x + 4,
      y: player.y + 4,
      w: PLAYER_WIDTH - 8,
      h: PLAYER_HEIGHT - 8,
    };

    // Obstacles
    obstacles = obstacles.filter((o) => {
      o.x -= speed * (dt / 16);
      if (o.x + o.w < 0) return false;
      if (collides(playerBox, { x: o.x, y: o.y, w: o.w, h: o.h })) {
        if (freeHitRemaining > 0) {
          freeHitRemaining--;
          return false;
        }
        state = "gameover";
        gameOverScreen.style.display = "flex";
        hud.classList.remove("visible");
        finalScoreEl.textContent = score;
        stopBGM();
      }
      return true;
    });

    // Collectibles
    collectibles = collectibles.filter((c) => {
      c.x -= speed * (dt / 16);
      if (c.x + c.r * 2 < 0) return false;
      if (circleRect(player.x + PLAYER_WIDTH / 2, player.y + PLAYER_HEIGHT / 2, 22, c.x, c.y, c.r * 2, c.r * 2)) {
        collectibleScore += 10;
        cupsCollected += 1;
        spawnCollectParticles(c.x + c.r, c.y + c.r);
        playCollectSound();
        return false;
      }
      return true;
    });

    drawParticles(dt);

    // Spawn obstacles (delay 1 second in Level 1)
    const gameElapsed = (Date.now() - gameStartTime) / 1000;
    const canSpawnObstacles = nightMode || level3Mode || gameElapsed >= 1.0;
    const spacingOk = (obstacles.length === 0 || obstacles[obstacles.length - 1].x < canvas.width - 260);
    if (canSpawnObstacles && spacingOk) {
      const sinceLast = lastObstacleSpawnTime < 0 ? 1e9 : (totalTime - lastObstacleSpawnTime);
      // Gentle pacing: guarantee an obstacle about every ~1.4s if spacing allows
      if (sinceLast > 1400 || Math.random() < 0.02) {
        spawnObstacle();
        lastObstacleSpawnTime = totalTime;
      }
    }
    // Spawn collectibles (cups / cakes / rainbows) — start immediately in Level 1
    const collectSpacingOk = (collectibles.length === 0 || collectibles[collectibles.length - 1].x < canvas.width - 140);
    if (collectSpacingOk) {
      const sinceLastC = lastCollectibleSpawnTime < 0 ? 1e9 : (totalTime - lastCollectibleSpawnTime);
      // Keep it fun: guarantee about every ~1.1s, plus a slightly higher random chance
      if (sinceLastC > 1100 || Math.random() < 0.03) {
        spawnCollectible();
        lastCollectibleSpawnTime = totalTime;
      }
    }

    score = Math.floor(groundOffset / 30) + collectibleScore;
    scoreEl.textContent = score;
    timeEl.textContent = Math.min(Math.floor(t), WIN_TIME_SEC);

    // Win: 40s normally, or 11s in Level 3
    const batmanTime = batmanModeStartTime >= 0 ? (totalTime - batmanModeStartTime) / 1000 : 0;
    const level3Time = level3StartTime >= 0 ? (totalTime - level3StartTime) / 1000 : 0;
    
    // Transition from Batman mode to Level 3 after 11 seconds
    if (nightMode && !level3Mode && batmanTime >= 11) {
      level3Mode = true;
      level3StartTime = totalTime;
      level3BannerStart = totalTime;
    }
    
    // Win after 7 seconds in Level 3
    const hasWon = level3Mode ? (level3Time >= 7) : (nightMode ? false : (t >= WIN_TIME_SEC));
    if (hasWon) {
      stopBGM();
      hud.classList.remove("visible");
      if (level3Mode) {
        state = "winAnim";
        winAnimStartTime = totalTime;
        winRunnerX = player.x;
        winHearts = [];
        winHeartsSpawned = false;
        winNancyX = -90;
        winNancyReachedTime = -1;
        winFireworks = [];
        applausePlayed = false;
      } else {
        state = "win";
        winScreen.style.display = "flex";
      }
    }
  }

  // --- Batman mode banner (Level 2) ---
  function drawBatmanBanner() {
    if (batmanBannerStart < 0 || !nightMode || level3Mode) return;
    const elapsed = totalTime - batmanBannerStart;
    if (elapsed > 8000) return;
    const slideDur = 700;
    let y = 50;
    let alpha = 1;
    if (elapsed < slideDur) {
      y = -60 + (110 * elapsed / slideDur);
    } else if (elapsed > 6000) {
      alpha = 1 - (elapsed - 6000) / 2000;
    }
    const bannerText = "Congrats! You've entered Batman mode! (Level 2)";
    ctx.font = "bold 22px 'Courier New', monospace";
    const textWidth = ctx.measureText(bannerText).width;
    const paddingX = 56;
    const paddingY = 20;
    const bw = Math.ceil(textWidth) + paddingX * 2;
    const bh = 56 + paddingY;
    const bx = (canvas.width - bw) / 2;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = "#1a1a2e";
    roundRect(ctx, bx, y, bw, bh, 8);
    ctx.fill();
    ctx.strokeStyle = "#f9a825";
    ctx.lineWidth = 3;
    roundRect(ctx, bx, y, bw, bh, 8);
    ctx.stroke();
    ctx.restore();
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffeb3b";
    ctx.globalAlpha = alpha;
    ctx.fillText(bannerText, canvas.width / 2, y + bh / 2 + 8);
    ctx.globalAlpha = 1;
    ctx.textAlign = "left";
  }

  // --- Level 1 banner (Press SPACE BAR to Jump!) ---
  function drawLevel1Banner() {
    if (level1BannerStart < 0 || nightMode || level3Mode) return;
    const elapsed = totalTime - level1BannerStart;
    if (elapsed > 5000) return;
    const slideDur = 600;
    let y = 50;
    let alpha = 1;
    if (elapsed < slideDur) {
      y = -60 + (110 * elapsed / slideDur);
    } else if (elapsed > 4000) {
      alpha = 1 - (elapsed - 4000) / 1000;
    }
    const bannerText = "Press SPACE BAR to Jump!";
    ctx.font = "bold 22px 'Courier New', monospace";
    const textWidth = ctx.measureText(bannerText).width;
    const paddingX = 56;
    const paddingY = 20;
    const bw = Math.ceil(textWidth) + paddingX * 2;
    const bh = 56 + paddingY;
    const bx = (canvas.width - bw) / 2;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = "#e53935";
    roundRect(ctx, bx, y, bw, bh, 8);
    ctx.fill();
    ctx.strokeStyle = "#ff6b6b";
    ctx.lineWidth = 3;
    roundRect(ctx, bx, y, bw, bh, 8);
    ctx.stroke();
    ctx.restore();
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffffff";
    ctx.globalAlpha = alpha;
    ctx.fillText(bannerText, canvas.width / 2, y + bh / 2 + 8);
    ctx.globalAlpha = 1;
    ctx.textAlign = "left";
  }

  // --- Level 3 banner (Kulfi round) ---
  function drawLevel3Banner() {
    if (level3BannerStart < 0 || !level3Mode) return;
    const elapsed = totalTime - level3BannerStart;
    if (elapsed > 8000) return;
    const slideDur = 700;
    let y = 50;
    let alpha = 1;
    if (elapsed < slideDur) {
      y = -60 + (110 * elapsed / slideDur);
    } else if (elapsed > 6000) {
      alpha = 1 - (elapsed - 6000) / 2000;
    }
    const bannerText = "Level 3: Seattle round!";
    ctx.font = "bold 22px 'Courier New', monospace";
    const textWidth = ctx.measureText(bannerText).width;
    const paddingX = 56;
    const paddingY = 20;
    const bw = Math.ceil(textWidth) + paddingX * 2;
    const bh = 56 + paddingY;
    const bx = (canvas.width - bw) / 2;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = "#283593";
    roundRect(ctx, bx, y, bw, bh, 8);
    ctx.fill();
    ctx.strokeStyle = "#5c6bc0";
    ctx.lineWidth = 3;
    roundRect(ctx, bx, y, bw, bh, 8);
    ctx.stroke();
    ctx.restore();
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffffff";
    ctx.globalAlpha = alpha;
    ctx.fillText(bannerText, canvas.width / 2, y + bh / 2 + 8);
    ctx.globalAlpha = 1;
    ctx.textAlign = "left";
  }

  // --- Win animation (Batman mode: finish line -> podium -> sign) ---
  const WIN_RUN_DUR = 2500;
  const PODIUM_START = 2500;
  const MEDAL_DUR = 1200;
  const SIGN_POP_AT = 5500;
  const SHOW_WIN_SCREEN_AT = 14000;
  const NANCY_WALK_DELAY_MS = 700;
  const NANCY_WALK_DUR_MS = 2200;
  const NANCY_TARGET_OFFSET = 72;

  function updateWinAnim(dt) {
    const elapsed = totalTime - winAnimStartTime;
    if (elapsed < WIN_RUN_DUR) {
      winRunnerX += (800 * dt) / WIN_RUN_DUR;
    } else if (elapsed >= PODIUM_START) {
      const podElapsed = elapsed - PODIUM_START;
      const cw = canvas.width;
      const vineetX = cw * 0.5;
      const nancyTargetX = vineetX - NANCY_TARGET_OFFSET;

      if (podElapsed <= MEDAL_DUR) {
        const t = podElapsed / MEDAL_DUR;
        const ease = 1 - Math.pow(1 - t, 2);
        const targetX = canvas.width * 0.5;
        const targetY = 340;
        winTrophyX = canvas.width + 120 - (canvas.width + 120 - targetX) * ease;
        winTrophyY = -100 + (targetY - (-100)) * ease;
      } else {
        winTrophyX = canvas.width * 0.5;
        winTrophyY = 340;
      }

      if (podElapsed >= NANCY_WALK_DELAY_MS) {
        const walkT = (podElapsed - NANCY_WALK_DELAY_MS) / NANCY_WALK_DUR_MS;
        const easeOut = 1 - Math.pow(1 - Math.min(1, walkT), 1.2);
        winNancyX = -90 + (nancyTargetX - (-90)) * easeOut;
        if (winNancyReachedTime < 0 && winNancyX >= nancyTargetX - 3) {
          winNancyReachedTime = totalTime;
        }
      }

      if (winNancyReachedTime > 0 && winFireworks.length < 35) {
        if (Math.random() < 0.08) {
          const x = Math.random() * cw;
          const y = 60 + Math.random() * 180;
          const colors = ["#ff6b6b", "#ffd93d", "#6bcb77", "#4d96ff", "#ff8c42", "#c44dff"];
          const color = colors[Math.floor(Math.random() * colors.length)];
          for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2 + Math.random();
            const speed = 2 + Math.random() * 3;
            winFireworks.push({
              x, y, color,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed - 1,
              life: 0,
              maxLife: 600 + Math.random() * 400,
              size: 2 + Math.random() * 2
            });
          }
        }
      }
      winFireworks = winFireworks.filter((f) => {
        f.x += f.vx * (dt / 16);
        f.y += f.vy * (dt / 16);
        f.vy += 0.08 * (dt / 16);
        f.life += dt;
        return f.life < f.maxLife;
      });

      if (!winHeartsSpawned && podElapsed > 100) {
        winHeartsSpawned = true;
        for (let i = 0; i < 27; i++) {
          winHearts.push({
            x: (canvas.width / 28) * (i + 0.5) + (Math.random() - 0.5) * 20,
            y: canvas.height + 15 + (i % 5) * 25,
            vy: -0.6 - Math.random() * 0.5,
            vx: (Math.random() - 0.5) * 0.3,
            life: 1,
            size: 14 + Math.random() * 10,
          });
        }
      }
      winTrumpetL = Math.min(180, (podElapsed / 500) * 180);
      winTrumpetR = Math.min(180, (podElapsed / 500) * 180);
      winHearts = winHearts.filter((h) => {
        h.x += h.vx * (dt / 16);
        h.y += h.vy * (dt / 16);
        return h.y > -50;
      });
    }
    if (elapsed >= SHOW_WIN_SCREEN_AT) {
      state = "win";
      winScreen.style.display = "flex";
    }
  }

  function drawWinAnimation() {
    const elapsed = totalTime - winAnimStartTime;
    const cw = canvas.width;
    const ch = canvas.height;

    if (elapsed < WIN_RUN_DUR) {
      drawSky();
      drawCitySkyline();
      drawGround();
      const finishX = cw - 50;
      const poleH = 100;
      const poleY = ch - GROUND_H - poleH;
      const bannerW = 140;
      const bannerH = 36;
      const barY = poleY + 20;
      ctx.fillStyle = "#9e9e9e";
      ctx.fillRect(finishX - 65, poleY + poleH - 12, 10, 12);
      ctx.fillRect(finishX + 55, poleY + poleH - 12, 10, 12);
      ctx.fillStyle = "#bdbdbd";
      ctx.fillRect(finishX - 60, poleY, 8, poleH);
      ctx.fillRect(finishX + 52, poleY, 8, poleH);
      ctx.fillStyle = "#bdbdbd";
      ctx.fillRect(finishX - 60, poleY, bannerW + 24, 6);
      ctx.fillStyle = "#ffc107";
      ctx.beginPath();
      ctx.moveTo(finishX - 58, barY + 6);
      ctx.lineTo(finishX - 50, barY + bannerH - 4);
      ctx.lineTo(finishX + 50, barY + bannerH - 4);
      ctx.lineTo(finishX + 58, barY + 6);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.15)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 28px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("FINISH", finishX, barY + bannerH / 2);
      ctx.textBaseline = "alphabetic";
      ctx.textAlign = "left";
      ctx.save();
      ctx.translate(winRunnerX, GROUND_Y - PLAYER_HEIGHT);
      // Use Level 1 character (head.png and red t-shirt)
      const headR = 20;
      if (headImage.complete && headImage.naturalWidth > 0) {
        ctx.beginPath();
        ctx.arc(21, 16, headR, 0, Math.PI * 2);
        ctx.closePath();
        ctx.save();
        ctx.clip();
        ctx.drawImage(headImage, 21 - headR, 16 - headR - 2, headR * 2, headR * 2.1);
        ctx.restore();
      } else {
        ctx.fillStyle = "#ffcc80";
        ctx.beginPath();
        ctx.arc(21, 16, headR, 0, Math.PI * 2);
        ctx.fill();
      }
      // Red t-shirt (Level 1 outfit)
      const bodyGr = ctx.createLinearGradient(8, 20, 34, 48);
      bodyGr.addColorStop(0, "#ef5350");
      bodyGr.addColorStop(0.5, "#e53935");
      bodyGr.addColorStop(1, "#c62828");
      ctx.fillStyle = bodyGr;
      ctx.fillRect(8, 20, 26, 28);
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fillRect(10, 22, 6, 12);
      // Legs
      ctx.fillStyle = "#37474f";
      ctx.fillRect(10, 44, 8, 14);
      ctx.fillRect(24, 44, 8, 14);
      ctx.restore();
      return;
    }

    const podElapsed = elapsed - PODIUM_START;
    ctx.fillStyle = "#1a1a3e";
    ctx.fillRect(0, 0, cw, ch);
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.3 + 0.3 * Math.sin(totalTime * 0.002 + i)})`;
      ctx.beginPath();
      ctx.arc((i * 47 + podElapsed * 0.1) % (cw + 40) - 20, (i * 31 % ch), 2, 0, Math.PI * 2);
      ctx.fill();
    }

    const jumpOffsetY = winNancyReachedTime > 0
      ? -6 * Math.sin((totalTime - winNancyReachedTime) * 0.009)
      : 0;

    winFireworks.forEach((f) => {
      const alpha = 1 - f.life / f.maxLife;
      ctx.fillStyle = f.color;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    const podY = ch - 90;
    const podH = [50, 85, 45];
    const podX = [cw * 0.22, cw * 0.5, cw * 0.78];
    const podW = 110;

    const podLabels = ["2nd", "1st", "3rd"];
    for (let i = 0; i < 3; i++) {
      const px = podX[i] - podW / 2;
      const ph = podH[i];
      const py = podY + (90 - ph);
      ctx.fillStyle = "#3e2723";
      ctx.fillRect(px, py, podW, ph);
      ctx.strokeStyle = "#5d4037";
      ctx.lineWidth = 2;
      ctx.strokeRect(px, py, podW, ph);
      ctx.fillStyle = "#6d4c41";
      ctx.fillRect(px, py, podW, 8);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 18px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(podLabels[i], podX[i], py + ph - 22);
      ctx.textAlign = "left";
    }

    function drawPodiumCharacter(cx, cy, shirtColor, scale) {
      const bodyH = 32 * scale;
      const bodyW = 22 * scale;
      const headR = 14 * scale;
      ctx.fillStyle = shirtColor;
      ctx.fillRect(cx - bodyW / 2, cy - bodyH - headR * 2 + 4, bodyW, bodyH);
      ctx.strokeStyle = "rgba(0,0,0,0.2)";
      ctx.lineWidth = 1;
      ctx.strokeRect(cx - bodyW / 2, cy - bodyH - headR * 2 + 4, bodyW, bodyH);
      ctx.fillStyle = "#ffcc80";
      ctx.beginPath();
      ctx.arc(cx, cy - bodyH - headR * 2 + 4, headR, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#263238";
      ctx.beginPath();
      ctx.arc(cx, cy - bodyH - headR * 2, headR * 0.85, 0, Math.PI);
      ctx.fill();
      ctx.fillRect(cx - headR * 0.9, cy - bodyH - headR * 2.2, headR * 1.8, headR * 0.9);
      ctx.fillStyle = "#212121";
      ctx.fillRect(cx - 5 * scale, cy - bodyH - headR * 2.2, 3 * scale, 2 * scale);
      ctx.fillRect(cx + 2 * scale, cy - bodyH - headR * 2.2, 3 * scale, 2 * scale);
      ctx.fillStyle = "#37474f";
      ctx.fillRect(cx - bodyW / 2 - 4, cy - bodyH - headR + 4, 6 * scale, 10 * scale);
      ctx.fillRect(cx + bodyW / 2 - 2, cy - bodyH - headR + 4, 6 * scale, 10 * scale);
    }

    drawPodiumCharacter(podX[0], podY - podH[0], "#2e7d32", 1.0);
    drawPodiumCharacter(podX[2], podY - podH[2], "#1565c0", 0.95);
    const vineetX = podX[1];
    const vineetY = podY - podH[1] - 10;
    const vineetScale = 1.35;

    const nancyScale = 1.15;
    const nancyBodyW = 22;
    const nancyBodyH = 34;
    const nancyHeadR = 38;
    const nancyBaseY = vineetY + jumpOffsetY;
    ctx.save();
    ctx.translate(winNancyX, nancyBaseY);
    ctx.scale(nancyScale, nancyScale);
    ctx.fillStyle = "#e91e63";
    ctx.beginPath();
    ctx.moveTo(-nancyBodyW / 2, 12);
    ctx.lineTo(-nancyBodyW / 2 - 4, nancyBodyH + 8);
    ctx.lineTo(nancyBodyW / 2 + 4, nancyBodyH + 8);
    ctx.lineTo(nancyBodyW / 2, 12);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.15)";
    ctx.lineWidth = 1;
    ctx.stroke();
    if (nancyImage.complete && nancyImage.naturalWidth > 0) {
      ctx.beginPath();
      ctx.arc(0, -nancyHeadR + 4, nancyHeadR, 0, Math.PI * 2);
      ctx.closePath();
      ctx.save();
      ctx.clip();
      ctx.drawImage(nancyImage, -nancyHeadR, -nancyHeadR - 4, nancyHeadR * 2, nancyHeadR * 2.1);
      ctx.restore();
    } else {
      ctx.fillStyle = "#ffcc80";
      ctx.beginPath();
      ctx.arc(0, -nancyHeadR + 4, nancyHeadR, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    ctx.save();
    ctx.translate(vineetX, vineetY + jumpOffsetY);
    ctx.scale(vineetScale, vineetScale);
    ctx.fillStyle = "#2d2d35";
    ctx.fillRect(-14, 18, 28, 32);
    ctx.fillStyle = "#f9a825";
    ctx.beginPath();
    ctx.moveTo(0, 26);
    ctx.lineTo(-6, 48);
    ctx.lineTo(0, 42);
    ctx.lineTo(6, 48);
    ctx.closePath();
    ctx.fill();
    const headR = 32;
    if (headImage.complete && headImage.naturalWidth > 0) {
      ctx.beginPath();
      ctx.arc(0, -5, headR, 0, Math.PI * 2);
      ctx.closePath();
      ctx.save();
      ctx.clip();
      ctx.drawImage(headImage, -headR, -headR - 7, headR * 2, headR * 2.15);
      ctx.restore();
    } else {
      ctx.fillStyle = "#ffcc80";
      ctx.beginPath();
      ctx.arc(0, -5, headR, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    const trophyOffsetX = 95;
    const trophyOffsetY = 8;
    const trophySize = 1.35;

    function drawTrophy(tx, ty, size) {
      const s = (size || 1) * trophySize;
      const w = 110 * s;
      const h = 145 * s;
      if (trophyImage.complete && trophyImage.naturalWidth > 0) {
        ctx.drawImage(trophyImage, tx - w / 2, ty - h + 40 * s, w, h);
      } else {
        ctx.fillStyle = "#ffd54f";
        ctx.strokeStyle = "#f9a825";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(tx - 18 * s, ty + 25 * s);
        ctx.lineTo(tx - 22 * s, ty + 45 * s);
        ctx.lineTo(tx - 12 * s, ty + 45 * s);
        ctx.lineTo(tx - 8 * s, ty + 28 * s);
        ctx.lineTo(tx, ty + 10 * s);
        ctx.lineTo(tx + 8 * s, ty + 28 * s);
        ctx.lineTo(tx + 12 * s, ty + 45 * s);
        ctx.lineTo(tx + 22 * s, ty + 45 * s);
        ctx.lineTo(tx + 18 * s, ty + 25 * s);
        ctx.quadraticCurveTo(tx + 20 * s, ty - 5 * s, tx, ty - 18 * s);
        ctx.quadraticCurveTo(tx - 20 * s, ty - 5 * s, tx - 18 * s, ty + 25 * s);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#5d4037";
        ctx.fillRect(tx - 15 * s, ty + 44 * s, 30 * s, 8 * s);
        ctx.strokeRect(tx - 15 * s, ty + 44 * s, 30 * s, 8 * s);
        ctx.fillStyle = "#fff";
        ctx.font = `bold ${14 * s}px sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText("1", tx, ty + 8 * s);
        ctx.textAlign = "left";
      }
    }

    const trophyX = vineetX + trophyOffsetX;
    const trophyY = vineetY + trophyOffsetY;
    if (podElapsed <= MEDAL_DUR + 200) {
      const t = Math.min(1, podElapsed / MEDAL_DUR);
      const ease = 1 - Math.pow(1 - t, 2);
      const targetX = trophyX;
      const targetY = trophyY;
      const tx = cw + 120 - (cw + 120 - targetX) * ease;
      const ty = -100 + (targetY - (-100)) * ease;
      drawTrophy(tx, ty, 1);
    } else {
      drawTrophy(trophyX, trophyY, 1);
    }

    const rainbowCx = cw / 2;
    const rainbowCy = ch + 140;
    const rainbowR = 420;
    const rAlpha = 0.55 + 0.2 * Math.sin(totalTime * 0.002);
    const bands = [
      "rgba(255,80,80)",
      "rgba(255,160,80)",
      "rgba(255,255,80)",
      "rgba(120,255,120)",
      "rgba(80,180,255)",
      "rgba(140,100,255)",
    ];
    bands.forEach((color, i) => {
      ctx.strokeStyle = color.replace(")", `,${rAlpha})`);
      ctx.lineWidth = 16;
      ctx.beginPath();
      ctx.arc(rainbowCx, rainbowCy, rainbowR + i * 20, Math.PI * 0.22, Math.PI * 0.78);
      ctx.stroke();
    });

    function drawTrumpet(ox, oy, flip) {
      ctx.save();
      ctx.translate(ox, oy);
      if (flip) ctx.scale(-1, 1);
      ctx.rotate(-0.25);
      ctx.fillStyle = "#ffc107";
      ctx.strokeStyle = "#ff8f00";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, 28, 45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#ff9800";
      ctx.beginPath();
      ctx.ellipse(0, 0, 22, 38, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#5d4037";
      ctx.fillRect(38, -6, 55, 12);
      ctx.strokeStyle = "#4e342e";
      ctx.strokeRect(38, -6, 55, 12);
      ctx.fillStyle = "#8d6e63";
      ctx.beginPath();
      ctx.arc(90, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#5d4037";
      ctx.beginPath();
      ctx.moveTo(42, 8);
      ctx.lineTo(48, 28);
      ctx.lineTo(54, 8);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(58, 6);
      ctx.lineTo(64, 26);
      ctx.lineTo(70, 6);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(74, 8);
      ctx.lineTo(80, 28);
      ctx.lineTo(86, 8);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    drawTrumpet(-100 + winTrumpetL, ch * 0.45, false);
    drawTrumpet(cw + 100 - winTrumpetR, ch * 0.45, true);

    winHearts.forEach((h) => {
      ctx.globalAlpha = Math.min(1, h.life);
      ctx.fillStyle = "#e91e63";
      ctx.strokeStyle = "#ad1457";
      ctx.lineWidth = 2;
      ctx.save();
      ctx.translate(h.x, h.y);
      ctx.rotate(Math.sin(totalTime * 0.003 + h.x * 0.02) * 0.2);
      ctx.beginPath();
      ctx.moveTo(0, -h.size * 0.45);
      ctx.bezierCurveTo(h.size * 1.1, -h.size * 0.5, h.size * 1.0, h.size * 0.35, 0, h.size * 0.7);
      ctx.bezierCurveTo(-h.size * 1.0, h.size * 0.35, -h.size * 1.1, -h.size * 0.5, 0, -h.size * 0.45);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      ctx.globalAlpha = 1;
    });

    if (elapsed >= SIGN_POP_AT) {
      const signT = Math.min(1, (elapsed - SIGN_POP_AT) / 600);
      const scale = 1 - Math.pow(1 - signT, 3);
      ctx.save();
      ctx.translate(cw / 2, 140);
      ctx.scale(scale, scale);
      ctx.fillStyle = "rgba(26, 26, 46, 0.95)";
      ctx.strokeStyle = "#f9a825";
      ctx.lineWidth = 4;
      roundRect(ctx, -220, -50, 440, 120, 12);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#ffeb3b";
      ctx.font = "bold 24px 'Courier New', monospace";
      ctx.textAlign = "center";
      ctx.fillText("Happy Valentine's Day Vineet!", 0, -15);
      ctx.font = "bold 20px 'Courier New', monospace";
      ctx.fillText("You already won my heart.", 0, 18);
      ctx.fillText("Love you forever ❤️", 0, 52);
      ctx.textAlign = "left";
      ctx.restore();

      if (winningImage.complete && winningImage.naturalWidth > 0) {
        if (!applausePlayed && signT > 0.1) {
          playApplause();
          applausePlayed = true;
        }
        ctx.save();
        ctx.globalAlpha = scale;
        const imgW = 200;
        const imgH = (winningImage.naturalHeight / winningImage.naturalWidth) * imgW;
        ctx.drawImage(winningImage, cw / 2 - imgW / 2, 260, imgW, imgH);
        ctx.restore();
      }
    }

    if (elapsed > SHOW_WIN_SCREEN_AT - 2000) {
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.font = "16px 'Courier New', monospace";
      ctx.textAlign = "center";
      ctx.fillText("Press SPACE to play again", cw / 2, ch - 30);
      ctx.textAlign = "left";
    }
  }

  // --- Intro: envelope -> open -> letter -> start button ---
  const ENVELOPE_GROW_MS = 2800;
  const ENVELOPE_FINAL_SCALE = 1.32;
  const FLAP_OPEN_MS = 1200;
  const LETTER_SLIDE_MS = 1000;
  const LETTER_SLIDE_DELAY_MS = 500;
  const OPENING_TO_LETTER_MS = 2800;
  const INTRO_DIM_ALPHA = 0.45;
  const INTRO_DIM_MS = 700;

  function drawSmallHeart(ctx, x, y, scale, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#e91e63";
    ctx.beginPath();
    ctx.moveTo(0, 4);
    ctx.bezierCurveTo(6, -2, 6, 5, 0, 10);
    ctx.bezierCurveTo(-6, 5, -6, -2, 0, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawIntro() {
    const cw = canvas.width;
    const ch = canvas.height;
    ctx.fillStyle = "#f8b4c4";
    ctx.fillRect(0, 0, cw, ch);

    if (introPhase === "envelope") {
      drawIntroEnvelope(cw, ch);
      return;
    }
    if (introPhase === "opening" || introPhase === "letter") {
      drawIntroOpeningAndLetter(cw, ch);
    }
  }

  function drawIntroEnvelope(cw, ch) {
    const growT = Math.min(1, totalTime / ENVELOPE_GROW_MS);
    const scale = 0.12 + (ENVELOPE_FINAL_SCALE - 0.12) * (1 - Math.pow(1 - growT, 1.5));
    const spinRaw = totalTime * 0.003;
    const spinUpright = Math.round((ENVELOPE_GROW_MS * 0.003) / (Math.PI * 2)) * (Math.PI * 2);
    const spin = growT >= 1 ? spinUpright : spinRaw;
    const bounce = growT >= 1 ? 6 * Math.sin(totalTime * 0.004) : 0;
    const cx = cw / 2;
    const cy = ch / 2 + bounce;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(spin);
    ctx.scale(scale, scale);
    const ew = 120;
    const eh = 80;
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "rgba(0,0,0,0.08)";
    ctx.lineWidth = 2;
    roundRect(ctx, -ew / 2, -eh / 2 + 12, ew, eh - 12, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#fafafa";
    ctx.beginPath();
    ctx.moveTo(-ew / 2, -eh / 2 + 12);
    ctx.lineTo(0, -eh / 2 + 35);
    ctx.lineTo(ew / 2, -eh / 2 + 12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#e91e63";
    ctx.strokeStyle = "#ad1457";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 8);
    ctx.bezierCurveTo(14, -4, 14, 14, 0, 22);
    ctx.bezierCurveTo(-14, 14, -14, -4, 0, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    if (growT >= 1) {
      const glowPulse = 0.85 + 0.2 * Math.sin(totalTime * 0.003);
      ctx.shadowColor = "rgba(255, 120, 180, 0.95)";
      ctx.shadowBlur = 22 + 14 * Math.sin(totalTime * 0.003);
      ctx.strokeStyle = `rgba(255, 230, 240, ${glowPulse})`;
      ctx.lineWidth = 5;
      roundRect(ctx, -ew / 2, -eh / 2 + 12, ew, eh - 12, 6);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-ew / 2, -eh / 2 + 12);
      ctx.lineTo(0, -eh / 2 + 35);
      ctx.lineTo(ew / 2, -eh / 2 + 12);
      ctx.closePath();
      ctx.stroke();
      ctx.shadowBlur = 0;
      if (introPrompt) introPrompt.style.visibility = "visible";
    }
    ctx.restore();
  }

  function drawIntroOpeningAndLetter(cw, ch) {
    const t = totalTime - introOpeningStartTime;

    // Dim overlay
    const dimT = Math.min(1, t / INTRO_DIM_MS);
    ctx.fillStyle = `rgba(0,0,0,${INTRO_DIM_ALPHA * dimT})`;
    ctx.fillRect(0, 0, cw, ch);

    const scale = ENVELOPE_FINAL_SCALE;
    const cx = cw / 2;
    const cy = ch / 2;
    const ew = 120;
    const eh = 80;

    // Envelope body (no flap when open, or flap folded back)
    const flapT = Math.min(1, t / FLAP_OPEN_MS);
    const flapAngle = flapT * Math.PI * 0.85;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "rgba(0,0,0,0.08)";
    ctx.lineWidth = 2;
    roundRect(ctx, -ew / 2, -eh / 2 + 12, ew, eh - 12, 6);
    ctx.fill();
    ctx.stroke();
    ctx.save();
    ctx.translate(0, -eh / 2 + 12);
    ctx.rotate(-flapAngle);
    ctx.translate(0, eh / 2 - 12);
    ctx.fillStyle = "#fafafa";
    ctx.beginPath();
    ctx.moveTo(-ew / 2, -eh / 2 + 12);
    ctx.lineTo(0, -eh / 2 + 35);
    ctx.lineTo(ew / 2, -eh / 2 + 12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    if (flapT < 1) {
      ctx.fillStyle = "#e91e63";
      ctx.strokeStyle = "#ad1457";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 8);
      ctx.bezierCurveTo(14, -4, 14, 14, 0, 22);
      ctx.bezierCurveTo(-14, 14, -14, -4, 0, 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
    ctx.restore();

    // Floating hearts
    introHearts.forEach((h) => {
      const a = 1 - h.life / h.maxLife;
      drawSmallHeart(ctx, h.x, h.y, h.scale, a);
    });

    // Letter paper slide-up
    const letterStart = LETTER_SLIDE_DELAY_MS;
    const letterDur = LETTER_SLIDE_MS;
    const letterT = Math.min(1, (t - letterStart) / letterDur);
    const easeOut = 1 - Math.pow(1 - letterT, 1.4);
    const paperH = 340;
    const paperW = 420;
    const paperFinalY = ch * 0.42 - paperH / 2;
    const paperY = letterT <= 0 ? ch + 50 : paperFinalY + (1 - easeOut) * (ch + 50 - paperFinalY);

    const bottomPaper = letterT > 0 ? paperY + paperH : ch;

    if (letterT > 0) {
      ctx.save();
      const paperX = (cw - paperW) / 2;
      ctx.shadowColor = "rgba(0,0,0,0.2)";
      ctx.shadowBlur = 14;
      ctx.shadowOffsetY = 6;
      ctx.fillStyle = "#f9f6ef";
      ctx.strokeStyle = "rgba(140,120,100,0.35)";
      ctx.lineWidth = 1.5;
      roundRect(ctx, paperX, paperY, paperW, paperH, 6);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.fillStyle = "#2c2520";
      ctx.font = "bold 22px Georgia, serif";
      ctx.textAlign = "center";
      ctx.fillText("To Vineet ❤️", cw / 2, paperY + 42);
      ctx.font = "16px Georgia, serif";
      ctx.textAlign = "left";
      const left = paperX + 28;
      let lineY = paperY + 78;
      const lineH = 24;
      const maxTextW = paperW - 56; // left+right padding
      const lines = [
        "Welcome to the 🏁 Valentine's Marathon 🏁",
        "",
        "Your mission:",
        "__BULLET__Run fast",
        "__BULLET__Jump over obstacles by pressing the SPACE-BAR\u00A0⬆️",
        "__BULLET__Collect cappachinos to earn points! ☕️",
        "I'm waiting for you at the finish line.",
        "",
        "PS: You already make my heart race.",
        "",
        "xoxo",
        "Nancy💋"
      ];
      function drawWrappedLine(text) {
        if (!text) {
          lineY += 14;
          return;
        }
        const isBullet = text.startsWith("__BULLET__");
        const cleanText = isBullet ? text.replace("__BULLET__", "") : text;
        const textX = isBullet ? left + 18 : left;
        const availableW = isBullet ? (maxTextW - 18) : maxTextW;

        if (isBullet) {
          // Pink heart bullet
          drawSmallHeart(ctx, left + 6, lineY - 6, 1.15, 1);
        }

        const words = cleanText.split(" ");
        let cur = "";
        for (let i = 0; i < words.length; i++) {
          const next = cur ? `${cur} ${words[i]}` : words[i];
          if (ctx.measureText(next).width > availableW && cur) {
            ctx.fillText(cur, textX, lineY);
            lineY += lineH;
            cur = words[i];
          } else {
            cur = next;
          }
        }
        if (cur) {
          ctx.fillText(cur, textX, lineY);
          lineY += lineH;
        }
      }
      lines.forEach(drawWrappedLine);
      ctx.restore();
    }

    if (introPhase === "letter") {
      const letterPhaseTime = t - OPENING_TO_LETTER_MS;
      const promptY = bottomPaper + 40;
      const buttonY = bottomPaper + 60;
      if (letterPhaseTime > 600) {
        ctx.fillStyle = "#fff";
        ctx.font = "bold 20px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Ready to run, Batman?", cw / 2, promptY);
      }
      if (letterPhaseTime > 1100) {
        drawIntroStartButton(cw, ch, buttonY);
      } else {
        introLetterButtonBounds = null;
      }
    } else {
      introLetterButtonBounds = null;
    }

    if (introPhase === "opening" && t >= OPENING_TO_LETTER_MS) {
      introPhase = "letter";
    }
  }

  function drawIntroStartButton(cw, ch, buttonY) {
    const bw = 220;
    const bh = 48;
    const bx = cw / 2 - bw / 2;
    const byRaw = buttonY != null ? buttonY : ch - 75;
    const by = Math.min(byRaw, ch - bh - 20); // leave ~0.5cm pink space under button
    const hover = introLetterButtonHover;
    ctx.save();
    ctx.fillStyle = hover ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.88)";
    ctx.strokeStyle = "rgba(200,80,120,0.8)";
    ctx.lineWidth = 2;
    roundRect(ctx, bx, by, bw, bh, 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#c2185b";
    ctx.font = "bold 18px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("👉 Start the run", cw / 2, by + bh / 2 + 6);
    ctx.restore();
    introLetterButtonBounds = { left: bx, right: bx + bw, top: by, bottom: by + bh };
  }

  let introLetterButtonBounds = null;
  let introLetterButtonHover = false;

  function getIntroEnvelopeBounds() {
    const cw = canvas.width;
    const ch = canvas.height;
    const growT = Math.min(1, totalTime / ENVELOPE_GROW_MS);
    const scale = 0.12 + (ENVELOPE_FINAL_SCALE - 0.12) * (1 - Math.pow(1 - growT, 1.5));
    const bounce = growT >= 1 ? 6 * Math.sin(totalTime * 0.004) : 0;
    const cx = cw / 2;
    const cy = ch / 2 + bounce;
    const half = 75 * scale;
    return { left: cx - half, right: cx + half, top: cy - half, bottom: cy + half };
  }

  // --- Draw ---
  function draw() {
    if (state === "intro") {
      drawIntro();
      return;
    }
    if (state === "winAnim") {
      drawWinAnimation();
      return;
    }
    drawSky();
    if (level3Mode) drawSeattleSkyline();
    if (nightMode && !level3Mode) drawCitySkyline();
    if (!nightMode && !level3Mode) drawLevel1Banner();
    if (nightMode && !level3Mode) drawBatmanBanner();
    if (level3Mode) drawLevel3Banner();
    drawClouds();
    drawGround();
    drawTrees();
    drawPlatforms();
    if (state === "playing") {
      drawObstacles();
      drawCollectibles();
      drawPlayer();
    }
  }

  function updateIntro(dt) {
    if (introPhase === "opening" || introPhase === "letter") {
      const t = totalTime - introOpeningStartTime;
      introHearts.forEach((h) => {
        h.x += h.vx * dt;
        h.y += h.vy * dt;
        h.life += dt;
      });
      introHearts = introHearts.filter((h) => h.life < h.maxLife);
      if (introPhase === "opening" && t < 900 && t >= 0) {
        if (Math.floor(t / 90) > Math.floor((t - dt) / 90)) {
          const cw = canvas.width;
          const ch = canvas.height;
          const cx = cw / 2;
          const cy = ch / 2;
          for (let i = 0; i < 3; i++) {
            introHearts.push({
              x: cx + (Math.random() - 0.5) * 50,
              y: cy + (Math.random() - 0.5) * 20,
              vx: (Math.random() - 0.5) * 0.2,
              vy: -0.2 - Math.random() * 0.2,
              life: 0,
              maxLife: 2500 + Math.random() * 1500,
              scale: 0.35 + Math.random() * 0.35
            });
          }
        }
      }
    }
  }

  function loop(ts) {
    const dt = Math.min(ts - (loop.last || ts), 50);
    loop.last = ts;
    totalTime += dt;
    if (state === "playing") update(dt);
    if (state === "winAnim") updateWinAnim(dt);
    if (state === "intro") updateIntro(dt);
    draw();
    animId = requestAnimationFrame(loop);
  }

  // --- Start / Restart ---
  function startGame() {
    state = "playing";
    score = 0;
    collectibleScore = 0;
    cupsCollected = 0;
    nightMode = false;
    level3Mode = false;
    batmanBannerStart = -1;
    level3BannerStart = -1;
    level1BannerStart = totalTime;
    gameStartTime = Date.now();
    speed = BASE_SPEED;
    groundOffset = 0;
    player.y = GROUND_Y - PLAYER_HEIGHT;
    player.vy = 0;
    player.frame = 0;
    player.frameTimer = 0;
    obstacles = [];
    collectibles = [];
    particles = [];
    freeHitRemaining = 1;
    batmanModeStartTime = -1;
    level3StartTime = -1;
    lastObstacleSpawnTime = -1;
    lastCollectibleSpawnTime = -1;

    startScreen.style.display = "none";
    gameOverScreen.style.display = "none";
    winScreen.style.display = "none";
    hud.classList.add("visible");
    scoreEl.textContent = "0";
    timeEl.textContent = "0";

    musicOn = true;
    startBGM();
  }

  function resetToStart() {
    state = "start";
    startScreen.style.display = "flex";
    gameOverScreen.style.display = "none";
    winScreen.style.display = "none";
    hud.classList.remove("visible");
    stopBGM();
  }

  canvas.addEventListener("click", (e) => {
    if (state !== "intro") return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const px = (e.clientX - rect.left) * scaleX;
    const py = (e.clientY - rect.top) * scaleY;

    if (introPhase === "letter" && introLetterButtonBounds) {
      const b = introLetterButtonBounds;
      if (px >= b.left && px <= b.right && py >= b.top && py <= b.bottom) {
        introScreen.style.display = "none";
        startGame();
        return;
      }
    }

    if (introPhase === "envelope") {
      const growT = Math.min(1, totalTime / ENVELOPE_GROW_MS);
      if (growT < 1) return;
      const b = getIntroEnvelopeBounds();
      if (px >= b.left && px <= b.right && py >= b.top && py <= b.bottom) {
        introPhase = "opening";
        introOpeningStartTime = totalTime;
        if (introPrompt) introPrompt.style.visibility = "hidden";
        playPaperRustle();
      }
    }
  });

  canvas.addEventListener("mousemove", (e) => {
    if (state !== "intro" || introPhase !== "letter" || !introLetterButtonBounds) {
      introLetterButtonHover = false;
      canvas.style.cursor = "";
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const px = (e.clientX - rect.left) * scaleX;
    const py = (e.clientY - rect.top) * scaleY;
    const b = introLetterButtonBounds;
    introLetterButtonHover = px >= b.left && px <= b.right && py >= b.top && py <= b.bottom;
    canvas.style.cursor = introLetterButtonHover ? "pointer" : "";
  });

  // --- Input ---
  document.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      e.preventDefault();
      if (state === "start") {
        startGame();
        return;
      }
      if (state === "gameover" || state === "win") {
        resetToStart();
        return;
      }
      if (state === "playing" && player.y >= GROUND_Y - PLAYER_HEIGHT - 2) {
        player.vy = JUMP_FORCE;
        playJumpSound();
      }
    }
    if (e.code === "KeyM") {
      e.preventDefault();
      musicOn = !musicOn;
      if (state === "playing" && musicOn) startBGM();
      else if (!musicOn) stopBGM();
    }
  });

  startScreen.style.display = "none";
  animId = requestAnimationFrame(loop);
})();
