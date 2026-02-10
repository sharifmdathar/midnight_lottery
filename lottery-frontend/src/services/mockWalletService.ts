// Mock wallet service for demo purposes
// Simulates wallet creation and sync with delays

const MOCK_WALLET_KEY = 'demo_wallet_address';
const MOCK_SEED_KEY = 'demo_wallet_seed';

export interface MockWalletContext {
    address: string;
    seed: string;
    balance: bigint;
}

// Generate a fake wallet address
function generateMockAddress(): string {
    const chars = 'abcdef0123456789';
    let address = 'mn1';
    for (let i = 0; i < 60; i++) {
        address += chars[Math.floor(Math.random() * chars.length)];
    }
    return address;
}

// Generate a fake seed
function generateMockSeed(): string {
    const chars = 'abcdef0123456789';
    let seed = '';
    for (let i = 0; i < 64; i++) {
        seed += chars[Math.floor(Math.random() * chars.length)];
    }
    return seed;
}

// Get or create mock wallet
export function getOrCreateMockWallet(): MockWalletContext {
    let address = localStorage.getItem(MOCK_WALLET_KEY);
    let seed = localStorage.getItem(MOCK_SEED_KEY);

    if (!address || !seed) {
        address = generateMockAddress();
        seed = generateMockSeed();
        localStorage.setItem(MOCK_WALLET_KEY, address);
        localStorage.setItem(MOCK_SEED_KEY, seed);
    }

    return {
        address,
        seed,
        balance: 1000000000000000n, // 1000 tDUST
    };
}

// Simulate wallet creation with delay
export async function createMockWallet(): Promise<MockWalletContext> {
    console.log('[DEMO] Creating mock wallet...');

    // Simulate wallet creation (instant)
    await new Promise(resolve => setTimeout(resolve, 500));

    const wallet = getOrCreateMockWallet();
    console.log('[DEMO] Mock wallet created:', wallet.address);

    return wallet;
}

// Simulate wallet sync with 5-second delay
export async function syncMockWallet(): Promise<void> {
    console.log('[DEMO] Syncing wallet with network...');

    // Simulate 5-second sync
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('[DEMO] Wallet synced successfully!');
}

// Get mock wallet address
export function getMockWalletAddress(wallet: MockWalletContext): string {
    return wallet.address;
}

// Clear mock wallet (logout)
export function clearMockWallet(): void {
    localStorage.removeItem(MOCK_WALLET_KEY);
    localStorage.removeItem(MOCK_SEED_KEY);
    console.log('[DEMO] Mock wallet cleared');
}

// Get mock balance
export function getMockBalance(wallet: MockWalletContext): bigint {
    return wallet.balance;
}
