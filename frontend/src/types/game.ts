export enum UnitType {
  Empty = 0,
  Assassin = 1,
  Guard = 2,
  Decoy = 3,
}

export enum StrikeResult {
  Miss = 0,
  HitGuard = 1,
  HitDecoy = 2,
  HitAssassin = 3,
}

export enum GameStatus {
  Setup = 'setup',
  Playing = 'playing',
  WaitingResponse = 'waiting',
  Won = 'won',
  Lost = 'lost',
}

export enum ActionType {
  Strike = 'strike',
  Scan = 'scan',
  Relocate = 'relocate',
}

export interface BoardState {
  assassinPos: number;
  guard1Pos: number;
  guard2Pos: number;
  decoy1Pos: number;
  decoy2Pos: number;
}

export interface ScanResult {
  position: number;  // Top-left corner of 2x2 area
  found: boolean;    // Whether any unit was found in the area
}

export interface StrikeAction {
  type: ActionType.Strike;
  target: number;
}

export interface ScanAction {
  type: ActionType.Scan;
  position: number;  // Top-left corner of 2x2 area
}

export interface RelocateAction {
  type: ActionType.Relocate;
  unitIndex: number;
  newPosition: number;
}

export type GameAction = StrikeAction | ScanAction | RelocateAction;

export interface ActionLogEntry {
  action: GameAction;
  result: StrikeResult | number | null;
  byPlayer: boolean;
  turnNumber: number;
}

export interface ChainEvent {
  type: 'game_created' | 'board_committed' | 'strike' | 'scan' | 'relocate';
  txHash: string;
  gameId?: string;
  commitment?: string;
  timestamp: number;
  description: string;
}

export interface RevealedInfo {
  strikes: Map<number, StrikeResult>;
  scans: ScanResult[];
}

export interface GameState {
  status: GameStatus;
  playerBoard: BoardState;
  opponentBoard: BoardState | null;
  playerRevealed: RevealedInfo;
  opponentRevealed: RevealedInfo;
  isPlayerTurn: boolean;
  playerRelocatesRemaining: number;
  opponentRelocatesRemaining: number;
  turnNumber: number;
  lastAction: GameAction | null;
  lastResult: StrikeResult | number | null;
  lastActionByPlayer: boolean;
  actionLog: ActionLogEntry[];
  aiThinking: boolean;
  gameId?: string;
  chainEvents: ChainEvent[];
  gridSize: number;
}

export const GRID_SIZES = {
  easy: 5,
  medium: 7,
  hard: 9,
} as const;

export type GridDifficulty = keyof typeof GRID_SIZES;

export const GRID_SIZE = 5; // Default, used for PvP
export const TOTAL_SQUARES = 25; // Default
export const ELIMINATED = -1;

export function posToRow(pos: number): number {
  return Math.floor(pos / GRID_SIZE);
}

export function posToCol(pos: number): number {
  return pos % GRID_SIZE;
}

export function rowColToPos(row: number, col: number): number {
  return row * GRID_SIZE + col;
}

export function isValidPos(pos: number): boolean {
  return pos >= 0 && pos < TOTAL_SQUARES;
}
