# Deployment Guide

This guide provides step-by-step instructions for deploying, verifying, and integrating the Homeshare smart contracts.

## Table of Contents

1. [Contract Deployment](#contract-deployment)
2. [Contract Verification](#contract-verification)
3. [Frontend Integration](#frontend-integration)
4. [Backend Integration](#backend-integration)
5. [Testing Integration](#testing-integration)

---

## Contract Deployment

### Prerequisites

- Node.js (v18 or higher)
- npm or pnpm
- Deployment wallet with sufficient native tokens for gas fees
- RPC endpoints for target networks
- Etherscan API keys (for verification)

### Environment Setup

1. Navigate to the contracts package:
   ```bash
   cd packages/contracts
   ```

2. Copy the environment example file:
   ```bash
   cp .env.example .env
   ```

3. Fill in the required values in `.env`:
   ```bash
   # RPC URLs
   ETHEREUM_SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
   BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
   
   # Deployment wallet private key
   DEPLOYER_PRIVATE_KEY=0x...your_private_key
   
   # Etherscan API keys (for verification)
   ETHEREUM_ETHERSCAN_API_KEY=YOUR_ETHERSCAN_API_KEY
   BASE_ETHERSCAN_API_KEY=YOUR_BASESCAN_API_KEY
   ```

### Deploy to Testnet

Deploy contracts to Sepolia testnet:
```bash
npm run deploy:sepolia
```

Deploy contracts to Base Sepolia testnet:
```bash
npm run deploy:base-sepolia
```

Deploy contracts to Canton testnet:
```bash
npm run deploy:canton-testnet
```

### Deploy to Mainnet

⚠️ **WARNING**: Mainnet deployments involve real funds. Double-check all configuration before deploying.

Deploy to Ethereum mainnet:
```bash
npm run deploy:ethereum
```

Deploy to Base mainnet:
```bash
npm run deploy:base
```

Deploy to Canton mainnet:
```bash
npm run deploy:canton
```

### Deployment Output

After successful deployment, you'll see output similar to:
```
==================================================
Deployment Successful!
==================================================
{
  "propertyToken": "0x24e580A700C2cE6a324A32b8a9f4f0d20EC5b020",
  "propertyCrowdfund": "0x705ca8D85C32Cd4D6456bf59F0Ed2F5e358D8062",
  "chainRegistry": "0xD368b35D0beaCe446E6e174D420DB2E65F6b2fE0",
  "deploymentBlock": 9979967,
  "deploymentTx": "0x89dec56f...",
  "deployedAt": "2026-01-04T21:40:18.528Z"
}
==================================================
```

Contract addresses are automatically saved to `deployments/testnet-addresses.json` or `deployments/mainnet-addresses.json`.

---

## Contract Verification

Contract verification allows users to read and interact with your contracts on block explorers like Etherscan.

### Automated Verification Script

We provide a bash script to verify all contracts at once:

```bash
cd packages/contracts
./scripts/verify-contracts.sh sepolia
```

Available networks:
- `sepolia` - Ethereum Sepolia Testnet
- `base-sepolia` - Base Sepolia Testnet
- `canton-testnet` - Canton Testnet
- `ethereum` - Ethereum Mainnet
- `base` - Base Mainnet
- `canton` - Canton Mainnet

### Manual Verification

If you need to verify contracts manually:

**PropertyToken:**
```bash
npx hardhat verify --network sepolia \
  0x24e580A700C2cE6a324A32b8a9f4f0d20EC5b020 \
  "Sepolia Property Token" \
  "SPT" \
  "property-sepolia-1" \
  "1000000000000000000000000" \
  "100000000000000000000000"
```

**PropertyCrowdfund:**
```bash
npx hardhat verify --network sepolia \
  0x705ca8D85C32Cd4D6456bf59F0Ed2F5e358D8062
```

**ChainRegistry:**
```bash
npx hardhat verify --network sepolia \
  0xD368b35D0beaCe446E6e174D420DB2E65F6b2fE0
```

### Verification Troubleshooting

**Issue: "Already Verified"**
- This is normal - the contract is already verified
- You can view it on the block explorer

**Issue: "Invalid API Key"**
- Check your Etherscan API key in `.env`
- Ensure you're using the correct API key for the network

**Issue: "Compilation failed"**
- Ensure your Solidity version matches exactly
- Check that constructor arguments are correct

---

## Frontend Integration

### Setup

1. Navigate to the frontend package:
   ```bash
   cd packages/frontend
   ```

2. Copy the environment example:
   ```bash
   cp .env.example .env
   ```

3. Update contract addresses in `.env`:
   ```bash
   # Sepolia Testnet
   VITE_SEPOLIA_PROPERTY_TOKEN=0x24e580A700C2cE6a324A32b8a9f4f0d20EC5b020
   VITE_SEPOLIA_PROPERTY_CROWDFUND=0x705ca8D85C32Cd4D6456bf59F0Ed2F5e358D8062
   VITE_SEPOLIA_CHAIN_REGISTRY=0xD368b35D0beaCe446E6e174D420DB2E65F6b2fE0
   ```

### Contract Integration Files

The frontend integration includes the following files in `src/lib/contracts/`:

- **`abi.ts`** - Contract ABIs as TypeScript constants
- **`addresses.ts`** - Contract addresses by network
- **`config.ts`** - Chain configurations and utilities
- **`usePropertyToken.ts`** - Wagmi hooks for PropertyToken
- **`usePropertyCrowdfund.ts`** - Wagmi hooks for PropertyCrowdfund
- **`useChainRegistry.ts`** - Wagmi hooks for ChainRegistry

### Usage Examples

**Read PropertyToken balance:**
```typescript
import { usePropertyTokenBalance } from '@/lib/contracts/usePropertyToken';

function MyComponent() {
  const { data: balance } = usePropertyTokenBalance(11155111, address);
  return <div>Balance: {balance?.toString()}</div>;
}
```

**Invest in a campaign:**
```typescript
import { useInvest } from '@/lib/contracts/usePropertyCrowdfund';

function InvestButton() {
  const { invest, isLoading } = useInvest(11155111);
  
  const handleInvest = () => {
    invest?.({
      args: [campaignId, tokenAddress, amount]
    });
  };
  
  return <button onClick={handleInvest} disabled={isLoading}>
    {isLoading ? 'Investing...' : 'Invest'}
  </button>;
}
```

---

## Backend Integration

### Setup

1. Navigate to the backend package:
   ```bash
   cd packages/backend
   ```

2. Copy the environment example:
   ```bash
   cp .env.example .env
   ```

3. Update contract addresses in `.env`:
   ```bash
   # Sepolia Testnet
   SEPOLIA_PROPERTY_TOKEN=0x24e580A700C2cE6a324A32b8a9f4f0d20EC5b020
   SEPOLIA_PROPERTY_CROWDFUND=0x705ca8D85C32Cd4D6456bf59F0Ed2F5e358D8062
   SEPOLIA_CHAIN_REGISTRY=0xD368b35D0beaCe446E6e174D420DB2E65F6b2fE0
   ```

### Contract Service

The backend uses `ContractService` to interact with contracts:

```typescript
import { contractService } from '@/services/contract-service';

// Get PropertyToken metadata
const metadata = await contractService.getPropertyTokenMetadata('sepolia');

// Get campaign details
const campaign = await contractService.getCampaign('sepolia', campaignId);

// Listen to events
contractService.listenToEvents(
  'sepolia',
  'PropertyCrowdfund',
  'InvestmentMade',
  (campaignId, investor, token, amount) => {
    console.log(`Investment made: ${amount}`);
  }
);
```

### Event Indexing

To index contract events:

```typescript
import { contractService } from '@/services/contract-service';

// Query past events
const events = await contractService.queryPastEvents(
  'sepolia',
  'PropertyCrowdfund',
  'InvestmentMade',
  9979967, // From deployment block
  'latest'
);

// Process events
events.forEach(event => {
  const { campaignId, investor, token, amount } = event.args;
  // Save to database
});
```

---

## Testing Integration

### Integration Testing Checklist

#### Frontend Testing

- [ ] Connect wallet to Sepolia testnet
- [ ] Verify contract addresses are correct
- [ ] Read PropertyToken balance
- [ ] Read PropertyToken metadata
- [ ] Approve PropertyToken spending
- [ ] Transfer PropertyTokens
- [ ] View campaign details
- [ ] Get campaign count
- [ ] Invest in a campaign (with test tokens)
- [ ] View investment amount
- [ ] Check ChainRegistry supported chains

#### Backend Testing

- [ ] Verify RPC connection to Sepolia
- [ ] Read PropertyToken metadata
- [ ] Query PropertyToken balance
- [ ] Get campaign details
- [ ] Get campaign count
- [ ] Query past events
- [ ] Listen to new events
- [ ] Format/parse values correctly

#### Contract Verification Testing

- [ ] Verify PropertyToken on Etherscan
- [ ] Verify PropertyCrowdfund on Etherscan
- [ ] Verify ChainRegistry on Etherscan
- [ ] Read contract on Etherscan
- [ ] Write to contract via Etherscan (testnet only)

### Test Networks

**Sepolia Testnet:**
- Chain ID: 11155111
- Faucet: https://sepoliafaucet.com/
- Explorer: https://sepolia.etherscan.io

**Base Sepolia:**
- Chain ID: 84532
- Faucet: https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet
- Explorer: https://sepolia.basescan.org

### Common Issues

**Issue: "Cannot read properties of undefined"**
- Ensure wallet is connected
- Check that contract addresses are set
- Verify you're on the correct network

**Issue: "Transaction reverted"**
- Check that you have sufficient balance
- Verify allowances for token transfers
- Ensure campaign is active

**Issue: "RPC Error"**
- Check RPC URL is correct
- Verify RPC endpoint is accessible
- Try a different RPC provider

---

## Updating Contract Addresses

When deploying to new networks, update addresses in:

1. **Contracts package:** `packages/contracts/deployments/contracts-config.ts`
2. **Frontend package:** `packages/frontend/src/lib/contracts/addresses.ts`
3. **Backend package:** `packages/backend/src/config/contracts.ts`
4. **Environment files:** Update all `.env.example` files

---

## Network Information

### Sepolia Testnet
- **Deployed Contracts:**
  - PropertyToken: `0x24e580A700C2cE6a324A32b8a9f4f0d20EC5b020`
  - PropertyCrowdfund: `0x705ca8D85C32Cd4D6456bf59F0Ed2F5e358D8062`
  - ChainRegistry: `0xD368b35D0beaCe446E6e174D420DB2E65F6b2fE0`
- **Deployment Block:** 9979967
- **Deployment Date:** 2026-01-04

### Base Sepolia Testnet
- **Status:** Not yet deployed
- **Chain ID:** 84532

### Canton Testnet
- **Status:** Not yet deployed
- **Chain ID:** TBD

---

## Support

For issues or questions:
1. Check the troubleshooting sections above
2. Review contract code in `packages/contracts/contracts/`
3. Check deployment logs in `packages/contracts/deployments/`
4. Create an issue in the repository

---

## Additional Resources

- [Hardhat Documentation](https://hardhat.org/docs)
- [Ethers.js Documentation](https://docs.ethers.org/)
- [Wagmi Documentation](https://wagmi.sh/)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/)
