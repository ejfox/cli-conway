const blessed = require("blessed");

const screen = blessed.screen({ smartCSR: true });
const box = blessed.box({ parent: screen, width: "100%", height: "100%" });
const statusBar = blessed.box({
  bottom: 0,
  height: 7, // Increased height for stats
  width: "100%",
  content: "",
  parent: screen,
});

// Get screen dimensions
let W = screen.width * 2;
let H = (screen.height - 7) * 4; // Subtract 7 for the status bar, multiply by 4 for Braille height

let grid = new Uint8Array(W * H);
let cursorX = W >> 1,
  cursorY = H >> 1;

let simulationSpeed = 100; // Default speed (100ms interval)

const shapes = {
  g: [0, 1, W, W + 1, W - 1], // Glider
  b: [0, W, W * 2], // Blinker (vertical)
  p: [W, W - 1, W + 1], // Pulsar seed example
  h: [0, 1, W, W + 1, W - 1], // Glider, same as "g" (for Hacker)
  l: [0, 1, W, W + 1], // Block (Still Life)
  v: [1, 2, W, W + 3, W * 2 + 1, W * 2 + 2], // Beehive (Still Life)
  o: [1, 2, W, W + 3, W * 2 + 1, W * 2 + 2, W * 2 + 3], // Loaf (Still Life)
  t: [0, 2, W, W + 2, W * 2 + 1], // Boat (Still Life)
  u: [1, W, W + 2, W * 2 + 1], // Tub (Still Life)
  s: [2, 3, W, W + 4, W * 2 + 1, W * 2 + 4, W * 3 + 2, W * 3 + 3], // LWSS (Spaceship)
  x: [W, W + 1, W * 2, W * 2 + 1], // Block (Still Life)
  c: [W, W + 1, W * 2, W * 2 + 1, W * 3], // Boat
};

const shapeKeys = Object.keys(shapes);
let marqueeIndex = 0;
let stepCount = 0; // Track number of steps
const livingStats = {
  totalLiving: 0,
  longestLiving: 0,
};

const getShapeDisplay = (shape) => {
  const display = new Uint8Array(2); // 2x4 grid (one Braille character)
  shape.forEach((offset) => {
    const x = offset % 3;
    const y = Math.floor(offset / 3) % 3;
    if (x < 2 && y < 4) {
      display[0] |= 1 << (y * 2 + x);
    }
  });
  return String.fromCharCode(0x2800 + display[0]);
};

const updateStatusBar = () => {
  // Update statistics content
  livingStats.totalLiving = grid.reduce((total, cell) => total + cell, 0);
  livingStats.longestLiving = Math.max(livingStats.longestLiving, stepCount);

  // Create content for the status bar
  let content = `Living: ${livingStats.totalLiving}, Longest: ${livingStats.longestLiving} TK\n`;

  let marqueeContent = "";
  for (let i = 0; i < 8; i++) {
    const key = shapeKeys[(marqueeIndex + i) % shapeKeys.length];
    const shape = shapes[key];
    const shapeDisplay = getShapeDisplay(shape);
    marqueeContent += shapeDisplay.padEnd(5, " ");
  }
  marqueeContent += "\n";
  for (let i = 0; i < 8; i++) {
    const key = shapeKeys[(marqueeIndex + i) % shapeKeys.length];
    marqueeContent += key.padStart(2, " ").padEnd(5, " ");
  }
  marqueeContent += `Speed: ${Math.round(1000 / simulationSpeed)} gen/s`;

  // Combine the contents
  statusBar.setContent(content + marqueeContent);
  screen.render();
};

// Marquee update function
const updateMarquee = () => {
  marqueeIndex = (marqueeIndex + 1) % shapeKeys.length;
};

// Updates the grid according to Game of Life rules
const updateGrid = () => {
  const newGrid = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let neighbors = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = (x + dx + W) % W;
          const ny = (y + dy + H) % H;
          neighbors += grid[ny * W + nx];
        }
      }
      const i = y * W + x;
      newGrid[i] = neighbors === 3 || (neighbors === 2 && grid[i]);
    }
  }
  grid = newGrid;
  stepCount++; // Increase steps
  updateStatusBar(); // Calculate statistics on every step
};

// Draws the grid using Braille characters and includes the cursor
const drawGrid = () => {
  const content = Array.from({ length: H / 4 }, (_, y) =>
    Array.from({ length: W / 2 }, (_, x) => {
      const cellX = x * 2;
      const cellY = y * 4;
      if (
        cursorX >= cellX &&
        cursorX < cellX + 2 &&
        cursorY >= cellY &&
        cursorY < cellY + 4
      ) {
        return "\u25A0"; // Cursor character (filled square)
      }
      return getBrailleChar(cellX, cellY);
    }).join("")
  ).join("\n");

  box.setContent(content);
  screen.render();
};

// Convert a 2x4 block of cells to a Braille character
const getBrailleChar = (x, y) => {
  const dx = [0, 1, 0, 1, 0, 1, 0, 1];
  const dy = [0, 0, 1, 1, 2, 2, 3, 3];
  let braille = 0;
  for (let i = 0; i < 8; i++) {
    const nx = x + dx[i],
      ny = y + dy[i];
    if (nx < W && ny < H && grid[ny * W + nx]) {
      braille |= 1 << i;
    }
  }
  return String.fromCharCode(0x2800 + braille);
};

// Places a shape on the grid at the cursor position
const placeShape = (shapeKey) => {
  const shape = shapes[shapeKey];
  shape.forEach((offset) => {
    const x = (cursorX + (offset % W) + W) % W;
    const y = (cursorY + Math.floor(offset / W) + H) % H;
    grid[y * W + x] = 1;
  });
};

// Exit keys
screen.key(["escape", "q", "C-c"], () => process.exit(0));

// Cursor movement keys
screen.key(["left", "right", "up", "down"], (_, key) => {
  const moveSpeed = 5; // Adjust this value to change cursor speed
  cursorX =
    (cursorX +
      (key.name === "left"
        ? -moveSpeed
        : key.name === "right"
        ? moveSpeed
        : 0) +
      W) %
    W;
  cursorY =
    (cursorY +
      (key.name === "up" ? -moveSpeed : key.name === "down" ? moveSpeed : 0) +
      H) %
    H;
  drawGrid();
});

// Shape placement keys
screen.key(Object.keys(shapes), (ch) => {
  placeShape(ch);
  drawGrid();
});

// Toggle cell state with spacebar
screen.key("space", () => {
  grid[cursorY * W + cursorX] ^= 1;
  drawGrid();
});

// Speed control keys
screen.key(["1", "2", "3", "4", "5", "6", "7", "8", "9"], (ch) => {
  const speed = (10 - parseInt(ch)) * 50; // 1 = 450ms, 9 = 50ms
  simulationSpeed = speed;
  startGameLoop();
});

// Handle terminal resize
screen.on("resize", () => {
  const newW = screen.width * 2;
  const newH = (screen.height - 7) * 4; // Adjust for the new status height
  const newGrid = new Uint8Array(newW * newH);

  // Copy old grid to new grid, truncating or padding as necessary
  for (let y = 0; y < Math.min(H, newH); y++) {
    for (let x = 0; x < Math.min(W, newW); x++) {
      newGrid[y * newW + x] = grid[y * W + x];
    }
  }

  W = newW;
  H = newH;
  grid = newGrid;
  cursorX = Math.min(cursorX, W - 1);
  cursorY = Math.min(cursorY, H - 1);
  drawGrid();
});

// Main game loop
let gameLoop;

const startGameLoop = () => {
  clearInterval(gameLoop);
  gameLoop = setInterval(() => {
    updateGrid();
    drawGrid();
  }, simulationSpeed);
};

// Marquee update interval
setInterval(updateMarquee, 3000); // Update every 3 seconds

drawGrid();
updateMarquee(); // Initial marquee update
startGameLoop(); // Start the game loop
