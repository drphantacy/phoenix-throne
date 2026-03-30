import React from 'react';
import { ActionType, StrikeResult, ActionLogEntry, ChainEvent } from '../types/game';
import { getStrikeResultDescription } from '../utils/gameLogic';
import './GameLog.css';

interface GameLogProps {
  actionLog: ActionLogEntry[];
  chainEvents?: ChainEvent[];
  gameId?: string | null;
}

const SEPOLIA_EXPLORER = 'https://sepolia.etherscan.io/tx/';

const TxLink: React.FC<{ txHash: string }> = ({ txHash }) => {
  if (!txHash || txHash === 'test-mode' || txHash === '0x0') {
    return <span className="tx-badge pending">pending</span>;
  }
  return (
    <a
      className="tx-badge linked"
      href={`${SEPOLIA_EXPLORER}${txHash}`}
      target="_blank"
      rel="noopener noreferrer"
      title={txHash}
    >
      {txHash.slice(0, 6)}...{txHash.slice(-4)}
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        <polyline points="15 3 21 3 21 9" />
        <line x1="10" y1="14" x2="21" y2="3" />
      </svg>
    </a>
  );
};

const GameLog: React.FC<GameLogProps> = ({
  actionLog,
  chainEvents = [],
  gameId,
}) => {
  // Build a map of turnNumber → chain event for quick lookup
  const chainByTurn = new Map<number, ChainEvent>();
  const gameCreatedEvent = chainEvents.find(e => e.type === 'game_created');
  for (const event of chainEvents) {
    if (event.turnNumber !== undefined) {
      chainByTurn.set(event.turnNumber, event);
    }
  }

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

  // Group action log entries by turn number
  const turnGroups: { turnNumber: number; entries: ActionLogEntry[] }[] = [];
  for (const entry of actionLog) {
    const last = turnGroups[turnGroups.length - 1];
    if (last && last.turnNumber === entry.turnNumber) {
      last.entries.push(entry);
    } else {
      turnGroups.push({ turnNumber: entry.turnNumber, entries: [entry] });
    }
  }

  // Reverse for newest-first display
  const recentGroups = turnGroups.slice(-10).reverse();

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
          {gameCreatedEvent && (
            <TxLink txHash={gameCreatedEvent.txHash} />
          )}
        </div>
      )}

      <div className="log-entries">
        {recentGroups.length === 0 ? (
          <div className="log-entry empty">No actions yet</div>
        ) : (
          recentGroups.map((group) => {
            const chainEvent = chainByTurn.get(group.turnNumber);
            return (
              <div key={group.turnNumber} className="turn-group">
                <div className="turn-header">
                  <span className="turn-label">Turn {group.turnNumber}</span>
                  {chainEvent ? (
                    <TxLink txHash={chainEvent.txHash} />
                  ) : (
                    <span className="tx-badge pending">local</span>
                  )}
                </div>
                {group.entries.map((entry, i) => (
                  <div
                    key={i}
                    className={`log-entry ${entry.byPlayer ? 'player' : 'opponent'}`}
                  >
                    {formatEntry(entry)}
                  </div>
                ))}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default GameLog;
