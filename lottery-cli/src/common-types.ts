import { Lottery } from '@midnight-ntwrk/lottery-contract';
import type { MidnightProviders } from '@midnight-ntwrk/midnight-js-types';
import type { DeployedContract, FoundContract } from '@midnight-ntwrk/midnight-js-contracts';
import type { ImpureCircuitId } from '@midnight-ntwrk/compact-js';

export type LotteryPrivateState = any;

export type LotteryCircuits = ImpureCircuitId<Lottery.Contract<LotteryPrivateState>>;

export const LotteryPrivateStateId = 'lotteryPrivateState';

export type LotteryProviders = MidnightProviders<LotteryCircuits, typeof LotteryPrivateStateId, LotteryPrivateState>;

export type LotteryContract = Lottery.Contract<LotteryPrivateState>;

export type DeployedLotteryContract = DeployedContract<LotteryContract> | FoundContract<LotteryContract>;
