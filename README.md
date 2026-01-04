# Homeshare v2 🏠

> Multi-Chain Real Estate Crowdfunding Platform

Homeshare v2 is a decentralized real estate crowdfunding platform that enables investors to participate in property investments across multiple blockchain networks with support for various stablecoins and native tokens.

## 🌐 Supported Networks

- **Ethereum Mainnet**: USDC, USDT, ETH
- **Base Network**: USDC, USDT, ETH, RIZE ($RIZE token)
- **Canton Network**: CC token (native)
- **EVM-Compatible Chains**: Generic support for future expansion

## 🏗️ Project Structure

This is a monorepo managed with pnpm workspaces:

```
homeshare-v2/
├── packages/
│   ├── frontend/      # React 18 + TypeScript + Vite
│   ├── backend/       # Node.js/Express + TypeScript
│   └── contracts/     # Solidity + Hardhat
├── docs/              # Project documentation
└── scripts/           # Utility scripts
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- pnpm (or npm/yarn)
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/Shehuna2/homeshare-v2.git
cd homeshare-v2

# Install dependencies
pnpm install

# Setup environment files
cp packages/frontend/.env.example packages/frontend/.env.local
cp packages/backend/.env.example packages/backend/.env.local
cp packages/contracts/.env.example packages/contracts/.env.local

# Start development servers
pnpm dev
```

## 📦 Packages

### Frontend
- React 18 with TypeScript
- Vite for fast development
- TailwindCSS for styling
- Wagmi for multi-chain wallet integration
- Redux Toolkit for state management

### Backend
- Express.js with TypeScript
- PostgreSQL for data persistence
- Multi-chain indexing service
- JWT-based authentication

### Contracts
- Solidity smart contracts
- Hardhat development environment
- Multi-chain deployment scripts
- OpenZeppelin contracts

## 📚 Documentation

- [Architecture](./docs/ARCHITECTURE.md)
- [Setup Guide](./docs/SETUP.md)
- [Deployment](./docs/DEPLOYMENT.md)
- [API Documentation](./docs/API.md)
- [Smart Contracts](./docs/SMART_CONTRACTS.md)
- [Contributing](./docs/CONTRIBUTING.md)

## 🔑 Key Features

✅ **Multi-Chain Support** - Invest across Ethereum, Base, and Canton networks  
✅ **Multiple Tokens** - Support for USDC, USDT, ETH, RIZE, and CC tokens  
✅ **Real Estate Tokenization** - Fractional ownership through ERC20 tokens  
✅ **Investor Dashboard** - Track investments across all chains  
✅ **Owner Console** - Manage properties and distribute profits  
✅ **Type Safety** - Full TypeScript across all packages  

## 🛠️ Development

```bash
# Build all packages
pnpm build

# Run tests
pnpm test

# Lint code
pnpm lint

# Clean all
pnpm clean
```

## 📄 License

MIT

## 🤝 Contributing

See [CONTRIBUTING.md](./docs/CONTRIBUTING.md) for details on how to contribute to this project.
