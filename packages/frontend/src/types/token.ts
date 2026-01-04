export interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoUrl?: string;
  chainId: number;
}

export interface TokenBalance {
  token: Token;
  balance: string;
  balanceFormatted: string;
}

export interface TokenPrice {
  token: Token;
  priceUSD: number;
  timestamp: number;
}
