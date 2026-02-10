# Midnight Lottery DApp

[![Generic badge](https://img.shields.io/badge/Compact%20Compiler-0.28.0-1abc9c.svg)](https://shields.io/) [![Generic badge](https://img.shields.io/badge/TypeScript-5.8.3-blue.svg)](https://shields.io/)

A full-stack privacy-preserving Lottery application built on the **Midnight Network**.

This DApp demonstrates secure lotteries where participation is public but ticket IDs and winners are managed privately until reveal.

## 🚀 Features

-   **Zero-Knowledge Proofs (ZKPs)**: Uses Midnight's Compact language for privacy-preserving ticket purchase and verification.
-   **Lace Wallet Integration**: Seamlessly connect your wallet to deploy and interact with the contract.
-   **Local Development**: Includes a full standalone environment (Node, Indexer, Proof Server) via Docker.

## 📂 Project Structure

```
private-lottery/
├── contract/                          # Smart contract (Compact language)
│   ├── src/lottery.compact            # The lottery logic
│   └── ...
├── lottery-frontend/                  # React + Vite Frontend
│   ├── src/services/midnight.ts       # SDK Integration (Wallet, Proofs)
│   ├── src/hooks/useLotteryContract.ts # Contract State Management
│   └── ...
└── ...
```

## 🛠️ Prerequisites

-   **Node.js**: v18 or higher (Recommend v20 LTS).
-   **Lace Wallet**: [Extenstion](https://www.lace.io/) (configured for Midnight **Testnet** or **Devnet**).
-   **Midnight Compact Compiler**: (Managed via `npm run compact`).

## ⚡ Quick Start

### 1. Install Dependencies (Frontend)

```bash
cd lottery-frontend
npm install
```

### 2. Build the Contract (Optional)

If you modify the `.compact` file, you need to rebuild the contract artifacts:

```bash
cd contract
npm run compact
npm run build
```

The compiled output is used by the frontend.

### 3. Run the Frontend

```bash
cd lottery-frontend
npm run dev
```

Navigate to `http://localhost:5173`.

## 🔧 Troubleshooting

### Wallet Issues
-   **"FiberFailure" / "No dust tokens found"**: Your wallet balance is empty. Fund your wallet with **tDUST** from the [Midnight Faucet](https://faucet.testnet.midnight.network/).
-   **"TypeError: The first argument must be one of type string..."**: Restart the frontend server (`npm run dev`). This fixes a transient dependency conflict.

### Connection Issues
-   Ensure the **Lace Wallet** network matches the DApp network (Testnet/Devnet).
-   Reload the page if the "Connect Wallet" button does not respond.

## 📜 License

MIT
