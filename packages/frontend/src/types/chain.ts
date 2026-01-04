export type ChainId = 1 | 8453 | 9000; // Ethereum, Base, Canton

export interface Chain {
  id: ChainId;
  name: string;
  rpcUrl: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  blockExplorer: string;
  isTestnet: boolean;
}

export interface ChainConfig {
  [chainId: number]: Chain;
}
