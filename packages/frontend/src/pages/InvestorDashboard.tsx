import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BrowserProvider, Contract, concat, dataLength, toBeHex, toUtf8Bytes } from 'ethers';
import {
  getAuthNonce,
  loginWithWallet,
  fetchMyEquityClaims,
  fetchMyInvestments,
  fetchMyProfitClaims,
  fetchMyProfitStatus,
  fetchProperties,
  InvestmentResponse,
  EquityClaimResponse,
  ProfitClaimResponse,
  InvestorProfitStatusResponse,
  PropertyResponse,
} from '../lib/api';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store';
import { clearUser, setUser } from '../store/slices/userSlice';
import { useAccount } from 'wagmi';
import { signInWithBaseAccount } from '../lib/baseAccount';
import { emitPortfolioActivity, subscribePortfolioActivity } from '../lib/portfolioActivity';
import { env } from '../config/env';

const PROFIT_DISTRIBUTOR_ABI = ['function claim() external'];
const BASE_SEPOLIA_CHAIN_ID_HEX = '0x14A34';
const ERC8021_SUFFIX = '0x80218021802180218021802180218021';

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

const toHexUtf8 = (value: string): `0x${string}` => {
  const bytes = new TextEncoder().encode(value);
  const hex = Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return `0x${hex}`;
};

const buildInvestorMessage = (address: string, nonce: string, chainId: number): string =>
  [
    'Homeshare wants you to sign in with your wallet.',
    `Address: ${address}`,
    `Chain ID: ${chainId}`,
    `Nonce: ${nonce}`,
    `Issued At: ${new Date().toISOString()}`,
  ].join('\n');

const getInjectedProvider = (): EthereumProvider | null => {
  const injected = (window as Window & { ethereum?: EthereumProvider }).ethereum;
  return injected && typeof injected.request === 'function' ? injected : null;
};

const toBuilderDataSuffix = (codes: string[]): string | null => {
  if (codes.length === 0) {
    return null;
  }
  const codesHex = `0x${Array.from(toUtf8Bytes(codes.join(',')))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')}`;
  const codesLengthHex = toBeHex(dataLength(codesHex), 1);
  const schemaIdHex = toBeHex(0, 1);
  return concat([codesHex, codesLengthHex, schemaIdHex, ERC8021_SUFFIX]);
};

const getScenarioSellUsdc = (
  property: PropertyResponse | undefined,
  scenario: 'conservative' | 'base' | 'optimistic'
): number | null => {
  if (!property) return null;
  const target = Number(property.targetUsdcBaseUnits) / 1_000_000;
  const fallback = property.estimatedSellUsdcBaseUnits
    ? Number(property.estimatedSellUsdcBaseUnits) / 1_000_000
    : target;

  if (scenario === 'conservative') {
    if (property.conservativeSellUsdcBaseUnits) {
      return Number(property.conservativeSellUsdcBaseUnits) / 1_000_000;
    }
    return (fallback * (property.conservativeMultiplierBps ?? 8500)) / 10000;
  }
  if (scenario === 'base') {
    if (property.baseSellUsdcBaseUnits) {
      return Number(property.baseSellUsdcBaseUnits) / 1_000_000;
    }
    return (fallback * (property.baseMultiplierBps ?? 10000)) / 10000;
  }
  if (property.optimisticSellUsdcBaseUnits) {
    return Number(property.optimisticSellUsdcBaseUnits) / 1_000_000;
  }
  return (fallback * (property.optimisticMultiplierBps ?? 12500)) / 10000;
};

export default function InvestorDashboard() {
  const dispatch = useDispatch();
  const { token, isAuthenticated } = useSelector((state: RootState) => state.user);
  const { address, role } = useSelector((state: RootState) => state.user);
  const { address: connectedWalletAddress, isConnected } = useAccount();
  const [investments, setInvestments] = useState<InvestmentResponse[]>([]);
  const [equityClaims, setEquityClaims] = useState<EquityClaimResponse[]>([]);
  const [profitClaims, setProfitClaims] = useState<ProfitClaimResponse[]>([]);
  const [profitStatuses, setProfitStatuses] = useState<InvestorProfitStatusResponse[]>([]);
  const [propertiesById, setPropertiesById] = useState<Record<string, PropertyResponse>>({});
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [claimingPropertyId, setClaimingPropertyId] = useState<string | null>(null);
  const [claimSuccessTxHash, setClaimSuccessTxHash] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isSigningWithBase, setIsSigningWithBase] = useState(false);
  const [showAllInvestments, setShowAllInvestments] = useState(false);
  const [showAllPayoutStatuses, setShowAllPayoutStatuses] = useState(false);
  const [showAllEquityClaims, setShowAllEquityClaims] = useState(false);
  const [showAllProfitClaims, setShowAllProfitClaims] = useState(false);
  const lastAutoAuthAddressRef = useRef<string | null>(null);
  const hasMatchingConnectedWallet =
    !!connectedWalletAddress &&
    !!address &&
    connectedWalletAddress.toLowerCase() === address.toLowerCase();
  const canFetchInvestorData = isAuthenticated && !!token && hasMatchingConnectedWallet;
  const isClaimingProfit = claimingPropertyId !== null;
  const builderDataSuffix = useMemo(() => toBuilderDataSuffix(env.BASE_BUILDER_CODES), []);

  const loadPortfolio = useCallback(async () => {
    if (!canFetchInvestorData || !token) {
      setInvestments([]);
      setEquityClaims([]);
      setProfitClaims([]);
      setProfitStatuses([]);
      setPropertiesById({});
      setErrorMessage('');
      setLoading(false);
      return;
    }

    try {
      const [investmentsData, equityData, profitData, profitStatusData, propertiesData] = await Promise.all([
        fetchMyInvestments(token),
        fetchMyEquityClaims(token),
        fetchMyProfitClaims(token),
        fetchMyProfitStatus(token),
        fetchProperties(),
      ]);
      setInvestments(investmentsData);
      setEquityClaims(equityData);
      setProfitClaims(profitData);
      setProfitStatuses(profitStatusData);
      setPropertiesById(
        propertiesData.reduce<Record<string, PropertyResponse>>((acc, property) => {
          acc[property.propertyId] = property;
          return acc;
        }, {})
      );
      setErrorMessage('');
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setLoading(false);
    }
  }, [canFetchInvestorData, token]);

  const ensureBaseSepolia = async (provider: EthereumProvider) => {
    try {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: BASE_SEPOLIA_CHAIN_ID_HEX }],
      });
    } catch (switchError) {
      const message = switchError instanceof Error ? switchError.message : String(switchError);
      if (!message.includes('4902')) {
        throw switchError;
      }
      await provider.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: BASE_SEPOLIA_CHAIN_ID_HEX,
            chainName: 'Base Sepolia',
            nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
            rpcUrls: ['https://sepolia.base.org'],
            blockExplorerUrls: ['https://sepolia.basescan.org'],
          },
        ],
      });
    }
  };

  const handleClaimProfit = async (status: InvestorProfitStatusResponse) => {
    setErrorMessage('');
    setClaimSuccessTxHash(null);
    setStatusMessage('Submitting profit claim...');
    setClaimingPropertyId(status.propertyId);
    try {
      const injected = getInjectedProvider();
      if (!injected) {
        throw new Error('Wallet provider not found');
      }
      await ensureBaseSepolia(injected);
      await injected.request({ method: 'eth_requestAccounts' });
      const provider = new BrowserProvider(injected as never);
      const signer = await provider.getSigner();
      const distributor = new Contract(status.profitDistributorAddress, PROFIT_DISTRIBUTOR_ABI, signer);
      const txData = distributor.interface.encodeFunctionData('claim', []);
      const data = builderDataSuffix ? concat([txData, builderDataSuffix]) : txData;
      const tx = await signer.sendTransaction({
        to: status.profitDistributorAddress,
        data,
      });
      await tx.wait();
      emitPortfolioActivity({
        txHash: tx.hash,
        propertyId: status.propertyId,
        type: 'claim-profit',
      });
      setStatusMessage(`Profit claim confirmed: ${tx.hash}`);
      setClaimSuccessTxHash(tx.hash);
      await loadPortfolio();
    } catch (error) {
      setClaimSuccessTxHash(null);
      setErrorMessage(error instanceof Error ? error.message : 'Profit claim failed');
      setStatusMessage('');
    } finally {
      setClaimingPropertyId(null);
    }
  };

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      await loadPortfolio();
      if (!isMounted) {
        return;
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [loadPortfolio]);

  useEffect(() => {
    if (!canFetchInvestorData) {
      return;
    }
    const timer = setInterval(() => {
      void loadPortfolio();
    }, 15000);
    return () => clearInterval(timer);
  }, [canFetchInvestorData, loadPortfolio]);

  useEffect(() => {
    if (!canFetchInvestorData) {
      return;
    }
    const unsubscribe = subscribePortfolioActivity(() => {
      if (!canFetchInvestorData) {
        return;
      }
      void loadPortfolio();
      setStatusMessage('Portfolio refreshed after recent onchain activity.');
    });
    return unsubscribe;
  }, [canFetchInvestorData, loadPortfolio]);

  const authenticateInvestor = async () => {
    setErrorMessage('');
    setClaimSuccessTxHash(null);
    setStatusMessage('Authenticating investor session...');
    setIsAuthenticating(true);
    try {
      const normalizedAddress = connectedWalletAddress?.toLowerCase();
      if (!normalizedAddress) {
        throw new Error('Connect a wallet before authentication.');
      }
      const injected = getInjectedProvider();
      if (!injected) {
        throw new Error('Wallet provider not found for investor authentication.');
      }
      const { nonce } = await getAuthNonce();
      const message = buildInvestorMessage(normalizedAddress, nonce, 84532);
      const signature = (await injected.request({
        method: 'personal_sign',
        params: [toHexUtf8(message), normalizedAddress],
      })) as string;

      const response = await loginWithWallet({
        address: normalizedAddress,
        signature,
        message,
        role: 'investor',
      });
      dispatch(
        setUser({
          address: response.user.address,
          role: response.user.role,
          token: response.token,
        })
      );
      setStatusMessage(`Authenticated as ${response.user.role}.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Investor authentication failed');
      setStatusMessage('');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const authenticateWithBase = async () => {
    setErrorMessage('');
    setClaimSuccessTxHash(null);
    setStatusMessage('Opening Sign in with Base...');
    setIsSigningWithBase(true);
    try {
      const { nonce } = await getAuthNonce();
      const result = await signInWithBaseAccount({ nonce, chainId: 84532 });
      const response = await loginWithWallet({
        address: result.address,
        signature: result.signature,
        message: result.message,
        role: 'investor',
      });
      dispatch(
        setUser({
          address: response.user.address,
          role: response.user.role,
          token: response.token,
        })
      );
      setStatusMessage(`Authenticated as ${response.user.role}.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Sign in with Base failed');
      setStatusMessage('');
    } finally {
      setIsSigningWithBase(false);
    }
  };

  const logoutInvestor = () => {
    dispatch(clearUser());
    setClaimSuccessTxHash(null);
    setStatusMessage('Logged out.');
    setErrorMessage('');
  };

  useEffect(() => {
    const normalizedConnectedAddress = connectedWalletAddress?.toLowerCase() || '';
    if (!isConnected || !normalizedConnectedAddress) {
      lastAutoAuthAddressRef.current = null;
      return;
    }
    if (canFetchInvestorData || isAuthenticating || isSigningWithBase) {
      return;
    }
    if (lastAutoAuthAddressRef.current === normalizedConnectedAddress) {
      return;
    }
    lastAutoAuthAddressRef.current = normalizedConnectedAddress;
    void authenticateInvestor().catch(() => {
      lastAutoAuthAddressRef.current = null;
    });
  }, [canFetchInvestorData, connectedWalletAddress, isAuthenticating, isConnected, isSigningWithBase]);

  const summary = useMemo(() => {
    const totalInvested = investments.reduce(
      (sum, investment) => sum + Number(investment.usdcAmountBaseUnits) / 1_000_000,
      0
    );
    const activeProperties = new Set(investments.map((investment) => investment.propertyId)).size;
    const totalReturns = investments.reduce((sum, investment) => {
      const invested = Number(investment.usdcAmountBaseUnits) / 1_000_000;
      const property = propertiesById[investment.propertyId];
      const target = property ? Number(property.targetUsdcBaseUnits) / 1_000_000 : 0;
      const baseSell = getScenarioSellUsdc(property, 'base');
      if (!baseSell || target <= 0) {
        return sum;
      }
      const projectedExit = (invested / target) * baseSell;
      return sum + (projectedExit - invested);
    }, 0);
    const byChain = investments.reduce<Record<string, number>>((acc, investment) => {
      const chain = 'Base Sepolia';
      const amount = Number(investment.usdcAmountBaseUnits) / 1_000_000;
      acc[chain] = (acc[chain] ?? 0) + amount;
      return acc;
    }, {});

    return { totalInvested, activeProperties, totalReturns, byChain };
  }, [investments, propertiesById]);

  const basescanTxUrl = (txHash: string) => `https://sepolia.basescan.org/tx/${txHash}`;
  const shortTx = (txHash: string) => `${txHash.slice(0, 10)}...${txHash.slice(-8)}`;
  const visibleInvestments = showAllInvestments ? investments : investments.slice(0, 2);
  const visibleProfitStatuses = showAllPayoutStatuses ? profitStatuses : profitStatuses.slice(0, 2);
  const visibleEquityClaims = showAllEquityClaims ? equityClaims : equityClaims.slice(0, 2);
  const visibleProfitClaims = showAllProfitClaims ? profitClaims : profitClaims.slice(0, 2);

  return (
    <div className="bg-gradient-to-br from-slate-50 via-white to-slate-100 py-10 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="container mx-auto px-4">
      <div className="mb-8 rounded-2xl border border-white/70 bg-white/85 p-6 shadow-xl shadow-slate-200/40 backdrop-blur dark:border-white/10 dark:bg-slate-900/70 dark:shadow-black/40">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
          Investor Dashboard
        </h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">
          Track investments, payout readiness, and claims in one place.
        </p>
      </div>

      {loading && (
        <div className="text-slate-600 dark:text-slate-300">Loading investments...</div>
      )}

      {!loading && !canFetchInvestorData && (
        <div className="mb-6 rounded-xl bg-blue-50 px-4 py-3 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
          Connect a wallet and authenticate as investor to view your onchain portfolio.
        </div>
      )}

      <div className="mb-6 rounded-2xl border border-white/70 bg-white/85 px-4 py-4 shadow-lg shadow-slate-200/30 backdrop-blur dark:border-white/10 dark:bg-slate-900/65 dark:shadow-black/30">
        <div className="flex flex-wrap items-center gap-3">
          <button
            className="rounded-xl bg-primary-600 px-4 py-2 text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => void authenticateInvestor()}
            disabled={!isConnected || isAuthenticating || isSigningWithBase}
          >
            {isAuthenticating ? 'Authenticating...' : 'Authenticate Investor'}
          </button>
          <button
            className="rounded-xl border border-primary-600 px-4 py-2 text-primary-700 dark:text-primary-300 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => void authenticateWithBase()}
            disabled={isAuthenticating || isSigningWithBase}
          >
            {isSigningWithBase ? 'Signing...' : 'Sign in with Base'}
          </button>
          {(isAuthenticated || token) && (
            <button
              className="rounded-xl border border-slate-300 px-4 py-2 text-slate-700 dark:border-slate-600 dark:text-slate-200"
              onClick={logoutInvestor}
            >
              Log out
            </button>
          )}
          {canFetchInvestorData && (
            <button
              className="rounded-xl border border-slate-300 px-4 py-2 text-slate-700 dark:border-slate-600 dark:text-slate-200"
              onClick={() => void loadPortfolio()}
            >
              Refresh Portfolio
            </button>
          )}
        </div>
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          Wallet: {connectedWalletAddress ? `${connectedWalletAddress.slice(0, 6)}...${connectedWalletAddress.slice(-4)}` : 'Not connected'}{' '}
          | Session: {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Not authenticated'} {role ? `(${role})` : ''}
        </p>
      </div>

      {statusMessage && (
        <div className="mb-6 rounded-xl bg-green-50 px-4 py-3 text-green-700 dark:bg-green-900/40 dark:text-green-200">
          <div>{statusMessage}</div>
          {claimSuccessTxHash && (
            <a
              href={basescanTxUrl(claimSuccessTxHash)}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block text-sm underline"
            >
              View transaction on BaseScan
            </a>
          )}
        </div>
      )}

      {errorMessage && (
        <div className="mb-6 rounded-xl bg-red-50 px-4 py-3 text-red-700 dark:bg-red-900/40 dark:text-red-200">
          {errorMessage}
        </div>
      )}

      {!loading && !errorMessage && investments.length === 0 && (
        <div className="mb-6 text-slate-600 dark:text-slate-300">No investments yet.</div>
      )}

      {/* Summary Cards */}
      <div className="mb-8 grid gap-6 md:grid-cols-3">
        <div className="rounded-2xl border border-white/70 bg-white/85 p-6 shadow-lg shadow-slate-200/30 dark:border-white/10 dark:bg-slate-900/65 dark:shadow-black/30">
          <h3 className="mb-2 text-sm text-slate-500 dark:text-slate-400">Total Invested</h3>
          <p className="text-3xl font-semibold text-slate-900 dark:text-white">
            ${summary.totalInvested.toLocaleString()}
          </p>
        </div>
        <div className="rounded-2xl border border-white/70 bg-white/85 p-6 shadow-lg shadow-slate-200/30 dark:border-white/10 dark:bg-slate-900/65 dark:shadow-black/30">
          <h3 className="mb-2 text-sm text-slate-500 dark:text-slate-400">Active Properties</h3>
          <p className="text-3xl font-semibold text-slate-900 dark:text-white">{summary.activeProperties}</p>
        </div>
        <div className="rounded-2xl border border-white/70 bg-white/85 p-6 shadow-lg shadow-slate-200/30 dark:border-white/10 dark:bg-slate-900/65 dark:shadow-black/30">
          <h3 className="mb-2 text-sm text-slate-500 dark:text-slate-400">Total Returns</h3>
          <p className="text-3xl font-semibold text-slate-900 dark:text-white">
            ${summary.totalReturns.toLocaleString()}
          </p>
        </div>
      </div>

      {/* By Chain */}
      <div className="mb-8 rounded-2xl border border-white/70 bg-white/85 p-6 shadow-xl shadow-slate-200/35 dark:border-white/10 dark:bg-slate-900/70 dark:shadow-black/35">
        <h2 className="mb-4 text-xl font-semibold text-slate-900 dark:text-white">Investments by Chain</h2>
        <div className="space-y-4">
          {Object.keys(summary.byChain).length === 0 && (
            <p className="text-gray-500 dark:text-gray-400">No chain data yet.</p>
          )}
          {Object.entries(summary.byChain).map(([chain, amount]) => (
            <div key={chain} className="flex justify-between items-center">
              <span className="text-gray-900 dark:text-white">{chain}</span>
              <span className="text-gray-900 dark:text-white">${amount.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Investment History */}
      <div className="rounded-2xl border border-white/70 bg-white/85 p-6 shadow-xl shadow-slate-200/35 dark:border-white/10 dark:bg-slate-900/70 dark:shadow-black/35">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Investment History</h2>
          {investments.length > 2 && (
            <button
              className="rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-600"
              onClick={() => setShowAllInvestments((prev) => !prev)}
            >
              {showAllInvestments ? 'Show latest 2' : `View all (${investments.length})`}
            </button>
          )}
        </div>
        {investments.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">No investments yet</p>
        ) : (
          <div className="space-y-4">
            {visibleInvestments.map((investment) => (
              <div
                key={`${investment.txHash}:${investment.logIndex}`}
                className="flex flex-col gap-2 border-b border-gray-200 pb-4 last:border-b-0 dark:border-gray-700"
              >
                <div className="flex justify-between">
                  <span className="text-gray-900 dark:text-white">Property ID</span>
                  <span className="text-gray-600 dark:text-gray-300">{investment.propertyId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-900 dark:text-white">Amount</span>
                  <span className="text-gray-600 dark:text-gray-300">
                    ${(Number(investment.usdcAmountBaseUnits) / 1_000_000).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-900 dark:text-white">Chain</span>
                  <span className="text-gray-600 dark:text-gray-300">Base Sepolia</span>
                </div>
                {(() => {
                  const property = propertiesById[investment.propertyId];
                  const target = property ? Number(property.targetUsdcBaseUnits) / 1_000_000 : 0;
                  const invested = Number(investment.usdcAmountBaseUnits) / 1_000_000;
                  const conservative = getScenarioSellUsdc(property, 'conservative');
                  const base = getScenarioSellUsdc(property, 'base');
                  const optimistic = getScenarioSellUsdc(property, 'optimistic');
                  if (!property || target <= 0 || !conservative || !base || !optimistic) {
                    return null;
                  }
                  const conservativeProfit = (invested / target) * conservative - invested;
                  const baseProfit = (invested / target) * base - invested;
                  const optimisticProfit = (invested / target) * optimistic - invested;
                  return (
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Projected P/L: C $
                      {conservativeProfit.toLocaleString(undefined, { maximumFractionDigits: 2 })} | B $
                      {baseProfit.toLocaleString(undefined, { maximumFractionDigits: 2 })} | O $
                      {optimisticProfit.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </div>
                  );
                })()}
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {new Date(investment.createdAt).toLocaleString()}
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <Link
                    to={`/properties/${investment.propertyId}`}
                    className="text-primary-600 hover:underline dark:text-primary-300"
                  >
                    Open property
                  </Link>
                  <a
                    href={basescanTxUrl(investment.txHash)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary-600 hover:underline dark:text-primary-300"
                  >
                    Tx {shortTx(investment.txHash)}
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mb-8 rounded-2xl border border-white/70 bg-white/85 p-6 shadow-xl shadow-slate-200/35 dark:border-white/10 dark:bg-slate-900/70 dark:shadow-black/35">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Payout Status By Property</h2>
          {profitStatuses.length > 2 && (
            <button
              className="rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-600"
              onClick={() => setShowAllPayoutStatuses((prev) => !prev)}
            >
              {showAllPayoutStatuses ? 'Show latest 2' : `View all (${profitStatuses.length})`}
            </button>
          )}
        </div>
        {!canFetchInvestorData ? (
          <p className="text-gray-500 dark:text-gray-400">
            Connect and authenticate as investor to view payout status.
          </p>
        ) : profitStatuses.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">No payout status yet.</p>
        ) : (
          <div className="space-y-3">
            {visibleProfitStatuses.map((status) => {
              const claimableBaseUnits = BigInt(status.claimableBaseUnits ?? '0');
              const unclaimedPoolBaseUnits = BigInt(status.unclaimedPoolBaseUnits);
              const claimable = Number(claimableBaseUnits) / 1_000_000;
              const unclaimedPool = Number(unclaimedPoolBaseUnits) / 1_000_000;
              const canClaim = claimableBaseUnits > 0n;
              const zeroClaimableReason = status.claimableError
                ? `Claimable status unavailable right now (${status.claimableError}). This is usually indexer/RPC lag.`
                : !status.lastDepositAt
                  ? 'No profit deposit has been indexed for this property yet.'
                  : unclaimedPoolBaseUnits === 0n
                    ? 'No unclaimed pool is available right now.'
                    : 'Pool exists, but your claimable amount is currently 0 (already claimed or indexer catching up).';
              return (
                <div
                  key={`${status.propertyId}:${status.profitDistributorAddress}`}
                  className="rounded border border-gray-200 p-3 dark:border-gray-700"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-medium text-gray-900 dark:text-white">{status.propertyId}</div>
                    <Link
                      to={`/properties/${status.propertyId}`}
                      className="text-xs text-primary-600 hover:underline dark:text-primary-300"
                    >
                      Open property
                    </Link>
                  </div>
                  <div className="mt-2 grid gap-2 text-sm md:grid-cols-3">
                    <div className="text-gray-600 dark:text-gray-300">
                      Last deposit:{' '}
                      {status.lastDepositAt ? new Date(status.lastDepositAt).toLocaleString() : 'None'}
                    </div>
                    <div className="text-gray-600 dark:text-gray-300">
                      Unclaimed pool: ${unclaimedPool.toLocaleString()}
                    </div>
                    <div className="text-gray-600 dark:text-gray-300">
                      Your claimable: ${claimable.toLocaleString()}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <button
                      className="rounded bg-primary-600 px-3 py-1 text-sm text-white hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed"
                      onClick={() => void handleClaimProfit(status)}
                      disabled={!canClaim || isClaimingProfit || !canFetchInvestorData}
                    >
                      {claimingPropertyId === status.propertyId ? 'Claiming...' : 'Claim Profit'}
                    </button>
                    {!canClaim && (
                      <span className="text-xs text-amber-600 dark:text-amber-300">
                        {zeroClaimableReason}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mb-8 rounded-2xl border border-white/70 bg-white/85 p-6 shadow-xl shadow-slate-200/35 dark:border-white/10 dark:bg-slate-900/70 dark:shadow-black/35">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Equity Claim History</h2>
          {equityClaims.length > 2 && (
            <button
              className="rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-600"
              onClick={() => setShowAllEquityClaims((prev) => !prev)}
            >
              {showAllEquityClaims ? 'Show latest 2' : `View all (${equityClaims.length})`}
            </button>
          )}
        </div>
        {equityClaims.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">No equity claims yet.</p>
        ) : (
          <div className="space-y-4">
            {visibleEquityClaims.map((claim) => (
              <div
                key={`${claim.txHash}:${claim.logIndex}`}
                className="flex flex-col gap-2 border-b border-gray-200 pb-4 last:border-b-0 dark:border-gray-700"
              >
                <div className="flex justify-between">
                  <span className="text-gray-900 dark:text-white">Property ID</span>
                  <span className="text-gray-600 dark:text-gray-300">{claim.propertyId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-900 dark:text-white">Equity Amount</span>
                  <span className="text-gray-600 dark:text-gray-300">{claim.equityAmountBaseUnits}</span>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {new Date(claim.createdAt).toLocaleString()}
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <Link
                    to={`/properties/${claim.propertyId}`}
                    className="text-primary-600 hover:underline dark:text-primary-300"
                  >
                    Open property
                  </Link>
                  <a
                    href={basescanTxUrl(claim.txHash)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary-600 hover:underline dark:text-primary-300"
                  >
                    Tx {shortTx(claim.txHash)}
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-white/70 bg-white/85 p-6 shadow-xl shadow-slate-200/35 dark:border-white/10 dark:bg-slate-900/70 dark:shadow-black/35">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Profit Claim History</h2>
          {profitClaims.length > 2 && (
            <button
              className="rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-600"
              onClick={() => setShowAllProfitClaims((prev) => !prev)}
            >
              {showAllProfitClaims ? 'Show latest 2' : `View all (${profitClaims.length})`}
            </button>
          )}
        </div>
        {profitClaims.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">No profit claims yet.</p>
        ) : (
          <div className="space-y-4">
            {visibleProfitClaims.map((claim) => (
              <div
                key={`${claim.txHash}:${claim.logIndex}`}
                className="flex flex-col gap-2 border-b border-gray-200 pb-4 last:border-b-0 dark:border-gray-700"
              >
                <div className="flex justify-between">
                  <span className="text-gray-900 dark:text-white">Property ID</span>
                  <span className="text-gray-600 dark:text-gray-300">{claim.propertyId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-900 dark:text-white">USDC Claimed</span>
                  <span className="text-gray-600 dark:text-gray-300">
                    ${(Number(claim.usdcAmountBaseUnits) / 1_000_000).toLocaleString()}
                  </span>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {new Date(claim.createdAt).toLocaleString()}
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <Link
                    to={`/properties/${claim.propertyId}`}
                    className="text-primary-600 hover:underline dark:text-primary-300"
                  >
                    Open property
                  </Link>
                  <a
                    href={basescanTxUrl(claim.txHash)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary-600 hover:underline dark:text-primary-300"
                  >
                    Tx {shortTx(claim.txHash)}
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
