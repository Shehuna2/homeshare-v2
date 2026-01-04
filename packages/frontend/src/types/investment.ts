export interface Investment {
  id: string;
  propertyId: string;
  investor: string;
  amount: string;
  tokenAmount: string;
  tokenAddress: string;
  chainId: number;
  timestamp: number;
  txHash: string;
}

export interface InvestmentSummary {
  totalInvested: string;
  totalProperties: number;
  totalReturns: string;
  byChain: {
    [chainId: number]: {
      invested: string;
      properties: number;
    };
  };
}
