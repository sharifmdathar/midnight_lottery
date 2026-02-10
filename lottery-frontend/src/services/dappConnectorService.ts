import type { DAppConnectorAPI } from '@midnight-ntwrk/dapp-connector-api';

/**
 * DApp Connector Service for Lace Wallet Integration
 */

// Check if Lace wallet is installed
export function isLaceInstalled(): boolean {
    return typeof window !== 'undefined' && 'midnight' in window && window.midnight !== undefined;
}

// Get the Lace wallet connector
export function getLaceConnector(): any | null {
    if (!isLaceInstalled()) {
        return null;
    }

    const win = window as any;

    // Prioritize mnLace as per reference implementation
    if (win.midnight?.mnLace) {
        return win.midnight.mnLace;
    }

    if (win.midnight?.lace) {
        return win.midnight.lace;
    }

    return null;
}

// Request wallet connection (check if installed)
export async function connectLaceWallet(): Promise<any> {
    // Poll for the wallet for up to 5 seconds
    const maxRetries = 10;
    const interval = 500;

    for (let i = 0; i < maxRetries; i++) {
        // Debug logging
        if (typeof window !== 'undefined' && window.midnight) {
            console.log('Detected window.midnight keys:', Object.keys(window.midnight));
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
export async function enableLaceWallet(connector: any) {
    try {
        console.log('Enabling Lace wallet...');

        // Try connect logic seen in working reference (yo/Lottery-Midnight)
        if (typeof connector.connect === 'function') {
            console.log('Using mnLace.connect("undeployed") flow');
            // 'undeployed' is used in the reference project, likely for local/sandbox environment
            const api = await connector.connect('undeployed');
            console.log('Lace wallet connected via mnLace.connect');
            return api;
        }

        // Fallback to standard CIP-30 style enable
        if (typeof connector.enable === 'function') {
            console.log('Using connector.enable() flow');
            const api = await connector.enable();
            console.log('Lace wallet enabled via connector.enable');
            return api;
        }

        throw new Error('Connector does not support connect() or enable()');
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
    return connector;
}

// Subscribe to wallet state changes
export function subscribeToWalletState(
    connector: DAppConnectorAPI,
    callback: (state: any) => void
) {
    callback(connector);
    return () => { };
}
