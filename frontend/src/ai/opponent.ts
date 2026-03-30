import {
  BoardState,
  GameAction,
  ActionType,
  RevealedInfo,
  ScanResult,
} from '../types/game';
import { generateRandomBoard } from '../utils/gameLogic';

export type AIDifficulty = 'easy' | 'medium' | 'hard';

export class AIOpponent {
  private board: BoardState;
  private difficulty: AIDifficulty;
  private gridSize: number;
  private totalSquares: number;
  private relocatesRemaining: number = 2;

  constructor(difficulty: AIDifficulty = 'medium', gridSize: number = 5) {
    this.gridSize = gridSize;
    this.totalSquares = gridSize * gridSize;
    this.board = generateRandomBoard(gridSize);
    this.difficulty = difficulty;
  }

  getGridSize(): number {
    return this.gridSize;
  }

  getBoard(): BoardState {
    return this.board;
  }

  updateBoard(newBoard: BoardState): void {
    this.board = newBoard;
  }

  decideAction(revealed: RevealedInfo): GameAction {
    switch (this.difficulty) {
      case 'easy':
        return this.decideEasy(revealed);
      case 'medium':
        return this.decideMedium(revealed);
      case 'hard':
        return this.decideHard(revealed);
      default:
        return this.decideMedium(revealed);
    }
  }

  private decideEasy(revealed: RevealedInfo): GameAction {
    const unstruck = this.getUnstruckPositions(revealed);
    const target = unstruck[Math.floor(Math.random() * unstruck.length)];
    return { type: ActionType.Strike, target };
  }

  private decideMedium(revealed: RevealedInfo): GameAction {
    const unstruck = this.getUnstruckPositions(revealed);

    if (revealed.scans.length < 3 && Math.random() < 0.2) {
      return this.decideScan(revealed);
    }

    const prioritized = this.prioritizeByScans(unstruck, revealed.scans);
    if (prioritized.length > 0) {
      const target = prioritized[Math.floor(Math.random() * prioritized.length)];
      return { type: ActionType.Strike, target };
    }

    const target = unstruck[Math.floor(Math.random() * unstruck.length)];
    return { type: ActionType.Strike, target };
  }

  private decideHard(revealed: RevealedInfo): GameAction {
    const unstruck = this.getUnstruckPositions(revealed);

    if (revealed.scans.length < 2 && revealed.strikes.size < 5) {
      return this.decideScan(revealed);
    }

    const scores = this.scorePositions(unstruck, revealed);
    const maxScore = Math.max(...scores.values());

    if (maxScore > 0) {
      const bestTargets = unstruck.filter(pos => scores.get(pos) === maxScore);
      const target = bestTargets[Math.floor(Math.random() * bestTargets.length)];
      return { type: ActionType.Strike, target };
    }

    if (Math.random() < 0.15 && revealed.scans.length < 6) {
      return this.decideScan(revealed);
    }

    const target = unstruck[Math.floor(Math.random() * unstruck.length)];
    return { type: ActionType.Strike, target };
  }

  private getUnstruckPositions(revealed: RevealedInfo): number[] {
    const positions: number[] = [];
    for (let i = 0; i < this.totalSquares; i++) {
      if (!revealed.strikes.has(i)) {
        positions.push(i);
      }
    }
    return positions;
  }

  private decideScan(revealed: RevealedInfo): GameAction {
    // Get positions that haven't been scanned yet (2x2 areas)
    const scannedPositions = new Set(revealed.scans.map(s => s.position));
    // Valid top-left positions for 2x2 areas
    const validPositions: number[] = [];
    for (let row = 0; row < this.gridSize - 1; row++) {
      for (let col = 0; col < this.gridSize - 1; col++) {
        const pos = row * this.gridSize + col;
        if (!scannedPositions.has(pos)) {
          validPositions.push(pos);
        }
      }
    }

    if (validPositions.length > 0) {
      const position = validPositions[Math.floor(Math.random() * validPositions.length)];
      return { type: ActionType.Scan, position };
    }

    return this.decideEasy(revealed);
  }

  private prioritizeByScans(positions: number[], scans: ScanResult[]): number[] {
    // Get cells that are in areas where units were found
    const hotCells = new Set<number>();
    const maxIdx = this.gridSize - 1;

    scans.forEach(scan => {
      if (scan.found) {
        // Add all 4 cells in the 2x2 area
        const row = Math.floor(scan.position / this.gridSize);
        const col = scan.position % this.gridSize;
        const startRow = row >= maxIdx ? maxIdx - 1 : row;
        const startCol = col >= maxIdx ? maxIdx - 1 : col;
        hotCells.add(startRow * this.gridSize + startCol);
        hotCells.add(startRow * this.gridSize + startCol + 1);
        hotCells.add((startRow + 1) * this.gridSize + startCol);
        hotCells.add((startRow + 1) * this.gridSize + startCol + 1);
      }
    });

    return positions.filter(pos => hotCells.has(pos));
  }

  private scorePositions(positions: number[], revealed: RevealedInfo): Map<number, number> {
    const scores = new Map<number, number>();
    const maxIdx = this.gridSize - 1;

    positions.forEach(pos => {
      let score = 0;

      // Check how many scan areas with "found" contain this position
      revealed.scans.forEach(scan => {
        if (scan.found) {
          const row = Math.floor(scan.position / this.gridSize);
          const col = scan.position % this.gridSize;
          const startRow = row >= maxIdx ? maxIdx - 1 : row;
          const startCol = col >= maxIdx ? maxIdx - 1 : col;
          const areaCells = [
            startRow * this.gridSize + startCol,
            startRow * this.gridSize + startCol + 1,
            (startRow + 1) * this.gridSize + startCol,
            (startRow + 1) * this.gridSize + startCol + 1,
          ];
          if (areaCells.includes(pos)) {
            score += 1;
          }
        }
      });

      scores.set(pos, score);
    });

    return scores;
  }

  getRelocatesRemaining(): number {
    return this.relocatesRemaining;
  }

  useRelocate(): void {
    if (this.relocatesRemaining > 0) {
      this.relocatesRemaining--;
    }
  }
}
