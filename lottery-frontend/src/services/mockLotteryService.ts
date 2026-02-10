// Mock lottery service for demo purposes
// Simulates all lottery contract operations

import type { MockWalletContext } from './mockWalletService';

const MOCK_CONTRACT_KEY = 'demo_lottery_contract';
const MOCK_TICKETS_KEY = 'demo_lottery_tickets';
const MOCK_STATE_KEY = 'demo_lottery_state';

export interface MockTicket {
    ticketNumber: number;
    owner: string;
    timestamp: number;
}

export interface MockLotteryState {
    contractAddress: string;
    ticketPrice: bigint;
    totalTickets: number;
    winningTicket: number | null;
    isActive: boolean;
    prizePool: bigint;
}

// Generate fake contract address
function generateMockContractAddress(): string {
    const chars = 'abcdef0123456789';
    let address = '0x';
    for (let i = 0; i < 40; i++) {
        address += chars[Math.floor(Math.random() * chars.length)];
    }
    return address;
}

// Deploy mock lottery contract
export async function deployMockLottery(): Promise<string> {
    console.log('[DEMO] Deploying lottery contract...');

    // Simulate deployment delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    const contractAddress = generateMockContractAddress();

    const initialState: MockLotteryState = {
        contractAddress,
        ticketPrice: 100000000000000n, // 100 tDUST
        totalTickets: 0,
        winningTicket: null,
        isActive: true,
        prizePool: 0n,
    };

    localStorage.setItem(MOCK_CONTRACT_KEY, contractAddress);
    localStorage.setItem(MOCK_STATE_KEY, JSON.stringify(initialState, (_, v) =>
        typeof v === 'bigint' ? v.toString() : v
    ));
    localStorage.setItem(MOCK_TICKETS_KEY, JSON.stringify([]));

    console.log('[DEMO] Contract deployed:', contractAddress);
    return contractAddress;
}

// Join existing mock lottery
export async function joinMockLottery(contractAddress: string): Promise<void> {
    console.log('[DEMO] Joining lottery contract:', contractAddress);

    await new Promise(resolve => setTimeout(resolve, 1000));

    localStorage.setItem(MOCK_CONTRACT_KEY, contractAddress);
    console.log('[DEMO] Joined lottery successfully');
}

// Buy a ticket
export async function buyMockTicket(wallet: MockWalletContext): Promise<number> {
    console.log('[DEMO] Buying lottery ticket...');

    await new Promise(resolve => setTimeout(resolve, 1500));

    const stateStr = localStorage.getItem(MOCK_STATE_KEY);
    if (!stateStr) throw new Error('No lottery contract deployed');

    const state: MockLotteryState = JSON.parse(stateStr, (_, v) => {
        if (typeof v === 'string' && /^\d+$/.test(v)) {
            try { return BigInt(v); } catch { return v; }
        }
        return v;
    });

    const ticketsStr = localStorage.getItem(MOCK_TICKETS_KEY) || '[]';
    const tickets: MockTicket[] = JSON.parse(ticketsStr);

    const ticketNumber = state.totalTickets + 1;

    const newTicket: MockTicket = {
        ticketNumber,
        owner: wallet.address,
        timestamp: Date.now(),
    };

    tickets.push(newTicket);
    state.totalTickets = ticketNumber;
    state.prizePool += state.ticketPrice;

    localStorage.setItem(MOCK_TICKETS_KEY, JSON.stringify(tickets));
    localStorage.setItem(MOCK_STATE_KEY, JSON.stringify(state, (_, v) =>
        typeof v === 'bigint' ? v.toString() : v
    ));

    console.log('[DEMO] Ticket purchased:', ticketNumber);
    return ticketNumber;
}

// Draw winning ticket
export async function drawMockWinner(): Promise<number> {
    console.log('[DEMO] Drawing winning ticket...');

    await new Promise(resolve => setTimeout(resolve, 2000));

    const stateStr = localStorage.getItem(MOCK_STATE_KEY);
    if (!stateStr) throw new Error('No lottery contract deployed');

    const state: MockLotteryState = JSON.parse(stateStr, (_, v) => {
        if (typeof v === 'string' && /^\d+$/.test(v)) {
            try { return BigInt(v); } catch { return v; }
        }
        return v;
    });

    if (state.totalTickets === 0) {
        throw new Error('No tickets sold yet');
    }

    // Random winning ticket
    const winningTicket = Math.floor(Math.random() * state.totalTickets) + 1;
    state.winningTicket = winningTicket;
    state.isActive = false;

    localStorage.setItem(MOCK_STATE_KEY, JSON.stringify(state, (_, v) =>
        typeof v === 'bigint' ? v.toString() : v
    ));

    console.log('[DEMO] Winning ticket drawn:', winningTicket);
    return winningTicket;
}

// Claim prize
export async function claimMockPrize(wallet: MockWalletContext, ticketNumber: number): Promise<void> {
    console.log('[DEMO] Claiming prize for ticket:', ticketNumber);

    await new Promise(resolve => setTimeout(resolve, 1500));

    const stateStr = localStorage.getItem(MOCK_STATE_KEY);
    if (!stateStr) throw new Error('No lottery contract deployed');

    const state: MockLotteryState = JSON.parse(stateStr, (_, v) => {
        if (typeof v === 'string' && /^\d+$/.test(v)) {
            try { return BigInt(v); } catch { return v; }
        }
        return v;
    });

    if (state.winningTicket !== ticketNumber) {
        throw new Error('This is not the winning ticket');
    }

    const ticketsStr = localStorage.getItem(MOCK_TICKETS_KEY) || '[]';
    const tickets: MockTicket[] = JSON.parse(ticketsStr);

    const ticket = tickets.find(t => t.ticketNumber === ticketNumber);
    if (!ticket || ticket.owner !== wallet.address) {
        throw new Error('You do not own this ticket');
    }

    console.log('[DEMO] Prize claimed successfully! Amount:', state.prizePool.toString());
}

// Get lottery state
export function getMockLotteryState(): MockLotteryState | null {
    const stateStr = localStorage.getItem(MOCK_STATE_KEY);
    if (!stateStr) return null;

    return JSON.parse(stateStr, (_, v) => {
        if (typeof v === 'string' && /^\d+$/.test(v)) {
            try { return BigInt(v); } catch { return v; }
        }
        return v;
    });
}

// Get user's tickets
export function getMockUserTickets(wallet: MockWalletContext): MockTicket[] {
    const ticketsStr = localStorage.getItem(MOCK_TICKETS_KEY) || '[]';
    const tickets: MockTicket[] = JSON.parse(ticketsStr);

    return tickets.filter(t => t.owner === wallet.address);
}

// Get all tickets
export function getMockAllTickets(): MockTicket[] {
    const ticketsStr = localStorage.getItem(MOCK_TICKETS_KEY) || '[]';
    return JSON.parse(ticketsStr);
}

// Reset lottery (for testing)
export function resetMockLottery(): void {
    localStorage.removeItem(MOCK_CONTRACT_KEY);
    localStorage.removeItem(MOCK_TICKETS_KEY);
    localStorage.removeItem(MOCK_STATE_KEY);
    console.log('[DEMO] Lottery reset');
}
