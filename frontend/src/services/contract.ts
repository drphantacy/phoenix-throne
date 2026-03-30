import { cofhejs, Encryptable } from 'cofhejs/web';
import { Contract } from 'ethers';

export interface BoardState {
  assassinPos: number;
  guard1Pos: number;
  guard2Pos: number;
  decoy1Pos: number;
  decoy2Pos: number;
}

function unwrapResult<T>(result: any): T {
  if (result?.success === false || result?.error) {
    console.error('cofhejs result:', JSON.stringify(result, null, 2));
    throw new Error(result?.error?.message || result?.error || JSON.stringify(result));
  }
  if (result?.data) return result.data;
  return result;
}

export async function encryptBoard(board: BoardState) {
  const result = await cofhejs.encrypt([
    Encryptable.uint8(BigInt(board.assassinPos)),
    Encryptable.uint8(BigInt(board.guard1Pos)),
    Encryptable.uint8(BigInt(board.guard2Pos)),
    Encryptable.uint8(BigInt(board.decoy1Pos)),
    Encryptable.uint8(BigInt(board.decoy2Pos)),
  ] as const);
  return unwrapResult(result);
}

export async function createSoloGame(
  contract: Contract,
  playerBoard: BoardState,
  aiBoard: BoardState,
): Promise<{ gameId: string; txHash: string }> {
  // Encrypt both boards (10 values total)
  const result = await cofhejs.encrypt([
    Encryptable.uint8(BigInt(playerBoard.assassinPos)),
    Encryptable.uint8(BigInt(playerBoard.guard1Pos)),
    Encryptable.uint8(BigInt(playerBoard.guard2Pos)),
    Encryptable.uint8(BigInt(playerBoard.decoy1Pos)),
    Encryptable.uint8(BigInt(playerBoard.decoy2Pos)),
    Encryptable.uint8(BigInt(aiBoard.assassinPos)),
    Encryptable.uint8(BigInt(aiBoard.guard1Pos)),
    Encryptable.uint8(BigInt(aiBoard.guard2Pos)),
    Encryptable.uint8(BigInt(aiBoard.decoy1Pos)),
    Encryptable.uint8(BigInt(aiBoard.decoy2Pos)),
  ] as const);

  const encrypted = unwrapResult(result);

  const tx = await contract.createGame(
    encrypted[0], encrypted[1], encrypted[2], encrypted[3], encrypted[4],
    encrypted[5], encrypted[6], encrypted[7], encrypted[8], encrypted[9],
  );

  const receipt = await tx.wait();

  // Parse GameCreated event for gameId
  const gameCreatedEvent = receipt.logs.find(
    (log: any) => {
      try {
        const parsed = contract.interface.parseLog({ topics: log.topics, data: log.data });
        return parsed?.name === 'GameCreated';
      } catch {
        return false;
      }
    },
  );

  let gameId = '0';
  if (gameCreatedEvent) {
    const parsed = contract.interface.parseLog({
      topics: gameCreatedEvent.topics,
      data: gameCreatedEvent.data,
    });
    gameId = parsed!.args.gameId.toString();
  }

  return { gameId, txHash: receipt.hash };
}

export async function executeTurn(
  contract: Contract,
  gameId: string,
  playerTargets: number[],
  playerResults: number[],
  aiTargets: number[],
  aiResults: number[],
): Promise<{ txHash: string }> {
  const tx = await contract.executeTurn(
    BigInt(gameId),
    playerTargets,
    playerResults,
    aiTargets,
    aiResults,
  );

  const receipt = await tx.wait();
  return { txHash: receipt.hash };
}

export async function relocateUnit(
  contract: Contract,
  gameId: string,
  isPlayer: boolean,
  unitIndex: number,
  newPosition: number,
): Promise<{ txHash: string }> {
  const result = await cofhejs.encrypt([
    Encryptable.uint8(BigInt(newPosition)),
  ] as const);

  const [encryptedPos] = unwrapResult(result);

  const tx = await contract.relocate(
    BigInt(gameId),
    isPlayer,
    unitIndex,
    encryptedPos,
  );

  const receipt = await tx.wait();
  return { txHash: receipt.hash };
}

export async function forfeit(
  contract: Contract,
  gameId: string,
): Promise<{ txHash: string }> {
  const tx = await contract.forfeit(BigInt(gameId));
  const receipt = await tx.wait();
  return { txHash: receipt.hash };
}
