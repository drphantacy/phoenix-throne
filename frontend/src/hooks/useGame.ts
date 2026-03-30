import { useState, useCallback, useRef } from 'react';
import {
  GameState,
  GameStatus,
  BoardState,
  StrikeResult,
  ActionType,
  RevealedInfo,
  ActionLogEntry,
  ELIMINATED,
  GRID_SIZES,
} from '../types/game';
import {
  resolveStrike,
  hasUnitInArea,
  relocateUnit,
} from '../utils/gameLogic';
import { AIOpponent, AIDifficulty } from '../ai/opponent';
import { getThinkingTime } from '../constants/game';

export interface AIStrikeAction {
  target: number;
  result: StrikeResult;
}

export interface TurnActions {
  turnNumber: number;
  playerTargets: number[];
  playerResults: number[];
  aiTargets: number[];
  aiResults: number[];
}

interface UseGameReturn {
  gameState: GameState | null;
  aiOpponent: AIOpponent | null;
  startGame: (difficulty: AIDifficulty) => void;
  placeUnits: (board: BoardState) => void;
  performStrike: (target: number, onTurnComplete?: (actions: TurnActions) => void) => void;
  performScan: (position: number, onTurnComplete?: (actions: TurnActions) => void) => void;
  performRelocate: (unitIndex: number, newPosition: number) => void;
  timeoutLose: () => void;
  resetGame: () => void;
}

interface AITurnResult {
  newState: GameState;
  aiActions: AIStrikeAction[];
}

export function useGame(): UseGameReturn {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [aiOpponent, setAiOpponent] = useState<AIOpponent | null>(null);

  // Accumulate player strikes within a turn (for bonus strikes from HitDecoy)
  const turnPlayerTargetsRef = useRef<number[]>([]);
  const turnPlayerResultsRef = useRef<number[]>([]);

  const createEmptyRevealed = (): RevealedInfo => ({
    strikes: new Map(),
    scans: [],
  });

  const createEmptyBoard = (): BoardState => ({
    assassinPos: ELIMINATED,
    guard1Pos: ELIMINATED,
    guard2Pos: ELIMINATED,
    decoy1Pos: ELIMINATED,
    decoy2Pos: ELIMINATED,
  });

  const startGame = useCallback((difficulty: AIDifficulty) => {
    const gridSize = GRID_SIZES[difficulty];
    const ai = new AIOpponent(difficulty, gridSize);
    setAiOpponent(ai);

    setGameState({
      status: GameStatus.Setup,
      playerBoard: createEmptyBoard(),
      opponentBoard: ai.getBoard(),
      playerRevealed: createEmptyRevealed(),
      opponentRevealed: createEmptyRevealed(),
      isPlayerTurn: true,
      playerRelocatesRemaining: 2,
      opponentRelocatesRemaining: 2,
      turnNumber: 0,
      lastAction: null,
      lastResult: null,
      lastActionByPlayer: false,
      actionLog: [],
      aiThinking: false,
      chainEvents: [],
      gridSize,
      turnStartTime: 0,
    });
  }, []);

  const placeUnits = useCallback((board: BoardState) => {
    setGameState(prev => {
      if (!prev) return null;
      return {
        ...prev,
        playerBoard: board,
        status: GameStatus.Playing,
        turnNumber: 1,
        isPlayerTurn: true,
        turnStartTime: Date.now(),
      };
    });
  }, []);

  const processAITurn = useCallback((state: GameState, ai: AIOpponent): AITurnResult => {
    const action = ai.decideAction(state.opponentRevealed);
    let newState = { ...state };
    const aiActions: AIStrikeAction[] = [];

    if (action.type === ActionType.Strike) {
      const { result, newBoard } = resolveStrike(state.playerBoard, action.target);

      const logEntry: ActionLogEntry = {
        action,
        result,
        byPlayer: false,
        turnNumber: state.turnNumber,
      };

      newState.playerBoard = newBoard;
      newState.opponentRevealed = {
        ...state.opponentRevealed,
        strikes: new Map(state.opponentRevealed.strikes).set(action.target, result),
      };
      newState.lastAction = action;
      newState.lastResult = result;
      newState.lastActionByPlayer = false;
      newState.actionLog = [...state.actionLog, logEntry];

      aiActions.push({ target: action.target, result });

      if (result === StrikeResult.HitAssassin) {
        newState.status = GameStatus.Lost;
        return { newState, aiActions };
      }

      if (result === StrikeResult.HitDecoy) {
        // AI gets bonus strike — recurse
        const recursed = processAITurn(newState, ai);
        return {
          newState: recursed.newState,
          aiActions: [...aiActions, ...recursed.aiActions],
        };
      }
    } else if (action.type === ActionType.Scan) {
      const found = hasUnitInArea(state.playerBoard, action.position, state.gridSize);

      const logEntry: ActionLogEntry = {
        action,
        result: found ? 1 : 0,
        byPlayer: false,
        turnNumber: state.turnNumber,
      };

      newState.opponentRevealed = {
        ...state.opponentRevealed,
        scans: [...state.opponentRevealed.scans, {
          position: action.position,
          found,
        }],
      };
      newState.lastAction = action;
      newState.lastResult = found ? 1 : 0;
      newState.lastActionByPlayer = false;
      newState.actionLog = [...state.actionLog, logEntry];
    }

    newState.isPlayerTurn = true;
    newState.turnNumber++;
    newState.turnStartTime = Date.now();
    return { newState, aiActions };
  }, []);

  const performStrike = useCallback((target: number, onTurnComplete?: (actions: TurnActions) => void) => {
    if (!gameState || !aiOpponent || !gameState.isPlayerTurn) return;
    if (gameState.status !== GameStatus.Playing) return;

    const opponentBoard = aiOpponent.getBoard();
    const { result, newBoard } = resolveStrike(opponentBoard, target);
    aiOpponent.updateBoard(newBoard);

    // Accumulate this strike
    turnPlayerTargetsRef.current.push(target);
    turnPlayerResultsRef.current.push(result);

    const action = { type: ActionType.Strike, target } as const;
    const logEntry: ActionLogEntry = {
      action,
      result,
      byPlayer: true,
      turnNumber: gameState.turnNumber,
    };

    let newState: GameState = {
      ...gameState,
      opponentBoard: newBoard,
      playerRevealed: {
        ...gameState.playerRevealed,
        strikes: new Map(gameState.playerRevealed.strikes).set(target, result),
      },
      lastAction: action,
      lastResult: result,
      lastActionByPlayer: true,
      actionLog: [...gameState.actionLog, logEntry],
    };

    if (result === StrikeResult.HitAssassin) {
      newState.status = GameStatus.Won;
      setGameState(newState);

      // Fire chain callback with accumulated actions
      if (onTurnComplete) {
        const actions: TurnActions = {
          turnNumber: gameState.turnNumber,
          playerTargets: [...turnPlayerTargetsRef.current],
          playerResults: [...turnPlayerResultsRef.current],
          aiTargets: [],
          aiResults: [],
        };
        turnPlayerTargetsRef.current = [];
        turnPlayerResultsRef.current = [];
        onTurnComplete(actions);
      }
      return;
    }

    if (result === StrikeResult.HitDecoy) {
      // Bonus strike — don't end turn, don't fire chain tx yet
      setGameState(newState);
      return;
    }

    // Turn-ending strike (Miss or HitGuard)
    newState.isPlayerTurn = false;
    newState.turnNumber++;
    newState.aiThinking = true;

    const thinkingTime = getThinkingTime();

    // Capture accumulated player actions before AI turn
    const accPlayerTargets = [...turnPlayerTargetsRef.current];
    const accPlayerResults = [...turnPlayerResultsRef.current];
    turnPlayerTargetsRef.current = [];
    turnPlayerResultsRef.current = [];

    setTimeout(() => {
      setGameState(prev => {
        if (!prev || prev.status !== GameStatus.Playing) return prev;
        const { newState: aiState, aiActions } = processAITurn(prev, aiOpponent);

        // Fire chain callback with full turn data
        if (onTurnComplete) {
          const actions: TurnActions = {
            turnNumber: prev.turnNumber - 1, // turnNumber was already incremented
            playerTargets: accPlayerTargets,
            playerResults: accPlayerResults,
            aiTargets: aiActions.map(a => a.target),
            aiResults: aiActions.map(a => a.result),
          };
          onTurnComplete(actions);
        }

        return { ...aiState, aiThinking: false };
      });
    }, thinkingTime);

    setGameState(newState);
  }, [gameState, aiOpponent, processAITurn]);

  const performScan = useCallback((position: number, onTurnComplete?: (actions: TurnActions) => void) => {
    if (!gameState || !aiOpponent || !gameState.isPlayerTurn) return;
    if (gameState.status !== GameStatus.Playing) return;

    const opponentBoard = aiOpponent.getBoard();
    const found = hasUnitInArea(opponentBoard, position, gameState.gridSize);

    const action = { type: ActionType.Scan, position } as const;
    const logEntry: ActionLogEntry = {
      action,
      result: found ? 1 : 0,
      byPlayer: true,
      turnNumber: gameState.turnNumber,
    };

    let newState: GameState = {
      ...gameState,
      playerRevealed: {
        ...gameState.playerRevealed,
        scans: [...gameState.playerRevealed.scans, { position, found }],
      },
      lastAction: action,
      lastResult: found ? 1 : 0,
      lastActionByPlayer: true,
      isPlayerTurn: false,
      turnNumber: gameState.turnNumber + 1,
      actionLog: [...gameState.actionLog, logEntry],
      aiThinking: true,
    };

    const thinkingTime = getThinkingTime();

    setTimeout(() => {
      setGameState(prev => {
        if (!prev || prev.status !== GameStatus.Playing) return prev;
        const { newState: aiState, aiActions } = processAITurn(prev, aiOpponent);

        // Scan doesn't produce strike targets/results for player
        if (onTurnComplete) {
          const actions: TurnActions = {
            turnNumber: prev.turnNumber - 1,
            playerTargets: [],
            playerResults: [],
            aiTargets: aiActions.map(a => a.target),
            aiResults: aiActions.map(a => a.result),
          };
          onTurnComplete(actions);
        }

        return { ...aiState, aiThinking: false };
      });
    }, thinkingTime);

    setGameState(newState);
  }, [gameState, aiOpponent, processAITurn]);

  const performRelocate = useCallback((unitIndex: number, newPosition: number) => {
    if (!gameState || !gameState.isPlayerTurn) return;
    if (gameState.status !== GameStatus.Playing) return;
    if (gameState.playerRelocatesRemaining <= 0) return;

    const newBoard = relocateUnit(gameState.playerBoard, unitIndex, newPosition);
    if (!newBoard) return;

    const action = { type: ActionType.Relocate, unitIndex, newPosition } as const;
    const logEntry: ActionLogEntry = {
      action,
      result: null,
      byPlayer: true,
      turnNumber: gameState.turnNumber,
    };

    let newState: GameState = {
      ...gameState,
      playerBoard: newBoard,
      playerRelocatesRemaining: gameState.playerRelocatesRemaining - 1,
      lastAction: action,
      lastResult: null,
      lastActionByPlayer: true,
      isPlayerTurn: false,
      turnNumber: gameState.turnNumber + 1,
      actionLog: [...gameState.actionLog, logEntry],
      aiThinking: true,
    };

    const thinkingTime = getThinkingTime();

    setTimeout(() => {
      setGameState(prev => {
        if (!prev || !aiOpponent || prev.status !== GameStatus.Playing) return prev;
        const { newState: aiState } = processAITurn(prev, aiOpponent);
        return { ...aiState, aiThinking: false };
      });
    }, thinkingTime);

    setGameState(newState);
  }, [gameState, aiOpponent, processAITurn]);

  const timeoutLose = useCallback(() => {
    setGameState(prev => {
      if (!prev || prev.status !== GameStatus.Playing) return prev;
      return { ...prev, status: GameStatus.Lost };
    });
  }, []);

  const resetGame = useCallback(() => {
    setGameState(null);
    setAiOpponent(null);
    turnPlayerTargetsRef.current = [];
    turnPlayerResultsRef.current = [];
  }, []);

  return {
    gameState,
    aiOpponent,
    startGame,
    placeUnits,
    performStrike,
    performScan,
    performRelocate,
    timeoutLose,
    resetGame,
  };
}
