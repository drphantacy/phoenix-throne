// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@fhenixprotocol/cofhe-contracts/FHE.sol";

contract PhoenixThrone {
    enum GameStatus { Active, PlayerWon, AIWon, Forfeited }

    struct EncryptedBoard {
        euint8 assassinPos;
        euint8 guard1Pos;
        euint8 guard2Pos;
        euint8 decoy1Pos;
        euint8 decoy2Pos;
    }

    struct Game {
        address player;
        EncryptedBoard playerBoard;
        EncryptedBoard aiBoard;
        GameStatus status;
        uint16 turnNumber;
    }

    uint256 public nextGameId;
    mapping(uint256 => Game) public games;

    // Sentinel value for eliminated units
    uint8 public constant ELIMINATED = 255;

    event GameCreated(uint256 indexed gameId, address indexed player);
    event TurnExecuted(
        uint256 indexed gameId,
        uint16 turnNumber,
        uint8[] playerTargets,
        uint8[] playerResults,
        uint8[] aiTargets,
        uint8[] aiResults
    );
    event UnitRelocated(uint256 indexed gameId, bool isPlayer, uint8 unitIndex);
    event GameOver(uint256 indexed gameId, GameStatus status);

    modifier onlyPlayer(uint256 gameId) {
        require(games[gameId].player == msg.sender, "Not the game player");
        _;
    }

    modifier gameActive(uint256 gameId) {
        require(games[gameId].status == GameStatus.Active, "Game not active");
        _;
    }

    function createGame(
        InEuint8 memory playerAssassin,
        InEuint8 memory playerGuard1,
        InEuint8 memory playerGuard2,
        InEuint8 memory playerDecoy1,
        InEuint8 memory playerDecoy2,
        InEuint8 memory aiAssassin,
        InEuint8 memory aiGuard1,
        InEuint8 memory aiGuard2,
        InEuint8 memory aiDecoy1,
        InEuint8 memory aiDecoy2
    ) external returns (uint256) {
        uint256 gameId = nextGameId++;
        Game storage game = games[gameId];
        game.player = msg.sender;
        game.status = GameStatus.Active;
        game.turnNumber = 1;

        // Store player board
        game.playerBoard.assassinPos = FHE.asEuint8(playerAssassin);
        game.playerBoard.guard1Pos = FHE.asEuint8(playerGuard1);
        game.playerBoard.guard2Pos = FHE.asEuint8(playerGuard2);
        game.playerBoard.decoy1Pos = FHE.asEuint8(playerDecoy1);
        game.playerBoard.decoy2Pos = FHE.asEuint8(playerDecoy2);

        // Store AI board
        game.aiBoard.assassinPos = FHE.asEuint8(aiAssassin);
        game.aiBoard.guard1Pos = FHE.asEuint8(aiGuard1);
        game.aiBoard.guard2Pos = FHE.asEuint8(aiGuard2);
        game.aiBoard.decoy1Pos = FHE.asEuint8(aiDecoy1);
        game.aiBoard.decoy2Pos = FHE.asEuint8(aiDecoy2);

        // Allow contract to use these encrypted values
        _allowBoard(game.playerBoard);
        _allowBoard(game.aiBoard);

        emit GameCreated(gameId, msg.sender);
        return gameId;
    }

    function executeTurn(
        uint256 gameId,
        uint8[] calldata playerTargets,
        uint8[] calldata playerResults,
        uint8[] calldata aiTargets,
        uint8[] calldata aiResults
    ) external onlyPlayer(gameId) gameActive(gameId) {
        require(playerTargets.length == playerResults.length, "Player arrays mismatch");
        require(aiTargets.length == aiResults.length, "AI arrays mismatch");

        Game storage game = games[gameId];

        // Verify and apply player strikes against AI board
        for (uint256 i = 0; i < playerTargets.length; i++) {
            _verifyAndApplyStrike(game.aiBoard, playerTargets[i], playerResults[i]);
        }

        // Verify and apply AI strikes against player board
        for (uint256 i = 0; i < aiTargets.length; i++) {
            _verifyAndApplyStrike(game.playerBoard, aiTargets[i], aiResults[i]);
        }

        emit TurnExecuted(
            gameId,
            game.turnNumber,
            playerTargets,
            playerResults,
            aiTargets,
            aiResults
        );

        // Check for game over conditions
        // Result 3 = HitAssassin
        for (uint256 i = 0; i < playerResults.length; i++) {
            if (playerResults[i] == 3) {
                game.status = GameStatus.PlayerWon;
                emit GameOver(gameId, GameStatus.PlayerWon);
                return;
            }
        }
        for (uint256 i = 0; i < aiResults.length; i++) {
            if (aiResults[i] == 3) {
                game.status = GameStatus.AIWon;
                emit GameOver(gameId, GameStatus.AIWon);
                return;
            }
        }

        game.turnNumber++;
    }

    function relocate(
        uint256 gameId,
        bool isPlayer,
        uint8 unitIndex,
        InEuint8 memory newPosition
    ) external onlyPlayer(gameId) gameActive(gameId) {
        require(unitIndex < 5, "Invalid unit index");

        Game storage game = games[gameId];
        EncryptedBoard storage board = isPlayer ? game.playerBoard : game.aiBoard;

        euint8 newPos = FHE.asEuint8(newPosition);

        if (unitIndex == 0) board.assassinPos = newPos;
        else if (unitIndex == 1) board.guard1Pos = newPos;
        else if (unitIndex == 2) board.guard2Pos = newPos;
        else if (unitIndex == 3) board.decoy1Pos = newPos;
        else if (unitIndex == 4) board.decoy2Pos = newPos;

        FHE.allowThis(newPos);

        emit UnitRelocated(gameId, isPlayer, unitIndex);
    }

    function forfeit(uint256 gameId) external onlyPlayer(gameId) gameActive(gameId) {
        games[gameId].status = GameStatus.Forfeited;
        emit GameOver(gameId, GameStatus.Forfeited);
    }

    // --- Internal helpers ---

    function _verifyAndApplyStrike(
        EncryptedBoard storage board,
        uint8 target,
        uint8 /* claimedResult */
    ) internal {
        euint8 encTarget = FHE.asEuint8(target);
        euint8 encEliminated = FHE.asEuint8(ELIMINATED);

        // Check each unit position for a hit
        ebool hitAssassin = FHE.eq(board.assassinPos, encTarget);
        ebool hitGuard1 = FHE.eq(board.guard1Pos, encTarget);
        ebool hitGuard2 = FHE.eq(board.guard2Pos, encTarget);
        ebool hitDecoy1 = FHE.eq(board.decoy1Pos, encTarget);
        ebool hitDecoy2 = FHE.eq(board.decoy2Pos, encTarget);

        // Eliminate hit units using FHE.select
        // If hit, set position to ELIMINATED (255); otherwise keep current
        board.assassinPos = FHE.select(hitAssassin, encEliminated, board.assassinPos);
        board.guard1Pos = FHE.select(hitGuard1, encEliminated, board.guard1Pos);
        board.guard2Pos = FHE.select(hitGuard2, encEliminated, board.guard2Pos);
        board.decoy1Pos = FHE.select(hitDecoy1, encEliminated, board.decoy1Pos);
        board.decoy2Pos = FHE.select(hitDecoy2, encEliminated, board.decoy2Pos);

        // Allow contract to use updated values
        FHE.allowThis(board.assassinPos);
        FHE.allowThis(board.guard1Pos);
        FHE.allowThis(board.guard2Pos);
        FHE.allowThis(board.decoy1Pos);
        FHE.allowThis(board.decoy2Pos);
    }

    function _allowBoard(EncryptedBoard storage board) internal {
        FHE.allowThis(board.assassinPos);
        FHE.allowThis(board.guard1Pos);
        FHE.allowThis(board.guard2Pos);
        FHE.allowThis(board.decoy1Pos);
        FHE.allowThis(board.decoy2Pos);
    }
}
