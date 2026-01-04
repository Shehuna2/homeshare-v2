/**
 * Contract Configuration for Backend
 * Contract addresses and ABIs for blockchain integration
 */

import PropertyTokenAbi from '../../../contracts/abi/PropertyToken.json' with { type: 'json' };
import PropertyCrowdfundAbi from '../../../contracts/abi/PropertyCrowdfund.json' with { type: 'json' };
import ChainRegistryAbi from '../../../contracts/abi/ChainRegistry.json' with { type: 'json' };

export interface ContractConfig {
  address: string;
  abi: any[];
  deploymentBlock?: number;
}

export interface NetworkConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  blockExplorer: string;
  contracts: {
    PropertyToken: ContractConfig;
    PropertyCrowdfund: ContractConfig;
    ChainRegistry: ContractConfig;
  };
}

/**
 * Get contract addresses from environment variables
 */
function getContractAddresses(network: string) {
  const prefix = network.toUpperCase().replace(/-/g, '_');
  
  return {
    PropertyToken: process.env[`${prefix}_PROPERTY_TOKEN`] || '0x0000000000000000000000000000000000000000',
    PropertyCrowdfund: process.env[`${prefix}_PROPERTY_CROWDFUND`] || '0x0000000000000000000000000000000000000000',
    ChainRegistry: process.env[`${prefix}_CHAIN_REGISTRY`] || '0x0000000000000000000000000000000000000000',
  };
}

/**
 * Network configurations
 */
export const NETWORKS: Record<string, NetworkConfig> = {
  // Testnets
  sepolia: {
    chainId: 11155111,
    name: 'Ethereum Sepolia',
    rpcUrl: process.env.ETHEREUM_SEPOLIA_RPC_URL || '',
    blockExplorer: 'https://sepolia.etherscan.io',
    contracts: {
      PropertyToken: {
        address: '0x24e580A700C2cE6a324A32b8a9f4f0d20EC5b020',
        abi: PropertyTokenAbi,
        deploymentBlock: 9979967,
      },
      PropertyCrowdfund: {
        address: '0x705ca8D85C32Cd4D6456bf59F0Ed2F5e358D8062',
        abi: PropertyCrowdfundAbi,
        deploymentBlock: 9979967,
      },
      ChainRegistry: {
        address: '0xD368b35D0beaCe446E6e174D420DB2E65F6b2fE0',
        abi: ChainRegistryAbi,
        deploymentBlock: 9979967,
      },
    },
  },
  'base-sepolia': {
    chainId: 84532,
    name: 'Base Sepolia',
    rpcUrl: process.env.BASE_SEPOLIA_RPC_URL || '',
    blockExplorer: 'https://sepolia.basescan.org',
    contracts: {
      PropertyToken: {
        address: getContractAddresses('base-sepolia').PropertyToken,
        abi: PropertyTokenAbi,
      },
      PropertyCrowdfund: {
        address: getContractAddresses('base-sepolia').PropertyCrowdfund,
        abi: PropertyCrowdfundAbi,
      },
      ChainRegistry: {
        address: getContractAddresses('base-sepolia').ChainRegistry,
        abi: ChainRegistryAbi,
      },
    },
  },
  'canton-testnet': {
    chainId: parseInt(process.env.CANTON_TESTNET_CHAIN_ID || '0'),
    name: 'Canton Testnet',
    rpcUrl: process.env.CANTON_TESTNET_RPC_URL || '',
    blockExplorer: process.env.CANTON_TESTNET_EXPLORER_URL || '',
    contracts: {
      PropertyToken: {
        address: getContractAddresses('canton-testnet').PropertyToken,
        abi: PropertyTokenAbi,
      },
      PropertyCrowdfund: {
        address: getContractAddresses('canton-testnet').PropertyCrowdfund,
        abi: PropertyCrowdfundAbi,
      },
      ChainRegistry: {
        address: getContractAddresses('canton-testnet').ChainRegistry,
        abi: ChainRegistryAbi,
      },
    },
  },
  // Mainnets
  ethereum: {
    chainId: 1,
    name: 'Ethereum',
    rpcUrl: process.env.ETHEREUM_MAINNET_RPC_URL || '',
    blockExplorer: 'https://etherscan.io',
    contracts: {
      PropertyToken: {
        address: getContractAddresses('ethereum').PropertyToken,
        abi: PropertyTokenAbi,
      },
      PropertyCrowdfund: {
        address: getContractAddresses('ethereum').PropertyCrowdfund,
        abi: PropertyCrowdfundAbi,
      },
      ChainRegistry: {
        address: getContractAddresses('ethereum').ChainRegistry,
        abi: ChainRegistryAbi,
      },
    },
  },
  base: {
    chainId: 8453,
    name: 'Base',
    rpcUrl: process.env.BASE_MAINNET_RPC_URL || '',
    blockExplorer: 'https://basescan.org',
    contracts: {
      PropertyToken: {
        address: getContractAddresses('base').PropertyToken,
        abi: PropertyTokenAbi,
      },
      PropertyCrowdfund: {
        address: getContractAddresses('base').PropertyCrowdfund,
        abi: PropertyCrowdfundAbi,
      },
      ChainRegistry: {
        address: getContractAddresses('base').ChainRegistry,
        abi: ChainRegistryAbi,
      },
    },
  },
  canton: {
    chainId: parseInt(process.env.CANTON_MAINNET_CHAIN_ID || '0'),
    name: 'Canton',
    rpcUrl: process.env.CANTON_MAINNET_RPC_URL || '',
    blockExplorer: process.env.CANTON_MAINNET_EXPLORER_URL || '',
    contracts: {
      PropertyToken: {
        address: getContractAddresses('canton').PropertyToken,
        abi: PropertyTokenAbi,
      },
      PropertyCrowdfund: {
        address: getContractAddresses('canton').PropertyCrowdfund,
        abi: PropertyCrowdfundAbi,
      },
      ChainRegistry: {
        address: getContractAddresses('canton').ChainRegistry,
        abi: ChainRegistryAbi,
      },
    },
  },
};

/**
 * Get network configuration by name
 */
export function getNetworkConfig(network: string): NetworkConfig | undefined {
  return NETWORKS[network];
}

/**
 * Get network configuration by chain ID
 */
export function getNetworkConfigByChainId(chainId: number): NetworkConfig | undefined {
  return Object.values(NETWORKS).find((config) => config.chainId === chainId);
}

/**
 * Get contract configuration
 */
export function getContractConfig(
  network: string,
  contractName: 'PropertyToken' | 'PropertyCrowdfund' | 'ChainRegistry'
): ContractConfig | undefined {
  return NETWORKS[network]?.contracts[contractName];
}

export default {
  NETWORKS,
  getNetworkConfig,
  getNetworkConfigByChainId,
  getContractConfig,
};
