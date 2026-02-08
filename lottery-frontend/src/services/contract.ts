// Re-export compiled contract and types from lottery-cli
// This allows the frontend to use the same contract definition

export { Lottery } from '@midnight-ntwrk/lottery-contract';

// Note: In a real deployment, you would:
// 1. Build the contract: cd contract && npm run build
// 2. The compiled contract is available via the @midnight-ntwrk/lottery-contract package
// 3. Import it here and use Lottery.Contract for initialization
