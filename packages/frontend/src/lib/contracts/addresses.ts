/**
 * Contract Address Configuration for Frontend
 * Environment-based contract address management
 */

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;

export interface ContractAddresses {
  PropertyToken: string;
  PropertyCrowdfund: string;
  ChainRegistry: string;
}

// Sepolia Testnet (default for development)
const SEPOLIA_ADDRESSES: ContractAddresses = {
  PropertyToken: '0x24e580A700C2cE6a324A32b8a9f4f0d20EC5b020',
  PropertyCrowdfund: '0x705ca8D85C32Cd4D6456bf59F0Ed2F5e358D8062',
  ChainRegistry: '0xD368b35D0beaCe446E6e174D420DB2E65F6b2fE0',
};

// Base Sepolia Testnet
const BASE_SEPOLIA_ADDRESSES: ContractAddresses = {
  PropertyToken: import.meta.env.VITE_BASE_SEPOLIA_PROPERTY_TOKEN || ZERO_ADDRESS,
  PropertyCrowdfund: import.meta.env.VITE_BASE_SEPOLIA_PROPERTY_CROWDFUND || ZERO_ADDRESS,
  ChainRegistry: import.meta.env.VITE_BASE_SEPOLIA_CHAIN_REGISTRY || ZERO_ADDRESS,
};

// Canton Testnet
const CANTON_TESTNET_ADDRESSES: ContractAddresses = {
  PropertyToken: import.meta.env.VITE_CANTON_TESTNET_PROPERTY_TOKEN || ZERO_ADDRESS,
  PropertyCrowdfund: import.meta.env.VITE_CANTON_TESTNET_PROPERTY_CROWDFUND || ZERO_ADDRESS,
  ChainRegistry: import.meta.env.VITE_CANTON_TESTNET_CHAIN_REGISTRY || ZERO_ADDRESS,
};

// Ethereum Mainnet
const ETHEREUM_ADDRESSES: ContractAddresses = {
  PropertyToken: import.meta.env.VITE_ETHEREUM_PROPERTY_TOKEN || ZERO_ADDRESS,
  PropertyCrowdfund: import.meta.env.VITE_ETHEREUM_PROPERTY_CROWDFUND || ZERO_ADDRESS,
  ChainRegistry: import.meta.env.VITE_ETHEREUM_CHAIN_REGISTRY || ZERO_ADDRESS,
};

// Base Mainnet
const BASE_ADDRESSES: ContractAddresses = {
  PropertyToken: import.meta.env.VITE_BASE_PROPERTY_TOKEN || ZERO_ADDRESS,
  PropertyCrowdfund: import.meta.env.VITE_BASE_PROPERTY_CROWDFUND || ZERO_ADDRESS,
  ChainRegistry: import.meta.env.VITE_BASE_CHAIN_REGISTRY || ZERO_ADDRESS,
};

// Canton Mainnet
const CANTON_ADDRESSES: ContractAddresses = {
  PropertyToken: import.meta.env.VITE_CANTON_PROPERTY_TOKEN || ZERO_ADDRESS,
  PropertyCrowdfund: import.meta.env.VITE_CANTON_PROPERTY_CROWDFUND || ZERO_ADDRESS,
  ChainRegistry: import.meta.env.VITE_CANTON_CHAIN_REGISTRY || ZERO_ADDRESS,
};

/**
 * Contract addresses by chain ID
 */
export const CONTRACT_ADDRESSES: Record<number, ContractAddresses> = {
  // Testnets
  11155111: SEPOLIA_ADDRESSES, // Sepolia
  84532: BASE_SEPOLIA_ADDRESSES, // Base Sepolia
  // Mainnets
  1: ETHEREUM_ADDRESSES, // Ethereum
  8453: BASE_ADDRESSES, // Base
};

// Add Canton addresses if chain IDs are set
const cantonTestnetChainId = import.meta.env.VITE_CANTON_TESTNET_CHAIN_ID;
if (cantonTestnetChainId) {
  CONTRACT_ADDRESSES[parseInt(cantonTestnetChainId)] = CANTON_TESTNET_ADDRESSES;
}

const cantonMainnetChainId = import.meta.env.VITE_CANTON_MAINNET_CHAIN_ID;
if (cantonMainnetChainId) {
  CONTRACT_ADDRESSES[parseInt(cantonMainnetChainId)] = CANTON_ADDRESSES;
}

/**
 * Get contract addresses for a specific chain
 */
export function getContractAddresses(chainId: number): ContractAddresses | undefined {
  return CONTRACT_ADDRESSES[chainId];
}

/**
 * Get a specific contract address for a chain
 */
export function getContractAddress(
  chainId: number,
  contractName: keyof ContractAddresses
): string {
  const addresses = CONTRACT_ADDRESSES[chainId];
  if (!addresses) {
    console.warn(`No contract addresses found for chain ID: ${chainId}`);
    return ZERO_ADDRESS;
  }
  return addresses[contractName] || ZERO_ADDRESS;
}

/**
 * Check if contracts are deployed on a specific chain
 */
export function areContractsDeployed(chainId: number): boolean {
  const addresses = CONTRACT_ADDRESSES[chainId];
  if (!addresses) return false;
  
  return (
    addresses.PropertyToken !== ZERO_ADDRESS &&
    addresses.PropertyCrowdfund !== ZERO_ADDRESS &&
    addresses.ChainRegistry !== ZERO_ADDRESS
  );
}

export default {
  ZERO_ADDRESS,
  CONTRACT_ADDRESSES,
  getContractAddresses,
  getContractAddress,
  areContractsDeployed,
};
