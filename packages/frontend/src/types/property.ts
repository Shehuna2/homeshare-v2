export interface Property {
  id: string;
  name: string;
  description: string;
  location: string;
  imageUrl: string;
  totalValue: string;
  targetFunding: string;
  currentFunding: string;
  tokenSupply: string;
  tokenPrice: string;
  chainId: number;
  contractAddress: string;
  owner: string;
  isActive: boolean;
  fundingDeadline: number;
  expectedReturn: number;
  createdAt: number;
  updatedAt: number;
}

export interface PropertyFilter {
  chainId?: number;
  minValue?: string;
  maxValue?: string;
  isActive?: boolean;
  searchQuery?: string;
}
