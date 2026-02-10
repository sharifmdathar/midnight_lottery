// Real Midnight SDK integration for browser
import { type WalletContext } from './walletService';
import { Lottery } from '@midnight-ntwrk/lottery-contract';
import * as ledger from '@midnight-ntwrk/ledger-v7';
import { deployContract, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';

import { type MidnightProvider, type WalletProvider } from '@midnight-ntwrk/midnight-js-types';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { config } from '../config';
import { BrowserZkConfigProvider } from './BrowserZkConfigProvider';
import * as Rx from 'rxjs';

export interface LotteryState {
    round: bigint;
    totalTickets: bigint;
    winningTicket: bigint;
}

export interface LotteryProviders {
    privateStateProvider: any;
    publicDataProvider: any;
    zkConfigProvider: any; // Required by SDK but unused - proof server handles ZK
    proofProvider: any;
    walletProvider: WalletProvider & MidnightProvider;
    midnightProvider: WalletProvider & MidnightProvider;
}

// Ticket storage in localStorage
const TICKETS_KEY = 'lottery_tickets';

function saveTicket(ticketId: bigint): void {
    const tickets = loadTickets();
    tickets.push(ticketId.toString());
    localStorage.setItem(TICKETS_KEY, JSON.stringify(tickets));
}

export function loadTickets(): string[] {
    const stored = localStorage.getItem(TICKETS_KEY);
    return stored ? JSON.parse(stored) : [];
}

export function loadTicketsFromStorage(): bigint[] {
    return loadTickets().map(t => BigInt(t));
}

export function saveTicketToStorage(ticketId: bigint): void {
    saveTicket(ticketId);
}

// Pre-compile the contract
// ZK circuit files are copied to public/managed and served as static assets
const lotteryCompiledContract = CompiledContract.make('lottery', Lottery.Contract).pipe(
    CompiledContract.withVacantWitnesses,
    CompiledContract.withCompiledFileAssets(config.zkConfigPath),
);

// Sign transaction intents
const signTransactionIntents = (
    tx: { intents?: Map<number, any> },
    signFn: (payload: Uint8Array) => ledger.Signature,
    proofMarker: 'proof' | 'pre-proof',
): void => {
    if (!tx.intents || tx.intents.size === 0) return;
    for (const segment of tx.intents.keys()) {
        const intent = tx.intents.get(segment);
        if (!intent) continue;
        const cloned = ledger.Intent.deserialize<ledger.SignatureEnabled, ledger.Proofish, ledger.PreBinding>(
            'signature',
            proofMarker,
            'pre-binding',
            intent.serialize(),
        );
        const sigData = cloned.signatureData(segment);
        const signature = signFn(sigData);
        if (cloned.fallibleUnshieldedOffer) {
            const sigs = cloned.fallibleUnshieldedOffer.inputs.map(
                (_: ledger.UtxoSpend, i: number) => cloned.fallibleUnshieldedOffer!.signatures.at(i) ?? signature,
            );
            cloned.fallibleUnshieldedOffer = cloned.fallibleUnshieldedOffer.addSignatures(sigs);
        }
        if (cloned.guaranteedUnshieldedOffer) {
            const sigs = cloned.guaranteedUnshieldedOffer.inputs.map(
                (_: ledger.UtxoSpend, i: number) => cloned.guaranteedUnshieldedOffer!.signatures.at(i) ?? signature,
            );
            cloned.guaranteedUnshieldedOffer = cloned.guaranteedUnshieldedOffer.addSignatures(sigs);
        }
        tx.intents.set(segment, cloned);
    }
};

// Create wallet and midnight provider
async function createWalletAndMidnightProvider(
    ctx: WalletContext,
): Promise<WalletProvider & MidnightProvider> {
    if (ctx.type === 'lace') {
        console.log('Using Lace wallet provider...');
        const state = await ctx.api.state();

        return {
            getCoinPublicKey() {
                return state.coinPublicKey;
            },
            getEncryptionPublicKey() {
                return state.encryptionPublicKey;
            },
            async balanceTx(tx, _ttl?) {
                // For Lace, we pass the transaction to the connector
                // The connector handles balancing, proving, and signing
                return await ctx.api.balanceAndProveTransaction(tx as any, []) as any;
            },
            async submitTx(tx) {
                const [txId] = await ctx.api.submitTransaction(tx as any);
                return txId;
            },
        };
    }

    console.log('Waiting for local wallet to sync...');
    // ... existing local wallet logic
    const syncTimeout = 30000; // 30 seconds
    const state = await Promise.race([
        Rx.firstValueFrom(ctx.wallet.state().pipe(Rx.filter((s) => s.isSynced))),
        new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Wallet sync timeout after 30 seconds')), syncTimeout)
        )
    ]);

    console.log('Wallet synced successfully!');

    return {
        getCoinPublicKey() {
            return state.shielded.coinPublicKey.toHexString();
        },
        getEncryptionPublicKey() {
            return state.shielded.encryptionPublicKey.toHexString();
        },
        async balanceTx(tx, ttl?) {
            const recipe = await ctx.wallet.balanceUnboundTransaction(
                tx,
                { shieldedSecretKeys: ctx.shieldedSecretKeys, dustSecretKey: ctx.dustSecretKey },
                { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) },
            );
            const signFn = (payload: Uint8Array) => ctx.unshieldedKeystore.signData(payload);
            signTransactionIntents(recipe.baseTransaction, signFn, 'proof');
            if (recipe.balancingTransaction) {
                signTransactionIntents(recipe.balancingTransaction, signFn, 'pre-proof');
            }
            return ctx.wallet.finalizeRecipe(recipe);
        },
        submitTx(tx) {
            return ctx.wallet.submitTransaction(tx) as any;
        },
    };
}

/**
 * Initialize Midnight SDK providers
 */
export async function initializeProviders(walletContext: WalletContext): Promise<LotteryProviders> {
    console.log('Initializing providers...');
    const walletAndMidnightProvider = await createWalletAndMidnightProvider(walletContext);
    const zkConfigProvider = new BrowserZkConfigProvider(config.zkConfigPath);

    return {
        privateStateProvider: levelPrivateStateProvider({
            privateStateStoreName: config.privateStateStoreName,
            walletProvider: walletAndMidnightProvider,
        }),
        publicDataProvider: indexerPublicDataProvider(config.indexer, config.indexerWS),
        zkConfigProvider,
        proofProvider: httpClientProofProvider(config.proofServer, zkConfigProvider),
        walletProvider: walletAndMidnightProvider,
        midnightProvider: walletAndMidnightProvider,
    };
}

// Wait for wallet to sync
export async function waitForSync(walletContext: WalletContext): Promise<void> {
    if (walletContext.type === 'lace') {
        console.log('Lace wallet is already synced!');
        return;
    }
    console.log('Waiting for local wallet to sync...');
    await Rx.firstValueFrom(
        walletContext.wallet.state().pipe(
            Rx.filter((state) => state.isSynced),
        ),
    );
    console.log('Wallet synced!');
}

/**
 * Deploy a new lottery contract
 */
export async function deployLotteryContract(providers: LotteryProviders): Promise<any> {
    console.log('Deploying lottery contract...');
    const lotteryContract = await deployContract(providers, {
        compiledContract: lotteryCompiledContract as any,
        privateStateId: 'lotteryPrivateState',
        initialPrivateState: {},
        args: [],
    });
    console.log(`Deployed contract at address: ${lotteryContract.deployTxData.public.contractAddress}`);
    return lotteryContract;
}

/**
 * Join an existing lottery contract
 */
export async function joinLotteryContract(
    providers: LotteryProviders,
    contractAddress: string
): Promise<any> {
    console.log(`Joining contract at ${contractAddress}...`);
    const lotteryContract = await findDeployedContract(providers, {
        contractAddress,
        compiledContract: lotteryCompiledContract as any,
        privateStateId: 'lotteryPrivateState',
    });
    console.log(`Joined contract successfully`);
    return lotteryContract;
}

/**
 * Get current lottery state from the blockchain
 */
export async function getLotteryState(
    providers: LotteryProviders,
    contractAddress: string
): Promise<LotteryState> {
    const state = await providers.publicDataProvider
        .queryContractState(contractAddress)
        .then((contractState: any) => (contractState != null ? Lottery.ledger(contractState.data) : null));

    if (!state) {
        return {
            round: 0n,
            totalTickets: 0n,
            winningTicket: 0n,
        };
    }

    return {
        round: state.round,
        totalTickets: state.total_tickets,
        winningTicket: state.winning_ticket,
    };
}

/**
 * Buy a lottery ticket
 */
export async function buyTicket(providers: LotteryProviders, contract: any): Promise<bigint> {
    console.log('Buying ticket...');
    const finalizedTxData = await contract.callTx.buy_ticket();
    console.log(`Ticket bought: Transaction ${finalizedTxData.public.txId}`);

    // Fetch updated state to get the ticket ID
    const state = await getLotteryState(providers, contract.deployTxData.public.contractAddress);
    const ticketId = state.totalTickets;
    saveTicket(ticketId);
    console.log(`Saved ticket ID: ${ticketId}`);

    return ticketId;
}

/**
 * Draw the winning ticket
 */
export async function drawWinner(contract: any, winningTicketNumber: bigint): Promise<void> {
    console.log(`Drawing winner with ticket ${winningTicketNumber}...`);
    const finalizedTxData = await (contract as any).callTx.draw_winner(winningTicketNumber);
    console.log(`Winner drawn! Transaction ${finalizedTxData.public.txId}`);
}

/**
 * Claim prize with your winning ticket
 */
export async function claimPrize(providers: LotteryProviders, contract: any): Promise<void> {
    console.log('Claiming prize...');
    const state = await getLotteryState(providers, contract.deployTxData.public.contractAddress);

    const myTickets = loadTickets().map(t => BigInt(t));
    const winningTicket = state.winningTicket;
    const winningTicketId = myTickets.find(t => t === winningTicket);

    if (winningTicketId === undefined) {
        throw new Error(`You do not have the winning ticket (Winning: ${winningTicket}, Yours: ${myTickets.join(', ')})`);
    }

    const finalizedTxData = await (contract as any).callTx.claim_prize(winningTicketId);
    console.log(`Prize claimed! Transaction ${finalizedTxData.public.txId}`);
}
