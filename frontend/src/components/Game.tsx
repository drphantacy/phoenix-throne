import React, { useState, useRef, useEffect } from 'react';
import { GameStatus, BoardState, ChainEvent, GRID_SIZES } from '../types/game';
import { useGame } from '../hooks/useGame';
import { useContract } from '../hooks/useContract';
import { AIDifficulty } from '../ai/opponent';
import {
  AUDIO_VOLUME,
  TRANSITION_DELAY_MS,
  MENU_ACCENT_CELLS,
  MENU_ANIMATION_DELAY_INCREMENT,
  INITIAL_EMPTY_BOARD,
} from '../constants/game';
import GameBoard from './GameBoard';
import GameControls from './GameControls';
import GameLog from './GameLog';
import PhoenixLogo from './PhoenixLogo';
import { PhoenixIcon, GuardIcon, DecoyIcon } from './UnitIcons';
import './Game.css';

type GameMode = 'ai' | 'online';

const Game: React.FC = () => {
  const {
    gameState,
    startGame,
    placeUnits,
    performStrike,
    performScan,
    performRelocate,
    resetGame,
  } = useGame();

  const { connected, connect, disconnect, createSoloGame, createGame, relocate: contractRelocate, balance, address } = useContract();

  const [popoverCell, setPopoverCell] = useState<number | null>(null);
  const [playerPopoverCell, setPlayerPopoverCell] = useState<number | null>(null);
  const [relocateFromCell, setRelocateFromCell] = useState<number | null>(null);
  const [isRelocating, setIsRelocating] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [lastSeenLogCount, setLastSeenLogCount] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [placingUnit, setPlacingUnit] = useState<number | null>(0);
  const [setupBoard, setSetupBoard] = useState<BoardState | null>(null);
  const [gameMode, setGameMode] = useState<GameMode | null>(null);
  const [opponentAddress, setOpponentAddress] = useState('');
  const [isCreatingGame, setIsCreatingGame] = useState(false);
  const [isStartingGame, setIsStartingGame] = useState(false);
  const [createdGameId, setCreatedGameId] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(() => {
    const saved = localStorage.getItem('phoenixThrone_musicMuted');
    return saved === 'true';
  });
  const [chainEvents, setChainEvents] = useState<ChainEvent[]>([]);
  const [currentGameId, setCurrentGameId] = useState<string | null>(null);
  const [hoverCell, setHoverCell] = useState<number | null>(null);
  const [selectedAction, setSelectedAction] = useState<'strike' | 'scan' | null>(null);
  const [scanStatus, setScanStatus] = useState<'selecting' | 'scanning' | 'found' | 'clear' | null>(null);
  const [showDifficultySelect, setShowDifficultySelect] = useState(false);
  const [selectedGridSize, setSelectedGridSize] = useState<number>(5);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!connected && (gameState || setupBoard || gameMode)) {
      resetGame();
      setGameMode(null);
      setSetupBoard(null);
      setCreatedGameId(null);
      setTxHash(null);
      setOpponentAddress('');
      setChainEvents([]);
      setCurrentGameId(null);
    }
  }, [connected]);

  useEffect(() => {
    audioRef.current = new Audio('/audio/background-music.mp3');
    audioRef.current.loop = true;
    audioRef.current.volume = AUDIO_VOLUME;
    audioRef.current.muted = isMuted;

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const startMusic = () => {
    if (audioRef.current && audioRef.current.paused) {
      audioRef.current.play().catch(() => {});
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      const newMuted = !audioRef.current.muted;
      audioRef.current.muted = newMuted;
      setIsMuted(newMuted);
      localStorage.setItem('phoenixThrone_musicMuted', String(newMuted));
    }
  };

  const handleStartGame = (difficulty: AIDifficulty = 'medium') => {
    startMusic();
    setGameMode('ai');
    setShowDifficultySelect(false);
    setSelectedGridSize(GRID_SIZES[difficulty]);
    setIsTransitioning(true);
    setTimeout(() => {
      startGame(difficulty);
      setSetupBoard({ ...INITIAL_EMPTY_BOARD });
      setPlacingUnit(0);
      setIsTransitioning(false);
    }, TRANSITION_DELAY_MS);
  };

  const [txError, setTxError] = useState<string | null>(null);

  const TEST_MODE = import.meta.env.VITE_TEST_MODE === 'true';

  const handleConfirmPlacement = async () => {
    if (!setupBoard) return;

    setIsStartingGame(true);
    setTxError(null);

    if (TEST_MODE) {
      const mockGameId = `test-${Date.now()}`;
      setCurrentGameId(mockGameId);
      setChainEvents([
        {
          type: 'game_created',
          txHash: 'test-mode',
          gameId: mockGameId,
          timestamp: Date.now(),
          description: 'Game created (test mode)',
        },
      ]);
      placeUnits(setupBoard);
      setSetupBoard(null);
      setIsStartingGame(false);
      return;
    }

    try {
      const result = await createSoloGame({
        assassinPos: setupBoard.assassinPos,
        guard1Pos: setupBoard.guard1Pos,
        guard2Pos: setupBoard.guard2Pos,
        decoy1Pos: setupBoard.decoy1Pos,
        decoy2Pos: setupBoard.decoy2Pos,
      });

      console.log('Game created:', result);

      setCurrentGameId(result.gameId);
      setChainEvents([
        {
          type: 'game_created',
          txHash: result.txHash,
          gameId: result.gameId,
          timestamp: Date.now(),
          description: 'Game created on-chain',
        },
      ]);

      placeUnits(setupBoard);
      setSetupBoard(null);
    } catch (err) {
      console.error('Failed to create on-chain game:', err);
      setTxError((err as Error).message || 'Transaction failed');
    } finally {
      setIsStartingGame(false);
    }
  };

  const handlePlaceUnit = (pos: number, fromPos?: number) => {
    if (!setupBoard) return;

    const occupied = [
      setupBoard.assassinPos,
      setupBoard.guard1Pos,
      setupBoard.guard2Pos,
      setupBoard.decoy1Pos,
      setupBoard.decoy2Pos,
    ].filter(p => p !== -1);

    if (fromPos !== undefined) {
      const unitIndex = [
        setupBoard.assassinPos,
        setupBoard.guard1Pos,
        setupBoard.guard2Pos,
        setupBoard.decoy1Pos,
        setupBoard.decoy2Pos,
      ].indexOf(fromPos);

      if (unitIndex === -1) return;

      if (pos !== fromPos && occupied.includes(pos)) return;

      const newBoard = { ...setupBoard };
      switch (unitIndex) {
        case 0: newBoard.assassinPos = pos; break;
        case 1: newBoard.guard1Pos = pos; break;
        case 2: newBoard.guard2Pos = pos; break;
        case 3: newBoard.decoy1Pos = pos; break;
        case 4: newBoard.decoy2Pos = pos; break;
      }
      setSetupBoard(newBoard);
      return;
    }

    if (placingUnit === null) return;
    if (occupied.includes(pos)) return;

    const newBoard = { ...setupBoard };
    switch (placingUnit) {
      case 0: newBoard.assassinPos = pos; break;
      case 1: newBoard.guard1Pos = pos; break;
      case 2: newBoard.guard2Pos = pos; break;
      case 3: newBoard.decoy1Pos = pos; break;
      case 4: newBoard.decoy2Pos = pos; break;
    }

    setSetupBoard(newBoard);

    const nextUnplaced = [
      newBoard.assassinPos,
      newBoard.guard1Pos,
      newBoard.guard2Pos,
      newBoard.decoy1Pos,
      newBoard.decoy2Pos,
    ].findIndex((p, i) => p === -1 && i > placingUnit);

    if (nextUnplaced !== -1) {
      setPlacingUnit(nextUnplaced);
    } else {
      const anyUnplaced = [
        newBoard.assassinPos,
        newBoard.guard1Pos,
        newBoard.guard2Pos,
        newBoard.decoy1Pos,
        newBoard.decoy2Pos,
      ].findIndex(p => p === -1);
      setPlacingUnit(anyUnplaced !== -1 ? anyUnplaced : null);
    }
  };

  const isAllPlaced = () => {
    if (!setupBoard) return false;
    return setupBoard.assassinPos !== -1 &&
           setupBoard.guard1Pos !== -1 &&
           setupBoard.guard2Pos !== -1 &&
           setupBoard.decoy1Pos !== -1 &&
           setupBoard.decoy2Pos !== -1;
  };

  const getUnitName = (index: number) => {
    switch (index) {
      case 0: return 'Phoenix';
      case 1: return 'Guard 1';
      case 2: return 'Guard 2';
      case 3: return 'Decoy 1';
      case 4: return 'Decoy 2';
      default: return '';
    }
  };

  const getUnitPlaced = (index: number) => {
    if (!setupBoard) return false;
    const positions = [
      setupBoard.assassinPos,
      setupBoard.guard1Pos,
      setupBoard.guard2Pos,
      setupBoard.decoy1Pos,
      setupBoard.decoy2Pos,
    ];
    return positions[index] !== -1;
  };

  const handleOpponentCellClick = (pos: number) => {
    if (!gameState || !gameState.isPlayerTurn) return;

    // If in scan mode, perform scan on the 2x2 area
    if (selectedAction === 'scan' && scanStatus === 'selecting') {
      setScanStatus('scanning');
      setHoverCell(null);

      // Simulate scanning delay, then show result
      setTimeout(() => {
        // Check if any unit in the 2x2 area
        const scanArea = getScanArea(pos);
        const opponentBoard = gameState.opponentBoard;
        let found = false;
        if (opponentBoard) {
          const unitPositions = [
            opponentBoard.assassinPos,
            opponentBoard.guard1Pos,
            opponentBoard.guard2Pos,
            opponentBoard.decoy1Pos,
            opponentBoard.decoy2Pos,
          ].filter(p => p !== -1);
          found = scanArea.some(cell => unitPositions.includes(cell));
        }

        setScanStatus(found ? 'found' : 'clear');

        // Auto-dismiss after showing result and perform the action
        setTimeout(() => {
          performScan(pos);
          setSelectedAction(null);
          setScanStatus(null);
        }, 1500);
      }, 800);
      return;
    }

    if (gameState.playerRevealed.strikes.has(pos)) return;
    setPopoverCell(popoverCell === pos ? null : pos);
    setPlayerPopoverCell(null); // Close player popover
    setRelocateFromCell(null); // Cancel relocate mode
  };

  const handleStrike = (pos: number) => {
    if (!gameState || !gameState.isPlayerTurn) return;
    performStrike(pos);
    setPopoverCell(null);
  };

  const closePopover = () => {
    setPopoverCell(null);
  };

  // Calculate 2x2 scan area based on hover position
  const getScanArea = (pos: number | null): number[] => {
    if (pos === null || !gameState) return [];
    const gridSize = gameState.gridSize;
    const maxIdx = gridSize - 1;
    const row = Math.floor(pos / gridSize);
    const col = pos % gridSize;
    // Adjust if at right or bottom edge
    const startRow = row >= maxIdx ? maxIdx - 1 : row;
    const startCol = col >= maxIdx ? maxIdx - 1 : col;
    return [
      startRow * gridSize + startCol,
      startRow * gridSize + startCol + 1,
      (startRow + 1) * gridSize + startCol,
      (startRow + 1) * gridSize + startCol + 1,
    ];
  };

  const getUnitAtPosition = (pos: number): number => {
    if (!gameState) return -1;
    const positions = [
      gameState.playerBoard.assassinPos,
      gameState.playerBoard.guard1Pos,
      gameState.playerBoard.guard2Pos,
      gameState.playerBoard.decoy1Pos,
      gameState.playerBoard.decoy2Pos,
    ];
    return positions.indexOf(pos);
  };

  const handlePlayerCellClick = async (pos: number) => {
    if (!gameState || !gameState.isPlayerTurn) return;

    // If in relocate mode, complete the relocate
    if (relocateFromCell !== null) {
      const unitIndex = getUnitAtPosition(relocateFromCell);
      if (unitIndex !== -1 && pos !== relocateFromCell) {
        // Check destination is empty and not struck
        const isStruck = gameState.opponentRevealed.strikes.has(pos);
        if (getUnitAtPosition(pos) === -1 && !isStruck) {
          if (!TEST_MODE && connected && currentGameId) {
            setIsRelocating(true);
            try {
              const board: BoardState = {
                assassinPos: gameState.playerBoard.assassinPos,
                guard1Pos: gameState.playerBoard.guard1Pos,
                guard2Pos: gameState.playerBoard.guard2Pos,
                decoy1Pos: gameState.playerBoard.decoy1Pos,
                decoy2Pos: gameState.playerBoard.decoy2Pos,
              };
              const result = await contractRelocate(currentGameId, board, unitIndex, pos);
              setChainEvents(prev => [...prev, {
                type: 'relocate',
                txHash: result.txHash,
                timestamp: Date.now(),
                description: `Relocated unit from ${relocateFromCell} to ${pos}`,
              }]);

              performRelocate(unitIndex, pos);
            } catch (err) {
              console.error('Failed to relocate on chain:', err);
            } finally {
              setIsRelocating(false);
            }
          } else {
            performRelocate(unitIndex, pos);
          }
        }
      }
      setRelocateFromCell(null);
      setPlayerPopoverCell(null);
      return;
    }

    // If clicking on own unit, show popover
    const unitIndex = getUnitAtPosition(pos);
    if (unitIndex !== -1 && gameState.playerRelocatesRemaining > 0) {
      setPlayerPopoverCell(playerPopoverCell === pos ? null : pos);
      setPopoverCell(null); // Close opponent popover
    }
  };

  const handleStartRelocate = () => {
    if (playerPopoverCell !== null) {
      setRelocateFromCell(playerPopoverCell);
      setPlayerPopoverCell(null);
    }
  };

  const closePlayerPopover = () => {
    setPlayerPopoverCell(null);
    setRelocateFromCell(null);
  };

  const renderSoundToggle = () => (
    <button
      className={`sound-toggle ${isMuted ? 'muted' : ''}`}
      onClick={toggleMute}
      title={isMuted ? 'Unmute' : 'Mute'}
    >
      {isMuted ? (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <line x1="23" y1="9" x2="17" y2="15" />
          <line x1="17" y1="9" x2="23" y2="15" />
        </svg>
      ) : (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
        </svg>
      )}
    </button>
  );

  const handleCreateOnlineGame = async () => {
    if (!setupBoard || !opponentAddress) return;

    setIsCreatingGame(true);
    try {
      const result = await createGame(
        {
          assassinPos: setupBoard.assassinPos,
          guard1Pos: setupBoard.guard1Pos,
          guard2Pos: setupBoard.guard2Pos,
          decoy1Pos: setupBoard.decoy1Pos,
          decoy2Pos: setupBoard.decoy2Pos,
        },
        opponentAddress
      );
      setCreatedGameId(result.gameId);
      setTxHash(result.txHash);
    } catch (err) {
      console.error('Failed to create game:', err);
      alert('Failed to create game: ' + (err as Error).message);
    } finally {
      setIsCreatingGame(false);
    }
  };

  const handleBackToMenu = () => {
    setGameMode(null);
    setSetupBoard(null);
    setCreatedGameId(null);
    setTxHash(null);
    setOpponentAddress('');
    setChainEvents([]);
    setCurrentGameId(null);
    setShowDifficultySelect(false);
  };

  const handlePlayAgain = () => {
    resetGame();
    setGameMode(null);
    setChainEvents([]);
    setCurrentGameId(null);
    setPopoverCell(null);
    setShowLog(false);
    setSetupBoard(null);
    setPlacingUnit(0);
    setShowDifficultySelect(false);
  };

  const truncateAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  if (!gameState && !setupBoard) {
    return (
      <div className={`game-container menu-screen ${isTransitioning ? 'transitioning' : ''}`}>
        {/* Floating decorative board */}
        <div className="menu-board-container">
          <div className="menu-board">
            {Array.from({ length: 25 }, (_, i) => (
              <div
                key={i}
                className={`menu-cell ${MENU_ACCENT_CELLS.includes(i) ? 'accent' : ''}`}
                style={{ '--delay': `${i * MENU_ANIMATION_DELAY_INCREMENT}s` } as React.CSSProperties}
              />
            ))}
          </div>
          <div className="menu-board-glow" />
          <div className="menu-board-shadow" />
        </div>

        <div className="menu-header">
          <div className="menu-title-row">
            <PhoenixLogo size={52} className="menu-logo" />
            <h1 className="menu-title">The Phoenix Throne</h1>
          </div>
          <p className="menu-subtitle">An FHE Hidden Information Strategy Game</p>
        </div>

        {/* Controls overlay */}
        <div className="menu-controls">
          {!connected ? (
            <div className="connect-prompt">
              <p className="connect-hint">Connect your wallet to play</p>
              <div className="menu-wallet">
                <button className="connect-wallet-btn" onClick={connect}>
                  Connect Wallet
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="wallet-card">
                <div className="menu-wallet connected">
                  <button className="connect-wallet-btn" onClick={disconnect}>
                    {address ? truncateAddress(address) : 'Connected'}
                  </button>
                </div>
                {balance !== null && (
                  <div className="wallet-balance">
                    <span className="balance-label">Balance</span>
                    <span className="balance-value">{balance.toFixed(4)}</span>
                    <span className="balance-unit">ETH</span>
                  </div>
                )}
              </div>

              <div className="mode-select">
                {!showDifficultySelect ? (
                  <div className="mode-buttons">
                    <button
                      className="solo-btn"
                      onClick={() => setShowDifficultySelect(true)}
                    >
                      Solo
                    </button>
                    <button
                      className="coming-soon"
                      disabled
                    >
                      <span className="btn-text">Play Versus</span>
                      <span className="btn-hover-text">Coming Soon</span>
                    </button>
                  </div>
                ) : (
                  <div className="difficulty-select">
                    <div className="difficulty-title">Select Difficulty</div>
                    <div className="difficulty-buttons">
                      <button
                        className="difficulty-btn easy"
                        onClick={() => handleStartGame('easy')}
                      >
                        <span className="difficulty-name">Easy</span>
                        <span className="difficulty-grid">5x5</span>
                      </button>
                      <button
                        className="difficulty-btn medium"
                        onClick={() => handleStartGame('medium')}
                      >
                        <span className="difficulty-name">Medium</span>
                        <span className="difficulty-grid">7x7</span>
                      </button>
                      <button
                        className="difficulty-btn hard"
                        onClick={() => handleStartGame('hard')}
                      >
                        <span className="difficulty-name">Hard</span>
                        <span className="difficulty-grid">9x9</span>
                      </button>
                    </div>
                    <button
                      className="back-link"
                      onClick={() => setShowDifficultySelect(false)}
                    >
                      Back
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {renderSoundToggle()}
      </div>
    );
  }

  if (gameMode === 'online' && setupBoard && !createdGameId) {
    return (
      <div className="game-container">
        <div className="setup-screen">
          <h2>Place Your Units</h2>
          <p>Drag or click to place pieces</p>
          <div className="setup-layout">
            <div className="unit-tray">
              {[0, 1, 2, 3, 4].map(i => (
                <div
                  key={i}
                  className={`unit-piece ${getUnitPlaced(i) ? 'placed' : ''} ${placingUnit === i ? 'selected' : ''}`}
                  draggable={!getUnitPlaced(i)}
                  onDragStart={(e) => {
                    setPlacingUnit(i);
                    e.dataTransfer.setData('text/plain', String(i));
                  }}
                  onClick={() => !getUnitPlaced(i) && setPlacingUnit(i)}
                >
                  <span className="unit-icon">
                    {i === 0 ? <PhoenixIcon size={32} /> : i <= 2 ? <GuardIcon size={32} /> : <DecoyIcon size={32} />}
                  </span>
                  <span className="unit-label">{getUnitName(i)}</span>
                </div>
              ))}
              <button
                className="start-btn tray-start-btn"
                onClick={handleCreateOnlineGame}
                disabled={!isAllPlaced() || isCreatingGame}
              >
                {isCreatingGame ? 'Creating...' : 'Create Game'}
              </button>
              <button className="back-btn tray-back-btn" onClick={handleBackToMenu}>
                Back
              </button>
            </div>
            <GameBoard
              board={setupBoard}
              isOwn={true}
              revealed={{ strikes: new Map(), scans: [] }}
              onCellClick={(pos) => handlePlaceUnit(pos)}
              onCellDrop={(pos, fromPos) => handlePlaceUnit(pos, fromPos)}
              disabled={false}
              allowRelocate={true}
              hideStatus={true}
              gridSize={5}
            />
          </div>
        </div>
        {renderSoundToggle()}
      </div>
    );
  }

  if (gameMode === 'online' && createdGameId) {
    return (
      <div className="game-container">
        <div className="setup-screen">
          <h2>Game Created!</h2>
          <p>Share the Game ID with your opponent:</p>
          <div className="game-id-display">
            <code>{createdGameId}</code>
          </div>
          {txHash && (
            <p className="tx-info">
              Transaction: <code>{txHash.slice(0, 20)}...</code>
            </p>
          )}
          <p>Waiting for opponent to join...</p>
          <button className="back-btn" onClick={handleBackToMenu}>
            Back to Menu
          </button>
        </div>
        {renderSoundToggle()}
      </div>
    );
  }

  if (!gameState && setupBoard) {
    return (
      <div className="game-container">
        <div className="setup-screen">
          <h2>Place Your Units</h2>
          <p>Drag or click to place pieces</p>
          <div className="setup-layout">
            <div className="unit-tray">
              {[0, 1, 2, 3, 4].map(i => (
                <div
                  key={i}
                  className={`unit-piece ${getUnitPlaced(i) ? 'placed' : ''} ${placingUnit === i ? 'selected' : ''}`}
                  draggable={!getUnitPlaced(i)}
                  onDragStart={(e) => {
                    setPlacingUnit(i);
                    e.dataTransfer.setData('text/plain', String(i));
                  }}
                  onClick={() => !getUnitPlaced(i) && setPlacingUnit(i)}
                >
                  <span className="unit-icon">
                    {i === 0 ? <PhoenixIcon size={32} /> : i <= 2 ? <GuardIcon size={32} /> : <DecoyIcon size={32} />}
                  </span>
                  <span className="unit-label">{getUnitName(i)}</span>
                </div>
              ))}
              <div className="tray-actions">
                <button
                  className={`start-btn tray-start-btn ${isStartingGame ? 'loading' : ''}`}
                  onClick={handleConfirmPlacement}
                  disabled={!isAllPlaced() || isStartingGame}
                >
                  {isStartingGame ? <span className="btn-spinner" /> : 'Start Game'}
                </button>
                {txError && (
                  <div className="tx-error">
                    Transaction failed. Please try again.
                  </div>
                )}
              </div>
            </div>
            <GameBoard
              board={setupBoard}
              isOwn={true}
              revealed={{ strikes: new Map(), scans: [] }}
              onCellClick={(pos) => handlePlaceUnit(pos)}
              onCellDrop={(pos, fromPos) => handlePlaceUnit(pos, fromPos)}
              disabled={false}
              allowRelocate={true}
              hideStatus={true}
              gridSize={selectedGridSize}
            />
          </div>
        </div>
        {renderSoundToggle()}
      </div>
    );
  }

  if (!gameState) {
    return null;
  }

  if (gameState.status === GameStatus.Setup && setupBoard) {
    return (
      <div className="game-container">
        <div className="setup-screen">
          <h2>Place Your Units</h2>
          <p>Drag or click to place pieces</p>
          <div className="setup-layout">
            <div className="unit-tray">
              {[0, 1, 2, 3, 4].map(i => (
                <div
                  key={i}
                  className={`unit-piece ${getUnitPlaced(i) ? 'placed' : ''} ${placingUnit === i ? 'selected' : ''}`}
                  draggable={!getUnitPlaced(i)}
                  onDragStart={(e) => {
                    setPlacingUnit(i);
                    e.dataTransfer.setData('text/plain', String(i));
                  }}
                  onClick={() => !getUnitPlaced(i) && setPlacingUnit(i)}
                >
                  <span className="unit-icon">
                    {i === 0 ? <PhoenixIcon size={32} /> : i <= 2 ? <GuardIcon size={32} /> : <DecoyIcon size={32} />}
                  </span>
                  <span className="unit-label">{getUnitName(i)}</span>
                </div>
              ))}
              <div className="tray-actions">
                <button
                  className={`start-btn tray-start-btn ${isStartingGame ? 'loading' : ''}`}
                  onClick={handleConfirmPlacement}
                  disabled={!isAllPlaced() || isStartingGame}
                >
                  {isStartingGame ? <span className="btn-spinner" /> : 'Start Game'}
                </button>
                {txError && (
                  <div className="tx-error">
                    Transaction failed. Please try again.
                  </div>
                )}
              </div>
            </div>
            <GameBoard
              board={setupBoard}
              isOwn={true}
              revealed={{ strikes: new Map(), scans: [] }}
              onCellClick={(pos) => handlePlaceUnit(pos)}
              onCellDrop={(pos, fromPos) => handlePlaceUnit(pos, fromPos)}
              disabled={false}
              allowRelocate={true}
              hideStatus={true}
              gridSize={selectedGridSize}
            />
          </div>
        </div>
        {renderSoundToggle()}
      </div>
    );
  }

  return (
    <div className="game-container">
      <div className="game-header">
        <div className="header-left">
          <PhoenixLogo size={48} className="header-logo" />
        </div>
        <div className="header-center">
          <GameControls
            status={gameState.status}
            isPlayerTurn={gameState.isPlayerTurn}
          />
        </div>
        <div className="header-right">
          <button
            className={`log-toggle ${showLog ? 'active' : ''}`}
            onClick={() => {
              setShowLog(!showLog);
              if (!showLog) {
                setLastSeenLogCount(gameState.actionLog.length + chainEvents.length);
              }
            }}
            title="Game Log"
          >
            {!showLog && (gameState.actionLog.length + chainEvents.length) > lastSeenLogCount && (
              <span className="log-notification-dot" />
            )}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          </button>
          <div className="header-wallet">
            <button className="connect-wallet-btn" onClick={disconnect}>
              {address ? truncateAddress(address) : 'Connected'}
            </button>
          </div>
        </div>
      </div>

      <div className="game-area">
        <div className={`floating-log ${showLog ? 'visible' : ''}`}>
          <GameLog
            actionLog={gameState.actionLog}
            chainEvents={chainEvents}
            gameId={currentGameId}
          />
        </div>

        <div className="board-stage">
          <div className={`board-wrapper ${gameState.isPlayerTurn ? 'active' : 'inactive'}`}>
            {popoverCell !== null && (
              <div className="action-box">
                <div className="action-box-header">
                  <span className="action-box-title">Cell {popoverCell}</span>
                  <button className="action-box-close" onClick={closePopover}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
                <div className="action-box-buttons">
                  <button className="action-box-btn strike" onClick={() => handleStrike(popoverCell)}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    Strike
                  </button>
                </div>
              </div>
            )}
            {selectedAction === 'scan' && scanStatus && (
              <div className={`action-bubble scan ${scanStatus}`}>
                {scanStatus === 'selecting' && (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="7" height="7" />
                      <rect x="14" y="3" width="7" height="7" />
                      <rect x="3" y="14" width="7" height="7" />
                      <rect x="14" y="14" width="7" height="7" />
                    </svg>
                    <span>Scan</span>
                    <button
                      className="action-bubble-close"
                      onClick={() => {
                        setSelectedAction(null);
                        setScanStatus(null);
                        setHoverCell(null);
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </>
                )}
                {scanStatus === 'scanning' && (
                  <>
                    <span className="scan-spinner" />
                    <span>Scanning...</span>
                  </>
                )}
                {scanStatus === 'found' && (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <span>Enemies detected!</span>
                  </>
                )}
                {scanStatus === 'clear' && (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>Nothing found</span>
                  </>
                )}
              </div>
            )}
            <GameBoard
              board={null}
              revealed={gameState.playerRevealed}
              isOwn={false}
              onCellClick={handleOpponentCellClick}
              onCellHover={selectedAction === 'scan' && scanStatus === 'selecting' ? setHoverCell : undefined}
              scanHighlightedCells={selectedAction === 'scan' && scanStatus === 'selecting' ? getScanArea(hoverCell) : []}
              disabled={!gameState.isPlayerTurn}
              popoverCell={popoverCell}
              gridSize={gameState.gridSize}
            />
          </div>
          <div className={`board-wrapper ${gameState.isPlayerTurn ? 'inactive' : 'active'} ${gameState.aiThinking ? 'thinking' : ''} ${isRelocating ? 'relocating' : ''}`}>
            {playerPopoverCell !== null && (
              <div className="action-box player-action-box">
                <div className="action-box-header">
                  <span className="action-box-title">Your Unit</span>
                  <button className="action-box-close" onClick={closePlayerPopover}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
                <div className="action-box-buttons">
                  <button className="action-box-btn relocate" onClick={handleStartRelocate}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="5 9 2 12 5 15" />
                      <polyline points="9 5 12 2 15 5" />
                      <polyline points="15 19 12 22 9 19" />
                      <polyline points="19 9 22 12 19 15" />
                      <line x1="2" y1="12" x2="22" y2="12" />
                      <line x1="12" y1="2" x2="12" y2="22" />
                    </svg>
                    Relocate ({gameState.playerRelocatesRemaining})
                  </button>
                </div>
              </div>
            )}
            {relocateFromCell !== null && (
              <div className="relocate-hint">
                Click an empty cell to relocate
              </div>
            )}
            <GameBoard
              board={gameState.playerBoard}
              revealed={gameState.opponentRevealed}
              isOwn={true}
              onCellClick={handlePlayerCellClick}
              disabled={!gameState.isPlayerTurn}
              popoverCell={playerPopoverCell}
              highlightedCells={relocateFromCell !== null ? [relocateFromCell] : []}
              gridSize={gameState.gridSize}
            />
            <div className="ai-thinking-overlay">
              <div className="ai-thinking-content">
                <div className="ai-thinking-text">Opponent Thinking</div>
                <div className="ai-thinking-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
            <div className="relocating-overlay">
              <div className="relocating-content">
                <span className="relocating-spinner" />
                <div className="relocating-text">Relocating</div>
              </div>
            </div>
          </div>
        </div>
      </div>


      {renderSoundToggle()}

      {(gameState.status === GameStatus.Won || gameState.status === GameStatus.Lost) && (
        <div className="game-over-overlay">
          <div className={`game-result ${gameState.status === GameStatus.Won ? 'win' : 'lose'}`}>
            <div className="result-title">
              {gameState.status === GameStatus.Won ? "Victory!" : "Defeat"}
            </div>
            <div className="result-message">
              {gameState.status === GameStatus.Won
                ? "You eliminated the enemy Assassin"
                : "Your Assassin was eliminated"}
            </div>
            <button className="play-again-btn" onClick={handlePlayAgain}>
              Play Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Game;
