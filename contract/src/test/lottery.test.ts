
import { describe, it, expect } from "vitest";
import {
  type CircuitContext,
  sampleContractAddress,
  createConstructorContext,
  createCircuitContext
} from "@midnight-ntwrk/compact-runtime";
import {
  Contract,
  type Ledger,
  ledger
} from "../managed/lottery/contract/index.js";

// A simple simulator for the Lottery contract
class LotterySimulator {
  readonly contract: Contract<void>;
  circuitContext: CircuitContext<void>;

  constructor() {
    this.contract = new Contract<void>({}); // No private state witnesses needed
    const {
      currentPrivateState,
      currentContractState,
      currentZswapLocalState
    } = this.contract.initialState(
      createConstructorContext(undefined, "0".repeat(64))
    );
    this.circuitContext = createCircuitContext(
      sampleContractAddress(),
      currentZswapLocalState,
      currentContractState,
      currentPrivateState
    );
  }

  public getLedger(): Ledger {
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  public buyTicket(): bigint {
    const result = this.contract.circuits.buy_ticket(this.circuitContext);
    this.circuitContext = result.context;
    return result.result;
  }

  public drawWinner(winningTicket: bigint): void {
    const result = this.contract.circuits.draw_winner(
      this.circuitContext,
      winningTicket
    );
    this.circuitContext = result.context;
  }

  public claimPrize(ticketId: bigint): void {
     const result = this.contract.circuits.claim_prize(
        this.circuitContext,
        ticketId
     );
     this.circuitContext = result.context;
  }
}

describe("Lottery smart contract", () => {
  it("initializes correctly", () => {
    const sim = new LotterySimulator();
    const ledger = sim.getLedger();
    expect(ledger.total_tickets).toEqual(0n);
    expect(ledger.round).toEqual(0n);
  });

  it("buys a ticket", () => {
    const sim = new LotterySimulator();
    const ticketId = sim.buyTicket();
    expect(ticketId).toEqual(1n);
    const ledger = sim.getLedger();
    expect(ledger.total_tickets).toEqual(1n);
  });

  it("draws a winner", () => {
    const sim = new LotterySimulator();
    sim.buyTicket(); // ticket 1
    sim.buyTicket(); // ticket 2
    
    // Draw winner (organizer picks 2)
    sim.drawWinner(2n);
    
    const ledger = sim.getLedger();
    expect(ledger.winning_ticket).toEqual(2n);
    expect(ledger.round).toEqual(1n);
  });

  it("claims prize successfully with winning ticket", () => {
     const sim = new LotterySimulator();
     sim.buyTicket(); // 1
     sim.drawWinner(1n);
     // Should not throw
     sim.claimPrize(1n);
  });

  it("fails to claim prize with losing ticket", () => {
     const sim = new LotterySimulator();
     sim.buyTicket(); // 1
     sim.buyTicket(); // 2
     sim.drawWinner(1n);
     
     // Should throw assertion error
     expect(() => sim.claimPrize(2n)).toThrow();
  });
});
