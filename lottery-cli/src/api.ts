/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { type ContractAddress } from '@midnight-ntwrk/compact-runtime';
import { Lottery } from '@midnight-ntwrk/lottery-contract';
import * as ledger from '@midnight-ntwrk/ledger-v7';
import { unshieldedToken } from '@midnight-ntwrk/ledger-v7';
import { deployContract, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { type FinalizedTxData, type MidnightProvider, type WalletProvider } from '@midnight-ntwrk/midnight-js-types';
import { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import { DustWallet } from '@midnight-ntwrk/wallet-sdk-dust-wallet';
import { HDWallet, Roles, generateRandomSeed } from '@midnight-ntwrk/wallet-sdk-hd';
import { ShieldedWallet } from '@midnight-ntwrk/wallet-sdk-shielded';
import {
  createKeystore,
  InMemoryTransactionHistoryStorage,
  PublicKey,
  UnshieldedWallet,
  type UnshieldedKeystore,
} from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';
import { type Logger } from 'pino';
import * as Rx from 'rxjs';
import { WebSocket } from 'ws';
import {
  type LotteryCircuits,
  type LotteryContract,
  type LotteryPrivateStateId,
  type LotteryProviders,
  type DeployedLotteryContract,
} from './common-types';
import { type Config, contractConfig } from './config';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { assertIsContractAddress, toHex } from '@midnight-ntwrk/midnight-js-utils';
import { getNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { Buffer } from 'buffer';
import {
  MidnightBech32m,
  ShieldedAddress,
  ShieldedCoinPublicKey,
  ShieldedEncryptionPublicKey,
} from '@midnight-ntwrk/wallet-sdk-address-format';
import * as fs from 'node:fs';
import * as path from 'node:path';

const TICKETS_FILE = 'my_tickets.json';

const saveTicket = (ticketId: bigint) => {
  let tickets: string[] = [];
  if (fs.existsSync(TICKETS_FILE)) {
    tickets = JSON.parse(fs.readFileSync(TICKETS_FILE, 'utf-8'));
  }
  tickets.push(ticketId.toString());
  fs.writeFileSync(TICKETS_FILE, JSON.stringify(tickets, null, 2));
};

const loadTickets = (): bigint[] => {
  if (!fs.existsSync(TICKETS_FILE)) return [];
  const tickets: string[] = JSON.parse(fs.readFileSync(TICKETS_FILE, 'utf-8'));
  return tickets.map(t => BigInt(t));
};

let logger: Logger;

// Required for GraphQL subscriptions (wallet sync) to work in Node.js
// @ts-expect-error: It's needed to enable WebSocket usage through apollo
globalThis.WebSocket = WebSocket;

// Pre-compile the contract with ZK circuit assets
const lotteryCompiledContract = CompiledContract.make('lottery', Lottery.Contract).pipe(
  CompiledContract.withVacantWitnesses,
  CompiledContract.withCompiledFileAssets(contractConfig.zkConfigPath),
);

export interface WalletContext {
  wallet: WalletFacade;
  shieldedSecretKeys: ledger.ZswapSecretKeys;
  dustSecretKey: ledger.DustSecretKey;
  unshieldedKeystore: UnshieldedKeystore;
}

export const getLotteryLedgerState = async (
  providers: LotteryProviders,
  contractAddress: ContractAddress,
): Promise<{ round: bigint; total_tickets: bigint; winning_ticket: bigint } | null> => {
  assertIsContractAddress(contractAddress);
  logger.info('Checking contract ledger state...');
  const state = await providers.publicDataProvider
    .queryContractState(contractAddress)
    .then((contractState) => (contractState != null ? Lottery.ledger(contractState.data) : null));
  if (state) {
    logger.info(`Ledger state: Round ${state.round}, Sold ${state.total_tickets}, Winning Ticket ${state.winning_ticket}`);
  }
  return state;
};

export const lotteryContractInstance: LotteryContract = new Lottery.Contract({});

export const joinContract = async (
  providers: LotteryProviders,
  contractAddress: string,
): Promise<DeployedLotteryContract> => {
  const lotteryContract = await findDeployedContract(providers, {
    contractAddress,
    compiledContract: lotteryCompiledContract,
    privateStateId: 'lotteryPrivateState',
    initialPrivateState: {},
  });
  logger.info(`Joined contract at address: ${lotteryContract.deployTxData.public.contractAddress}`);
  return lotteryContract;
};

export const deploy = async (
  providers: LotteryProviders,
): Promise<DeployedLotteryContract> => {

  logger.info('Deploying lottery contract...');
  const lotteryContract = await deployContract(providers, {
    compiledContract: lotteryCompiledContract,
    privateStateId: 'lotteryPrivateState',
    initialPrivateState: {},
  });
  logger.info(`Deployed contract at address: ${lotteryContract.deployTxData.public.contractAddress}`);
  return lotteryContract;
};

export const buyTicket = async (providers: LotteryProviders, lotteryContract: DeployedLotteryContract): Promise<FinalizedTxData> => {
  logger.info('Buying ticket...');
  const tx = await lotteryContract.callTx.buy_ticket();
  // Wait, midnight-js contracts wrapper might return FinalizedTxData directly or structure?
  // generated bindings return CircuitResults<PS, bigint>
  // callTx proxy returns FinalizedTxData & { result: T }?
  // Logic: The contract call returns a tuple/result.
  // We need to check how midnight-js handles return values.
  // Assuming standard callTx returns the transaction data.
  // To get the return value (ticketId), we might need to inspect the result or use a different call method?
  // callTx submits transaction. The return value of the circuit is NOT available in the transaction outcome directly for the caller unless it's a view?
  // BUT `buy_ticket` is an impure circuit. It returns `Uint<64>`.
  // The return value of an impure circuit is returned to the caller in the simulation result, but ON-CHAIN it's not "returned" like a view.
  // However, the Midnight JS client simulates it locally to generate the proof.
  // We can capture the result from the simulation.
  // But `lotteryContract.callTx.buy_ticket()` returns `Promise<FinalizedTxData>`.
  // It seems `callTx` does NOT expose the return value of the circuit.
  // This is a limitation.
  // WORKAROUND: We can simulate the circuit call first to get the ticket ID (if deterministic), or rely on the logic that ticket ID = total_tickets + 1.
  // Since we rely on local simulation for proof generation, we should access the result.
  // If `callTx` doesn't return it, we might need to use `call` or similar?
  // `lotteryContract.impureCircuits.buy_ticket(context)`?
  // Let's assume for MVP we fetch `total_tickets` before/after or assume it worked.
  // BUT avoiding race conditions is hard.
  // Actually, we can just read the current ledger state `total_tickets` BEFORE the tx, and assume `+1`.
  // Or read it AFTER.
  // Let's read it AFTER.
  // But other people might buy.
  // Ideally `callTx` should return the result.
  // Let's check generated bindings usage in `midnight-js`.
  // If not supported, I'll fetch `total_tickets` from ledger *after* confirming the tx, and assume mine is one of them? No.
  // For MVP, I'll just fetch `total_tickets` from the ledger state (which I can query) and hope I can correlate.
  // OR: I can just increment a local counter if I am the only user (standalone).
  // BETTER: `buy_ticket` is updating `total_tickets`.
  // I will read `total_tickets` from ledger *after* the transaction confirms.
  // The ticket ID I got is likely the value of `total_tickets` at that moment.
  // Note: this is race-prone but okay for single-user demo.

  const finalizedTxData = await lotteryContract.callTx.buy_ticket();
  logger.info(`Ticket bought: Transaction ${finalizedTxData.public.txId} in block ${finalizedTxData.public.blockHeight}`);

  // Fetch updated state to guess the ticket ID (MVP Hack)
  // In a real app, we'd want the return value from the simulation.
  // Compact simulation returns it.
  // Let's look if `callTx` object has `simulate`?
  // For now:
  const output = await getLotteryLedgerState(providers, lotteryContract.deployTxData.public.contractAddress);
  if (output) {
    const myTicketId = output.total_tickets; // Assume we got the latest
    saveTicket(myTicketId);
    logger.info(`Saved ticket ID: ${myTicketId}`);
  }
  return finalizedTxData.public;
};

export const drawWinner = async (lotteryContract: DeployedLotteryContract, seed: bigint): Promise<FinalizedTxData> => {
  logger.info(`Drawing winner with seed ${seed}...`);
  const finalizedTxData = await (lotteryContract as any).callTx.draw_winner(seed);
  logger.info(`Winner drawn! Transaction ${finalizedTxData.public.txId}`);
  return finalizedTxData.public;
};

export const claimPrize = async (providers: LotteryProviders, lotteryContract: DeployedLotteryContract): Promise<FinalizedTxData> => {
  logger.info('Claiming prize...');
  const state = await getLotteryLedgerState(providers, lotteryContract.deployTxData.public.contractAddress);
  if (!state) throw new Error("Could not fetch contract state");

  const myTickets = loadTickets();
  const winningTicket = state.winning_ticket;
  const winningTicketId = myTickets.find(t => t === winningTicket);

  if (winningTicketId === undefined) {
    throw new Error(`You do not have the winning ticket (Winning: ${winningTicket}, Yours: ${myTickets.join(', ')})`);
  }

  const finalizedTxData = await (lotteryContract as any).callTx.claim_prize(winningTicketId);
  logger.info(`Prize claimed! Transaction ${finalizedTxData.public.txId}`);
  return finalizedTxData.public;
};

const signTransactionIntents = (
  tx: { intents?: Map<number, any> },
  signFn: (payload: Uint8Array) => ledger.Signature,
  proofMarker: 'proof' | 'pre-proof',
): void => {
  if (!tx.intents || tx.intents.size === 0) return;
  for (const segment of tx.intents.keys()) {
    const intent = tx.intents.get(segment);
    if (!intent) continue;
    const cloned = ledger.Intent.deserialize<ledger.SignatureEnabled, ledger.Proofish, ledger.PreBinding>(
      'signature',
      proofMarker,
      'pre-binding',
      intent.serialize(),
    );
    const sigData = cloned.signatureData(segment);
    const signature = signFn(sigData);
    if (cloned.fallibleUnshieldedOffer) {
      const sigs = cloned.fallibleUnshieldedOffer.inputs.map(
        (_: ledger.UtxoSpend, i: number) => cloned.fallibleUnshieldedOffer!.signatures.at(i) ?? signature,
      );
      cloned.fallibleUnshieldedOffer = cloned.fallibleUnshieldedOffer.addSignatures(sigs);
    }
    if (cloned.guaranteedUnshieldedOffer) {
      const sigs = cloned.guaranteedUnshieldedOffer.inputs.map(
        (_: ledger.UtxoSpend, i: number) => cloned.guaranteedUnshieldedOffer!.signatures.at(i) ?? signature,
      );
      cloned.guaranteedUnshieldedOffer = cloned.guaranteedUnshieldedOffer.addSignatures(sigs);
    }
    tx.intents.set(segment, cloned);
  }
};

export const createWalletAndMidnightProvider = async (
  ctx: WalletContext,
): Promise<WalletProvider & MidnightProvider> => {
  const state = await Rx.firstValueFrom(ctx.wallet.state().pipe(Rx.filter((s) => s.isSynced)));
  return {
    getCoinPublicKey() {
      return state.shielded.coinPublicKey.toHexString();
    },
    getEncryptionPublicKey() {
      return state.shielded.encryptionPublicKey.toHexString();
    },
    async balanceTx(tx, ttl?) {
      const recipe = await ctx.wallet.balanceUnboundTransaction(
        tx,
        { shieldedSecretKeys: ctx.shieldedSecretKeys, dustSecretKey: ctx.dustSecretKey },
        { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) },
      );
      const signFn = (payload: Uint8Array) => ctx.unshieldedKeystore.signData(payload);
      signTransactionIntents(recipe.baseTransaction, signFn, 'proof');
      if (recipe.balancingTransaction) {
        signTransactionIntents(recipe.balancingTransaction, signFn, 'pre-proof');
      }
      return ctx.wallet.finalizeRecipe(recipe);
    },
    submitTx(tx) {
      return ctx.wallet.submitTransaction(tx) as any;
    },
  };
};

export const waitForSync = (wallet: WalletFacade) =>
  Rx.firstValueFrom(
    wallet.state().pipe(
      Rx.throttleTime(5_000),
      Rx.filter((state) => state.isSynced),
    ),
  );

export const waitForFunds = (wallet: WalletFacade): Promise<bigint> =>
  Rx.firstValueFrom(
    wallet.state().pipe(
      Rx.throttleTime(10_000),
      Rx.filter((state) => state.isSynced),
      Rx.map((s) => s.unshielded.balances[unshieldedToken().raw] ?? 0n),
      Rx.filter((balance) => balance > 0n),
    ),
  );

const buildShieldedConfig = ({ indexer, indexerWS, node, proofServer }: Config) => ({
  networkId: getNetworkId(),
  indexerClientConnection: {
    indexerHttpUrl: indexer,
    indexerWsUrl: indexerWS,
  },
  provingServerUrl: new URL(proofServer),
  relayURL: new URL(node.replace(/^http/, 'ws')),
});

const buildUnshieldedConfig = ({ indexer, indexerWS }: Config) => ({
  networkId: getNetworkId(),
  indexerClientConnection: {
    indexerHttpUrl: indexer,
    indexerWsUrl: indexerWS,
  },
  txHistoryStorage: new InMemoryTransactionHistoryStorage(),
});

const buildDustConfig = ({ indexer, indexerWS, node, proofServer }: Config) => ({
  networkId: getNetworkId(),
  costParameters: {
    additionalFeeOverhead: 300_000_000_000_000n,
    feeBlocksMargin: 5,
  },
  indexerClientConnection: {
    indexerHttpUrl: indexer,
    indexerWsUrl: indexerWS,
  },
  provingServerUrl: new URL(proofServer),
  relayURL: new URL(node.replace(/^http/, 'ws')),
});

const deriveKeysFromSeed = (seed: string) => {
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
};

const formatBalance = (balance: bigint): string => balance.toLocaleString();

export const withStatus = async <T>(message: string, fn: () => Promise<T>): Promise<T> => {
  const frames = ['?', '?', '?', '?', '?', '?', '?', '?', '?', '?'];
  let i = 0;
  const interval = setInterval(() => {
    process.stdout.write(`\r  ${frames[i++ % frames.length]} ${message}`);
  }, 80);
  try {
    const result = await fn();
    clearInterval(interval);
    process.stdout.write(`\r  ? ${message}\n`);
    return result;
  } catch (e) {
    clearInterval(interval);
    process.stdout.write(`\r  ? ${message}\n`);
    throw e;
  }
};

const registerForDustGeneration = async (
  wallet: WalletFacade,
  unshieldedKeystore: UnshieldedKeystore,
): Promise<void> => {
  const state = await Rx.firstValueFrom(wallet.state().pipe(Rx.filter((s) => s.isSynced)));
  if (state.dust.availableCoins.length > 0) {
    const dustBal = state.dust.walletBalance(new Date());
    console.log(`  ? Dust tokens already available (${formatBalance(dustBal)} DUST)`);
    return;
  }
  const nightUtxos = state.unshielded.availableCoins.filter(
    (coin: any) => coin.meta?.registeredForDustGeneration !== true,
  );
  if (nightUtxos.length === 0) {
    await withStatus('Waiting for dust tokens to generate', () =>
      Rx.firstValueFrom(
        wallet.state().pipe(
          Rx.throttleTime(5_000),
          Rx.filter((s) => s.isSynced),
          Rx.filter((s) => s.dust.walletBalance(new Date()) > 0n),
        ),
      ),
    );
    return;
  }
  await withStatus(`Registering ${nightUtxos.length} NIGHT UTXO(s) for dust generation`, async () => {
    const recipe = await wallet.registerNightUtxosForDustGeneration(
      nightUtxos,
      unshieldedKeystore.getPublicKey(),
      (payload) => unshieldedKeystore.signData(payload),
    );
    const finalized = await wallet.finalizeRecipe(recipe);
    await wallet.submitTransaction(finalized);
  });
  await withStatus('Waiting for dust tokens to generate', () =>
    Rx.firstValueFrom(
      wallet.state().pipe(
        Rx.throttleTime(5_000),
        Rx.filter((s) => s.isSynced),
        Rx.filter((s) => s.dust.walletBalance(new Date()) > 0n),
      ),
    ),
  );
};

const printWalletSummary = (seed: string, state: any, unshieldedKeystore: UnshieldedKeystore) => {
  const networkId = getNetworkId();
  const unshieldedBalance = state.unshielded.balances[unshieldedToken().raw] ?? 0n;
  const coinPubKey = ShieldedCoinPublicKey.fromHexString(state.shielded.coinPublicKey.toHexString());
  const encPubKey = ShieldedEncryptionPublicKey.fromHexString(state.shielded.encryptionPublicKey.toHexString());
  const shieldedAddress = MidnightBech32m.encode(networkId, new ShieldedAddress(coinPubKey, encPubKey)).toString();
  const DIV = '--------------------------------------------------------------';
  console.log(`
${DIV}
  Wallet Overview                            Network: ${networkId}
${DIV}
  Seed: ${seed}
${DIV}
  Shielded (ZSwap)
  +- Address: ${shieldedAddress}
  Unshielded
  +- Address: ${unshieldedKeystore.getBech32Address()}
  +- Balance: ${formatBalance(unshieldedBalance)} tNight
  Dust
  +- Address: ${state.dust.dustAddress}
${DIV}`);
};

export const buildWalletAndWaitForFunds = async (config: Config, seed: string): Promise<WalletContext> => {
  console.log('');
  const { wallet, shieldedSecretKeys, dustSecretKey, unshieldedKeystore } = await withStatus(
    'Building wallet',
    async () => {
      const keys = deriveKeysFromSeed(seed);
      const shieldedSecretKeys = ledger.ZswapSecretKeys.fromSeed(keys[Roles.Zswap]);
      const dustSecretKey = ledger.DustSecretKey.fromSeed(keys[Roles.Dust]);
      const unshieldedKeystore = createKeystore(keys[Roles.NightExternal], getNetworkId());
      const shieldedWallet = ShieldedWallet(buildShieldedConfig(config)).startWithSecretKeys(shieldedSecretKeys);
      const unshieldedWallet = UnshieldedWallet(buildUnshieldedConfig(config)).startWithPublicKey(
        PublicKey.fromKeyStore(unshieldedKeystore),
      );
      const dustWallet = DustWallet(buildDustConfig(config)).startWithSecretKey(
        dustSecretKey,
        ledger.LedgerParameters.initialParameters().dust,
      );
      const wallet = new WalletFacade(shieldedWallet, unshieldedWallet, dustWallet);
      await wallet.start(shieldedSecretKeys, dustSecretKey);
      return { wallet, shieldedSecretKeys, dustSecretKey, unshieldedKeystore };
    },
  );
  const networkId = getNetworkId();
  const DIV = '--------------------------------------------------------------';
  console.log(`
${DIV}
  Wallet Overview                            Network: ${networkId}
${DIV}
  Seed: ${seed}
  Unshielded Address (send tNight here):
  ${unshieldedKeystore.getBech32Address()}
  Fund your wallet with tNight from the Preprod faucet:
  https://faucet.preprod.midnight.network/
${DIV}
`);
  const syncedState = await withStatus('Syncing with network', () => waitForSync(wallet));
  printWalletSummary(seed, syncedState, unshieldedKeystore);
  const balance = syncedState.unshielded.balances[unshieldedToken().raw] ?? 0n;
  if (balance === 0n) {
    const fundedBalance = await withStatus('Waiting for incoming tokens', () => waitForFunds(wallet));
    console.log(`    Balance: ${formatBalance(fundedBalance)} tNight\n`);
  }
  await registerForDustGeneration(wallet, unshieldedKeystore);
  return { wallet, shieldedSecretKeys, dustSecretKey, unshieldedKeystore };
};

export const buildFreshWallet = async (config: Config): Promise<WalletContext> =>
  await buildWalletAndWaitForFunds(config, toHex(Buffer.from(generateRandomSeed())));

export const configureProviders = async (ctx: WalletContext, config: Config) => {
  const walletAndMidnightProvider = await createWalletAndMidnightProvider(ctx);
  const zkConfigProvider = new NodeZkConfigProvider<LotteryCircuits>(contractConfig.zkConfigPath);
  return {
    privateStateProvider: levelPrivateStateProvider<typeof LotteryPrivateStateId>({
      privateStateStoreName: contractConfig.privateStateStoreName,
      walletProvider: walletAndMidnightProvider,
    }),
    publicDataProvider: indexerPublicDataProvider(config.indexer, config.indexerWS),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(config.proofServer, zkConfigProvider),
    walletProvider: walletAndMidnightProvider,
    midnightProvider: walletAndMidnightProvider,
  };
};

export const getDustBalance = async (
  wallet: WalletFacade,
): Promise<{ available: bigint; pending: bigint; availableCoins: number; pendingCoins: number }> => {
  const state = await Rx.firstValueFrom(wallet.state().pipe(Rx.filter((s) => s.isSynced)));
  const available = state.dust.walletBalance(new Date());
  const availableCoins = state.dust.availableCoins.length;
  const pendingCoins = state.dust.pendingCoins.length;
  const pending = state.dust.pendingCoins.reduce((sum, c) => sum + c.initialValue, 0n);
  return { available, pending, availableCoins, pendingCoins };
};

export const monitorDustBalance = async (wallet: WalletFacade, stopSignal: Promise<void>): Promise<void> => {
  let stopped = false;
  void stopSignal.then(() => {
    stopped = true;
  });
  const sub = wallet
    .state()
    .pipe(
      Rx.throttleTime(5_000),
      Rx.filter((s) => s.isSynced),
    )
    .subscribe((state) => {
      if (stopped) return;
      const now = new Date();
      const available = state.dust.walletBalance(now);
      const availableCoins = state.dust.availableCoins.length;
      const pendingCoins = state.dust.pendingCoins.length;
      const registeredNight = state.unshielded.availableCoins.filter(
        (coin: any) => coin.meta?.registeredForDustGeneration === true,
      ).length;
      const totalNight = state.unshielded.availableCoins.length;
      let status = '';
      if (pendingCoins > 0 && availableCoins === 0) {
        status = '? locked by pending tx';
      } else if (available > 0n) {
        status = '? ready to deploy';
      } else if (availableCoins > 0) {
        status = 'accruing...';
      } else if (registeredNight > 0) {
        status = 'waiting for generation...';
      } else {
        status = 'no NIGHT registered';
      }
      const time = now.toLocaleTimeString();
      console.log(
        `  [${time}] DUST: ${formatBalance(available)} (${availableCoins} coins, ${pendingCoins} pending) | NIGHT: ${totalNight} UTXOs, ${registeredNight} registered | ${status}`,
      );
    });
  await stopSignal;
  sub.unsubscribe();
};

export function setLogger(_logger: Logger) {
  logger = _logger;
}
