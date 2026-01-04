import { Token } from '../types/token';

// Ethereum tokens
export const ETHEREUM_USDC: Token = {
  address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  symbol: 'USDC',
  name: 'USD Coin',
  decimals: 6,
  chainId: 1,
};

export const ETHEREUM_USDT: Token = {
  address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  symbol: 'USDT',
  name: 'Tether USD',
  decimals: 6,
  chainId: 1,
};

export const ETHEREUM_ETH: Token = {
  address: '0x0000000000000000000000000000000000000000',
  symbol: 'ETH',
  name: 'Ether',
  decimals: 18,
  chainId: 1,
};

// Base tokens
export const BASE_USDC: Token = {
  address: '0x833589fCD6eDb6E08f4c7C32D4f71b1566469c3d',
  symbol: 'USDC',
  name: 'USD Coin',
  decimals: 6,
  chainId: 8453,
};

export const BASE_USDT: Token = {
  address: '0xfde4C96c8593536E31F26E3DaA6eFB41D12d2588',
  symbol: 'USDT',
  name: 'Tether USD',
  decimals: 6,
  chainId: 8453,
};

export const BASE_ETH: Token = {
  address: '0x0000000000000000000000000000000000000000',
  symbol: 'ETH',
  name: 'Ether',
  decimals: 18,
  chainId: 8453,
};

export const BASE_RIZE: Token = {
  address: '0x0000000000000000000000000000000000000000', // TODO: Replace with actual RIZE token address
  symbol: 'RIZE',
  name: 'Rize Token',
  decimals: 18,
  chainId: 8453,
};

// Canton tokens
export const CANTON_CC: Token = {
  address: '0x0000000000000000000000000000000000000000',
  symbol: 'CC',
  name: 'Canton Coin',
  decimals: 18,
  chainId: 9000,
};

export const TOKENS_BY_CHAIN: { [chainId: number]: Token[] } = {
  1: [ETHEREUM_USDC, ETHEREUM_USDT, ETHEREUM_ETH],
  8453: [BASE_USDC, BASE_USDT, BASE_ETH, BASE_RIZE],
  9000: [CANTON_CC],
};

export const getAllTokens = (): Token[] => {
  return Object.values(TOKENS_BY_CHAIN).flat();
};

export const getTokensByChain = (chainId: number): Token[] => {
  return TOKENS_BY_CHAIN[chainId] || [];
};
