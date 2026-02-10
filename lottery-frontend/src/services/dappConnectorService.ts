import type { DAppConnectorAPI } from '@midnight-ntwrk/dapp-connector-api';

/**
 * DApp Connector Service for Lace Wallet Integration
 */

// Check if Lace wallet is installed
export function isLaceInstalled(): boolean {
    return typeof window !== 'undefined' && 'midnight' in window && window.midnight !== undefined;
}

// Get the Lace wallet connector
export function getLaceConnector(): DAppConnectorAPI | null {
    if (!isLaceInstalled()) {
        return null;
    }

    // Try standard 'lace' key first
    if (window.midnight?.lace) {
        return window.midnight.lace;
    }

    // Fallback: Check for other common keys or return the first available one if appropriate
    // For now, we'll stick to specific keys to avoid connecting to wrong wallets
    const midnightObj = window.midnight as any;
    if (midnightObj?.mnLace) {
        return midnightObj.mnLace;
    }

    return null;
}

// Request wallet connection (check if installed)
export async function connectLaceWallet(): Promise<DAppConnectorAPI> {
    // Poll for the wallet for up to 5 seconds
    const maxRetries = 10;
    const interval = 500;

    for (let i = 0; i < maxRetries; i++) {
        // Debug logging
        if (typeof window !== 'undefined' && window.midnight) {
            console.log('Detected window.midnight keys:', Object.keys(window.midnight));
        } else {
            console.log('window.midnight is undefined');
        }

        const connector = getLaceConnector();
        if (connector) {
            return connector;
        }
        await new Promise(resolve => setTimeout(resolve, interval));
    }

    throw new Error('Lace wallet is not installed or not detected. Please ensure the Lace extension is active.');
}

// Enable wallet (triggers Lace popup)
export async function enableLaceWallet(connector: DAppConnectorAPI) {
    try {
        const api = await connector.enable();
        console.log('Lace wallet enabled successfully');
        return api;
    } catch (error) {
        console.error('Failed to enable Lace wallet:', error);
        throw new Error('Failed to enable Lace wallet. Please approve the connection in Lace.');
    }
}

// Disconnect wallet
export async function disconnectLaceWallet(): Promise<void> {
    const connector = getLaceConnector();

    if (connector && typeof (connector as any).disconnect === 'function') {
        try {
            await (connector as any).disconnect();
        } catch (error) {
            console.error('Failed to disconnect wallet:', error);
        }
    }
}

// Get wallet state
export async function getWalletState(connector: DAppConnectorAPI) {
    try {
        // The connector itself might be the state, or have a different method
        // Let's try to access it directly
        return connector;
    } catch (error) {
        console.error('Failed to get wallet state:', error);
        throw error;
    }
}

// Subscribe to wallet state changes
export function subscribeToWalletState(
    connector: DAppConnectorAPI,
    callback: (state: any) => void
) {
    // For now, just call the callback once with the connector
    // We'll refine this once we understand the API better
    callback(connector);

    // Return a no-op unsubscribe function
    return () => { };
}
