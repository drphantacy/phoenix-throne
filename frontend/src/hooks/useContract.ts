import { useCallback, useState } from 'react';
import { BrowserProvider, formatEther } from 'ethers';
import { cofhejs, type AbstractProvider, type AbstractSigner } from 'cofhejs/web';
import {
  BoardState,
  generateGameId,
  encryptBoard,
} from '../services/contract';

declare global {
  interface Window {
    ethereum?: any;
  }
}

/** Wrap ethers BrowserProvider to match cofhejs AbstractProvider */
function wrapProvider(provider: BrowserProvider): AbstractProvider {
  return {
    getChainId: async () => {
      const network = await provider.getNetwork();
      return network.chainId.toString();
    },
    call: async (tx: { to: string; data: string }) => provider.call(tx),
    send: async (method: string, params: any[]) => provider.send(method, params),
  };
}

/** Wrap ethers signer to match cofhejs AbstractSigner */
function wrapSigner(signer: any, abstractProvider: AbstractProvider): AbstractSigner {
  return {
    getAddress: () => signer.getAddress(),
    signTypedData: (domain: object, types: Record<string, Array<object>>, value: object) =>
      signer.signTypedData(domain, types, value),
    provider: abstractProvider,
    sendTransaction: async (tx: { to: string; data: string }) => {
      const resp = await signer.sendTransaction(tx);
      return resp.hash;
    },
  };
}

export function useContract() {
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [provider, setProvider] = useState<BrowserProvider | null>(null);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      throw new Error('No EVM wallet found. Please install MetaMask.');
    }

    const browserProvider = new BrowserProvider(window.ethereum);
    const signer = await browserProvider.getSigner();
    const addr = await signer.getAddress();

    const abstractProvider = wrapProvider(browserProvider);
    const abstractSigner = wrapSigner(signer, abstractProvider);

    // Initialize cofhejs with the wrapped provider and signer
    await cofhejs.initialize({ provider: abstractProvider, signer: abstractSigner });

    setProvider(browserProvider);
    setAddress(addr);

    // Fetch balance
    const bal = await browserProvider.getBalance(addr);
    setBalance(parseFloat(formatEther(bal)));
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    setBalance(null);
    setProvider(null);
  }, []);

  const refreshBalance = useCallback(async () => {
    if (provider && address) {
      const bal = await provider.getBalance(address);
      setBalance(parseFloat(formatEther(bal)));
    }
  }, [provider, address]);

  const createSoloGame = useCallback(async (board: BoardState) => {
    if (!address) throw new Error('Wallet not connected');

    const gameId = generateGameId();
    void encryptBoard(board); // TODO: Send to Fhenix contract

    const txHash = `0x${gameId}`; // placeholder
    return { gameId, txHash, board };
  }, [address]);

  const createGame = useCallback(async (board: BoardState, _opponent: string) => {
    if (!address) throw new Error('Wallet not connected');

    const gameId = generateGameId();
    void encryptBoard(board); // TODO: Send to Fhenix contract

    const txHash = `0x${gameId}`; // placeholder
    return { gameId, txHash, board };
  }, [address]);

  const strike = useCallback(async (_target: number) => {
    if (!address) throw new Error('Wallet not connected');
    // TODO: Call Fhenix contract
    const txHash = '0x0'; // placeholder
    return { txHash };
  }, [address]);

  const scan = useCallback(async (_position: number) => {
    if (!address) throw new Error('Wallet not connected');
    // TODO: Call Fhenix contract
    const txHash = '0x0'; // placeholder
    return { txHash };
  }, [address]);

  const relocate = useCallback(async (_gameId: string, _board: BoardState, _unitIndex: number, _newPosition: number) => {
    if (!address) throw new Error('Wallet not connected');
    // TODO: Call Fhenix contract
    const txHash = '0x0'; // placeholder
    return { txHash };
  }, [address]);

  const forfeit = useCallback(async () => {
    if (!address) throw new Error('Wallet not connected');
    // TODO: Call Fhenix contract
    const txHash = '0x0'; // placeholder
    return { txHash };
  }, [address]);

  return {
    connected: !!address,
    address,
    balance,
    connect,
    disconnect,
    refreshBalance,
    createSoloGame,
    createGame,
    strike,
    scan,
    relocate,
    forfeit,
  };
}
