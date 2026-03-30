import React from 'react';
import {
  BoardState,
  UnitType,
  StrikeResult,
  RevealedInfo,
  GRID_SIZE,
} from '../types/game';
import { getUnitAt } from '../utils/gameLogic';
import { UNIT_NAMES, UNIT_EMOJIS } from '../constants/game';
import './GameBoard.css';

interface GameBoardProps {
  board: BoardState | null;
  revealed?: RevealedInfo;
  isOwn: boolean;
  onCellClick?: (pos: number) => void;
  onCellDrop?: (pos: number, fromPos?: number) => void;
  onUnitDragStart?: (pos: number, unitIndex: number) => void;
  onCellHover?: (pos: number | null) => void;
  selectedCell?: number | null;
  highlightedCells?: number[];
  scanHighlightedCells?: number[];
  disabled?: boolean;
  allowRelocate?: boolean;
  popoverCell?: number | null;
  hideStatus?: boolean;
  gridSize?: number;
}

const GameBoard: React.FC<GameBoardProps> = ({
  board,
  revealed,
  isOwn,
  onCellClick,
  onCellDrop,
  onUnitDragStart,
  onCellHover,
  selectedCell,
  highlightedCells = [],
  scanHighlightedCells = [],
  disabled = false,
  allowRelocate = false,
  popoverCell,
  hideStatus = false,
  gridSize = GRID_SIZE,
}) => {
  const [dragOverCell, setDragOverCell] = React.useState<number | null>(null);
  const dragImageRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const dragImage = document.createElement('div');
    dragImage.className = 'drag-image';
    dragImage.style.cssText = `
      position: fixed;
      top: -100px;
      left: -100px;
      padding: 8px 16px;
      background: linear-gradient(135deg, #1a1a1a 0%, #0f0f0f 100%);
      border: 2px solid var(--lime, #c4ffc2);
      border-radius: 8px;
      color: var(--ivory, #f5f5f0);
      font-size: 14px;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
      pointer-events: none;
      z-index: 9999;
    `;
    document.body.appendChild(dragImage);
    dragImageRef.current = dragImage;

    return () => {
      if (dragImageRef.current) {
        document.body.removeChild(dragImageRef.current);
      }
    };
  }, []);

  const getUnitIndexAt = (pos: number): number => {
    if (!board) return -1;
    if (board.assassinPos === pos) return 0;
    if (board.guard1Pos === pos) return 1;
    if (board.guard2Pos === pos) return 2;
    if (board.decoy1Pos === pos) return 3;
    if (board.decoy2Pos === pos) return 4;
    return -1;
  };

  const renderCell = (row: number, col: number) => {
    const pos = row * gridSize + col;
    const isHighlighted = highlightedCells.includes(pos);
    const isSelected = selectedCell === pos;

    let cellContent: React.ReactNode = null;
    let cellClass = 'cell';
    let isDraggable = false;

    if (isOwn && board) {
      const unit = getUnitAt(board, pos);
      const isStruck = revealed?.strikes.has(pos);
      const strikeResult = revealed?.strikes.get(pos);

      if (unit !== UnitType.Empty) {
        cellContent = getUnitEmoji(unit);
        if (isStruck) {
          cellClass += ' struck';
          if (unit === UnitType.Assassin) cellClass += ' result-hitassassin';
          else if (unit === UnitType.Guard) cellClass += ' result-hitguard';
          else if (unit === UnitType.Decoy) cellClass += ' result-hitdecoy';
        } else {
          cellClass += ' unit-active';
        }
        if (allowRelocate && !isStruck) {
          isDraggable = true;
          cellClass += ' draggable';
        }
      } else if (isStruck) {
        // Unit was eliminated - show emoji based on strike result
        if (strikeResult === StrikeResult.HitAssassin) {
          cellContent = '🗡️';
          cellClass += ' struck result-hitassassin';
        } else if (strikeResult === StrikeResult.HitGuard) {
          cellContent = '🛡️';
          cellClass += ' struck result-hitguard';
        } else if (strikeResult === StrikeResult.HitDecoy) {
          cellContent = '👤';
          cellClass += ' struck result-hitdecoy';
        } else {
          cellClass += ' struck result-miss';
        }
      }
    } else if (revealed) {
      if (revealed.strikes.has(pos)) {
        const result = revealed.strikes.get(pos)!;
        cellClass += ` result-${StrikeResult[result].toLowerCase()} struck`;
        if (result === StrikeResult.HitAssassin) {
          cellContent = '🗡️';
        } else if (result === StrikeResult.HitGuard) {
          cellContent = '🛡️';
        } else if (result === StrikeResult.HitDecoy) {
          cellContent = '👤';
        }
      }
    }

    if (isHighlighted) cellClass += ' highlighted';
    if (isSelected) cellClass += ' selected';
    if (scanHighlightedCells.includes(pos)) cellClass += ' scan-highlight';
    if (disabled && !onCellDrop) cellClass += ' disabled';
    if (dragOverCell === pos) cellClass += ' drag-over';
    if (popoverCell === pos) cellClass += ' popover-active';

    return (
      <div
        key={pos}
        className={cellClass}
        draggable={isDraggable}
        onClick={() => !disabled && !cellClass.includes('struck') && onCellClick?.(pos)}
        onMouseEnter={() => onCellHover?.(pos)}
        onMouseLeave={() => onCellHover?.(null)}
        onDragStart={(e) => {
          if (isDraggable) {
            const unitIndex = getUnitIndexAt(pos);
            e.dataTransfer.setData('text/plain', `board:${unitIndex}:${pos}`);
            if (dragImageRef.current && unitIndex !== -1) {
              dragImageRef.current.innerHTML = `<span>${UNIT_EMOJIS[unitIndex]}</span><span>${UNIT_NAMES[unitIndex]}</span>`;
              e.dataTransfer.setDragImage(dragImageRef.current, 40, 20);
            }

            onUnitDragStart?.(pos, unitIndex);
          }
        }}
        onDragOver={(e) => {
          if (onCellDrop) {
            e.preventDefault();
            setDragOverCell(pos);
          }
        }}
        onDragLeave={() => setDragOverCell(null)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOverCell(null);
          const data = e.dataTransfer.getData('text/plain');
          if (data.startsWith('board:')) {
            const fromPos = parseInt(data.split(':')[2], 10);
            onCellDrop?.(pos, fromPos);
          } else {
            onCellDrop?.(pos);
          }
        }}
      >
        {cellContent}
        <span className="cell-pos">{pos}</span>
      </div>
    );
  };

  const getKilledUnits = (): boolean[] => {
    const killed = [false, false, false, false, false];

    if (isOwn && board) {
      const positions = [board.assassinPos, board.guard1Pos, board.guard2Pos, board.decoy1Pos, board.decoy2Pos];
      positions.forEach((pos, idx) => {
        // Unit is killed if its position is -1 (ELIMINATED)
        if (pos === -1) {
          killed[idx] = true;
        }
      });
    } else if (!isOwn && revealed) {
      let guardsKilled = 0;
      let decoysKilled = 0;

      revealed.strikes.forEach((result) => {
        if (result === StrikeResult.HitAssassin) killed[0] = true;
        if (result === StrikeResult.HitGuard) {
          if (guardsKilled === 0) killed[1] = true;
          else killed[2] = true;
          guardsKilled++;
        }
        if (result === StrikeResult.HitDecoy) {
          if (decoysKilled === 0) killed[3] = true;
          else killed[4] = true;
          decoysKilled++;
        }
      });
    }

    return killed;
  };

  const killedUnits = getKilledUnits();

  return (
    <div className={`game-board ${isOwn ? 'own-board' : ''}`}>
      <div className="board-title">{isOwn ? 'Your Board' : "Opponent's Board"}</div>
      <div className="board-grid" style={{ '--grid-size': gridSize } as React.CSSProperties}>
        {Array.from({ length: gridSize }, (_, row) => (
          <div key={row} className="board-row" style={{ zIndex: row + 1 }}>
            {Array.from({ length: gridSize }, (_, col) => renderCell(row, col))}
          </div>
        ))}
      </div>
      {!hideStatus && (
        <div className="unit-status">
          {[0, 1, 2, 3, 4].map((idx) => (
            <div
              key={idx}
              className={`unit-status-item ${killedUnits[idx] ? 'killed' : ''}`}
              title={UNIT_NAMES[idx]}
            >
              <span className="unit-status-emoji">{UNIT_EMOJIS[idx]}</span>
            </div>
          ))}
        </div>
      )}

    </div>
  );
};

function getUnitEmoji(unit: UnitType): string {
  switch (unit) {
    case UnitType.Assassin: return '🗡️';
    case UnitType.Guard: return '🛡️';
    case UnitType.Decoy: return '👤';
    default: return '';
  }
}

export default GameBoard;
