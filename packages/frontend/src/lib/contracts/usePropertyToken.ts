/**
 * Wagmi Hook for PropertyToken Contract
 */

import { useContractRead, useContractWrite, usePrepareContractWrite, useWaitForTransaction } from 'wagmi';
import { PropertyTokenAbi } from './abi';
import { getContractAddress, ZERO_ADDRESS } from './addresses';

/**
 * Hook to read PropertyToken contract data
 */
export function usePropertyToken(chainId: number) {
  const address = getContractAddress(chainId, 'PropertyToken') as `0x${string}`;

  return {
    address,
    abi: PropertyTokenAbi,
  };
}

/**
 * Hook to get property token balance
 */
export function usePropertyTokenBalance(chainId: number, account: string | undefined) {
  const { address, abi } = usePropertyToken(chainId);

  return useContractRead({
    address,
    abi,
    functionName: 'balanceOf',
    args: account ? [account as `0x${string}`] : undefined,
    enabled: !!account && address !== ZERO_ADDRESS,
  });
}

/**
 * Hook to get property token metadata
 */
export function usePropertyTokenMetadata(chainId: number) {
  const { address, abi } = usePropertyToken(chainId);

  const { data: name } = useContractRead({
    address,
    abi,
    functionName: 'name',
    enabled: address !== ZERO_ADDRESS,
  });

  const { data: symbol } = useContractRead({
    address,
    abi,
    functionName: 'symbol',
    enabled: address !== ZERO_ADDRESS,
  });

  const { data: decimals } = useContractRead({
    address,
    abi,
    functionName: 'decimals',
    enabled: address !== ZERO_ADDRESS,
  });

  const { data: totalSupply } = useContractRead({
    address,
    abi,
    functionName: 'totalSupply',
    enabled: address !== ZERO_ADDRESS,
  });

  const { data: propertyId } = useContractRead({
    address,
    abi,
    functionName: 'propertyId',
    enabled: address !== ZERO_ADDRESS,
  });

  const { data: totalValue } = useContractRead({
    address,
    abi,
    functionName: 'totalValue',
    enabled: address !== ZERO_ADDRESS,
  });

  return {
    name,
    symbol,
    decimals,
    totalSupply,
    propertyId,
    totalValue,
  };
}

/**
 * Hook to transfer property tokens
 */
export function usePropertyTokenTransfer(chainId: number) {
  const { address, abi } = usePropertyToken(chainId);

  const { config } = usePrepareContractWrite({
    address,
    abi,
    functionName: 'transfer',
  });

  const { data, write, isLoading: isWriteLoading } = useContractWrite(config);

  const { isLoading: isTxLoading, isSuccess } = useWaitForTransaction({
    hash: data?.hash,
  });

  return {
    transfer: write,
    isLoading: isWriteLoading || isTxLoading,
    isSuccess,
    txHash: data?.hash,
  };
}

/**
 * Hook to approve property token spending
 */
export function usePropertyTokenApprove(chainId: number) {
  const { address, abi } = usePropertyToken(chainId);

  const { config } = usePrepareContractWrite({
    address,
    abi,
    functionName: 'approve',
  });

  const { data, write, isLoading: isWriteLoading } = useContractWrite(config);

  const { isLoading: isTxLoading, isSuccess } = useWaitForTransaction({
    hash: data?.hash,
  });

  return {
    approve: write,
    isLoading: isWriteLoading || isTxLoading,
    isSuccess,
    txHash: data?.hash,
  };
}

/**
 * Hook to get allowance
 */
export function usePropertyTokenAllowance(
  chainId: number,
  owner: string | undefined,
  spender: string | undefined
) {
  const { address, abi } = usePropertyToken(chainId);

  return useContractRead({
    address,
    abi,
    functionName: 'allowance',
    args: owner && spender ? [owner as `0x${string}`, spender as `0x${string}`] : undefined,
    enabled: !!owner && !!spender && address !== ZERO_ADDRESS,
  });
}

/**
 * Hook to check if user is owner
 */
export function usePropertyTokenOwner(chainId: number) {
  const { address, abi } = usePropertyToken(chainId);

  return useContractRead({
    address,
    abi,
    functionName: 'owner',
    enabled: address !== ZERO_ADDRESS,
  });
}
