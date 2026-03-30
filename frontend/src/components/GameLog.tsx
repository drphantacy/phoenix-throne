import React from 'react';
import { ActionType, StrikeResult, ActionLogEntry, ChainEvent } from '../types/game';
import { getStrikeResultDescription } from '../utils/gameLogic';
import './GameLog.css';

interface GameLogProps {
  actionLog: ActionLogEntry[];
  chainEvents?: ChainEvent[];
  gameId?: string | null;
}

const GameLog: React.FC<GameLogProps> = ({
  actionLog,
  chainEvents = [],
  gameId,
}) => {
  const formatEntry = (entry: ActionLogEntry) => {
    const actor = entry.byPlayer ? 'You' : 'Opponent';
    const { action, result } = entry;

    if (action.type === ActionType.Strike) {
      return (
        <span>
          <strong>{actor}</strong> struck position {action.target}.{' '}
          {typeof result === 'number' && getStrikeResultDescription(result as StrikeResult)}
        </span>
      );
    }
    if (action.type === ActionType.Scan) {
      const found = result === 1;
      return (
        <span>
          <strong>{actor}</strong> scanned area at position {action.position}.{' '}
          {found ? 'Enemies found!' : 'Nothing found.'}
        </span>
      );
    }
    if (action.type === ActionType.Relocate) {
      return (
        <span>
          <strong>{actor}</strong> relocated a unit.
        </span>
      );
    }
    return null;
  };

  const formatChainEvent = (event: ChainEvent) => {
    return (
      <div className="chain-event-content">
        <span className="chain-event-text">{event.description}</span>
      </div>
    );
  };

  const recentLogs = actionLog.slice(-10).reverse();

  return (
    <div className="game-log">
      <div className="log-title">
        Game Log
      </div>

      {gameId && (
        <div className="game-id-section">
          <span className="game-id-label">Game ID:</span>
          <code className="game-id-value" title={gameId}>
            {gameId.slice(0, 16)}...
          </code>
        </div>
      )}

      {chainEvents.length > 0 && (
        <div className="chain-events">
          <div className="chain-events-title">On-Chain Activity</div>
          {chainEvents.map((event, i) => (
            <div key={i} className={`chain-event chain-event-${event.type}`}>
              {formatChainEvent(event)}
            </div>
          ))}
        </div>
      )}

      <div className="log-entries">
        {recentLogs.length === 0 ? (
          <div className="log-entry empty">No actions yet</div>
        ) : (
          recentLogs.map((entry, i) => (
            <div
              key={actionLog.length - 1 - i}
              className={`log-entry ${entry.byPlayer ? 'player' : 'opponent'} ${i === 0 ? 'latest' : ''}`}
            >
              {formatEntry(entry)}
            </div>
          ))
        )}
      </div>

          </div>
  );
};

export default GameLog;
