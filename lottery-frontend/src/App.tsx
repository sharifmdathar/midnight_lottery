import { useState, useEffect } from 'react';
import { WalletConnect } from './components/WalletConnect';
import { useLotteryContract } from './hooks/useLotteryContract';
import { loadTicketsFromStorage } from './services/midnight';
import './App.css';

function App() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [myTickets, setMyTickets] = useState<bigint[]>([]);
  const [contractAddressInput, setContractAddressInput] = useState('');
  const [winningTicketInput, setWinningTicketInput] = useState('');

  const {
    contract,
    contractAddress,
    lotteryState,
    isLoading,
    error,
    deployContract,
    joinContract,
    buyTicket,
    drawWinner,
    claimPrize,
  } = useLotteryContract(walletAddress);

  // Load user's tickets from localStorage when wallet connects
  useEffect(() => {
    if (walletAddress) {
      const tickets = loadTicketsFromStorage(walletAddress);
      setMyTickets(tickets);
    }
  }, [walletAddress, lotteryState]); // Refresh when state changes

  const handleBuyTicket = async () => {
    await buyTicket();
    if (walletAddress) {
      const tickets = loadTicketsFromStorage(walletAddress);
      setMyTickets(tickets);
    }
  };

  const handleDrawWinner = async () => {
    const ticketNum = BigInt(winningTicketInput);
    await drawWinner(ticketNum);
    setWinningTicketInput('');
  };

  const handleClaimPrize = async (ticketId: bigint) => {
    await claimPrize(ticketId);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>🎰 Midnight Lottery</h1>
        <p className="tagline">Private. Secure. Decentralized.</p>
      </header>

      <main className="app-main">
        <WalletConnect onAddressChange={setWalletAddress} />

        {error && (
          <div className="error-banner">
            ⚠️ {error}
          </div>
        )}

        {!contract && walletAddress && (
          <div className="contract-setup">
            <div className="dashboard-card">
              <h2>🚀 Get Started</h2>
              <div className="setup-options">
                <button
                  onClick={deployContract}
                  disabled={isLoading}
                  className="action-button primary"
                >
                  {isLoading ? '⏳ Deploying...' : '🎲 Deploy New Lottery'}
                </button>

                <div className="divider">OR</div>

                <div className="join-contract">
                  <input
                    type="text"
                    placeholder="Enter contract address"
                    value={contractAddressInput}
                    onChange={(e) => setContractAddressInput(e.target.value)}
                    className="contract-input"
                  />
                  <button
                    onClick={() => joinContract(contractAddressInput)}
                    disabled={isLoading || !contractAddressInput}
                    className="action-button secondary"
                  >
                    {isLoading ? '⏳ Joining...' : '🔗 Join Existing Lottery'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {contract && (
          <div className="lottery-dashboard">
            <div className="dashboard-card">
              <h2>📋 Contract Info</h2>
              <div className="contract-info">
                <div className="info-item">
                  <span className="label">Address:</span>
                  <code className="value">{contractAddress?.slice(0, 20)}...</code>
                </div>
              </div>
            </div>

            <div className="dashboard-card">
              <h2>🎫 Your Tickets ({myTickets.length})</h2>
              {myTickets.length === 0 ? (
                <p className="empty-state">No tickets yet. Buy your first ticket below!</p>
              ) : (
                <div className="ticket-list">
                  {myTickets.map((ticket, idx) => (
                    <div key={idx} className="ticket-item">
                      <span>Ticket #{ticket.toString()}</span>
                      {lotteryState && ticket === lotteryState.winningTicket && (
                        <button
                          onClick={() => handleClaimPrize(ticket)}
                          className="claim-button"
                          disabled={isLoading}
                        >
                          🏆 Claim Prize
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="dashboard-card">
              <h2>🎲 Lottery Actions</h2>
              <div className="action-buttons">
                <button
                  onClick={handleBuyTicket}
                  disabled={isLoading}
                  className="action-button primary"
                >
                  {isLoading ? '⏳ Processing...' : '🎫 Buy Ticket'}
                </button>

                <div className="draw-winner-section">
                  <input
                    type="number"
                    placeholder="Winning ticket number"
                    value={winningTicketInput}
                    onChange={(e) => setWinningTicketInput(e.target.value)}
                    className="ticket-input"
                    min="1"
                    max={lotteryState?.totalTickets.toString() || '1'}
                  />
                  <button
                    onClick={handleDrawWinner}
                    disabled={isLoading || !winningTicketInput}
                    className="action-button secondary"
                  >
                    {isLoading ? '⏳ Drawing...' : '🎯 Draw Winner'}
                  </button>
                </div>
              </div>
            </div>

            <div className="dashboard-card">
              <h2>📊 Lottery Stats</h2>
              <div className="stats-grid">
                <div className="stat-item">
                  <div className="stat-label">Total Tickets</div>
                  <div className="stat-value">
                    {lotteryState?.totalTickets.toString() || '0'}
                  </div>
                </div>
                <div className="stat-item">
                  <div className="stat-label">Current Round</div>
                  <div className="stat-value">
                    {lotteryState?.round.toString() || '1'}
                  </div>
                </div>
                <div className="stat-item">
                  <div className="stat-label">Winning Ticket</div>
                  <div className="stat-value">
                    {lotteryState?.winningTicket.toString() || '-'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="app-footer">
        <p>Powered by Midnight Network • Connected to localhost:6300, 8088, 9944</p>
      </footer>
    </div>
  );
}

export default App;
