// ServerDot.js
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import cors from 'cors';

const app = express();
app.use(cors());
const server = createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: '*', 
    methods: ['GET', 'POST']
  }
});

// Set up basic route
app.get('/', (req, res) => {
  res.send('Dots and Boxes Game Server is running');
});

// Game state storage
const games = {}; // Stores all active games

// Constants
const GRID_SIZE = 5;
const DOTS_COUNT = GRID_SIZE + 1;

// Initialize a new game state
function createNewGame() {
  return {
    horizontalLines: Array(GRID_SIZE * DOTS_COUNT).fill(false),
    verticalLines: Array(DOTS_COUNT * GRID_SIZE).fill(false),
    boxes: Array(GRID_SIZE * GRID_SIZE).fill(null),
    scores: { red: 0, blue: 0 },
    currentPlayer: 'red',
    players: {},
    lastDrawnLine: null,
    isFull: false
  };
}

// Check if a box is completed after drawing a line
function checkBoxCompletion(game, lineType, lineIndex) {
  const { horizontalLines, verticalLines, boxes, currentPlayer } = game;
  let boxesCompleted = 0;
  
  // Clone the boxes array to update it
  const newBoxes = [...boxes];
  
  // For horizontal lines - CORRECTED INDICES
  if (lineType === 'horizontal') {
    // Calculate row and column from the line index
    const row = Math.floor(lineIndex / DOTS_COUNT);
    const col = lineIndex % DOTS_COUNT;
    
    console.log(`Checking horizontal line at row ${row}, col ${col}, index ${lineIndex}`);
    
    // Check box above (if not top row)
    if (row > 0) {
      const boxIndex = (row - 1) * GRID_SIZE + col;
      
      // Only check if this box isn't already completed and the column is valid
      if (col < GRID_SIZE && newBoxes[boxIndex] === null) {
        // Check if all 4 sides of the box are drawn
        const topLine = horizontalLines[(row - 1) * DOTS_COUNT + col];
        const rightLine = verticalLines[(col + 1) * GRID_SIZE + (row - 1)];
        const bottomLine = horizontalLines[row * DOTS_COUNT + col]; // Current line
        const leftLine = verticalLines[col * GRID_SIZE + (row - 1)];
        
        console.log(`Box above (${row-1},${col}): Top: ${topLine}, Right: ${rightLine}, Bottom: ${bottomLine}, Left: ${leftLine}`);
        
        if (topLine && rightLine && bottomLine && leftLine) {
          console.log(`Box completed above at index ${boxIndex}`);
          newBoxes[boxIndex] = currentPlayer;
          boxesCompleted++;
        }
      }
    }
    
    // Check box below (if not bottom row)
    if (row < GRID_SIZE) {
      const boxIndex = row * GRID_SIZE + col;
      
      // Only check if this box isn't already completed and the column is valid
      if (col < GRID_SIZE && newBoxes[boxIndex] === null) {
        // Check if all 4 sides of the box are drawn
        const topLine = horizontalLines[row * DOTS_COUNT + col]; // Current line
        const rightLine = verticalLines[(col + 1) * GRID_SIZE + row];
        const bottomLine = horizontalLines[(row + 1) * DOTS_COUNT + col];
        const leftLine = verticalLines[col * GRID_SIZE + row];
        
        console.log(`Box below (${row},${col}): Top: ${topLine}, Right: ${rightLine}, Bottom: ${bottomLine}, Left: ${leftLine}`);
        
        if (topLine && rightLine && bottomLine && leftLine) {
          console.log(`Box completed below at index ${boxIndex}`);
          newBoxes[boxIndex] = currentPlayer;
          boxesCompleted++;
        }
      }
    }
  }
  
  // For vertical lines - CORRECTED INDICES
  else if (lineType === 'vertical') {
    // Calculate column and row from the line index
    const col = Math.floor(lineIndex / GRID_SIZE);
    const row = lineIndex % GRID_SIZE;
    
    console.log(`Checking vertical line at row ${row}, col ${col}, index ${lineIndex}`);
    
    // Check box to the left (if not leftmost column)
    if (col > 0) {
      const boxIndex = row * GRID_SIZE + (col - 1);
      
      // Only check if this box isn't already completed
      if (newBoxes[boxIndex] === null) {
        // Check if all 4 sides of the box are drawn
        const topLine = horizontalLines[row * DOTS_COUNT + (col - 1)];
        const rightLine = verticalLines[col * GRID_SIZE + row]; // Current line
        const bottomLine = horizontalLines[(row + 1) * DOTS_COUNT + (col - 1)];
        const leftLine = verticalLines[(col - 1) * GRID_SIZE + row];
        
        console.log(`Box left (${row},${col-1}): Top: ${topLine}, Right: ${rightLine}, Bottom: ${bottomLine}, Left: ${leftLine}`);
        
        if (topLine && rightLine && bottomLine && leftLine) {
          console.log(`Box completed to the left at index ${boxIndex}`);
          newBoxes[boxIndex] = currentPlayer;
          boxesCompleted++;
        }
      }
    }
    
    // Check box to the right (if not rightmost column)
    if (col < GRID_SIZE) {
      const boxIndex = row * GRID_SIZE + col;
      
      // Only check if this box isn't already completed
      if (newBoxes[boxIndex] === null) {
        // Check if all 4 sides of the box are drawn
        const topLine = horizontalLines[row * DOTS_COUNT + col];
        const rightLine = verticalLines[(col + 1) * GRID_SIZE + row];
        const bottomLine = horizontalLines[(row + 1) * DOTS_COUNT + col];
        const leftLine = verticalLines[col * GRID_SIZE + row]; // Current line
        
        console.log(`Box right (${row},${col}): Top: ${topLine}, Right: ${rightLine}, Bottom: ${bottomLine}, Left: ${leftLine}`);
        
        if (topLine && rightLine && bottomLine && leftLine) {
          console.log(`Box completed to the right at index ${boxIndex}`);
          newBoxes[boxIndex] = currentPlayer;
          boxesCompleted++;
        }
      }
    }
  }
  
  // Update game state if boxes were completed
  if (boxesCompleted > 0) {
    console.log(`${boxesCompleted} box(es) completed by ${currentPlayer}`);
    game.boxes = newBoxes;
    game.scores[currentPlayer] += boxesCompleted;
    return true;
  }
  
  return false;
}

// Check if the game is over (all boxes filled)
function isGameOver(game) {
  return game.boxes.every(box => box !== null);
}

// Debug function to list all active games
function listAllGames() {
  console.log("\n--- ACTIVE GAMES ---");
  Object.keys(games).forEach(id => {
    const game = games[id];
    const playerCount = Object.keys(game.players).length;
    console.log(`Game ID: ${id} | Players: ${playerCount} | Full: ${game.isFull}`);
  });
  console.log("-------------------\n");
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  
  // Create a new game
  socket.on('createGame', () => {
    // Generate a unique game ID
    const gameId = uuidv4();
    const playerId = socket.id;
    
    // Create a new game state
    games[gameId] = createNewGame();
    
    // Add the player to the game
    games[gameId].players[playerId] = {
      socketId: playerId,
      color: 'red' // First player is always red
    };
    
    // Join the socket room for this game
    socket.join(gameId);
    
    // Send the game ID and player ID back to the client
    socket.emit('gameCreated', {
      gameId,
      playerId,
      color: 'red'
    });
    
    console.log(`Game created: ${gameId} by player ${playerId}`);
    listAllGames();
  });
  
  // Join an existing game
  socket.on('joinGame', (gameId) => {
    console.log(`Attempting to join game with ID: ${gameId}`);
    
    // Check if the game exists
    if (!games[gameId]) {
      console.log(`Game not found: ${gameId}`);
      console.log(`Available games: ${Object.keys(games).join(', ')}`);
      socket.emit('error', { message: 'Game not found' });
      return;
    }
    
    // Check if the game is already full
    if (games[gameId].isFull) {
      console.log(`Game ${gameId} is full`);
      socket.emit('error', { message: 'Game is full' });
      return;
    }
    
    const playerId = socket.id;
    
    // Add the player to the game
    games[gameId].players[playerId] = {
      socketId: playerId,
      color: 'blue' // Second player is always blue
    };
    
    // Mark the game as full
    games[gameId].isFull = true;
    
    // Join the socket room for this game
    socket.join(gameId);
    
    // Send game info to the joining player
    socket.emit('gameJoined', {
      gameId,
      playerId,
      color: 'blue',
      gameState: games[gameId]
    });
    
    // Notify the first player that an opponent has joined
    socket.to(gameId).emit('opponentJoined', {
      gameState: games[gameId]
    });
    
    console.log(`Player ${playerId} joined game ${gameId}`);
    listAllGames();
  });
  
  // Handle a player move
  socket.on('makeMove', ({ gameId, playerId, lineType, lineIndex }) => {
    // Check if the game exists
    if (!games[gameId]) {
      socket.emit('error', { message: 'Game not found' });
      return;
    }
    
    const game = games[gameId];
    
    // Check if it's the player's turn
    if (game.players[playerId]?.color !== game.currentPlayer) {
      socket.emit('error', { message: 'Not your turn' });
      return;
    }
    
    // Check if the line is already drawn
    if ((lineType === 'horizontal' && game.horizontalLines[lineIndex]) || 
        (lineType === 'vertical' && game.verticalLines[lineIndex])) {
      socket.emit('error', { message: 'Line already drawn' });
      return;
    }
    
    console.log(`Processing move: ${game.currentPlayer} drawing ${lineType} line at index ${lineIndex}`);
    
    // Update the game state
    if (lineType === 'horizontal') {
      game.horizontalLines[lineIndex] = true;
    } else {
      game.verticalLines[lineIndex] = true;
    }
    
    // Save the last drawn line
    game.lastDrawnLine = { type: lineType, index: lineIndex };
    
    // Check if the move completed any boxes
    const completedBox = checkBoxCompletion(game, lineType, lineIndex);
    
    if (completedBox) {
      // Notify clients that a box was completed
      io.to(gameId).emit('boxCompleted', {
        player: game.currentPlayer,
        lineType,
        lineIndex
      });
      
      console.log(`Box completed by ${game.currentPlayer} - gets an extra turn`);
    } else {
      // Switch player if no box was completed
      game.currentPlayer = game.currentPlayer === 'red' ? 'blue' : 'red';
      console.log(`Turn passes to ${game.currentPlayer}`);
    }
    
    // Check if the game is over
    const gameOver = isGameOver(game);
    
    // Broadcast the updated game state to all players
    io.to(gameId).emit('gameState', game);
    
    // Emit player turn event
    io.to(gameId).emit('playerTurn', game.currentPlayer);
    
    // If the game is over, emit the game over event
    if (gameOver) {
      io.to(gameId).emit('gameOver', {
        redScore: game.scores.red,
        blueScore: game.scores.blue,
        winner: game.scores.red > game.scores.blue ? 'red' : game.scores.blue > game.scores.red ? 'blue' : 'tie'
      });
    }
  });
  
  // Handle game restart
  socket.on('restartGame', ({ gameId }) => {
    // Check if the game exists
    if (!games[gameId]) {
      socket.emit('error', { message: 'Game not found' });
      return;
    }
    
    // Keep the players but reset the game state
    const players = games[gameId].players;
    games[gameId] = createNewGame();
    games[gameId].players = players;
    games[gameId].isFull = true;
    
    // Broadcast the reset game state
    io.to(gameId).emit('gameReset', games[gameId]);
    
    console.log(`Game ${gameId} restarted`);
  });
  
  // Debug endpoint to get all games
  socket.on('getAllGames', () => {
    const gameIds = Object.keys(games);
    socket.emit('allGames', gameIds);
    listAllGames();
  });
  
  // Handle player disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    // Find games where this player is participating
    Object.keys(games).forEach((gameId) => {
      const game = games[gameId];
      
      // If player is in this game
      if (game.players[socket.id]) {
        // Notify the other player that the opponent disconnected
        socket.to(gameId).emit('opponentDisconnected');
        
        // If the game is empty after this player leaves, we can clean it up
        // Otherwise, mark it as not full so another player can join
        const remainingPlayers = Object.keys(game.players).filter(id => id !== socket.id);
        if (remainingPlayers.length === 0) {
          delete games[gameId];
          console.log(`Game ${gameId} removed as all players disconnected`);
        } else {
          delete game.players[socket.id];
          game.isFull = false;
          console.log(`Player ${socket.id} removed from game ${gameId}`);
        }
      }
    });
    
    listAllGames();
  });
});

// Start the server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});