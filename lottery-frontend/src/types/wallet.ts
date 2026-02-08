// Lace Wallet Integration Types
declare global {
    interface Window {
        midnight?: {
            enable: () => Promise<string[]>;
            isEnabled: () => Promise<boolean>;
            getProvider: () => any;
            on: (event: string, callback: (...args: any[]) => void) => void;
            off: (event: string, callback: (...args: any[]) => void) => void;
        };
    }
}

export interface WalletState {
    isConnected: boolean;
    address: string | null;
    isLaceInstalled: boolean;
}

export { };
