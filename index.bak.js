const blessed = require('blessed');

const W = 80, H = 24;
const screen = blessed.screen({smartCSR: true});
const box = blessed.box({parent: screen, width: '100%', height: '100%'});
let grid = new Uint8Array(W * H);
let cursorX = W >> 1, cursorY = H >> 1;

const shapes = {
  g: [0, 1, W, W + 1, W - 1],  // Glider
  b: [0, W, W * 2],            // Blinker (vertical)
  p: [W, W - 1, W + 1]         // A smaller Pulsar seed example
};

// Draws the grid on the screen
const drawGrid = () => {
  box.setContent(Array.from({length: H}, (_, y) =>
    Array.from({length: W}, (_, x) =>
      (x === cursorX && y === cursorY) ? '+' : (grid[y * W + x] ? '█' : ' ')
    ).join('')
  ).join('\n'));
  screen.render();
};

// Updates the grid according to the Game of Life rules
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
};

// Places a shape on the grid at the cursor position
const placeShape = (shapeKey) => {
  const shape = shapes[shapeKey];
  const offset = cursorY * W + cursorX;
  
  shape.forEach(bit => {
    const x = (offset % W + (bit % 3) - 1 + W) % W;
    const y = ((offset / W | 0) + ((bit / 3) | 0) - 1 + H) % H;
    grid[y * W + x] = 1;
  });
};

// Exit keys
screen.key(['escape', 'q', 'C-c'], () => process.exit(0));

// Cursor movement keys
screen.key(['left', 'right', 'up', 'down'], (_, key) => {
  cursorX = (cursorX + (key.name === 'left' ? -1 : key.name === 'right' ? 1 : 0) + W) % W;
  cursorY = (cursorY + (key.name === 'up' ? -1 : key.name === 'down' ? 1 : 0) + H) % H;
  drawGrid();
});

// Shape placement keys
screen.key(['g', 'b', 'p'], (ch) => {
  placeShape(ch);
  drawGrid();
});

// Toggle cell state with spacebar
screen.key('space', () => {
  grid[cursorY * W + cursorX] ^= 1;
  drawGrid();
});

// Main game loop
setInterval(() => {
  updateGrid();
  drawGrid();
}, 100);

drawGrid();
