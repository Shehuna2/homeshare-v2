/**
 * Contract Service for Backend
 * Utilities for interacting with smart contracts using ethers.js
 */

import { ethers } from 'ethers';
import { getNetworkConfig, getContractConfig, NetworkConfig } from '../config/contracts';

/**
 * Contract Service Class
 */
export class ContractService {
  private providers: Map<string, ethers.JsonRpcProvider>;
  private contracts: Map<string, ethers.Contract>;

  constructor() {
    this.providers = new Map();
    this.contracts = new Map();
  }

  /**
   * Get or create a provider for a network
   */
  getProvider(network: string): ethers.JsonRpcProvider {
    if (this.providers.has(network)) {
      return this.providers.get(network)!;
    }

    const networkConfig = getNetworkConfig(network);
    if (!networkConfig) {
      throw new Error(`Network configuration not found for: ${network}`);
    }

    if (!networkConfig.rpcUrl) {
      throw new Error(`RPC URL not configured for network: ${network}`);
    }

    const provider = new ethers.JsonRpcProvider(networkConfig.rpcUrl);
    this.providers.set(network, provider);
    return provider;
  }

  /**
   * Get or create a contract instance
   */
  getContract(
    network: string,
    contractName: 'PropertyToken' | 'PropertyCrowdfund' | 'ChainRegistry'
  ): ethers.Contract {
    const key = `${network}-${contractName}`;
    
    if (this.contracts.has(key)) {
      return this.contracts.get(key)!;
    }

    const contractConfig = getContractConfig(network, contractName);
    if (!contractConfig) {
      throw new Error(`Contract configuration not found for: ${contractName} on ${network}`);
    }

    const provider = this.getProvider(network);
    const contract = new ethers.Contract(contractConfig.address, contractConfig.abi, provider);
    
    this.contracts.set(key, contract);
    return contract;
  }

  /**
   * Get PropertyToken contract
   */
  getPropertyToken(network: string): ethers.Contract {
    return this.getContract(network, 'PropertyToken');
  }

  /**
   * Get PropertyCrowdfund contract
   */
  getPropertyCrowdfund(network: string): ethers.Contract {
    return this.getContract(network, 'PropertyCrowdfund');
  }

  /**
   * Get ChainRegistry contract
   */
  getChainRegistry(network: string): ethers.Contract {
    return this.getContract(network, 'ChainRegistry');
  }

  /**
   * Query PropertyToken balance
   */
  async getPropertyTokenBalance(network: string, address: string): Promise<bigint> {
    const contract = this.getPropertyToken(network);
    return await contract.balanceOf(address);
  }

  /**
   * Query PropertyToken metadata
   */
  async getPropertyTokenMetadata(network: string): Promise<{
    name: string;
    symbol: string;
    decimals: bigint;
    totalSupply: bigint;
    propertyId: string;
    totalValue: bigint;
  }> {
    const contract = this.getPropertyToken(network);
    
    const [name, symbol, decimals, totalSupply, propertyId, totalValue] = await Promise.all([
      contract.name(),
      contract.symbol(),
      contract.decimals(),
      contract.totalSupply(),
      contract.propertyId(),
      contract.totalValue(),
    ]);

    return { name, symbol, decimals, totalSupply, propertyId, totalValue };
  }

  /**
   * Query campaign details
   */
  async getCampaign(network: string, campaignId: number): Promise<{
    propertyToken: string;
    fundingGoal: bigint;
    currentFunding: bigint;
    deadline: bigint;
    isActive: boolean;
  }> {
    const contract = this.getPropertyCrowdfund(network);
    const campaign = await contract.campaigns(campaignId);
    
    return {
      propertyToken: campaign.propertyToken,
      fundingGoal: campaign.fundingGoal,
      currentFunding: campaign.currentFunding,
      deadline: campaign.deadline,
      isActive: campaign.isActive,
    };
  }

  /**
   * Query campaign count
   */
  async getCampaignCount(network: string): Promise<bigint> {
    const contract = this.getPropertyCrowdfund(network);
    return await contract.campaignCount();
  }

  /**
   * Query investment amount
   */
  async getInvestment(network: string, campaignId: number, investor: string): Promise<bigint> {
    const contract = this.getPropertyCrowdfund(network);
    return await contract.investments(campaignId, investor);
  }

  /**
   * Query accepted tokens for a campaign
   */
  async getCampaignTokens(network: string, campaignId: number): Promise<string[]> {
    const contract = this.getPropertyCrowdfund(network);
    return await contract.getCampaignTokens(campaignId);
  }

  /**
   * Query supported chains from ChainRegistry
   */
  async getSupportedChains(network: string): Promise<bigint[]> {
    const contract = this.getChainRegistry(network);
    return await contract.getSupportedChains();
  }

  /**
   * Check if chain is supported
   */
  async isChainSupported(network: string, chainId: number): Promise<boolean> {
    const contract = this.getChainRegistry(network);
    return await contract.isChainSupported(chainId);
  }

  /**
   * Check if token is supported
   */
  async isTokenSupported(network: string, chainId: number, tokenAddress: string): Promise<boolean> {
    const contract = this.getChainRegistry(network);
    return await contract.isTokenSupported(chainId, tokenAddress);
  }

  /**
   * Listen to contract events
   */
  listenToEvents(
    network: string,
    contractName: 'PropertyToken' | 'PropertyCrowdfund' | 'ChainRegistry',
    eventName: string,
    callback: (...args: any[]) => void
  ): void {
    const contract = this.getContract(network, contractName);
    contract.on(eventName, callback);
  }

  /**
   * Query past events
   */
  async queryPastEvents(
    network: string,
    contractName: 'PropertyToken' | 'PropertyCrowdfund' | 'ChainRegistry',
    eventName: string,
    fromBlock: number | string = 'earliest',
    toBlock: number | string = 'latest'
  ): Promise<ethers.EventLog[]> {
    const contract = this.getContract(network, contractName);
    const filter = contract.filters[eventName]();
    const events = await contract.queryFilter(filter, fromBlock, toBlock);
    return events as ethers.EventLog[];
  }

  /**
   * Get current block number
   */
  async getCurrentBlockNumber(network: string): Promise<number> {
    const provider = this.getProvider(network);
    return await provider.getBlockNumber();
  }

  /**
   * Get transaction receipt
   */
  async getTransactionReceipt(network: string, txHash: string): Promise<ethers.TransactionReceipt | null> {
    const provider = this.getProvider(network);
    return await provider.getTransactionReceipt(txHash);
  }

  /**
   * Format value from wei to human-readable format
   */
  formatValue(value: bigint, decimals: number = 18): string {
    return ethers.formatUnits(value, decimals);
  }

  /**
   * Parse value from human-readable to wei
   */
  parseValue(value: string, decimals: number = 18): bigint {
    return ethers.parseUnits(value, decimals);
  }
}

// Export singleton instance
export const contractService = new ContractService();

export default contractService;
