// Browser-adapted wallet service for Midnight SDK
import { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import { ShieldedWallet } from '@midnight-ntwrk/wallet-sdk-shielded';
import { UnshieldedWallet, createKeystore, PublicKey, InMemoryTransactionHistoryStorage } from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';
import { DustWallet } from '@midnight-ntwrk/wallet-sdk-dust-wallet';
import { HDWallet, Roles } from '@midnight-ntwrk/wallet-sdk-hd';
import * as ledger from '@midnight-ntwrk/ledger-v7';
import { getNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { config } from '../config';
import * as Rx from 'rxjs';

const WALLET_SEED_KEY = 'midnight_wallet_seed';

// Generate or load wallet seed from localStorage
export function getOrCreateSeed(): string {
    let seed = localStorage.getItem(WALLET_SEED_KEY);
    if (!seed) {
        // Use the same test seed as the backend for development
        // This wallet has a massive test balance (250 quadrillion tNight)
        const testSeed = '0000000000000000000000000000000000000000000000000000000000000001';
        seed = testSeed;
        localStorage.setItem(WALLET_SEED_KEY, seed);
        console.log('Using backend test wallet (seed: 0x01) with massive test balance');
    }
    return seed;
}

// Import seed (for wallet recovery)
export function importSeed(seed: string): void {
    localStorage.setItem(WALLET_SEED_KEY, seed);
}

// Derive keys from seed
function deriveKeysFromSeed(seed: string) {
    const hdWallet = HDWallet.fromSeed(Buffer.from(seed, 'hex'));
    if (hdWallet.type !== 'seedOk') {
        throw new Error('Failed to initialize HDWallet from seed');
    }
    const derivationResult = hdWallet.hdWallet
        .selectAccount(0)
        .selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust])
        .deriveKeysAt(0);
    if (derivationResult.type !== 'keysDerived') {
        throw new Error('Failed to derive keys');
    }
    hdWallet.hdWallet.clear();
    return derivationResult.keys;
}

// Build wallet configuration for browser
const buildShieldedConfig = () => ({
    networkId: getNetworkId(),
    indexerClientConnection: {
        indexerHttpUrl: config.indexer,
        indexerWsUrl: undefined as any,
    },
    provingServerUrl: new URL(config.proofServer),
    relayURL: new URL(config.node.replace(/^http/, 'ws')),
});

const buildUnshieldedConfig = () => ({
    networkId: getNetworkId(),
    indexerClientConnection: {
        indexerHttpUrl: config.indexer,
        indexerWsUrl: undefined as any,
    },
    txHistoryStorage: new InMemoryTransactionHistoryStorage(),
});

const buildDustConfig = () => ({
    networkId: getNetworkId(),
    costParameters: {
        additionalFeeOverhead: 300_000_000_000_000n,
        feeBlocksMargin: 5,
    },
    indexerClientConnection: {
        indexerHttpUrl: config.indexer,
        indexerWsUrl: undefined as any,
    },
    provingServerUrl: new URL(config.proofServer),
    relayURL: new URL(config.node.replace(/^http/, 'ws')),
});

import type { DAppConnectorWalletAPI } from '@midnight-ntwrk/dapp-connector-api';

export type WalletContext =
    | {
        type: 'local';
        wallet: WalletFacade;
        shieldedSecretKeys: ledger.ZswapSecretKeys;
        dustSecretKey: ledger.DustSecretKey;
        unshieldedKeystore: any;
        seed: string;
    }
    | {
        type: 'lace';
        api: DAppConnectorWalletAPI;
    };

// Create wallet from seed
export async function createWallet(seed?: string): Promise<WalletContext> {
    const walletSeed = seed || getOrCreateSeed();

    console.log('Creating wallet from seed...');
    const keys = deriveKeysFromSeed(walletSeed);

    const shieldedSecretKeys = ledger.ZswapSecretKeys.fromSeed(keys[Roles.Zswap]);
    const dustSecretKey = ledger.DustSecretKey.fromSeed(keys[Roles.Dust]);
    const unshieldedKeystore = createKeystore(keys[Roles.NightExternal], getNetworkId());

    console.log('Building wallet components...');
    const shieldedWallet = ShieldedWallet(buildShieldedConfig()).startWithSecretKeys(shieldedSecretKeys);
    const unshieldedWallet = UnshieldedWallet(buildUnshieldedConfig()).startWithPublicKey(
        PublicKey.fromKeyStore(unshieldedKeystore),
    );
    const dustWallet = DustWallet(buildDustConfig()).startWithSecretKey(
        dustSecretKey,
        ledger.LedgerParameters.initialParameters().dust,
    );

    const wallet = new WalletFacade(shieldedWallet, unshieldedWallet, dustWallet);

    console.log('Starting wallet...');
    await wallet.start(shieldedSecretKeys, dustSecretKey);

    return {
        type: 'local',
        wallet,
        shieldedSecretKeys,
        dustSecretKey,
        unshieldedKeystore,
        seed: walletSeed,
    };
}

// Get wallet address
export function getWalletAddress(ctx: WalletContext): string {
    if (ctx.type === 'local') {
        return ctx.unshieldedKeystore.getBech32Address();
    }
    // For Lace, we'd need to async fetch from API state, but this function is sync.
    // We'll return an empty string or handle it elsewhere if needed.
    return '';
}

// Get shielded address (coin public key)
export async function getShieldedAddress(ctx: WalletContext): Promise<string> {
    if (ctx.type === 'local') {
        const state = await Rx.firstValueFrom(ctx.wallet.state());
        return state.shielded.coinPublicKey.toHexString();
    } else {
        // Adapt to different Lace API versions
        if (typeof ctx.api.state === 'function') {
            const state = await ctx.api.state();
            return state.coinPublicKey;
        } else if (typeof (ctx.api as any).getShieldedAddresses === 'function') {
            const addresses = await (ctx.api as any).getShieldedAddresses();
            return addresses.shieldedCoinPublicKey;
        } else {
            throw new Error('Unknown Lace API structure: cannot find state() or getShieldedAddresses()');
        }
    }
}

// Clear wallet (logout)
export function clearWallet(): void {
    localStorage.removeItem(WALLET_SEED_KEY);
}

// Create wallet from Lace API
export async function createLaceWalletContext(api: DAppConnectorWalletAPI): Promise<WalletContext> {
    return {
        type: 'lace',
        api,
    };
}
