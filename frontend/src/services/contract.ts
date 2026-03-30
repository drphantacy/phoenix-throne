import { cofhejs, Encryptable } from 'cofhejs/web';

export interface BoardState {
  assassinPos: number;
  guard1Pos: number;
  guard2Pos: number;
  decoy1Pos: number;
  decoy2Pos: number;
}

export function generateGameId(): string {
  return Math.floor(Math.random() * 1_000_000_000).toString();
}

export async function encryptBoard(board: BoardState) {
  const encrypted = await cofhejs.encrypt(
    () => {},
    [
      Encryptable.uint8(BigInt(board.assassinPos)),
      Encryptable.uint8(BigInt(board.guard1Pos)),
      Encryptable.uint8(BigInt(board.guard2Pos)),
      Encryptable.uint8(BigInt(board.decoy1Pos)),
      Encryptable.uint8(BigInt(board.decoy2Pos)),
    ],
  );
  return encrypted;
}

export async function createSoloGame(board: BoardState) {
  const gameId = generateGameId();
  const encryptedBoard = await encryptBoard(board);
  // TODO: Call Fhenix smart contract to create solo game
  return { gameId, encryptedBoard };
}

export async function strike(target: number) {
  const encryptedTarget = await cofhejs.encrypt(
    () => {},
    [Encryptable.uint8(BigInt(target))],
  );
  // TODO: Call Fhenix smart contract to perform strike
  return { encryptedTarget };
}

export async function scan(position: number) {
  const encryptedPosition = await cofhejs.encrypt(
    () => {},
    [Encryptable.uint8(BigInt(position))],
  );
  // TODO: Call Fhenix smart contract to perform scan
  return { encryptedPosition };
}

export async function relocate(unitIndex: number, newPosition: number) {
  const encrypted = await cofhejs.encrypt(
    () => {},
    [
      Encryptable.uint8(BigInt(unitIndex)),
      Encryptable.uint8(BigInt(newPosition)),
    ],
  );
  // TODO: Call Fhenix smart contract to relocate
  return { encrypted };
}

export async function forfeit() {
  // TODO: Call Fhenix smart contract to forfeit
}
