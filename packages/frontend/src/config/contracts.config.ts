export interface ContractAddresses {
  PropertyToken: string;
  PropertyCrowdfund: string;
  ChainRegistry: string;
}

export const CONTRACT_ADDRESSES: { [chainId: number]: ContractAddresses } = {
  1: {
    PropertyToken: '0x24e580A700C2cE6a324A32b8a9f4f0d20EC5b020',
    PropertyCrowdfund: '0x705ca8D85C32Cd4D6456bf59F0Ed2F5e358D8062',
    ChainRegistry: '0xD368b35D0beaCe446E6e174D420DB2E65F6b2fE0',
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
