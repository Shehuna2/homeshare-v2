import { Chain, ChainConfig } from '../types/chain';

export const ETHEREUM_MAINNET: Chain = {
  id: 1,
  name: 'Ethereum',
  rpcUrl: 'https://eth-mainnet.g.alchemy.com/v2/your-api-key',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  blockExplorer: 'https://etherscan.io',
  isTestnet: false,
};

export const BASE_MAINNET: Chain = {
  id: 8453,
  name: 'Base',
  rpcUrl: 'https://base-mainnet.g.alchemy.com/v2/your-api-key',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  blockExplorer: 'https://basescan.org',
  isTestnet: false,
};

export const CANTON_NETWORK: Chain = {
  id: 9000,
  name: 'Canton',
  rpcUrl: import.meta.env.VITE_CANTON_RPC_URL || 'https://canton-rpc-placeholder.com', // Replace with actual RPC URL
  nativeCurrency: {
    name: 'Canton Coin',
    symbol: 'CC',
    decimals: 18,
  },
  blockExplorer: import.meta.env.VITE_CANTON_EXPLORER_URL || 'https://canton-explorer-placeholder.com', // Replace with actual explorer URL
  isTestnet: false,
};

export const SUPPORTED_CHAINS: ChainConfig = {
  1: ETHEREUM_MAINNET,
  8453: BASE_MAINNET,
  9000: CANTON_NETWORK,
};

export const DEFAULT_CHAIN_ID = 1;
