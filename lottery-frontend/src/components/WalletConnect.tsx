import { useState, useEffect } from 'react';
import './WalletConnect.css';

interface WalletConnectProps {
    onAddressChange?: (address: string | null) => void;
}

export function WalletConnect({ onAddressChange }: WalletConnectProps) {
    const [isConnected, setIsConnected] = useState(false);
    const [address, setAddress] = useState<string | null>(null);
    const [isLaceInstalled, setIsLaceInstalled] = useState(false);

    useEffect(() => {
        // Check if Lace wallet is installed
        setIsLaceInstalled(typeof window.midnight !== 'undefined');

        // Check if already connected
        if (window.midnight) {
            window.midnight.isEnabled().then(enabled => {
                if (enabled) {
                    window.midnight!.enable().then(accounts => {
                        if (accounts.length > 0) {
                            setIsConnected(true);
                            setAddress(accounts[0]);
                        }
                    });
                }
            });
        }
    }, []);

    const connectWallet = async () => {
        if (!window.midnight) {
            alert('Lace wallet is not installed. Please install it from https://www.lace.io/');
            return;
        }

        try {
            const accounts = await window.midnight.enable();
            if (accounts.length > 0) {
                setIsConnected(true);
                setAddress(accounts[0]);
                onAddressChange?.(accounts[0]);
                console.log('Connected to Lace wallet:', accounts[0]);
            }
        } catch (error) {
            console.error('Failed to connect to Lace wallet:', error);
            alert('Failed to connect to Lace wallet. Please try again.');
        }
    };

    const disconnectWallet = () => {
        setIsConnected(false);
        setAddress(null);
        onAddressChange?.(null);
    };

    if (!isLaceInstalled) {
        return (
            <div className="wallet-connect">
                <div className="wallet-not-installed">
                    <h3>⚠️ Lace Wallet Not Detected</h3>
                    <p>Please install the Lace wallet browser extension to continue.</p>
                    <a
                        href="https://www.lace.io/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="install-button"
                    >
                        Install Lace Wallet
                    </a>
                </div>
            </div>
        );
    }

    return (
        <div className="wallet-connect">
            {!isConnected ? (
                <button onClick={connectWallet} className="connect-button">
                    🔗 Connect Lace Wallet
                </button>
            ) : (
                <div className="wallet-info">
                    <div className="connected-badge">✅ Connected</div>
                    <div className="address">{address?.slice(0, 20)}...{address?.slice(-10)}</div>
                    <button onClick={disconnectWallet} className="disconnect-button">
                        Disconnect
                    </button>
                </div>
            )}
        </div>
    );
}
