import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Howl } from 'howler';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

// Sound effects
const sounds = {
  move: new Howl({ src: ['https://assets.codepen.io/21542/howler-push.mp3'] }),
  rotate: new Howl({ src: ['https://assets.codepen.io/21542/howler-retry.mp3'] }),
  clear: new Howl({ src: ['https://assets.codepen.io/21542/howler-sfx-victory.mp3'] }),
  drop: new Howl({ src: ['https://assets.codepen.io/21542/howler-fall.mp3'] }),
  gameOver: new Howl({ src: ['https://assets.codepen.io/21542/howler-death.mp3'] })
};

// Tetromino shapes
const TETROMINOES = {
  I: {
    shape: [[1, 1, 1, 1]],
    color: 'bg-cyan-400'
  },
  J: {
    shape: [[1, 0, 0], [1, 1, 1]],
    color: 'bg-blue-500'
  },
  L: {
    shape: [[0, 0, 1], [1, 1, 1]],
    color: 'bg-orange-400'
  },
  O: {
    shape: [[1, 1], [1, 1]],
    color: 'bg-yellow-300'
  },
  S: {
    shape: [[0, 1, 1], [1, 1, 0]],
    color: 'bg-green-400'
  },
  T: {
    shape: [[0, 1, 0], [1, 1, 1]],
    color: 'bg-purple-500'
  },
  Z: {
    shape: [[1, 1, 0], [0, 1, 1]],
    color: 'bg-red-400'
  }
};

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;
const INITIAL_SPEED = 1000;

const createEmptyBoard = () => 
  Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(null));

const TetrisGame = () => {
  const [board, setBoard] = useState(createEmptyBoard());
  const [currentPiece, setCurrentPiece] = useState(null);
  const [nextPiece, setNextPiece] = useState(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const gameLoop = useRef(null);
  const { toast } = useToast();

  const getRandomTetromino = useCallback(() => {
    const pieces = Object.keys(TETROMINOES);
    const randomPiece = pieces[Math.floor(Math.random() * pieces.length)];
    return {
      shape: TETROMINOES[randomPiece].shape,
      color: TETROMINOES[randomPiece].color
    };
  }, []);

  const resetGame = useCallback(() => {
    setBoard(createEmptyBoard());
    setCurrentPiece(getRandomTetromino());
    setNextPiece(getRandomTetromino());
    setPosition({ x: Math.floor(BOARD_WIDTH / 2) - 1, y: 0 });
    setScore(0);
    setLevel(1);
    setGameOver(false);
    setIsPaused(false);
  }, [getRandomTetromino]);

  const playSound = useCallback((soundName) => {
    if (!isMuted) {
      sounds[soundName].play();
    }
  }, [isMuted]);

  const isValidMove = useCallback((piece, newPosition) => {
    if (!piece) return false;
    
    return piece.shape.every((row, dy) =>
      row.every((cell, dx) => {
        if (!cell) return true;
        const newX = newPosition.x + dx;
        const newY = newPosition.y + dy;
        return (
          newX >= 0 &&
          newX < BOARD_WIDTH &&
          newY >= 0 &&
          newY < BOARD_HEIGHT &&
          !board[newY]?.[newX]
        );
      })
    );
  }, [board]);

  const mergePieceToBoard = useCallback(() => {
    if (!currentPiece) return;

    const newBoard = board.map(row => [...row]);
    currentPiece.shape.forEach((row, dy) => {
      row.forEach((cell, dx) => {
        if (cell) {
          const newY = position.y + dy;
          const newX = position.x + dx;
          if (newY >= 0 && newY < BOARD_HEIGHT) {
            newBoard[newY][newX] = currentPiece.color;
          }
        }
      });
    });

    setBoard(newBoard);
    playSound('drop');

    // Check for completed lines
    let linesCleared = 0;
    const updatedBoard = newBoard.filter(row => {
      const isComplete = row.every(cell => cell !== null);
      if (isComplete) linesCleared++;
      return !isComplete;
    });

    while (updatedBoard.length < BOARD_HEIGHT) {
      updatedBoard.unshift(Array(BOARD_WIDTH).fill(null));
    }

    if (linesCleared > 0) {
      playSound('clear');
      setScore(prev => prev + (linesCleared * 100 * level));
      setLevel(prev => Math.floor(score / 1000) + 1);
      setBoard(updatedBoard);
    }

    // Spawn next piece
    setCurrentPiece(nextPiece);
    setNextPiece(getRandomTetromino());
    setPosition({ x: Math.floor(BOARD_WIDTH / 2) - 1, y: 0 });

    // Check for game over
    if (!isValidMove(nextPiece, { x: Math.floor(BOARD_WIDTH / 2) - 1, y: 0 })) {
      playSound('gameOver');
      setGameOver(true);
      toast({
        title: "Game Over!",
        description: `Final Score: ${score}`,
      });
    }
  }, [board, currentPiece, position, nextPiece, level, score, isValidMove, getRandomTetromino, playSound, toast]);

  const movePiece = useCallback((dx, dy) => {
    if (gameOver || isPaused || !currentPiece) return;

    const newPosition = { x: position.x + dx, y: position.y + dy };
    if (isValidMove(currentPiece, newPosition)) {
      setPosition(newPosition);
      if (dx !== 0) playSound('move');
      return true;
    }
    if (dy > 0) {
      mergePieceToBoard();
    }
    return false;
  }, [currentPiece, position, gameOver, isPaused, isValidMove, mergePieceToBoard, playSound]);

  const rotatePiece = useCallback(() => {
    if (gameOver || isPaused || !currentPiece) return;

    const rotated = {
      shape: currentPiece.shape[0].map((_, i) =>
        currentPiece.shape.map(row => row[i]).reverse()
      ),
      color: currentPiece.color
    };

    if (isValidMove(rotated, position)) {
      setCurrentPiece(rotated);
      playSound('rotate');
    }
  }, [currentPiece, position, gameOver, isPaused, isValidMove, playSound]);

  const handleKeyPress = useCallback((event) => {
    if (gameOver) return;

    switch (event.key) {
      case 'ArrowLeft':
        movePiece(-1, 0);
        break;
      case 'ArrowRight':
        movePiece(1, 0);
        break;
      case 'ArrowDown':
        movePiece(0, 1);
        break;
      case 'ArrowUp':
        rotatePiece();
        break;
      case ' ':
        while (movePiece(0, 1)) {}
        break;
      case 'p':
        setIsPaused(prev => !prev);
        break;
      default:
        break;
    }
  }, [movePiece, rotatePiece, gameOver]);

  useEffect(() => {
    resetGame();
  }, [resetGame]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);

  useEffect(() => {
    if (!gameOver && !isPaused) {
      gameLoop.current = setInterval(() => {
        movePiece(0, 1);
      }, INITIAL_SPEED / level);

      return () => clearInterval(gameLoop.current);
    }
  }, [gameOver, isPaused, level, movePiece]);

  const renderBoard = () => {
    const displayBoard = board.map(row => [...row]);
    
    if (currentPiece) {
      currentPiece.shape.forEach((row, dy) => {
        row.forEach((cell, dx) => {
          if (cell && position.y + dy >= 0) {
            displayBoard[position.y + dy][position.x + dx] = currentPiece.color;
          }
        });
      });
    }

    return displayBoard.map((row, y) => (
      <div key={y} className="flex">
        {row.map((cell, x) => (
          <div
            key={`${x}-${y}`}
            className={`game-cell w-6 h-6 ${cell || 'bg-gray-100'}`}
          />
        ))}
      </div>
    ));
  };

  const renderNextPiece = () => {
    if (!nextPiece) return null;

    return (
      <div className="next-piece">
        <div className="text-sm font-semibold mb-2">Next Piece</div>
        {nextPiece.shape.map((row, y) => (
          <div key={y} className="flex justify-center">
            {row.map((cell, x) => (
              <div
                key={`${x}-${y}`}
                className={`w-4 h-4 m-0.5 ${
                  cell ? nextPiece.color : 'bg-transparent'
                }`}
              />
            ))}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="tetris-container">
      <div className="score-display">
        Score: {score} | Level: {level}
      </div>
      
      {renderNextPiece()}
      
      <div className="game-board">
        {renderBoard()}
        
        {gameOver && (
          <div className="game-over">
            <div className="game-over-content">
              <h2 className="text-2xl font-bold mb-4">Game Over!</h2>
              <p className="mb-4">Final Score: {score}</p>
              <Button
                onClick={resetGame}
                className="bg-white text-black hover:bg-gray-200"
              >
                Play Again
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="controls">
        <Button
          onClick={() => setIsPaused(p => !p)}
          className="bg-white text-black hover:bg-gray-200"
        >
          {isPaused ? 'Resume' : 'Pause'}
        </Button>
        <Button
          onClick={() => setIsMuted(m => !m)}
          className="bg-white text-black hover:bg-gray-200"
        >
          {isMuted ? 'Unmute' : 'Mute'}
        </Button>
      </div>
    </div>
  );
};

export default TetrisGame;