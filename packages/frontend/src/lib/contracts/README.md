# Contract Integration

This directory contains all the necessary files for integrating the Homeshare smart contracts into the frontend application.

## Structure

```
lib/contracts/
├── abi.ts                      # Contract ABIs as TypeScript constants
├── addresses.ts                # Contract addresses by network
├── config.ts                   # Chain configurations and utilities
├── usePropertyToken.ts         # Wagmi hooks for PropertyToken
├── usePropertyCrowdfund.ts     # Wagmi hooks for PropertyCrowdfund
├── useChainRegistry.ts         # Wagmi hooks for ChainRegistry
└── index.ts                    # Centralized exports
```

## Usage

### Import contracts utilities

```typescript
import {
  PropertyTokenAbi,
  PropertyCrowdfundAbi,
  ChainRegistryAbi,
  getContractAddress,
  getChainConfig,
  usePropertyTokenBalance,
  useInvest,
  useSupportedChains
} from '@/lib/contracts';
```

### Read contract data

```typescript
// Get PropertyToken balance
const { data: balance } = usePropertyTokenBalance(chainId, userAddress);

// Get campaign details
const { data: campaign } = useCampaign(chainId, campaignId);

// Get supported chains from ChainRegistry
const { data: chains } = useSupportedChains(chainId);
```

### Write to contracts

```typescript
// Transfer PropertyTokens
const { transfer, isLoading } = usePropertyTokenTransfer(chainId);
transfer?.({ args: [recipientAddress, amount] });

// Invest in a campaign
const { invest, isLoading } = useInvest(chainId);
invest?.({ args: [campaignId, tokenAddress, amount] });

// Add a chain to registry (owner only)
const { addChain, isLoading } = useAddChain(chainId);
addChain?.({ args: [newChainId, chainName] });
```

### Get contract addresses

```typescript
// Get all contract addresses for a chain
const addresses = getContractAddresses(11155111); // Sepolia
// Returns: { PropertyToken, PropertyCrowdfund, ChainRegistry }

// Get a specific contract address
const tokenAddress = getContractAddress(11155111, 'PropertyToken');
```

### Chain configuration

```typescript
// Get chain configuration
const config = getChainConfig(11155111);
// Returns: { chainId, name, rpcUrl, blockExplorer, nativeCurrency, ... }

// Get all supported chains
const chainIds = getSupportedChainIds();

// Check if contracts are deployed
const isDeployed = areContractsDeployed(11155111);
```

## Environment Variables

Configure contract addresses in `.env`:

```bash
# Sepolia Testnet
VITE_SEPOLIA_PROPERTY_TOKEN=0x24e580A700C2cE6a324A32b8a9f4f0d20EC5b020
VITE_SEPOLIA_PROPERTY_CROWDFUND=0x705ca8D85C32Cd4D6456bf59F0Ed2F5e358D8062
VITE_SEPOLIA_CHAIN_REGISTRY=0xD368b35D0beaCe446E6e174D420DB2E65F6b2fE0

# Add more networks as needed
```

## Supported Networks

- **Sepolia Testnet** (Chain ID: 11155111) ✅ Deployed
- **Base Sepolia** (Chain ID: 84532)
- **Ethereum Mainnet** (Chain ID: 1)
- **Base** (Chain ID: 8453)
- **Canton Network** (Chain ID: TBD)

## Examples

### Complete investment flow

```typescript
function InvestmentComponent() {
  const { address } = useAccount();
  const chainId = useChainId();
  
  // 1. Check token balance
  const { data: balance } = usePropertyTokenBalance(chainId, address);
  
  // 2. Get campaign details
  const { data: campaign } = useCampaign(chainId, campaignId);
  
  // 3. Approve token spending
  const { approve, isLoading: isApproving } = usePropertyTokenApprove(chainId);
  
  // 4. Invest in campaign
  const { invest, isLoading: isInvesting } = useInvest(chainId);
  
  const handleInvest = async () => {
    // First approve
    await approve?.({ args: [campaignAddress, investAmount] });
    
    // Then invest
    await invest?.({ args: [campaignId, tokenAddress, investAmount] });
  };
  
  return (
    <button onClick={handleInvest} disabled={isApproving || isInvesting}>
      {isApproving ? 'Approving...' : isInvesting ? 'Investing...' : 'Invest'}
    </button>
  );
}
```

## Notes

- All hooks use Wagmi under the hood for efficient caching and state management
- Contract addresses are environment-based for easy network switching
- ABIs are typed for better TypeScript support
- All write functions include loading states for better UX

## Resources

- [Deployment Guide](../../../contracts/DEPLOYMENT_GUIDE.md)
- [Wagmi Documentation](https://wagmi.sh/)
- [Contract Source Code](../../../contracts/contracts/)
