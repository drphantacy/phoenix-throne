import {
  BoardState,
  UnitType,
  StrikeResult,
  ELIMINATED,
  posToRow,
  posToCol,
  isValidPos,
} from '../types/game';

export function getUnitPositions(board: BoardState): number[] {
  return [
    board.assassinPos,
    board.guard1Pos,
    board.guard2Pos,
    board.decoy1Pos,
    board.decoy2Pos,
  ].filter(pos => pos !== ELIMINATED);
}

export function getUnitAt(board: BoardState, pos: number): UnitType {
  if (pos === board.assassinPos) return UnitType.Assassin;
  if (pos === board.guard1Pos || pos === board.guard2Pos) return UnitType.Guard;
  if (pos === board.decoy1Pos || pos === board.decoy2Pos) return UnitType.Decoy;
  return UnitType.Empty;
}

export function unitToStrikeResult(unit: UnitType): StrikeResult {
  switch (unit) {
    case UnitType.Assassin: return StrikeResult.HitAssassin;
    case UnitType.Guard: return StrikeResult.HitGuard;
    case UnitType.Decoy: return StrikeResult.HitDecoy;
    default: return StrikeResult.Miss;
  }
}

export function resolveStrike(board: BoardState, target: number): { result: StrikeResult; newBoard: BoardState } {
  const unit = getUnitAt(board, target);
  const result = unitToStrikeResult(unit);

  const newBoard = { ...board };
  if (target === board.assassinPos) newBoard.assassinPos = ELIMINATED;
  else if (target === board.guard1Pos) newBoard.guard1Pos = ELIMINATED;
  else if (target === board.guard2Pos) newBoard.guard2Pos = ELIMINATED;
  else if (target === board.decoy1Pos) newBoard.decoy1Pos = ELIMINATED;
  else if (target === board.decoy2Pos) newBoard.decoy2Pos = ELIMINATED;

  return { result, newBoard };
}

export function countUnitsInLine(board: BoardState, isRow: boolean, index: number): number {
  const positions = getUnitPositions(board);
  return positions.filter(pos => {
    const posIndex = isRow ? posToRow(pos) : posToCol(pos);
    return posIndex === index;
  }).length;
}

// Check if any unit is in a 2x2 area starting from top-left position
export function hasUnitInArea(board: BoardState, topLeft: number, gridSize: number = 5): boolean {
  const row = Math.floor(topLeft / gridSize);
  const col = topLeft % gridSize;
  const maxIdx = gridSize - 1;
  // Adjust if at right or bottom edge
  const startRow = row >= maxIdx ? maxIdx - 1 : row;
  const startCol = col >= maxIdx ? maxIdx - 1 : col;

  const areaCells = [
    startRow * gridSize + startCol,
    startRow * gridSize + startCol + 1,
    (startRow + 1) * gridSize + startCol,
    (startRow + 1) * gridSize + startCol + 1,
  ];

  const unitPositions = getUnitPositions(board);
  return areaCells.some(cell => unitPositions.includes(cell));
}

export function isValidPlacement(board: BoardState): boolean {
  const positions = [
    board.assassinPos,
    board.guard1Pos,
    board.guard2Pos,
    board.decoy1Pos,
    board.decoy2Pos,
  ];

  if (!positions.every(isValidPos)) return false;

  const unique = new Set(positions);
  if (unique.size !== positions.length) return false;

  return true;
}

export function isPositionOccupied(board: BoardState, pos: number): boolean {
  return getUnitAt(board, pos) !== UnitType.Empty;
}

export function relocateUnit(board: BoardState, unitIndex: number, newPos: number): BoardState | null {
  if (!isValidPos(newPos)) return null;
  if (isPositionOccupied(board, newPos)) return null;

  const newBoard = { ...board };
  switch (unitIndex) {
    case 0:
      if (board.assassinPos === ELIMINATED) return null;
      newBoard.assassinPos = newPos;
      break;
    case 1:
      if (board.guard1Pos === ELIMINATED) return null;
      newBoard.guard1Pos = newPos;
      break;
    case 2:
      if (board.guard2Pos === ELIMINATED) return null;
      newBoard.guard2Pos = newPos;
      break;
    case 3:
      if (board.decoy1Pos === ELIMINATED) return null;
      newBoard.decoy1Pos = newPos;
      break;
    case 4:
      if (board.decoy2Pos === ELIMINATED) return null;
      newBoard.decoy2Pos = newPos;
      break;
    default:
      return null;
  }

  return newBoard;
}

export function generateRandomBoard(gridSize: number = 5): BoardState {
  const totalSquares = gridSize * gridSize;
  const positions: number[] = [];
  while (positions.length < 5) {
    const pos = Math.floor(Math.random() * totalSquares);
    if (!positions.includes(pos)) {
      positions.push(pos);
    }
  }

  return {
    assassinPos: positions[0],
    guard1Pos: positions[1],
    guard2Pos: positions[2],
    decoy1Pos: positions[3],
    decoy2Pos: positions[4],
  };
}

export function isAssassinEliminated(board: BoardState): boolean {
  return board.assassinPos === ELIMINATED;
}

export function getUnitName(unit: UnitType): string {
  switch (unit) {
    case UnitType.Assassin: return 'Assassin';
    case UnitType.Guard: return 'Guard';
    case UnitType.Decoy: return 'Decoy';
    default: return 'Empty';
  }
}

export function getStrikeResultDescription(result: StrikeResult): string {
  switch (result) {
    case StrikeResult.Miss: return 'Miss! The square was empty.';
    case StrikeResult.HitGuard: return 'Hit a Guard! Turn ends.';
    case StrikeResult.HitDecoy: return 'Hit a Decoy! Bonus strike!';
    case StrikeResult.HitAssassin: return 'HIT THE ASSASSIN! You win!';
    default: return '';
  }
}
