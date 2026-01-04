export interface ContractAddresses {
  PropertyToken: string;
  PropertyCrowdfund: string;
  ChainRegistry: string;
}

export const CONTRACT_ADDRESSES: { [chainId: number]: ContractAddresses } = {
  1: {
    PropertyToken: '0x0000000000000000000000000000000000000000', // To be deployed
    PropertyCrowdfund: '0x0000000000000000000000000000000000000000',
    ChainRegistry: '0x0000000000000000000000000000000000000000',
  },
  8453: {
    PropertyToken: '0x0000000000000000000000000000000000000000',
    PropertyCrowdfund: '0x0000000000000000000000000000000000000000',
    ChainRegistry: '0x0000000000000000000000000000000000000000',
  },
  9000: {
    PropertyToken: '0x0000000000000000000000000000000000000000',
    PropertyCrowdfund: '0x0000000000000000000000000000000000000000',
    ChainRegistry: '0x0000000000000000000000000000000000000000',
  },
};

export const getContractAddress = (
  chainId: number,
  contractName: keyof ContractAddresses
): string => {
  return CONTRACT_ADDRESSES[chainId]?.[contractName] || '';
};
