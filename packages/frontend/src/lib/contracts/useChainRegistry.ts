/**
 * Wagmi Hook for ChainRegistry Contract
 */

import { useContractRead, useContractWrite, usePrepareContractWrite, useWaitForTransaction } from 'wagmi';
import { ChainRegistryAbi } from './abi';
import { getContractAddress, ZERO_ADDRESS } from './addresses';

/**
 * Hook to get ChainRegistry contract instance
 */
export function useChainRegistry(chainId: number) {
  const address = getContractAddress(chainId, 'ChainRegistry') as `0x${string}`;

  return {
    address,
    abi: ChainRegistryAbi,
  };
}

/**
 * Hook to get supported chains
 */
export function useSupportedChains(chainId: number) {
  const { address, abi } = useChainRegistry(chainId);

  return useContractRead({
    address,
    abi,
    functionName: 'getSupportedChains',
    enabled: address !== ZERO_ADDRESS,
  });
}

/**
 * Hook to check if a chain is supported
 */
export function useIsChainSupported(chainId: number, targetChainId: number | undefined) {
  const { address, abi } = useChainRegistry(chainId);

  return useContractRead({
    address,
    abi,
    functionName: 'isChainSupported',
    args: targetChainId !== undefined ? [BigInt(targetChainId)] : undefined,
    enabled: targetChainId !== undefined && address !== ZERO_ADDRESS,
  });
}

/**
 * Hook to get chain info
 */
export function useChainInfo(chainId: number, targetChainId: number | undefined) {
  const { address, abi } = useChainRegistry(chainId);

  return useContractRead({
    address,
    abi,
    functionName: 'chains',
    args: targetChainId !== undefined ? [BigInt(targetChainId)] : undefined,
    enabled: targetChainId !== undefined && address !== ZERO_ADDRESS,
  });
}

/**
 * Hook to check if a token is supported
 */
export function useIsTokenSupported(
  chainId: number,
  targetChainId: number | undefined,
  tokenAddress: string | undefined
) {
  const { address, abi } = useChainRegistry(chainId);

  return useContractRead({
    address,
    abi,
    functionName: 'isTokenSupported',
    args:
      targetChainId !== undefined && tokenAddress
        ? [BigInt(targetChainId), tokenAddress as `0x${string}`]
        : undefined,
    enabled:
      targetChainId !== undefined &&
      !!tokenAddress &&
      address !== ZERO_ADDRESS,
  });
}

/**
 * Hook to add a chain (owner only)
 */
export function useAddChain(chainId: number) {
  const { address, abi } = useChainRegistry(chainId);

  const { config } = usePrepareContractWrite({
    address,
    abi,
    functionName: 'addChain',
  });

  const { data, write, isLoading: isWriteLoading } = useContractWrite(config);

  const { isLoading: isTxLoading, isSuccess } = useWaitForTransaction({
    hash: data?.hash,
  });

  return {
    addChain: write,
    isLoading: isWriteLoading || isTxLoading,
    isSuccess,
    txHash: data?.hash,
  };
}

/**
 * Hook to remove a chain (owner only)
 */
export function useRemoveChain(chainId: number) {
  const { address, abi } = useChainRegistry(chainId);

  const { config } = usePrepareContractWrite({
    address,
    abi,
    functionName: 'removeChain',
  });

  const { data, write, isLoading: isWriteLoading } = useContractWrite(config);

  const { isLoading: isTxLoading, isSuccess } = useWaitForTransaction({
    hash: data?.hash,
  });

  return {
    removeChain: write,
    isLoading: isWriteLoading || isTxLoading,
    isSuccess,
    txHash: data?.hash,
  };
}

/**
 * Hook to add a token (owner only)
 */
export function useAddToken(chainId: number) {
  const { address, abi } = useChainRegistry(chainId);

  const { config } = usePrepareContractWrite({
    address,
    abi,
    functionName: 'addToken',
  });

  const { data, write, isLoading: isWriteLoading } = useContractWrite(config);

  const { isLoading: isTxLoading, isSuccess } = useWaitForTransaction({
    hash: data?.hash,
  });

  return {
    addToken: write,
    isLoading: isWriteLoading || isTxLoading,
    isSuccess,
    txHash: data?.hash,
  };
}

/**
 * Hook to remove a token (owner only)
 */
export function useRemoveToken(chainId: number) {
  const { address, abi } = useChainRegistry(chainId);

  const { config } = usePrepareContractWrite({
    address,
    abi,
    functionName: 'removeToken',
  });

  const { data, write, isLoading: isWriteLoading } = useContractWrite(config);

  const { isLoading: isTxLoading, isSuccess } = useWaitForTransaction({
    hash: data?.hash,
  });

  return {
    removeToken: write,
    isLoading: isWriteLoading || isTxLoading,
    isSuccess,
    txHash: data?.hash,
  };
}

/**
 * Hook to check if user is owner
 */
export function useChainRegistryOwner(chainId: number) {
  const { address, abi } = useChainRegistry(chainId);

  return useContractRead({
    address,
    abi,
    functionName: 'owner',
    enabled: address !== ZERO_ADDRESS,
  });
}
