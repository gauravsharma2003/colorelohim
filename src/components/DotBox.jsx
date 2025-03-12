import React, { useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';

const DotsAndBoxesGame = () => {
  const gridSize = 5;
  const dotsCount = gridSize + 1;
  
  const [cellSize, setCellSize] = useState(60);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [horizontalLines, setHorizontalLines] = useState(Array(gridSize * dotsCount).fill(false));
  const [verticalLines, setVerticalLines] = useState(Array(dotsCount * gridSize).fill(false));
  const [boxes, setBoxes] = useState(Array(gridSize * gridSize).fill(null));
  const [scores, setScores] = useState({ red: 0, blue: 0 });
  const [currentPlayer, setCurrentPlayer] = useState('red');
  const [gameOver, setGameOver] = useState(false);
  const [gameId, setGameId] = useState('');
  const [socket, setSocket] = useState(null);
  const [playerId, setPlayerId] = useState('');
  const [playerColor, setPlayerColor] = useState(null);
  const [lastDrawnLine, setLastDrawnLine] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isWaitingForOpponent, setIsWaitingForOpponent] = useState(true);
  const [connectionError, setConnectionError] = useState('');
  const [debugInfo, setDebugInfo] = useState([]);
  const [showBoxCompletedNotification, setShowBoxCompletedNotification] = useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  
  const prevScoresRef = useRef({ red: 0, blue: 0 });
  
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      
      if (window.innerWidth < 480) {
        setCellSize(40);
      } else if (window.innerWidth < 768) {
        setCellSize(50);
      } else {
        setCellSize(60);
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);
  
  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const urlGameId = queryParams.get('gameId');
    
    if (urlGameId) {
      setGameId(urlGameId);
    }
  }, []);
  
 // Replace this part in your DotsAndBoxesGame.jsx file:

useEffect(() => {
    // For development, use localhost; for production, use relative path
    const socketUrl = process.env.NODE_ENV === 'production' 
      ? 'https://dotandbox-production.up.railway.app' 
      : 'https://dotandbox-production.up.railway.app';
      
    const newSocket = io(socketUrl, {
      path: '/socket.io',
    });
    
    setSocket(newSocket);
    
    newSocket.on('connect', () => {
      setIsConnected(true);
      setConnectionError('');
      
      const queryParams = new URLSearchParams(window.location.search);
      const urlGameId = queryParams.get('gameId');
      
      if (urlGameId) {
        newSocket.emit('joinGame', urlGameId);
      } else {
        newSocket.emit('createGame');
      }
  
      newSocket.emit('getAllGames');
    });
    
    newSocket.on('connect_error', (error) => {
      setConnectionError('Failed to connect to the game server.');
      setIsConnected(false);
      console.error('Socket connection error:', error);
    });
    
    return () => {
      if (newSocket) {
        newSocket.disconnect();
      }
    };
  }, []);
  
  useEffect(() => {
    if (!socket) return;
    
    socket.on('allGames', (gameIds) => {
      setDebugInfo(prev => [...prev, `Active games: ${gameIds.join(', ')}`]);
    });
    
    socket.on('gameCreated', (data) => {
      setGameId(data.gameId);
      setPlayerId(data.playerId);
      setPlayerColor('red');
      
      updateUrlWithGameId(data.gameId);
      
      setDebugInfo(prev => [...prev, `Game created with ID: ${data.gameId}`]);
    });
    
    socket.on('gameJoined', (data) => {
      setPlayerId(data.playerId);
      setPlayerColor(data.color);
      
      if (data.gameState) {
        updateGameStateFromServer(data.gameState);
      }
      
      setIsWaitingForOpponent(false);
      setDebugInfo(prev => [...prev, `Joined game as ${data.color} player`]);
    });
    
    socket.on('opponentJoined', (data) => {
      setIsWaitingForOpponent(false);
      
      if (data.gameState) {
        updateGameStateFromServer(data.gameState);
      }
      
      setDebugInfo(prev => [...prev, `Opponent has joined the game`]);
    });
    
    socket.on('gameState', (gameState) => {
      const oldScoreRed = scores.red;
      const oldScoreBlue = scores.blue;
      
      updateGameStateFromServer(gameState);
      
      if (gameState.scores.red > oldScoreRed || gameState.scores.blue > oldScoreBlue) {
        const scoringPlayer = gameState.scores.red > oldScoreRed ? 'red' : 'blue';
        const pointsGained = scoringPlayer === 'red' 
          ? gameState.scores.red - oldScoreRed 
          : gameState.scores.blue - oldScoreBlue;
        
        setDebugInfo(prev => [...prev, 
          `${scoringPlayer === playerColor ? 'You' : 'Opponent'} completed ${pointsGained} box(es)! ` +
          `Score: Red ${gameState.scores.red}, Blue ${gameState.scores.blue}`
        ]);
        
        if (scoringPlayer === playerColor) {
          setShowBoxCompletedNotification(true);
          setTimeout(() => setShowBoxCompletedNotification(false), 2000);
        }
      }
      
      setDebugInfo(prev => [...prev, `Turn updated: ${gameState.currentPlayer}'s turn (${gameState.currentPlayer === playerColor ? 'You' : 'Opponent'})`]);
      
      if (gameState.boxes.every(box => box !== null)) {
        setGameOver(true);
        setDebugInfo(prev => [...prev, 'Game over!']);
      }
    });
    
    socket.on('playerTurn', (player) => {
      setCurrentPlayer(player);
    });
    
    socket.on('gameReset', (gameState) => {
      updateGameStateFromServer(gameState);
      setLastDrawnLine(null);
      setGameOver(false);
      
      setDebugInfo(prev => [...prev, `Game has been reset`]);
    });
    
    socket.on('error', (error) => {
      alert(`Game error: ${error.message}`);
      setDebugInfo(prev => [...prev, `Error: ${error.message}`]);
    });
    
    socket.on('opponentDisconnected', () => {
      alert('Your opponent has disconnected from the game.');
      setIsWaitingForOpponent(true);
      
      setDebugInfo(prev => [...prev, `Opponent disconnected`]);
    });
    
    socket.on('gameOver', (gameResult) => {
      setGameOver(true);
      
      const winnerText = gameResult.winner === 'tie' 
        ? "It's a tie!" 
        : `${gameResult.winner === 'red' ? 'Red' : 'Blue'} wins!`;
      
      setDebugInfo(prev => [...prev, 
        `Game over! ${winnerText} Final score: Red ${gameResult.redScore}, Blue ${gameResult.blueScore}`
      ]);
    });
    
    socket.on('boxCompleted', (data) => {
      setDebugInfo(prev => [...prev, `Box completed by ${data.player}! Extra turn granted.`]);
      
      if (data.player === playerColor) {
        setShowBoxCompletedNotification(true);
        setTimeout(() => setShowBoxCompletedNotification(false), 2000);
      }
    });
    
    return () => {
      if (socket) {
        socket.off('gameCreated');
        socket.off('gameJoined');
        socket.off('opponentJoined');
        socket.off('gameState');
        socket.off('playerTurn');
        socket.off('gameReset');
        socket.off('error');
        socket.off('opponentDisconnected');
        socket.off('allGames');
        socket.off('gameOver');
        socket.off('boxCompleted');
      }
    };
  }, [socket, scores, playerColor]);
  
  useEffect(() => {
    prevScoresRef.current = scores;
  }, [scores]);
  
  const updateGameStateFromServer = (gameState) => {
    setHorizontalLines(gameState.horizontalLines);
    setVerticalLines(gameState.verticalLines);
    setBoxes(gameState.boxes);
    setScores(gameState.scores);
    setCurrentPlayer(gameState.currentPlayer);
    setLastDrawnLine(gameState.lastDrawnLine);
  };
  
  const updateUrlWithGameId = (id) => {
    const newUrl = `${window.location.pathname}?gameId=${id}`;
    window.history.pushState({ path: newUrl }, '', newUrl);
  };
  
  const handleLineClick = useCallback((lineType, rowIndex, colIndex) => {
    let index;
    if (lineType === 'horizontal') {
      index = rowIndex * dotsCount + colIndex;
    } else {
      index = colIndex * gridSize + rowIndex;
    }
    
    if (currentPlayer !== playerColor || gameOver || !socket || isWaitingForOpponent) {
      return;
    }
    
    if ((lineType === 'horizontal' && horizontalLines[index]) || 
        (lineType === 'vertical' && verticalLines[index])) {
      return;
    }
    
    socket.emit('makeMove', {
      gameId,
      playerId,
      lineType,
      lineIndex: index
    });
  }, [currentPlayer, playerColor, gameOver, socket, isWaitingForOpponent, horizontalLines, verticalLines, gameId, playerId, dotsCount, gridSize]);
  
  const handleRestart = () => {
    if (socket) {
      socket.emit('restartGame', { gameId });
    }
  };
  
  const handleRefreshConnection = () => {
    if (socket) {
      socket.emit('getAllGames');
    }
  };
  
  const shareableLink = `${window.location.origin}${window.location.pathname}?gameId=${gameId}`;
  
  const copyLinkToClipboard = () => {
    navigator.clipboard.writeText(shareableLink)
      .then(() => {
        alert('Game link copied to clipboard! Share it with a friend to play together.');
      })
      .catch(err => {
        alert('Failed to copy link to clipboard. Please copy it manually.');
      });
  };

  const toggleDebugPanel = () => {
    setShowDebugPanel(!showDebugPanel);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-800 p-4">
      <div className="w-full max-w-md mx-auto">
        <h1 className="text-3xl font-bold mb-4 text-center text-indigo-800 tracking-wide">Dots and Boxes</h1>
        
        {connectionError ? (
          <div className="text-center text-red-600 p-4 bg-red-100 rounded-lg mb-4 shadow-md">
            <p className="font-bold">Connection Error</p>
            <p>{connectionError}</p>
            <p className="mt-2">Make sure the server is running on port 3001.</p>
            <button
              onClick={handleRefreshConnection}
              className="mt-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors shadow-sm"
            >
              Refresh Connection
            </button>
          </div>
        ) : isConnected ? (
          <>
            {showBoxCompletedNotification && (
              <div className="fixed top-16 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-bounce font-semibold">
                Box completed! You get an extra turn.
              </div>
            )}
            
            <div className="mb-6 text-center">
              {isWaitingForOpponent ? (
                <div className="mb-4 bg-white rounded-lg shadow-md p-4">
                  <p className="text-xl mb-3 font-semibold text-indigo-700">Waiting for an opponent to join...</p>
                  <div className="mb-4">
                    <p className="text-lg mb-2">Share this link with a friend:</p>
                    <div className="flex items-center justify-center flex-col sm:flex-row">
                      <input 
                        type="text" 
                        value={shareableLink} 
                        readOnly 
                        className="border border-gray-300 p-2 rounded mb-2 sm:mb-0 sm:mr-2 w-full text-center sm:text-left"
                      />
                      <button 
                        onClick={copyLinkToClipboard}
                        className="bg-indigo-600 text-white w-full sm:w-auto px-4 py-2 rounded hover:bg-indigo-700 transition-colors shadow-sm flex items-center justify-center"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                          <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                        </svg>
                        Copy
                      </button>
                    </div>
                  </div>
                  <div className="animate-pulse flex justify-center">
                    <div className="w-3 h-3 bg-indigo-500 rounded-full mx-1"></div>
                    <div className="w-3 h-3 bg-indigo-500 rounded-full mx-1"></div>
                    <div className="w-3 h-3 bg-indigo-500 rounded-full mx-1"></div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex justify-center space-x-4 mb-4">
                    <div className={`p-3 rounded-lg shadow-md ${currentPlayer === 'red' ? 'bg-red-100 border-2 border-red-500 transform scale-105' : 'bg-white'} transition-all duration-300`}>
                      <span className="font-bold text-red-600 text-lg">Red:</span> 
                      <span className="text-2xl ml-2 font-bold">{scores.red}</span>
                    </div>
                    <div className={`p-3 rounded-lg shadow-md ${currentPlayer === 'blue' ? 'bg-blue-100 border-2 border-blue-500 transform scale-105' : 'bg-white'} transition-all duration-300`}>
                      <span className="font-bold text-blue-600 text-lg">Blue:</span> 
                      <span className="text-2xl ml-2 font-bold">{scores.blue}</span>
                    </div>
                  </div>
                  
                  <div className="mb-4 bg-white rounded-lg shadow-md p-3">
                    <p className="text-lg">
                      Current Turn: 
                      <span className={`font-bold ml-2 ${currentPlayer === 'red' ? 'text-red-600' : 'text-blue-600'}`}>
                        {currentPlayer === playerColor ? 'Your turn' : 'Opponent\'s turn'}
                      </span>
                    </p>
                    <p className="text-md mt-1">
                      You are: 
                      <span className={`font-bold ml-2 ${playerColor === 'red' ? 'text-red-600' : 'text-blue-600'}`}>
                        {playerColor}
                      </span>
                    </p>
                  </div>
                </>
              )}
            </div>
            
            <div className="bg-white p-4 rounded-lg shadow-lg mx-auto flex justify-center">
              <div className="relative" style={{ 
                width: `${cellSize * dotsCount}px`, 
                height: `${cellSize * dotsCount}px` 
              }}>
                {[...Array(gridSize)].map((_, rowIndex) => (
                  [...Array(gridSize)].map((_, colIndex) => {
                    const index = rowIndex * gridSize + colIndex;
                    const boxOwner = boxes[index];
                    let bgColor = 'bg-gray-50';
                    
                    if (boxOwner === 'red') {
                      bgColor = 'bg-red-200';
                    } else if (boxOwner === 'blue') {
                      bgColor = 'bg-blue-200';
                    }
                    
                    return (
                      <div
                        key={`box-${rowIndex}-${colIndex}`}
                        className={`absolute ${bgColor} transition-colors duration-300 rounded-sm`}
                        style={{
                          left: `${colIndex * cellSize + cellSize/2}px`,
                          top: `${rowIndex * cellSize + cellSize/2}px`,
                          width: `${cellSize}px`,
                          height: `${cellSize}px`,
                          transform: 'translate(-50%, -50%)'
                        }}
                      />
                    );
                  })
                ))}
                
                {[...Array(gridSize + 1)].map((_, rowIndex) => (
                  [...Array(gridSize)].map((_, colIndex) => {
                    const index = rowIndex * dotsCount + colIndex;
                    const isDrawn = horizontalLines[index];
                    let lineColor = 'bg-gray-300 bg-opacity-20';
                    let hoverColor = 'hover:bg-gray-500 hover:bg-opacity-40';
                    
                    if (isDrawn) {
                      if (lastDrawnLine && lastDrawnLine.type === 'horizontal' && lastDrawnLine.index === index) {
                        lineColor = currentPlayer === 'red' ? 'bg-red-600' : 'bg-blue-600';
                      } else {
                        lineColor = 'bg-zinc-900';
                      }
                      hoverColor = '';
                    }
                    
                    return (
                      <div
                        key={`h-${rowIndex}-${colIndex}`}
                        className={`absolute cursor-pointer transition-all duration-200 ${isDrawn ? lineColor : `${lineColor} ${hoverColor}`}`}
                        style={{
                          left: `${colIndex * cellSize + cellSize/2}px`,
                          top: `${rowIndex * cellSize}px`,
                          width: `${cellSize}px`,
                          height: '6px',
                          transform: 'translateX(-50%)',
                          borderRadius: '3px'
                        }}
                        onClick={() => handleLineClick('horizontal', rowIndex, colIndex)}
                      />
                    );
                  })
                ))}
                
                {[...Array(gridSize)].map((_, rowIndex) => (
                  [...Array(gridSize + 1)].map((_, colIndex) => {
                    const index = colIndex * gridSize + rowIndex;
                    const isDrawn = verticalLines[index];
                    let lineColor = 'bg-gray-300 bg-opacity-20';
                    let hoverColor = 'hover:bg-gray-500 hover:bg-opacity-40';
                    
                    if (isDrawn) {
                      if (lastDrawnLine && lastDrawnLine.type === 'vertical' && lastDrawnLine.index === index) {
                        lineColor = currentPlayer === 'red' ? 'bg-red-500' : 'bg-blue-500';
                      } else {
                        lineColor = 'bg-zinc-900';
                      }
                      hoverColor = '';
                    }
                    
                    return (
                      <div
                        key={`v-${colIndex}-${rowIndex}`}
                        className={`absolute cursor-pointer transition-all duration-200 ${isDrawn ? lineColor : `${lineColor} ${hoverColor}`}`}
                        style={{
                          left: `${colIndex * cellSize}px`,
                          top: `${rowIndex * cellSize + cellSize/2}px`,
                          width: '6px',
                          height: `${cellSize}px`,
                          transform: 'translateY(-50%)',
                          borderRadius: '3px'
                        }}
                        onClick={() => handleLineClick('vertical', rowIndex, colIndex)}
                      />
                    );
                  })
                ))}
                
                {[...Array(dotsCount)].map((_, rowIndex) => (
                  [...Array(dotsCount)].map((_, colIndex) => (
                    <div
                      key={`dot-${rowIndex}-${colIndex}`}
                      className="absolute bg-indigo-500 rounded-full shadow-sm"
                      style={{
                        left: `${colIndex * cellSize}px`,
                        top: `${rowIndex * cellSize}px`,
                        width: '10px',
                        height: '10px',
                        transform: 'translate(-50%, -50%)',
                        zIndex: 10
                      }}
                    />
                  ))
                ))}
              </div>
            </div>
            
            {gameOver && (
              <div className="mt-6 text-center p-4 bg-indigo-50 rounded-lg border border-indigo-200 shadow-md">
                <h2 className="text-2xl font-bold mb-3 text-indigo-800">Game Over!</h2>
                <p className="text-xl mb-4">
                  {scores.red > scores.blue ? (
                    <span className="text-red-600 font-bold">Red wins!</span>
                  ) : scores.blue > scores.red ? (
                    <span className="text-blue-600 font-bold">Blue wins!</span>
                  ) : (
                    <span className="font-bold text-gray-700">It's a tie!</span>
                  )}
                </p>
                <button
                  onClick={handleRestart}
                  className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-green-700 transition-colors shadow-md"
                >
                  Play Again
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center bg-white p-6 rounded-lg shadow-md">
            <div className="animate-spin w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-xl text-indigo-800 mb-2">Connecting to server...</p>
            <p className="text-gray-600">If this persists, please check if the server is running on port 3001.</p>
          </div>
        )}
        
        {gameId && (
          <div className="mt-4 text-gray-600 text-sm text-center">
            Game ID: <span className="font-mono bg-gray-100 px-1 py-0.5 rounded">{gameId}</span>
          </div>
        )}
        
        <div className="mt-4 text-center">
          <button 
            onClick={toggleDebugPanel} 
            className="text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 px-2 py-1 rounded transition-colors"
          >
            {showDebugPanel ? 'Hide Debug Info' : 'Show Debug Info'}
          </button>
        </div>
        
        {showDebugPanel && (
          <div className="mt-2 p-2 border border-gray-300 rounded-lg text-xs w-full bg-white shadow-sm">
            <h3 className="font-bold mb-1 text-gray-700">Game Status:</h3>
            <ul className="list-disc pl-4">
              <li>Current Player: <span className={currentPlayer === 'red' ? 'text-red-600 font-bold' : 'text-blue-600 font-bold'}>{currentPlayer}</span></li>
              <li>Your Color: <span className={playerColor === 'red' ? 'text-red-600 font-bold' : 'text-blue-600 font-bold'}>{playerColor || 'Not assigned yet'}</span></li>
              <li>Scores: Red {scores.red} - Blue {scores.blue}</li>
              <li>Completed Boxes: {boxes.filter(box => box !== null).length} of {gridSize * gridSize}</li>
              <li>Last Move: {lastDrawnLine ? `${lastDrawnLine.type} line at index ${lastDrawnLine.index}` : 'None'}</li>
            </ul>
            
            {debugInfo.length > 0 && (
              <>
                <h3 className="font-bold mt-2 mb-1 text-gray-700">Game History:</h3>
                <div className="max-h-32 overflow-y-auto border border-gray-200 rounded p-1 bg-gray-50">
                  <ul className="list-disc pl-4">
                    {debugInfo.slice(-10).map((info, index) => (
                      <li key={index} className="text-gray-700">{info}</li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DotsAndBoxesGame;