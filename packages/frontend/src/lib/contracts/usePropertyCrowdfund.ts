/**
 * Wagmi Hook for PropertyCrowdfund Contract
 */

import { useContractRead, useContractWrite, usePrepareContractWrite, useWaitForTransaction } from 'wagmi';
import { PropertyCrowdfundAbi } from './abi';
import { getContractAddress } from './addresses';

/**
 * Hook to get PropertyCrowdfund contract instance
 */
export function usePropertyCrowdfund(chainId: number) {
  const address = getContractAddress(chainId, 'PropertyCrowdfund') as `0x${string}`;

  return {
    address,
    abi: PropertyCrowdfundAbi,
  };
}

/**
 * Hook to get campaign count
 */
export function useCampaignCount(chainId: number) {
  const { address, abi } = usePropertyCrowdfund(chainId);

  return useContractRead({
    address,
    abi,
    functionName: 'campaignCount',
    enabled: address !== '0x0000000000000000000000000000000000000000',
  });
}

/**
 * Hook to get campaign details
 */
export function useCampaign(chainId: number, campaignId: number | undefined) {
  const { address, abi } = usePropertyCrowdfund(chainId);

  return useContractRead({
    address,
    abi,
    functionName: 'campaigns',
    args: campaignId !== undefined ? [BigInt(campaignId)] : undefined,
    enabled: campaignId !== undefined && address !== '0x0000000000000000000000000000000000000000',
  });
}

/**
 * Hook to get campaign accepted tokens
 */
export function useCampaignTokens(chainId: number, campaignId: number | undefined) {
  const { address, abi } = usePropertyCrowdfund(chainId);

  return useContractRead({
    address,
    abi,
    functionName: 'getCampaignTokens',
    args: campaignId !== undefined ? [BigInt(campaignId)] : undefined,
    enabled: campaignId !== undefined && address !== '0x0000000000000000000000000000000000000000',
  });
}

/**
 * Hook to get user investment in a campaign
 */
export function useInvestment(
  chainId: number,
  campaignId: number | undefined,
  investor: string | undefined
) {
  const { address, abi } = usePropertyCrowdfund(chainId);

  return useContractRead({
    address,
    abi,
    functionName: 'investments',
    args:
      campaignId !== undefined && investor
        ? [BigInt(campaignId), investor as `0x${string}`]
        : undefined,
    enabled:
      campaignId !== undefined &&
      !!investor &&
      address !== '0x0000000000000000000000000000000000000000',
  });
}

/**
 * Hook to create a campaign
 */
export function useCreateCampaign(chainId: number) {
  const { address, abi } = usePropertyCrowdfund(chainId);

  const { config } = usePrepareContractWrite({
    address,
    abi,
    functionName: 'createCampaign',
  });

  const { data, write, isLoading: isWriteLoading } = useContractWrite(config);

  const { isLoading: isTxLoading, isSuccess } = useWaitForTransaction({
    hash: data?.hash,
  });

  return {
    createCampaign: write,
    isLoading: isWriteLoading || isTxLoading,
    isSuccess,
    txHash: data?.hash,
  };
}

/**
 * Hook to invest in a campaign
 */
export function useInvest(chainId: number) {
  const { address, abi } = usePropertyCrowdfund(chainId);

  const { config } = usePrepareContractWrite({
    address,
    abi,
    functionName: 'invest',
  });

  const { data, write, isLoading: isWriteLoading } = useContractWrite(config);

  const { isLoading: isTxLoading, isSuccess } = useWaitForTransaction({
    hash: data?.hash,
  });

  return {
    invest: write,
    isLoading: isWriteLoading || isTxLoading,
    isSuccess,
    txHash: data?.hash,
  };
}

/**
 * Hook to finalize a campaign
 */
export function useFinalizeCampaign(chainId: number) {
  const { address, abi } = usePropertyCrowdfund(chainId);

  const { config } = usePrepareContractWrite({
    address,
    abi,
    functionName: 'finalizeCampaign',
  });

  const { data, write, isLoading: isWriteLoading } = useContractWrite(config);

  const { isLoading: isTxLoading, isSuccess } = useWaitForTransaction({
    hash: data?.hash,
  });

  return {
    finalizeCampaign: write,
    isLoading: isWriteLoading || isTxLoading,
    isSuccess,
    txHash: data?.hash,
  };
}

/**
 * Hook to check if user is owner
 */
export function usePropertyCrowdfundOwner(chainId: number) {
  const { address, abi } = usePropertyCrowdfund(chainId);

  return useContractRead({
    address,
    abi,
    functionName: 'owner',
    enabled: address !== '0x0000000000000000000000000000000000000000',
  });
}
