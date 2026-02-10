import { useState } from 'react';
import { createWallet, getShieldedAddress, createLaceWalletContext } from '../services/walletService';
import { connectLaceWallet, enableLaceWallet } from '../services/dappConnectorService';
import type { WalletContext } from '../services/walletService';
import './WalletConnect.css';

interface WalletConnectProps {
    onWalletConnect: (context: WalletContext | null) => void;
    onAddressChange: (address: string | null) => void;
}

function WalletConnect({ onWalletConnect, onAddressChange }: WalletConnectProps) {
    const [isConnecting, setIsConnecting] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [address, setAddress] = useState<string | null>(null);
    const [useDemoMode, setUseDemoMode] = useState(false);

    const handleConnectLocal = async () => {
        setIsConnecting(true);
        setError(null);

        try {
            console.log('Creating wallet... This may take 30-60 seconds for initial sync.');
            const walletContext = await createWallet();

            // Get the address from the wallet
            const walletAddress = await getShieldedAddress(walletContext);

            setAddress(walletAddress);
            setIsConnected(true);

            // Pass wallet context to parent
            onWalletConnect(walletContext);
            onAddressChange(walletAddress);

            console.log('Wallet created successfully!');
        } catch (err) {
            console.error('Connection error:', err);
            const errorMsg = err instanceof Error ? err.message : 'Failed to create wallet';
            setError(`${errorMsg}\n\nTip: Wallet sync can take 30-60 seconds. Try enabling Demo Mode for instant testing.`);
        } finally {
            setIsConnecting(false);
        }
    };

    const handleConnectLace = async () => {
        // We rely on connectLaceWallet to poll for the extension
        setIsConnecting(true);
        setError(null);

        try {
            console.log('Connecting to Lace wallet...');
            const connector = await connectLaceWallet();
            const api = await enableLaceWallet(connector);
            const walletContext = await createLaceWalletContext(api);

            // Get the address from the wallet
            const walletAddress = await getShieldedAddress(walletContext);

            setAddress(walletAddress);
            setIsConnected(true);

            // Pass wallet context to parent
            onWalletConnect(walletContext);
            onAddressChange(walletAddress);

            console.log('Lace wallet connected successfully!');
        } catch (err) {
            console.error('Lace connection error:', err);
            const errorMsg = err instanceof Error ? err.message : 'Failed to connect to Lace wallet';
            setError(errorMsg);
        } finally {
            setIsConnecting(false);
        }
    };

    const handleDemoMode = () => {
        const demoAddress = 'mn_addr_demo_1234567890abcdef';
        setAddress(demoAddress);
        setIsConnected(true);
        setUseDemoMode(true);

        // Create a mock wallet context for demo
        const mockContext = {
            type: 'local',
            wallet: { coinPublicKey: demoAddress },
        } as any;

        onWalletConnect(mockContext);
        onAddressChange(demoAddress);
    };

    const handleDisconnect = () => {
        setIsConnected(false);
        setAddress(null);
        setUseDemoMode(false);
        onWalletConnect(null);
        onAddressChange(null);
    };

    if (isConnected) {
        return (
            <div className="wallet-connect connected">
                <div className="connection-status">
                    <span className="status-icon">🟢</span>
                    <h3>Wallet Connected</h3>
                    {useDemoMode && <span className="demo-badge">Demo Mode</span>}
                </div>
                <div className="wallet-info">
                    <div className="info-row">
                        <span className="label">Address:</span>
                        <span className="value" title={address || ''}>
                            {address ? `${address.slice(0, 12)}...${address.slice(-8)}` : ''}
                        </span>
                    </div>
                </div>
                <button onClick={handleDisconnect} className="disconnect-button">
                    Disconnect
                </button>
            </div>
        );
    }

    return (
        <div className="wallet-connect">
            <h2>Connect Wallet</h2>

            {error && (
                <div className="error-message">
                    {error}
                </div>
            )}

            <div className="connect-options">
                <button
                    onClick={handleConnectLace}
                    disabled={isConnecting}
                    className="connect-button lace-button"
                >
                    {isConnecting ? 'Connecting...' : 'Connect Lace Wallet'}
                </button>

                <div className="divider"><span>OR</span></div>

                <button
                    onClick={handleConnectLocal}
                    disabled={isConnecting}
                    className="connect-button local-button"
                >
                    {isConnecting ? 'Creating...' : 'Create Local Test Wallet'}
                </button>
            </div>

            <div className="demo-section">
                <p className="demo-text">For instant testing without waiting for sync:</p>
                <button
                    onClick={handleDemoMode}
                    disabled={isConnecting}
                    className="demo-button"
                >
                    Enable Demo Mode
                </button>
            </div>

            <div className="connection-info">
                <p>
                    <strong>Note:</strong> Local wallet creation may take 30-60 seconds while the wallet synchronizes.
                </p>
            </div>
        </div>
    );
}

export default WalletConnect;
