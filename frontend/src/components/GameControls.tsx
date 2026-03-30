import React from 'react';
import { GameStatus } from '../types/game';
import './GameControls.css';

interface GameControlsProps {
  status: GameStatus;
  isPlayerTurn: boolean;
}

const GameControls: React.FC<GameControlsProps> = ({
  status,
  isPlayerTurn,
}) => {
  if (status === GameStatus.Won || status === GameStatus.Lost) {
    return null;
  }

  if (status !== GameStatus.Playing) {
    return null;
  }

  return (
    <div className="game-controls">
      <div className={`turn-indicator ${!isPlayerTurn ? 'waiting' : ''}`}>
        {isPlayerTurn ? "Your Turn" : "Opponent's Turn"}
      </div>
      <div className="action-hint">
        {isPlayerTurn ? "Click a cell on opponent's board" : "Please wait..."}
      </div>
    </div>
  );
};

export default GameControls;
