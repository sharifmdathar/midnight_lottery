import {
    ZKConfigProvider,
    type ZKConfig,
    type ZKIR,
    type ProverKey,
    type VerifierKey,
    createZKIR,
    createProverKey,
    createVerifierKey,
} from '@midnight-ntwrk/midnight-js-types';

export class BrowserZkConfigProvider<K extends string> implements ZKConfigProvider<K> {
    private baseUrl: string;

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    }

    private async fetchBinary(path: string): Promise<Uint8Array> {
        const response = await fetch(`${this.baseUrl}/${path}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch ${path}: ${response.statusText}`);
        }
        const buffer = await response.arrayBuffer();
        return new Uint8Array(buffer);
    }

    async getZKIR(circuitId: K): Promise<ZKIR> {
        const data = await this.fetchBinary(`zkir/${circuitId}.zkir`);
        return createZKIR(data);
    }

    async getProverKey(circuitId: K): Promise<ProverKey> {
        const data = await this.fetchBinary(`keys/${circuitId}.prover`);
        return createProverKey(data);
    }

    async getVerifierKey(circuitId: K): Promise<VerifierKey> {
        const data = await this.fetchBinary(`keys/${circuitId}.verifier`);
        return createVerifierKey(data);
    }

    async getVerifierKeys(circuitIds: K[]): Promise<[K, VerifierKey][]> {
        const promises = circuitIds.map(async (id) => {
            const key = await this.getVerifierKey(id);
            return [id, key] as [K, VerifierKey];
        });
        return Promise.all(promises);
    }

    async get(circuitId: K): Promise<ZKConfig<K>> {
        const [zkir, proverKey, verifierKey] = await Promise.all([
            this.getZKIR(circuitId),
            this.getProverKey(circuitId),
            this.getVerifierKey(circuitId),
        ]);

        return {
            circuitId,
            zkir,
            proverKey,
            verifierKey,
        };
    }

    asKeyMaterialProvider() {
        return {
            getZKIR: (location: string) => this.fetchBinary(location),
            getProverKey: (location: string) => this.fetchBinary(location),
            getVerifierKey: (location: string) => this.fetchBinary(location),
        };
    }
}
