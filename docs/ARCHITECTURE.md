# Homeshare v2 Architecture

## Overview

Homeshare v2 is a decentralized real estate crowdfunding platform built as a monorepo with three main packages: frontend, backend, and smart contracts. The platform supports multiple blockchain networks and payment tokens.

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                             │
│  (React + TypeScript + Vite + Wagmi + Redux)                │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   │ REST API / Web3
                   │
┌──────────────────┴──────────────────────────────────────────┐
│                         Backend                              │
│  (Node.js + Express + TypeScript + PostgreSQL)              │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   │ Web3 RPC
                   │
┌──────────────────┴──────────────────────────────────────────┐
│                    Smart Contracts                           │
│         (Ethereum, Base, Canton Networks)                    │
└─────────────────────────────────────────────────────────────┘
```

## Package Structure

### 1. Frontend (`packages/frontend/`)

**Technology Stack:**
- React 18 with TypeScript
- Vite for build tooling
- TailwindCSS for styling
- Wagmi for wallet connections
- Redux Toolkit for state management
- React Router for navigation

**Key Components:**
- **Chain Selector**: Switch between Ethereum, Base, and Canton
- **Token Selector**: Choose payment token (USDC, USDT, ETH, RIZE, CC)
- **Property Listings**: Browse properties across all chains
- **Investment Dashboard**: Track portfolio across chains
- **Owner Console**: Manage properties and distributions

**State Management:**
- `chainSlice`: Active chain and supported chains
- `userSlice`: User authentication and wallet
- `propertiesSlice`: Property data across chains
- `investmentSlice`: User investments
- `tokenSlice`: Token balances and prices

### 2. Backend (`packages/backend/`)

**Technology Stack:**
- Node.js with Express
- TypeScript for type safety
- PostgreSQL for data persistence
- ethers.js for blockchain interactions
- Bull for job queues

**Key Services:**
- **Multi-Chain Indexer**: Listen to events on all supported chains
- **API Server**: REST API for properties, investments, users
- **Authentication**: JWT-based auth with Web3 signature verification
- **Price Oracle**: Fetch token prices from external sources
- **Notification Service**: Alert users of important events

**Database Models:**
- Property: Store property details
- Investment: Track investments across chains
- User: User profiles and authentication
- ChainLog: Track indexed blocks per chain
- Token: Token metadata and prices

### 3. Smart Contracts (`packages/contracts/`)

**Contracts:**
- **PropertyToken.sol**: ERC20 token for property shares
- **PropertyCrowdfund.sol**: Crowdfunding with multi-token support
- **ChainRegistry.sol**: Registry of supported chains and tokens

**Deployment:**
- Same contracts deployed to each network
- Network-specific configurations in environment variables
- Hardhat for compilation, testing, and deployment

## Multi-Chain Architecture

### Chain Abstraction Layer

The platform uses a chain abstraction layer to handle multiple networks seamlessly:

1. **Frontend**:
   - `chainRegistry.ts`: Chain metadata and configurations
   - `contractService.ts`: Unified contract interaction layer
   - Wagmi for wallet connections across chains

2. **Backend**:
   - `web3Service.ts`: Multi-provider management
   - `indexerService.ts`: Parallel event listening for all chains
   - Chain-specific RPC endpoints in configuration

### Adding New Chains

To add a new chain:

1. Add chain configuration to `chains.config.ts`
2. Add token configurations to `tokens.config.ts`
3. Deploy contracts to the new chain
4. Update environment variables with new RPC endpoints
5. Add chain to indexer service

## Data Flow

### Investment Flow

```
1. User selects property on frontend
2. User chooses payment token and amount
3. Frontend initiates blockchain transaction
4. Smart contract processes investment
5. Backend indexer detects event
6. Backend updates database
7. Frontend refreshes user dashboard
```

### Property Creation Flow

```
1. Owner creates property via Owner Console
2. Backend validates and stores property data
3. Backend deploys PropertyToken contract
4. Backend creates crowdfunding campaign
5. Frontend displays new property
```

## Security Considerations

- All smart contracts use OpenZeppelin libraries
- ReentrancyGuard on financial functions
- JWT tokens for API authentication
- Web3 signature verification for login
- Rate limiting on API endpoints
- Input validation on all user inputs

## Scalability

- Database indexing on frequently queried fields
- Caching layer for token prices and property data
- Parallel event listening for multiple chains
- Pagination on all list endpoints
- Optimized smart contract gas usage

## Future Enhancements

- Cross-chain messaging for unified liquidity
- Automated profit distribution
- Secondary market for property tokens
- Governance mechanisms for property decisions
- Mobile application (React Native)
