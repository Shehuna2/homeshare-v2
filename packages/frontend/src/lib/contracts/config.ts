/**
 * Contract Configuration and Chain Mappings
 */

import { getContractAddresses, areContractsDeployed } from './addresses';

export interface ChainConfig {
  chainId: number;
  name: string;
  shortName: string;
  rpcUrl: string;
  blockExplorer: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  isTestnet: boolean;
  deploymentBlock?: number;
}

/**
 * Supported chain configurations
 */
export const CHAIN_CONFIGS: Record<number, ChainConfig> = {
  // Testnets
  11155111: {
    chainId: 11155111,
    name: 'Ethereum Sepolia',
    shortName: 'Sepolia',
    rpcUrl: import.meta.env.VITE_SEPOLIA_RPC_URL || 'https://sepolia.infura.io/v3/',
    blockExplorer: 'https://sepolia.etherscan.io',
    nativeCurrency: {
      name: 'Sepolia Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    isTestnet: true,
    deploymentBlock: 9979967,
  },
  84532: {
    chainId: 84532,
    name: 'Base Sepolia',
    shortName: 'Base Sepolia',
    rpcUrl: import.meta.env.VITE_BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
    blockExplorer: 'https://sepolia.basescan.org',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    isTestnet: true,
  },
  // Mainnets
  1: {
    chainId: 1,
    name: 'Ethereum',
    shortName: 'Ethereum',
    rpcUrl: import.meta.env.VITE_ETHEREUM_RPC_URL || '',
    blockExplorer: 'https://etherscan.io',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    isTestnet: false,
  },
  8453: {
    chainId: 8453,
    name: 'Base',
    shortName: 'Base',
    rpcUrl: import.meta.env.VITE_BASE_RPC_URL || '',
    blockExplorer: 'https://basescan.org',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    isTestnet: false,
  },
};

// Add Canton configs if chain IDs are set
const cantonTestnetChainId = import.meta.env.VITE_CANTON_TESTNET_CHAIN_ID;
if (cantonTestnetChainId) {
  CHAIN_CONFIGS[parseInt(cantonTestnetChainId)] = {
    chainId: parseInt(cantonTestnetChainId),
    name: 'Canton Testnet',
    shortName: 'Canton Testnet',
    rpcUrl: import.meta.env.VITE_CANTON_TESTNET_RPC_URL || '',
    blockExplorer: import.meta.env.VITE_CANTON_TESTNET_EXPLORER || '',
    nativeCurrency: {
      name: 'Canton Coin',
      symbol: 'CC',
      decimals: 18,
    },
    isTestnet: true,
  };
}

const cantonMainnetChainId = import.meta.env.VITE_CANTON_MAINNET_CHAIN_ID;
if (cantonMainnetChainId) {
  CHAIN_CONFIGS[parseInt(cantonMainnetChainId)] = {
    chainId: parseInt(cantonMainnetChainId),
    name: 'Canton Network',
    shortName: 'Canton',
    rpcUrl: import.meta.env.VITE_CANTON_RPC_URL || '',
    blockExplorer: import.meta.env.VITE_CANTON_EXPLORER || '',
    nativeCurrency: {
      name: 'Canton Coin',
      symbol: 'CC',
      decimals: 18,
    },
    isTestnet: false,
  };
}

/**
 * Get chain configuration
 */
export function getChainConfig(chainId: number): ChainConfig | undefined {
  return CHAIN_CONFIGS[chainId];
}

/**
 * Get all supported chain IDs
 */
export function getSupportedChainIds(): number[] {
  return Object.keys(CHAIN_CONFIGS).map(Number);
}

/**
 * Check if a chain is supported
 */
export function isChainSupported(chainId: number): boolean {
  return chainId in CHAIN_CONFIGS;
}

/**
 * Get chains with deployed contracts
 */
export function getDeployedChains(): ChainConfig[] {
  return Object.values(CHAIN_CONFIGS).filter((config) =>
    areContractsDeployed(config.chainId)
  );
}

/**
 * Get testnet chains
 */
export function getTestnetChains(): ChainConfig[] {
  return Object.values(CHAIN_CONFIGS).filter((config) => config.isTestnet);
}

/**
 * Get mainnet chains
 */
export function getMainnetChains(): ChainConfig[] {
  return Object.values(CHAIN_CONFIGS).filter((config) => !config.isTestnet);
}

export default {
  CHAIN_CONFIGS,
  getChainConfig,
  getSupportedChainIds,
  isChainSupported,
  getDeployedChains,
  getTestnetChains,
  getMainnetChains,
  getContractAddresses,
  areContractsDeployed,
};
