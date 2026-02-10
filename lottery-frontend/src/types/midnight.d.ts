import type { DAppConnectorAPI } from '@midnight-ntwrk/dapp-connector-api';

declare global {
    interface Window {
        midnight?: {
            [key: string]: DAppConnectorAPI;
        };
    }
}

export { };
