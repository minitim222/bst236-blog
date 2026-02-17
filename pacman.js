// Simple Valentine's Pac-Man implementation using a tile-based grid and canvas.
// Features:
// - Classic pellets, walls, ghosts, and lives
// - Rose power-up spawns periodically
// - While powered, Pac-Man continuously shoots heart projectiles that destroy ghosts

const TILE_SIZE = 20;
const ROWS = 28;
const COLS = 28;

// Tile codes
const TILE = {
  WALL: 1,
  PELLET: 2,
  EMPTY: 0,
  ROSE: 3,
};

// A small, hand-tuned maze. 1 = wall, 2 = pellet, 0 = empty.
// We'll treat 2 as pellets and leave some 0s for tunnels / ghost house.
// This is a simplified, symmetric 28x28 layout.
const baseLayout = [
  "1111111111111111111111111111",
  "1222222222111222222222222221",
  "1211112112111211112112111121",
  "1211112112111211112112111121",
  "1222222222222222222222222221",
  "1211112111111111112111111121",
  "1222222111222222111222222221",
  "1111112111211112111211111111",
  "0000012111200002111210000000",
  "1111112111211112111211111111",
  "1222222222222222222222222221",
  "1211112111111111112111111121",
  "1222222111222222111222222221",
  "1111112111211112111211111111",
  "1222222222111222222222222221",
  "1211112112111211112112111121",
  "1211112112111211112112111121",
  "1222222222222222222222222221",
  "1211112111111111112111111121",
  "1222222111222222111222222221",
  "1111112111211112111211111111",
  "1222222222222222222222222221",
  "1211112111111111112111111121",
  "1222222111222222111222222221",
  "1211112111211112111211111121",
  "1222222222222222222222222221",
  "1222222222222222222222222221",
  "1111111111111111111111111111",
];

function createMaze() {
  const grid = [];
  for (let r = 0; r < ROWS; r++) {
    const row = [];
    for (let c = 0; c < COLS; c++) {
      const ch = baseLayout[r][c];
      if (ch === "1") row.push(TILE.WALL);
      else if (ch === "2") row.push(TILE.PELLET);
      else row.push(TILE.EMPTY);
    }
    grid.push(row);
  }
  return grid;
}

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const state = {
  maze: createMaze(),
  pacman: {
    row: 23,
    col: 13,
    dir: { x: 0, y: 0 },
    lastDir: { x: 1, y: 0 },
  },
  ghosts: [],
  pelletsRemaining: 0,
  lives: 3,
  score: 0,
  level: 1,
  running: false,
  overlay: document.getElementById("overlay"),
  roseTimer: 0,
  roseInterval: 20_000, // ms
  powered: false,
  powerTimer: 0,
  powerDuration: 7000, // ms
  hearts: [],
  lastHeartTime: 0,
  heartInterval: 300, // ms while powered
  lastFrameTime: 0,
};

function initPelletCount() {
  let count = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (state.maze[r][c] === TILE.PELLET) count++;
    }
  }
  state.pelletsRemaining = count;
}

function resetGhosts() {
  state.ghosts = [
    { row: 13, col: 12, color: "#fb7185", dir: { x: 1, y: 0 } },
    { row: 13, col: 14, color: "#22c55e", dir: { x: -1, y: 0 } },
    { row: 14, col: 12, color: "#38bdf8", dir: { x: 0, y: 1 } },
    { row: 14, col: 14, color: "#f97316", dir: { x: 0, y: -1 } },
  ];
}

function resetGame(full = true) {
  if (full) {
    state.maze = createMaze();
    initPelletCount();
    state.score = 0;
    state.lives = 3;
    state.level = 1;
  }
  state.pacman.row = 23;
  state.pacman.col = 13;
  state.pacman.dir = { x: 0, y: 0 };
  state.pacman.lastDir = { x: 1, y: 0 };
  resetGhosts();
  state.powered = false;
  state.powerTimer = 0;
  state.hearts = [];
  state.roseTimer = 0;
  removeExistingRose();
}

function startGame() {
  resetGame(true);
  state.running = true;
  state.overlay.classList.add("hidden");
  state.lastFrameTime = performance.now();
  requestAnimationFrame(loop);
  updateHUD();
}

function updateHUD() {
  document.getElementById("lives").textContent = state.lives.toString();
  document.getElementById("score").textContent = state.score.toString();
  document.getElementById("level").textContent = state.level.toString();
}

// Helpers
function isWall(r, c) {
  if (r < 0 || c < 0 || r >= ROWS || c >= COLS) return true;
  return state.maze[r][c] === TILE.WALL;
}

function tryMove(row, col, dir) {
  let nr = row + dir.y;
  let nc = col + dir.x;

  // Simple horizontal wrap tunnels
  if (nc < 0) nc = COLS - 1;
  if (nc >= COLS) nc = 0;

  if (isWall(nr, nc)) return { row, col };
  return { row: nr, col: nc };
}

// Input
window.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();
  let dir = null;
  if (key === "arrowup" || key === "w") dir = { x: 0, y: -1 };
  else if (key === "arrowdown" || key === "s") dir = { x: 0, y: 1 };
  else if (key === "arrowleft" || key === "a") dir = { x: -1, y: 0 };
  else if (key === "arrowright" || key === "d") dir = { x: 1, y: 0 };
  if (!dir) return;

  // Only change to a direction that's not blocked by a wall
  const { row, col } = state.pacman;
  const target = tryMove(row, col, dir);
  if (target.row !== row || target.col !== col) {
    state.pacman.dir = dir;
    state.pacman.lastDir = dir;
  }
});

document.getElementById("start-btn").addEventListener("click", () => {
  startGame();
});

function spawnRose() {
  const candidates = [];
  for (let r = 1; r < ROWS - 1; r++) {
    for (let c = 1; c < COLS - 1; c++) {
      if (state.maze[r][c] === TILE.EMPTY) {
        candidates.push({ r, c });
      }
    }
  }
  if (!candidates.length) return;
  const chosen = candidates[Math.floor(Math.random() * candidates.length)];
  state.maze[chosen.r][chosen.c] = TILE.ROSE;
}

function removeExistingRose() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (state.maze[r][c] === TILE.ROSE) {
        state.maze[r][c] = TILE.EMPTY;
      }
    }
  }
}

function update(dt) {
  if (!state.running) return;

  // Pac-Man movement
  const p = state.pacman;
  const moved = tryMove(p.row, p.col, p.dir);
  p.row = moved.row;
  p.col = moved.col;

  // Pellet collection
  const tile = state.maze[p.row][p.col];
  if (tile === TILE.PELLET) {
    state.maze[p.row][p.col] = TILE.EMPTY;
    state.score += 10;
    state.pelletsRemaining--;
    if (state.pelletsRemaining <= 0) {
      // Next level: reset pellets, keep score and lives
      state.level++;
      state.maze = createMaze();
      initPelletCount();
      resetGhosts();
    }
  } else if (tile === TILE.ROSE) {
    state.maze[p.row][p.col] = TILE.EMPTY;
    state.powered = true;
    state.powerTimer = state.powerDuration;
  }

  // Ghost movement (simple random turns)
  for (const g of state.ghosts) {
    // Occasionally change direction
    if (Math.random() < 0.15) {
      const options = [
        { x: 1, y: 0 },
        { x: -1, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: -1 },
      ].filter((d) => {
        const res = tryMove(g.row, g.col, d);
        return res.row !== g.row || res.col !== g.col;
      });
      if (options.length) {
        g.dir = options[Math.floor(Math.random() * options.length)];
      }
    }
    const movedGhost = tryMove(g.row, g.col, g.dir);
    g.row = movedGhost.row;
    g.col = movedGhost.col;
  }

  // Power-up timers
  if (state.powered) {
    state.powerTimer -= dt;
    if (state.powerTimer <= 0) {
      state.powered = false;
      state.powerTimer = 0;
    }
  }

  // Rose spawn timer
  state.roseTimer += dt;
  if (state.roseTimer >= state.roseInterval) {
    state.roseTimer = 0;
    removeExistingRose();
    spawnRose();
  }

  // Heart shooting
  if (state.powered) {
    state.lastHeartTime += dt;
    if (state.lastHeartTime >= state.heartInterval) {
      state.lastHeartTime = 0;
      shootHeart();
    }
  } else {
    state.lastHeartTime = 0;
  }

  // Update hearts
  const hearts = [];
  for (const h of state.hearts) {
    const movedHeart = tryMove(h.row, h.col, h.dir);
    h.row = movedHeart.row;
    h.col = movedHeart.col;

    // If we didn't move, it's a wall: discard
    if (movedHeart.row === h.startRow && movedHeart.col === h.startCol) {
      continue;
    }

    // Check collision with ghosts
    let hit = false;
    for (const g of state.ghosts) {
      if (g.row === h.row && g.col === h.col) {
        // Remove ghost, respawn in house
        g.row = 13;
        g.col = 13;
        g.dir = { x: 0, y: 1 };
        state.score += 50;
        hit = true;
        break;
      }
    }
    if (!hit) hearts.push(h);
  }
  state.hearts = hearts;

  // Check collisions with ghosts
  for (const g of state.ghosts) {
    if (g.row === p.row && g.col === p.col) {
      state.lives--;
      if (state.lives <= 0) {
        gameOver();
        return;
      } else {
        // Reset positions, keep score and pellets
        state.pacman.row = 23;
        state.pacman.col = 13;
        state.pacman.dir = { x: 0, y: 0 };
        state.pacman.lastDir = { x: 1, y: 0 };
        resetGhosts();
        state.powered = false;
        state.hearts = [];
      }
    }
  }

  updateHUD();
}

function shootHeart() {
  const dir = state.pacman.lastDir;
  if (dir.x === 0 && dir.y === 0) return;
  const { row, col } = state.pacman;
  state.hearts.push({
    row,
    col,
    dir: { ...dir },
    startRow: row,
    startCol: col,
  });
}

function gameOver() {
  state.running = false;
  state.overlay.classList.remove("hidden");
  const title = document.getElementById("overlay-title");
  const message = document.getElementById("overlay-message");
  title.textContent = "Game Over";
  message.textContent = `Final score: ${state.score}. Click to play again!`;
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw maze
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = c * TILE_SIZE;
      const y = r * TILE_SIZE;
      const t = state.maze[r][c];
      if (t === TILE.WALL) {
        ctx.fillStyle = "#020617";
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        ctx.strokeStyle = "#1d4ed8";
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
      } else {
        ctx.fillStyle = "#020617";
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        if (t === TILE.PELLET) {
          ctx.fillStyle = "#e5e7eb";
          ctx.beginPath();
          ctx.arc(
            x + TILE_SIZE / 2,
            y + TILE_SIZE / 2,
            2.3,
            0,
            Math.PI * 2
          );
          ctx.fill();
        } else if (t === TILE.ROSE) {
          // Rose: pink circle with a little stem
          ctx.fillStyle = "#fb7185";
          ctx.beginPath();
          ctx.arc(
            x + TILE_SIZE / 2,
            y + TILE_SIZE / 2 - 2,
            4,
            0,
            Math.PI * 2
          );
          ctx.fill();
          ctx.strokeStyle = "#22c55e";
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(x + TILE_SIZE / 2, y + TILE_SIZE / 2);
          ctx.lineTo(x + TILE_SIZE / 2, y + TILE_SIZE - 4);
          ctx.stroke();
        }
      }
    }
  }

  // Draw hearts
  for (const h of state.hearts) {
    const x = h.col * TILE_SIZE + TILE_SIZE / 2;
    const y = h.row * TILE_SIZE + TILE_SIZE / 2;
    drawHeart(x, y, 5, "#f97373");
  }

  // Draw ghosts
  for (const g of state.ghosts) {
    const x = g.col * TILE_SIZE + TILE_SIZE / 2;
    const y = g.row * TILE_SIZE + TILE_SIZE / 2;
    drawGhost(x, y, 8, g.color);
  }

  // Draw Pac-Man
  const px = state.pacman.col * TILE_SIZE + TILE_SIZE / 2;
  const py = state.pacman.row * TILE_SIZE + TILE_SIZE / 2;
  drawPacman(px, py, 8, state.pacman.lastDir);
}

function drawPacman(x, y, radius, dir) {
  const angleMap = {
    "1,0": 0,
    "-1,0": Math.PI,
    "0,-1": -Math.PI / 2,
    "0,1": Math.PI / 2,
  };
  const key = `${dir.x},${dir.y}`;
  const facing = angleMap[key] ?? 0;
  const open = 0.3;

  ctx.fillStyle = "#fde047";
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, radius, facing + open, facing + Math.PI * 2 - open);
  ctx.closePath();
  ctx.fill();
}

function drawGhost(x, y, radius, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, radius, Math.PI, 0);
  ctx.rect(x - radius, y, radius * 2, radius);
  ctx.fill();

  // Eyes
  ctx.fillStyle = "#e5e7eb";
  ctx.beginPath();
  ctx.arc(x - radius / 2.2, y - 1, radius / 3, 0, Math.PI * 2);
  ctx.arc(x + radius / 2.2, y - 1, radius / 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawHeart(x, y, size, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 10, size / 10);
  ctx.beginPath();
  ctx.moveTo(0, 3);
  ctx.bezierCurveTo(0, -1, -5, -1, -5, 2);
  ctx.bezierCurveTo(-5, 5, 0, 8, 0, 10);
  ctx.bezierCurveTo(0, 8, 5, 5, 5, 2);
  ctx.bezierCurveTo(5, -1, 0, -1, 0, 3);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function loop(timestamp) {
  if (!state.running) return;
  const dt = Math.min(100, timestamp - state.lastFrameTime);
  state.lastFrameTime = timestamp;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

// Initial draw and overlay text
resetGame(true);
draw();

