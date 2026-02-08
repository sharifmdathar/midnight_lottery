import { useState, useEffect } from 'react';
import * as midnightService from '../services/midnight';

export interface UseLotteryContractResult {
    contract: any | null;
    contractAddress: string | null;
    lotteryState: midnightService.LotteryState | null;
    isLoading: boolean;
    error: string | null;
    deployContract: () => Promise<void>;
    joinContract: (address: string) => Promise<void>;
    buyTicket: () => Promise<void>;
    drawWinner: (ticketNumber: bigint) => Promise<void>;
    claimPrize: (ticketId: bigint) => Promise<void>;
    refreshState: () => Promise<void>;
}

export function useLotteryContract(walletAddress: string | null): UseLotteryContractResult {
    const [contract, setContract] = useState<any | null>(null);
    const [contractAddress, setContractAddress] = useState<string | null>(null);
    const [lotteryState, setLotteryState] = useState<midnightService.LotteryState | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [providers, setProviders] = useState<midnightService.LotteryProviders | null>(null);

    // Initialize providers when wallet connects
    useEffect(() => {
        if (walletAddress && window.midnight) {
            const initProviders = async () => {
                try {
                    const walletProvider = window.midnight!.getProvider();
                    const p = await midnightService.initializeProviders(walletProvider);
                    setProviders(p);
                } catch (err) {
                    console.error('Failed to initialize providers:', err);
                    setError('Failed to connect to Midnight Network');
                }
            };
            initProviders();
        }
    }, [walletAddress]);

    // Refresh lottery state periodically
    useEffect(() => {
        if (contractAddress && providers) {
            const interval = setInterval(() => {
                refreshState();
            }, 10000); // Refresh every 10 seconds
            return () => clearInterval(interval);
        }
    }, [contractAddress, providers]);

    const deployContract = async () => {
        if (!providers) {
            setError('Wallet not connected');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const newContract = await midnightService.deployLotteryContract(providers);
            setContract(newContract);
            setContractAddress(newContract.deployTxData.public.contractAddress);
            await refreshState();
        } catch (err) {
            console.error('Deploy failed:', err);
            setError(err instanceof Error ? err.message : 'Failed to deploy contract');
        } finally {
            setIsLoading(false);
        }
    };

    const joinContract = async (address: string) => {
        if (!providers) {
            setError('Wallet not connected');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const joinedContract = await midnightService.joinLotteryContract(providers, address);
            setContract(joinedContract);
            setContractAddress(address);
            await refreshState();
        } catch (err) {
            console.error('Join failed:', err);
            setError(err instanceof Error ? err.message : 'Failed to join contract');
        } finally {
            setIsLoading(false);
        }
    };

    const buyTicket = async () => {
        if (!contract || !walletAddress) {
            setError('Contract not loaded or wallet not connected');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const ticketId = await midnightService.buyTicket(contract);
            midnightService.saveTicketToStorage(walletAddress, ticketId);
            await refreshState();
        } catch (err) {
            console.error('Buy ticket failed:', err);
            setError(err instanceof Error ? err.message : 'Failed to buy ticket');
        } finally {
            setIsLoading(false);
        }
    };

    const drawWinner = async (ticketNumber: bigint) => {
        if (!contract) {
            setError('Contract not loaded');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            await midnightService.drawWinner(contract, ticketNumber);
            await refreshState();
        } catch (err) {
            console.error('Draw winner failed:', err);
            setError(err instanceof Error ? err.message : 'Failed to draw winner');
        } finally {
            setIsLoading(false);
        }
    };

    const claimPrize = async (ticketId: bigint) => {
        if (!contract) {
            setError('Contract not loaded');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            await midnightService.claimPrize(contract, ticketId);
            await refreshState();
        } catch (err) {
            console.error('Claim prize failed:', err);
            setError(err instanceof Error ? err.message : 'Failed to claim prize');
        } finally {
            setIsLoading(false);
        }
    };

    const refreshState = async () => {
        if (!contractAddress || !providers) return;

        try {
            const state = await midnightService.getLotteryState(providers, contractAddress);
            setLotteryState(state);
        } catch (err) {
            console.error('Failed to refresh state:', err);
        }
    };

    return {
        contract,
        contractAddress,
        lotteryState,
        isLoading,
        error,
        deployContract,
        joinContract,
        buyTicket,
        drawWinner,
        claimPrize,
        refreshState,
    };
}
