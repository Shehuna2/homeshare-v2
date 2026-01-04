/**
 * Contract Configuration
 * Multi-chain contract address mappings and network configurations
 */

export interface ContractAddresses {
  PropertyToken: string;
  PropertyCrowdfund: string;
  ChainRegistry: string;
}

export interface NetworkConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  blockExplorer: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  contracts: ContractAddresses;
  deploymentBlock?: number;
  isTestnet: boolean;
}

export interface TokenConfig {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  isNative?: boolean;
}

// Testnet Configurations
export const SEPOLIA_CONFIG: NetworkConfig = {
  chainId: 11155111,
  name: 'Ethereum Sepolia',
  rpcUrl: process.env.ETHEREUM_SEPOLIA_RPC_URL || 'https://sepolia.infura.io/v3/',
  blockExplorer: 'https://sepolia.etherscan.io',
  nativeCurrency: {
    name: 'Sepolia Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  contracts: {
    PropertyToken: '0x24e580A700C2cE6a324A32b8a9f4f0d20EC5b020',
    PropertyCrowdfund: '0x705ca8D85C32Cd4D6456bf59F0Ed2F5e358D8062',
    ChainRegistry: '0xD368b35D0beaCe446E6e174D420DB2E65F6b2fE0',
  },
  deploymentBlock: 9979967,
  isTestnet: true,
};

export const BASE_SEPOLIA_CONFIG: NetworkConfig = {
  chainId: 84532,
  name: 'Base Sepolia',
  rpcUrl: process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
  blockExplorer: 'https://sepolia.basescan.org',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  contracts: {
    PropertyToken: '0x0000000000000000000000000000000000000000',
    PropertyCrowdfund: '0x0000000000000000000000000000000000000000',
    ChainRegistry: '0x0000000000000000000000000000000000000000',
  },
  isTestnet: true,
};

export const CANTON_TESTNET_CONFIG: NetworkConfig = {
  chainId: parseInt(process.env.CANTON_TESTNET_CHAIN_ID || '0'),
  name: 'Canton Testnet',
  rpcUrl: process.env.CANTON_TESTNET_RPC_URL || '',
  blockExplorer: process.env.CANTON_TESTNET_EXPLORER_URL || '',
  nativeCurrency: {
    name: 'Canton Coin',
    symbol: 'CC',
    decimals: 18,
  },
  contracts: {
    PropertyToken: '0x0000000000000000000000000000000000000000',
    PropertyCrowdfund: '0x0000000000000000000000000000000000000000',
    ChainRegistry: '0x0000000000000000000000000000000000000000',
  },
  isTestnet: true,
};

// Mainnet Configurations
export const ETHEREUM_CONFIG: NetworkConfig = {
  chainId: 1,
  name: 'Ethereum Mainnet',
  rpcUrl: process.env.ETHEREUM_MAINNET_RPC_URL || '',
  blockExplorer: 'https://etherscan.io',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  contracts: {
    PropertyToken: '0x0000000000000000000000000000000000000000',
    PropertyCrowdfund: '0x0000000000000000000000000000000000000000',
    ChainRegistry: '0x0000000000000000000000000000000000000000',
  },
  isTestnet: false,
};

export const BASE_CONFIG: NetworkConfig = {
  chainId: 8453,
  name: 'Base',
  rpcUrl: process.env.BASE_MAINNET_RPC_URL || '',
  blockExplorer: 'https://basescan.org',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  contracts: {
    PropertyToken: '0x0000000000000000000000000000000000000000',
    PropertyCrowdfund: '0x0000000000000000000000000000000000000000',
    ChainRegistry: '0x0000000000000000000000000000000000000000',
  },
  isTestnet: false,
};

export const CANTON_CONFIG: NetworkConfig = {
  chainId: parseInt(process.env.CANTON_MAINNET_CHAIN_ID || '0'),
  name: 'Canton Network',
  rpcUrl: process.env.CANTON_MAINNET_RPC_URL || '',
  blockExplorer: process.env.CANTON_MAINNET_EXPLORER_URL || '',
  nativeCurrency: {
    name: 'Canton Coin',
    symbol: 'CC',
    decimals: 18,
  },
  contracts: {
    PropertyToken: '0x0000000000000000000000000000000000000000',
    PropertyCrowdfund: '0x0000000000000000000000000000000000000000',
    ChainRegistry: '0x0000000000000000000000000000000000000000',
  },
  isTestnet: false,
};

// Network configurations by chain ID
export const NETWORK_CONFIGS: Record<number, NetworkConfig> = {
  // Testnets
  11155111: SEPOLIA_CONFIG,
  84532: BASE_SEPOLIA_CONFIG,
  // Mainnets
  1: ETHEREUM_CONFIG,
  8453: BASE_CONFIG,
};

// Add Canton configs if chain IDs are set
if (CANTON_TESTNET_CONFIG.chainId > 0) {
  NETWORK_CONFIGS[CANTON_TESTNET_CONFIG.chainId] = CANTON_TESTNET_CONFIG;
}
if (CANTON_CONFIG.chainId > 0) {
  NETWORK_CONFIGS[CANTON_CONFIG.chainId] = CANTON_CONFIG;
}

// Token configurations per chain
export const TOKENS_BY_CHAIN: Record<number, TokenConfig[]> = {
  // Ethereum Mainnet
  1: [
    {
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
    },
    {
      address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
    },
  ],
  // Sepolia Testnet
  11155111: [
    {
      address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
    },
  ],
  // Base Mainnet
  8453: [
    {
      address: '0x833589fCD6eDb6E08f4c7C32D4f71b1566469c3d',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
    },
    {
      address: '0xfde4C96c8593536E31F26E3DaA6eFB41D12d2588',
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
    },
  ],
  // Base Sepolia
  84532: [
    {
      address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
    },
  ],
};

/**
 * Get contract addresses for a specific chain
 */
export function getContractAddresses(chainId: number): ContractAddresses | undefined {
  return NETWORK_CONFIGS[chainId]?.contracts;
}

/**
 * Get network configuration for a specific chain
 */
export function getNetworkConfig(chainId: number): NetworkConfig | undefined {
  return NETWORK_CONFIGS[chainId];
}

/**
 * Get supported tokens for a specific chain
 */
export function getSupportedTokens(chainId: number): TokenConfig[] {
  return TOKENS_BY_CHAIN[chainId] || [];
}

/**
 * Get all supported chain IDs
 */
export function getSupportedChainIds(): number[] {
  return Object.keys(NETWORK_CONFIGS).map(Number);
}

/**
 * Check if a chain is supported
 */
export function isChainSupported(chainId: number): boolean {
  return chainId in NETWORK_CONFIGS;
}

export default {
  NETWORK_CONFIGS,
  TOKENS_BY_CHAIN,
  getContractAddresses,
  getNetworkConfig,
  getSupportedTokens,
  getSupportedChainIds,
  isChainSupported,
};
