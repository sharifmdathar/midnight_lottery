# Midnight Lottery DApp

A privacy-preserving lottery application built on the [Midnight Network](https://midnight.network/).

## 🚀 Overview

This DApp allows users to:
-   **Deploy** a new lottery smart contract.
-   **Join** an existing lottery.
-   **Buy Tickets** privately (using ZK proofs).
-   **Draw a Winner** fairly and verifiably.
-   **Claim Prizes** anonymously.

## 🛠️ Prerequisites

-   **Node.js**: v18 or higher.
-   **Lace Wallet**: [Download Endpoint](https://www.lace.io/) (configured for Midnight Testnet).
-   **Midnight Compact Compiler**: For building contracts (if modifying `.compact` files).

## 📦 Installation

1.  **Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Start Local Development Server**:
    ```bash
    npm run dev
    ```

3.  **Open in Browser**:
    Navigate to `http://localhost:5173`.

## 🔧 Troubleshooting

### 1. Wallet Connection Issues
-   Ensure you have the **Lace Wallet** extension installed and set to **Midnight Testnet**.
-   If the DApp doesn't detect the wallet, reload the page.

### 2. Deployment Errors

#### `TypeError: The first argument must be one of type string...`
-   **Cause**: A "dual package" issue where `Transaction` objects from different versions of the Midnight SDK conflict.
-   **Fix**: This is resolved in `vite.config.ts` using aliases. If you see this, try restarting the dev server (`npm run dev`).

#### `FiberFailure` or `No dust tokens found`
-   **Cause**: Your wallet has **0 tDUST** (Testnet Dust). You need tokens to pay for transaction fees.
-   **Fix**:
    1.  Copy your Lace wallet address.
    2.  Go to the [Midnight Testnet Faucet](https://faucet.testnet.midnight.network/).
    3.  Request **tDUST** and **tBTC** (optional).
    4.  Wait for the transaction to confirm, then try again.

## 📂 Project Structure

-   `src/contracts/`: Smart contract logic.
-   `src/services/midnight.ts`: Core Midnight SDK integration (Wallet, Proofs, Indexer).
-   `src/hooks/useLotteryContract.ts`: React hooks for managing contract state.
-   `vite.config.ts`: Configuration for building the frontend (includes polyfills for Buffer/Stream).

## 📜 License

MIT
