// This file is part of midnightntwrk/example-counter.
// Copyright (C) 2025 Midnight Foundation
// SPDX-License-Identifier: Apache-2.0
// Licensed under the Apache License, Version 2.0 (the "License");
// You may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { type WalletContext } from './api';
import { stdin as input, stdout as output } from 'node:process';
import { createInterface, type Interface } from 'node:readline/promises';
import { type Logger } from 'pino';

import { type LotteryProviders, type DeployedLotteryContract } from './common-types';
import { type Config, StandaloneConfig } from './config';
import * as api from './api';

let logger: Logger;

/**
 * This seed gives access to tokens minted in the genesis block of a local development node.
 * Only used in standalone networks to build a wallet with initial funds.
 */
const GENESIS_MINT_WALLET_SEED = '0000000000000000000000000000000000000000000000000000000000000001';

const BANNER = `
  Midnight Lottery Example
  A privacy-preserving smart contract demo
`;

const DIVIDER = '--------------------------------------------------------------';

const WALLET_MENU = `
${DIVIDER}
  Wallet Setup
${DIVIDER}
  [1] Create a new wallet
  [2] Restore wallet from seed
  [3] Exit
${DIVIDER}
> `;

/** Build the contract actions menu, showing current DUST balance in the header. */
const contractMenu = (dustBalance: string) => `
${DIVIDER}
  Contract Actions${dustBalance ? `                    DUST: ${dustBalance}` : ''}
${DIVIDER}
  [1] Deploy a new lottery contract
  [2] Join an existing lottery contract
  [3] Monitor DUST balance
  [4] Exit
${DIVIDER}
> `;

/** Build the lottery actions menu, showing current DUST balance in the header. */
const lotteryMenu = (dustBalance: string) => `
${DIVIDER}
  Lottery Actions${dustBalance ? `                     DUST: ${dustBalance}` : ''}
${DIVIDER}
  [1] Buy Ticket
  [2] Draw Winner
  [3] Claim Prize
  [4] Get Lottery State
  [5] Exit
${DIVIDER}
> `;

/** Prompt the user for a seed phrase and restore a wallet from it. */
const buildWalletFromSeed = async (config: Config, rli: Interface): Promise<WalletContext> => {
  const seed = await rli.question('Enter your wallet seed: ');
  return await api.buildWalletAndWaitForFunds(config, seed);
};

/**
 * Wallet creation flow.
 * - Standalone configs skip the menu and use the genesis seed automatically.
 * - All other configs present a menu to create or restore a wallet.
 */
const buildWallet = async (config: Config, rli: Interface): Promise<WalletContext | null> => {
  if (config instanceof StandaloneConfig) {
    return await api.buildWalletAndWaitForFunds(config, GENESIS_MINT_WALLET_SEED);
  }
  while (true) {
    const choice = await rli.question(WALLET_MENU);
    switch (choice.trim()) {
      case '1':
        return await api.buildFreshWallet(config);
      case '2':
        return await buildWalletFromSeed(config, rli);
      case '3':
        return null;
      default:
        console.log(`Invalid choice: ${choice}`);
    }
  }
};

/** Format dust balance for menu headers. */
const getDustLabel = async (wallet: api.WalletContext['wallet']): Promise<string> => {
  try {
    const dust = await api.getDustBalance(wallet);
    return dust.available.toLocaleString();
  } catch {
    return '';
  }
};

/** Prompt for a contract address and join an existing deployed contract. */
const joinContract = async (providers: LotteryProviders, rli: Interface): Promise<DeployedLotteryContract> => {
  const contractAddress = await rli.question('Enter the contract address (hex): ');
  return await api.joinContract(providers, contractAddress);
};

/**
 * Start the DUST monitor. Shows a live-updating balance display
 * that runs until the user presses Enter.
 */
const startDustMonitor = async (wallet: api.WalletContext['wallet'], rli: Interface): Promise<void> => {
  console.log('');
  const stopPromise = rli.question('  Press Enter to return to menu...\n').then(() => { });
  await api.monitorDustBalance(wallet, stopPromise);
  console.log('');
};

/**
 * Deploy or join flow. Returns the contract handle, or null if the user exits.
 */
const deployOrJoin = async (
  providers: LotteryProviders,
  walletCtx: api.WalletContext,
  rli: Interface,
): Promise<DeployedLotteryContract | null> => {
  while (true) {
    const dustLabel = await getDustLabel(walletCtx.wallet);
    const choice = await rli.question(contractMenu(dustLabel));
    switch (choice.trim()) {
      case '1':
        try {
          const contract = await api.withStatus('Deploying lottery contract', () =>
            api.deploy(providers),
          );
          console.log(`  Contract deployed at: ${contract.deployTxData.public.contractAddress}\n`);
          return contract;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.log(`\n  Deploy failed: ${msg}`);
          if (msg.toLowerCase().includes('dust')) {
            console.log('    Insufficient DUST for transaction fees.');
          }
          console.log('');
        }
        break;
      case '2':
        try {
          return await joinContract(providers, rli);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.log(`  Failed to join contract: ${msg}\n`);
        }
        break;
      case '3':
        await startDustMonitor(walletCtx.wallet, rli);
        break;
      case '4':
        return null;
      default:
        console.log(`  Invalid choice: ${choice}`);
    }
  }
};

/**
 * Main interaction loop. Once a contract is deployed/joined, the user
 * can interact with the lottery.
 */
const mainLoop = async (providers: LotteryProviders, walletCtx: api.WalletContext, rli: Interface): Promise<void> => {
  const lotteryContract = await deployOrJoin(providers, walletCtx, rli);
  if (lotteryContract === null) {
    return;
  }

  while (true) {
    const dustLabel = await getDustLabel(walletCtx.wallet);
    const choice = await rli.question(lotteryMenu(dustLabel));
    switch (choice.trim()) {
      case '1': // Buy Ticket
        try {
          await api.withStatus('Buying ticket', () => api.buyTicket(providers, lotteryContract));
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.log(`  Buy failed: ${msg}\n`);
        }
        break;
      case '2': // Draw Winner
        try {
          const seedInput = await rli.question('Enter random seed (integer): ');
          const seed = BigInt(seedInput);
          await api.withStatus('Drawing winner', () => api.drawWinner(lotteryContract, seed));
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.log(`  Draw failed: ${msg}\n`);
        }
        break;
      case '3': // Claim Prize
        try {
          await api.withStatus('Claiming prize', () => api.claimPrize(providers, lotteryContract));
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.log(`  Claim failed: ${msg}\n`);
        }
        break;
      case '4': // Get State
        try {
          const address = lotteryContract.deployTxData.public.contractAddress;
          await api.getLotteryLedgerState(providers, address);
        } catch (e) {
          console.log(`  Get state failed: ${e}\n`);
        }
        break;
      case '5':
        return;
      default:
        console.log(`  Invalid choice: ${choice}`);
    }
  }
};

export const run = async (config: Config, _logger: Logger, cleanup?: () => Promise<void>): Promise<void> => {
  logger = _logger;
  api.setLogger(_logger);
  console.log(BANNER);
  const rli = createInterface({ input, output, terminal: true });
  try {
    const walletCtx = await buildWallet(config, rli);
    if (walletCtx === null) {
      return;
    }
    try {
      const providers = await api.withStatus('Configuring providers', () => api.configureProviders(walletCtx, config));
      console.log('');
      await mainLoop(providers, walletCtx, rli);
    } catch (e) {
      if (e instanceof Error) {
        logger.error(`Error: ${e.message}`);
        logger.debug(`${e.stack}`);
      } else {
        throw e;
      }
    } finally {
      try {
        await walletCtx.wallet.stop();
      } catch (e) {
        logger.error(`Error stopping wallet: ${e}`);
      }
    }
  } finally {
    rli.close();
    rli.removeAllListeners();
    if (cleanup) {
      try {
        await cleanup();
      } catch (e) {
        logger.error(`Error running cleanup: ${e}`);
      }
    }
    logger.info('Goodbye.');
  }
};
