import { useCallback, useRef, useState } from 'react';
import { BrowserProvider, Contract, formatEther } from 'ethers';
import { cofhejs } from 'cofhejs/web';
import {
  BoardState,
  createSoloGame as createSoloGameService,
  executeTurn as executeTurnService,
  relocateUnit as relocateUnitService,
  forfeit as forfeitService,
} from '../services/contract';
import { getContractAddress } from '../constants/contracts';
import PhoenixThroneABI from '../abi/PhoenixThrone.json';

declare global {
  interface Window {
    ethereum?: any;
  }
}

export function useContract() {
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [contract, setContract] = useState<Contract | null>(null);
  const fheAvailable = useRef(false);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      throw new Error('No EVM wallet found. Please install MetaMask.');
    }

    const browserProvider = new BrowserProvider(window.ethereum);
    const signer = await browserProvider.getSigner();
    const addr = await signer.getAddress();

    // Initialize cofhejs with ethers provider/signer
    fheAvailable.current = false;
    try {
      const initResult = await cofhejs.initializeWithEthers({
        ethersProvider: browserProvider,
        ethersSigner: signer,
        environment: 'TESTNET',
      });
      if (initResult && (initResult as any).success === false) {
        console.warn('cofhejs init failed — FHE unavailable on this chain. Using local-only mode.');
      } else {
        fheAvailable.current = true;
        console.log('cofhejs initialized successfully');
      }
    } catch (e) {
      console.warn('cofhejs init failed — using local-only mode:', e);
    }

    // Instantiate contract
    const network = await browserProvider.getNetwork();
    const chainId = network.chainId.toString();
    const contractAddress = getContractAddress(chainId);
    if (contractAddress && contractAddress !== '0x0000000000000000000000000000000000000000') {
      const contractInstance = new Contract(contractAddress, PhoenixThroneABI.abi, signer);
      setContract(contractInstance);
    }

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
    setContract(null);
    fheAvailable.current = false;
  }, []);

  const refreshBalance = useCallback(async () => {
    if (provider && address) {
      const bal = await provider.getBalance(address);
      setBalance(parseFloat(formatEther(bal)));
    }
  }, [provider, address]);

  const localFallback = () => {
    const gameId = Math.floor(Math.random() * 1_000_000_000).toString();
    return { gameId, txHash: `local-${gameId}` };
  };

  const createSoloGame = useCallback(async (playerBoard: BoardState, aiBoard: BoardState) => {
    if (!address) throw new Error('Wallet not connected');

    if (!contract || !fheAvailable.current) {
      return localFallback();
    }

    try {
      return await createSoloGameService(contract, playerBoard, aiBoard);
    } catch (err) {
      console.warn('On-chain createGame failed, falling back to local mode:', err);
      return localFallback();
    }
  }, [address, contract]);

  const executeTurn = useCallback(async (
    gameId: string,
    playerTargets: number[],
    playerResults: number[],
    aiTargets: number[],
    aiResults: number[],
  ) => {
    if (!address) throw new Error('Wallet not connected');

    if (!contract || !fheAvailable.current) {
      return { txHash: '' };
    }

    try {
      return await executeTurnService(contract, gameId, playerTargets, playerResults, aiTargets, aiResults);
    } catch (err) {
      console.warn('On-chain executeTurn failed:', err);
      return { txHash: '' };
    }
  }, [address, contract]);

  const relocate = useCallback(async (
    gameId: string,
    isPlayer: boolean,
    unitIndex: number,
    newPosition: number,
  ) => {
    if (!address) throw new Error('Wallet not connected');

    if (!contract || !fheAvailable.current) {
      return { txHash: '' };
    }

    try {
      return await relocateUnitService(contract, gameId, isPlayer, unitIndex, newPosition);
    } catch (err) {
      console.warn('On-chain relocate failed:', err);
      return { txHash: '' };
    }
  }, [address, contract]);

  const forfeit = useCallback(async (gameId: string) => {
    if (!address) throw new Error('Wallet not connected');

    if (!contract || !fheAvailable.current) {
      return { txHash: '' };
    }

    try {
      return await forfeitService(contract, gameId);
    } catch (err) {
      console.warn('On-chain forfeit failed:', err);
      return { txHash: '' };
    }
  }, [address, contract]);

  return {
    connected: !!address,
    address,
    balance,
    connect,
    disconnect,
    refreshBalance,
    createSoloGame,
    executeTurn,
    relocate,
    forfeit,
  };
}
