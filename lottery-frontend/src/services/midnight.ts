import { deployContract, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { Lottery } from '@midnight-ntwrk/lottery-contract';
import { CompiledContract } from '@midnight-ntwrk/compact-js';

// Configuration for standalone environment
const STANDALONE_CONFIG = {
    proofServer: 'http://localhost:6300',
    indexer: 'http://localhost:8088',
    node: 'http://localhost:9944',
    networkId: 'undeployed' as const,
    zkConfigPath: './zkconfig', // Path to ZK config (adjust as needed)
};

// Initialize the compiled contract
// Note: This requires the contract to be built first
const lotteryCompiledContract = CompiledContract.make('lottery', Lottery.Contract).pipe(
    CompiledContract.withVacantWitnesses,
    // In browser, we can't use file system, so ZK config must be provided differently
    // For now, this is a placeholder - you'll need to handle ZK config loading
);

export interface LotteryState {
    totalTickets: bigint;
    winningTicket: bigint;
    round: bigint;
}

export interface LotteryProviders {
    proofProvider: any;
    publicDataProvider: any;
    privateStateProvider: any;
    zkConfigProvider: any;
    walletProvider: any;
    midnightProvider: any; // Required by Midnight SDK
}

/**
 * Initialize Midnight SDK providers
 * This connects to your standalone environment (ports 6300, 8088, 9944)
 */
export async function initializeProviders(walletProvider: any): Promise<LotteryProviders> {
    // Import providers using correct factory functions (not classes)
    const { httpClientProofProvider } = await import('@midnight-ntwrk/midnight-js-http-client-proof-provider');
    const { indexerPublicDataProvider } = await import('@midnight-ntwrk/midnight-js-indexer-public-data-provider');
    const { NodeZkConfigProvider } = await import('@midnight-ntwrk/midnight-js-node-zk-config-provider');
    const { getNetworkId } = await import('@midnight-ntwrk/midnight-js-network-id');

    const networkId = getNetworkId(STANDALONE_CONFIG.networkId);

    const proofProvider = httpClientProofProvider(STANDALONE_CONFIG.proofServer);
    const publicDataProvider = indexerPublicDataProvider(
        STANDALONE_CONFIG.indexer,
        networkId
    );
    const zkConfigProvider = new NodeZkConfigProvider(STANDALONE_CONFIG.node);

    // Create midnight provider from wallet
    const midnightProvider = walletProvider; // Lace wallet provider acts as midnight provider

    // Private state provider - would need level-db in browser
    // For now using null (contract will work without private state for basic operations)
    const privateStateProvider = null;

    return {
        proofProvider,
        publicDataProvider,
        privateStateProvider,
        zkConfigProvider,
        walletProvider,
        midnightProvider,
    };
}

/**
 * Deploy a new lottery contract
 */
export async function deployLotteryContract(providers: LotteryProviders): Promise<any> {
    if (!lotteryCompiledContract) {
        throw new Error('Lottery contract not loaded. Please import the compiled contract.');
    }

    const contract = await deployContract(providers, {
        compiledContract: lotteryCompiledContract,
        privateStateId: 'lotteryPrivateState',
        initialPrivateState: {},
    });

    return contract;
}

/**
 * Join an existing lottery contract
 */
export async function joinLotteryContract(
    providers: LotteryProviders,
    contractAddress: string
): Promise<any> {
    if (!lotteryCompiledContract) {
        throw new Error('Lottery contract not loaded. Please import the compiled contract.');
    }

    const contract = await findDeployedContract(providers, {
        compiledContract: lotteryCompiledContract,
        contractAddress,
        privateStateId: 'lotteryPrivateState',
    });

    return contract;
}

/**
 * Buy a lottery ticket
 */
export async function buyTicket(contract: any): Promise<bigint> {
    const tx = await contract.callTx.buy_ticket();

    // Get the ticket ID from the transaction result
    // The ticket ID is the return value of buy_ticket()
    const ticketId = tx.result || 0n;

    return ticketId;
}

/**
 * Draw the winning ticket
 */
export async function drawWinner(contract: any, winningTicketNumber: bigint): Promise<void> {
    await contract.callTx.draw_winner(winningTicketNumber);
}

/**
 * Claim prize with your winning ticket
 */
export async function claimPrize(contract: any, ticketId: bigint): Promise<void> {
    await contract.callTx.claim_prize(ticketId);
}

/**
 * Get current lottery state from the blockchain
 */
export async function getLotteryState(
    providers: LotteryProviders,
    contractAddress: string
): Promise<LotteryState> {
    // Query the contract's ledger state
    const contractState = await providers.publicDataProvider.queryContractState(contractAddress);

    if (!contractState || !contractState.data) {
        return {
            totalTickets: 0n,
            winningTicket: 0n,
            round: 0n,
        };
    }

    // Parse the state data
    // The state structure matches the ledger variables in the contract
    const stateData = contractState.data as any;

    return {
        totalTickets: BigInt(stateData.total_tickets || 0),
        winningTicket: BigInt(stateData.winning_ticket || 0),
        round: BigInt(stateData.round || 0),
    };
}

/**
 * Save ticket to browser localStorage
 */
export function saveTicketToStorage(walletAddress: string, ticketId: bigint): void {
    const key = `lottery_tickets_${walletAddress}`;
    const existing = localStorage.getItem(key);
    const tickets = existing ? JSON.parse(existing) : [];
    tickets.push(ticketId.toString());
    localStorage.setItem(key, JSON.stringify(tickets));
}

/**
 * Load tickets from browser localStorage
 */
export function loadTicketsFromStorage(walletAddress: string): bigint[] {
    const key = `lottery_tickets_${walletAddress}`;
    const stored = localStorage.getItem(key);
    if (!stored) return [];
    const tickets: string[] = JSON.parse(stored);
    return tickets.map(t => BigInt(t));
}
