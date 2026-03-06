import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  BrowserProvider,
  Contract,
  JsonRpcProvider,
  concat,
  dataLength,
  formatUnits,
  parseUnits,
  toBeHex,
  toUtf8Bytes,
} from 'ethers';
import {
  fetchCampaign,
  fetchCampaignInvestments,
  EthUsdcQuoteResponse,
  fetchEthUsdcQuote,
  fetchPropertyEquityClaims,
  fetchPropertyProfitClaims,
  fetchProperty,
  CampaignResponse,
  EquityClaimResponse,
  ProfitClaimResponse,
  PropertyResponse,
} from '../lib/api';
import { BASE_SEPOLIA_USDC } from '../config/tokens.config';
import { useAccount } from 'wagmi';
import { env } from '../config/env';
import { emitPortfolioActivity } from '../lib/portfolioActivity';

// Inline SVG Icons
const ChevronLeft = ({ className }: { className: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);

const TrendingUp = ({ className }: { className: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
  </svg>
);

const AlertIcon = ({ className }: { className: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4v2m0-12a9 9 0 110 18 9 9 0 010-18z" />
  </svg>
);

const CROWDFUND_ABI = [
  'function invest(uint256 amountUSDC) external',
  'function claimTokens() external',
  'function claimableTokens(address user) view returns (uint256)',
  'function claimRefund() external',
  'function usdcToken() view returns (address)',
];

const ERC20_ABI = [
  'function approve(address spender, uint256 value) external returns (bool)',
  'function balanceOf(address account) external view returns (uint256)',
  'function allowance(address owner, address spender) external view returns (uint256)',
];

const PROFIT_DISTRIBUTOR_ABI = [
  'function claim() external',
  'function claimable(address user) view returns (uint256)',
];

const WETH_ABI = [
  'function deposit() payable',
  'function approve(address spender, uint256 value) external returns (bool)',
];

const SWAP_ROUTER_ABI = [
  'function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountOut)',
  'function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 deadline,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountOut)',
];

const BASE_SEPOLIA_CHAIN_ID_HEX = '0x14A34';
const CAMPAIGN_ACTIVE_STATE = 'ACTIVE';
const CAMPAIGN_FAILED_STATE = 'FAILED';
const ERC8021_SUFFIX = '0x80218021802180218021802180218021';
const PENDING_CLAIMS_STORAGE_KEY = 'homeshare.pendingClaims';
type CampaignPhase = 'NOT_STARTED' | 'ACTIVE' | 'FAILED' | 'ENDED' | 'UNKNOWN';

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

type PendingClaim = {
  txHash: string;
  propertyId: string;
  type: 'claim-profit' | 'claim-equity';
  createdAt: string;
};

const getEthereumProvider = (): EthereumProvider | null => {
  const provider = (window as Window & { ethereum?: EthereumProvider }).ethereum;
  return provider ?? null;
};

const toUsd = (baseUnits: string): string =>
  (Number(baseUnits) / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 });

const formatUsdcUnits = (amountBaseUnits: bigint): string =>
  Number(formatUnits(amountBaseUnits, 6)).toLocaleString(undefined, {
    maximumFractionDigits: 6,
  });

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

export default function PropertyDetail() {
  const { id } = useParams<{ id: string }>();
  const { address: connectedAddress, isConnected } = useAccount();
  const [property, setProperty] = useState<PropertyResponse | null>(null);
  const [campaign, setCampaign] = useState<CampaignResponse | null>(null);
  const [crowdfundUsdcAddress, setCrowdfundUsdcAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [amountUsdc, setAmountUsdc] = useState('');
  const [amountEth, setAmountEth] = useState('');
  const [quotedUsdcOutBaseUnits, setQuotedUsdcOutBaseUnits] = useState<bigint | null>(null);
  const [quoteError, setQuoteError] = useState('');
  const [isQuotingEth, setIsQuotingEth] = useState(false);
  const [ethQuote, setEthQuote] = useState<EthUsdcQuoteResponse | null>(null);
  const [slippagePercent, setSlippagePercent] = useState('1');
  const [investAsset, setInvestAsset] = useState<'USDC' | 'ETH'>('USDC');
  const [txStatus, setTxStatus] = useState('');
  const [txError, setTxError] = useState('');
  const [isInvesting, setIsInvesting] = useState(false);
  const [isClaimingEquity, setIsClaimingEquity] = useState(false);
  const [isClaimingProfit, setIsClaimingProfit] = useState(false);
  const [isClaimingRefund, setIsClaimingRefund] = useState(false);
  const [claimableProfitBaseUnits, setClaimableProfitBaseUnits] = useState<bigint | null>(null);
  const [claimableEquityBaseUnits, setClaimableEquityBaseUnits] = useState<bigint | null>(null);
  const [claimableEquityError, setClaimableEquityError] = useState('');
  const [myInvestedBaseUnits, setMyInvestedBaseUnits] = useState<bigint>(0n);
  const [nowMs, setNowMs] = useState(Date.now());
  const [selectedGalleryImage, setSelectedGalleryImage] = useState<string | null>(null);
  const [pendingClaims, setPendingClaims] = useState<PendingClaim[]>([]);
  const [propertyEquityClaims, setPropertyEquityClaims] = useState<EquityClaimResponse[]>([]);
  const [propertyProfitClaims, setPropertyProfitClaims] = useState<ProfitClaimResponse[]>([]);
  const [claimRefreshNonce, setClaimRefreshNonce] = useState(0);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(PENDING_CLAIMS_STORAGE_KEY);
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw) as PendingClaim[];
      if (Array.isArray(parsed)) {
        setPendingClaims(
          parsed.filter(
            (item) =>
              typeof item?.txHash === 'string' &&
              typeof item?.propertyId === 'string' &&
              (item?.type === 'claim-profit' || item?.type === 'claim-equity')
          )
        );
      }
    } catch {
      setPendingClaims([]);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(PENDING_CLAIMS_STORAGE_KEY, JSON.stringify(pendingClaims));
    } catch {
      // Ignore storage write failures.
    }
  }, [pendingClaims]);

  useEffect(() => {
    let isMounted = true;

    const loadProperty = async () => {
      if (!id) {
        if (isMounted) {
          setErrorMessage('Missing property id.');
          setLoading(false);
        }
        return;
      }

      try {
        const data = await fetchProperty(id);
        if (isMounted) {
          setProperty(data);
        }
        try {
          const campaignData = await fetchCampaign(data.crowdfundAddress);
          if (isMounted) {
            setCampaign(campaignData);
          }
        } catch (_campaignError) {
          if (isMounted) {
            setCampaign(null);
          }
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage((error as Error).message);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadProperty();
    return () => {
      isMounted = false;
    };
  }, [id]);

  const normalizedAmount = useMemo(() => Number(amountUsdc), [amountUsdc]);
  const effectiveUsdcAddress = crowdfundUsdcAddress || BASE_SEPOLIA_USDC.address;
  const campaignState = campaign?.state ?? 'UNKNOWN';
  const campaignStartMs = campaign?.startTime ? Date.parse(campaign.startTime) : null;
  const hasCampaignStarted = campaignStartMs === null || Number.isNaN(campaignStartMs) || nowMs >= campaignStartMs;
  const campaignPhase: CampaignPhase = useMemo(() => {
    if (!campaign) return 'UNKNOWN';
    if (campaignState === CAMPAIGN_FAILED_STATE) return 'FAILED';
    if (!hasCampaignStarted) return 'NOT_STARTED';
    if (campaignState === CAMPAIGN_ACTIVE_STATE) return 'ACTIVE';
    return 'ENDED';
  }, [campaign, campaignState, hasCampaignStarted]);
  const campaignTargetBaseUnits = useMemo(
    () => BigInt(campaign?.targetUsdcBaseUnits ?? property?.targetUsdcBaseUnits ?? '0'),
    [campaign?.targetUsdcBaseUnits, property?.targetUsdcBaseUnits]
  );
  const campaignRaisedBaseUnits = useMemo(
    () => BigInt(campaign?.raisedUsdcBaseUnits ?? '0'),
    [campaign?.raisedUsdcBaseUnits]
  );
  const isTargetReached = useMemo(
    () => campaignTargetBaseUnits > 0n && campaignRaisedBaseUnits >= campaignTargetBaseUnits,
    [campaignRaisedBaseUnits, campaignTargetBaseUnits]
  );
  const fundingProgressPercent = useMemo(() => {
    if (campaignTargetBaseUnits <= 0n) return 0;
    const progress = Number((campaignRaisedBaseUnits * 10_000n) / campaignTargetBaseUnits) / 100;
    return Math.min(100, Math.max(0, progress));
  }, [campaignRaisedBaseUnits, campaignTargetBaseUnits]);
  const canInvest = (campaignPhase === 'ACTIVE' || campaignPhase === 'UNKNOWN') && !isTargetReached;
  const canClaimRefund = campaignPhase === 'FAILED';
  const canSwapEthOnBaseSepolia = Boolean(env.BASE_SEPOLIA_SWAP_ROUTER);
  const walletAvailable = getEthereumProvider() !== null;
  const txInFlight = isInvesting || isClaimingEquity || isClaimingProfit || isClaimingRefund;
  const canClaimProfit = claimableProfitBaseUnits !== null && claimableProfitBaseUnits > 0n;
  const canClaimEquity = claimableEquityBaseUnits !== null && claimableEquityBaseUnits > 0n;
  const hasInvestmentInConnectedWallet = myInvestedBaseUnits > 0n;
  const isCampaignClaimPhase = campaignState === 'SUCCESS' || campaignState === 'WITHDRAWN';
  const equityTokenMissing = claimableEquityError
    .toLowerCase()
    .includes('equity token is not configured');
  const canAttemptEquityClaim =
    hasInvestmentInConnectedWallet &&
    isCampaignClaimPhase &&
    !equityTokenMissing &&
    (canClaimEquity || claimableEquityBaseUnits === null);
  const shouldClaimEquityFirst =
    hasInvestmentInConnectedWallet &&
    (canClaimEquity || canAttemptEquityClaim) &&
    claimableProfitBaseUnits !== null &&
    claimableProfitBaseUnits <= 0n;
  const claimProfitUnavailableMessage = !hasInvestmentInConnectedWallet
    ? 'This connected wallet has no investment in this property.'
    : shouldClaimEquityFirst
      ? 'Claim equity first, then profit becomes claimable.'
    : claimableProfitBaseUnits === null
      ? 'Unable to read claimable profit right now.'
      : 'No claimable profit yet.';
  const claimEquityUnavailableMessage = claimableEquityError
    ? claimableEquityError
    : !hasInvestmentInConnectedWallet
      ? 'This connected wallet has no investment in this property.'
    : !isCampaignClaimPhase
      ? 'Campaign must be finalized before equity can be claimed.'
    : claimableEquityBaseUnits === null
      ? 'Unable to read claimable equity right now. You can still try claiming.'
      : 'No claimable equity yet.';
  const claimSequence = {
    walletReady: walletAvailable,
    hasInvestment: hasInvestmentInConnectedWallet,
    campaignReady: isCampaignClaimPhase,
    equityReady: canClaimEquity || canAttemptEquityClaim,
    profitReady: canClaimProfit,
  };
  const normalizedEthAmount = useMemo(() => Number(amountEth), [amountEth]);
  const normalizedSlippagePercent = useMemo(() => Number(slippagePercent), [slippagePercent]);
  const swapFeeCandidates = useMemo(() => {
    const candidates = [env.BASE_SEPOLIA_SWAP_POOL_FEE, 500, 3000, 10000];
    return Array.from(
      new Set(candidates.filter((value) => Number.isInteger(value) && value > 0))
    );
  }, []);
  const slippageBps = useMemo(() => {
    if (!Number.isFinite(normalizedSlippagePercent)) {
      return 100;
    }
    const clamped = Math.min(Math.max(normalizedSlippagePercent, 0), 50);
    return Math.round(clamped * 100);
  }, [normalizedSlippagePercent]);
  const minUsdcOutBaseUnits = useMemo(() => {
    if (ethQuote?.minUsdcOutBaseUnits) {
      const fromQuote = BigInt(ethQuote.minUsdcOutBaseUnits);
      if (fromQuote > 0n) {
        return fromQuote;
      }
    }
    if (!quotedUsdcOutBaseUnits || quotedUsdcOutBaseUnits <= 0n) {
      return null;
    }
    const minOut = (quotedUsdcOutBaseUnits * BigInt(10_000 - slippageBps)) / 10_000n;
    return minOut > 0n ? minOut : null;
  }, [ethQuote?.minUsdcOutBaseUnits, quotedUsdcOutBaseUnits, slippageBps]);
  const hasNoUsdcRoute =
    quoteError.includes('No usable ETH/USDC quote on Base Sepolia') ||
    quoteError.includes('No usable ETH/USDC quote');
  const builderDataSuffix = useMemo(() => toBuilderDataSuffix(env.BASE_BUILDER_CODES), []);
  const startCountdown = useMemo(() => {
    if (!campaignStartMs || Number.isNaN(campaignStartMs) || hasCampaignStarted) {
      return null;
    }
    const remainingMs = Math.max(0, campaignStartMs - nowMs);
    const totalSeconds = Math.floor(remainingMs / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
  }, [campaignStartMs, hasCampaignStarted, nowMs]);

  const positionSummary = useMemo(() => {
    const invested = Number(formatUnits(myInvestedBaseUnits, 6));
    const claimableProfit =
      claimableProfitBaseUnits !== null ? Number(formatUnits(claimableProfitBaseUnits, 6)) : null;
    return { invested, claimableProfit };
  }, [claimableProfitBaseUnits, myInvestedBaseUnits]);
  const targetRaiseUsdc = useMemo(
    () => Number(formatUnits(BigInt(property?.targetUsdcBaseUnits ?? '0'), 6)),
    [property?.targetUsdcBaseUnits]
  );
  const estimatedSellUsdc = useMemo(
    () =>
      property?.estimatedSellUsdcBaseUnits
        ? Number(formatUnits(BigInt(property.estimatedSellUsdcBaseUnits), 6))
        : null,
    [property?.estimatedSellUsdcBaseUnits]
  );
  const projectedRoiPercent = useMemo(() => {
    if (!estimatedSellUsdc || targetRaiseUsdc <= 0) return null;
    return ((estimatedSellUsdc - targetRaiseUsdc) / targetRaiseUsdc) * 100;
  }, [estimatedSellUsdc, targetRaiseUsdc]);
  const scenarioProjections = useMemo(() => {
    if (targetRaiseUsdc <= 0) {
      return null;
    }
    const fallbackBase = estimatedSellUsdc ?? targetRaiseUsdc;
    const resolveScenario = (
      fixedBaseUnits: string | null | undefined,
      multiplierBps: number | null | undefined,
      defaultMultiplierBps: number
    ) => {
      const fixed = fixedBaseUnits ? Number(formatUnits(BigInt(fixedBaseUnits), 6)) : null;
      if (fixed && Number.isFinite(fixed) && fixed > 0) {
        return fixed;
      }
      const multiplier = multiplierBps && multiplierBps > 0 ? multiplierBps : defaultMultiplierBps;
      return (fallbackBase * multiplier) / 10000;
    };

    const conservative = resolveScenario(
      property?.conservativeSellUsdcBaseUnits,
      property?.conservativeMultiplierBps,
      8500
    );
    const base = resolveScenario(
      property?.baseSellUsdcBaseUnits,
      property?.baseMultiplierBps,
      10000
    );
    const optimistic = resolveScenario(
      property?.optimisticSellUsdcBaseUnits,
      property?.optimisticMultiplierBps,
      12500
    );

    const toRoi = (value: number) => ((value - targetRaiseUsdc) / targetRaiseUsdc) * 100;
    const toMyExit = (value: number) =>
      positionSummary.invested > 0 ? (positionSummary.invested / targetRaiseUsdc) * value : null;

    return {
      conservative: {
        sell: conservative,
        roi: toRoi(conservative),
        myExit: toMyExit(conservative),
      },
      base: {
        sell: base,
        roi: toRoi(base),
        myExit: toMyExit(base),
      },
      optimistic: {
        sell: optimistic,
        roi: toRoi(optimistic),
        myExit: toMyExit(optimistic),
      },
    };
  }, [
    estimatedSellUsdc,
    property?.baseMultiplierBps,
    property?.baseSellUsdcBaseUnits,
    property?.conservativeMultiplierBps,
    property?.conservativeSellUsdcBaseUnits,
    property?.optimisticMultiplierBps,
    property?.optimisticSellUsdcBaseUnits,
    positionSummary.invested,
    targetRaiseUsdc,
  ]);
  const galleryImages = useMemo(() => {
    const merged = [property?.imageUrl, ...(property?.imageUrls ?? [])]
      .map((value) => value?.trim())
      .filter((value): value is string => Boolean(value));
    return Array.from(new Set(merged));
  }, [property?.imageUrl, property?.imageUrls]);
  const basescanTxUrl = (txHash: string) => `https://sepolia.basescan.org/tx/${txHash}`;
  const visiblePendingClaims = useMemo(
    () => pendingClaims.filter((item) => item.propertyId === property?.propertyId).slice(0, 4),
    [pendingClaims, property?.propertyId]
  );

  const addPendingClaim = (next: PendingClaim) => {
    setPendingClaims((current) => {
      if (current.some((item) => item.txHash.toLowerCase() === next.txHash.toLowerCase())) {
        return current;
      }
      return [next, ...current].slice(0, 20);
    });
  };

  const campaignPhaseBadge = useMemo(() => {
    if (campaignPhase === 'ACTIVE') {
      return { bg: 'bg-emerald-500/20', border: 'border-emerald-500/30', text: 'text-emerald-300' };
    }
    if (campaignPhase === 'NOT_STARTED') {
      return { bg: 'bg-yellow-500/20', border: 'border-yellow-500/30', text: 'text-yellow-300' };
    }
    if (campaignPhase === 'FAILED') {
      return { bg: 'bg-red-500/20', border: 'border-red-500/30', text: 'text-red-300' };
    }
    if (campaignPhase === 'ENDED') {
      return { bg: 'bg-slate-500/20', border: 'border-slate-500/30', text: 'text-slate-300' };
    }
    return { bg: 'bg-slate-500/20', border: 'border-slate-500/30', text: 'text-slate-300' };
  }, [campaignPhase]);

  const investUnavailableMessage = useMemo(() => {
    if (isTargetReached) {
      return 'Target reached. Campaign is awaiting/processing finalization and new investments are disabled.';
    }
    if (campaignPhase === 'NOT_STARTED') {
      return `Campaign not started. Countdown: ${startCountdown ?? 'pending'}`;
    }
    if (campaignPhase === 'FAILED') {
      return 'Campaign failed. New investments are closed; refunds are enabled.';
    }
    if (campaignPhase === 'ENDED') {
      return 'Campaign ended. New investments are closed.';
    }
    return 'Investments are currently unavailable.';
  }, [campaignPhase, isTargetReached, startCountdown]);

  const ensureBaseSepolia = async (injected: EthereumProvider) => {
    try {
      await injected.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: BASE_SEPOLIA_CHAIN_ID_HEX }],
      });
    } catch (error) {
      const code = (error as { code?: number })?.code;
      if (code !== 4902) {
        throw error;
      }
      await injected.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: BASE_SEPOLIA_CHAIN_ID_HEX,
            chainName: 'Base Sepolia',
            nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
            rpcUrls: ['https://sepolia.base.org'],
            blockExplorerUrls: ['https://sepolia.basescan.org'],
          },
        ],
      });
      await injected.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: BASE_SEPOLIA_CHAIN_ID_HEX }],
      });
    }
  };

  useEffect(() => {
    let cancelled = false;

    if (!property?.crowdfundAddress) {
      setCrowdfundUsdcAddress(null);
      return;
    }

    const loadCrowdfundUsdcAddress = async () => {
      try {
        const rpcUrl = (import.meta as ImportMeta & { env: Record<string, string> }).env
          .VITE_BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';
        const provider = new JsonRpcProvider(rpcUrl);
        const crowdfund = new Contract(property.crowdfundAddress, CROWDFUND_ABI, provider);
        const tokenAddress = ((await crowdfund.usdcToken()) as string).toLowerCase();
        if (!cancelled) {
          setCrowdfundUsdcAddress(tokenAddress);
        }
      } catch (_error) {
        if (!cancelled) {
          setCrowdfundUsdcAddress(null);
        }
      }
    };

    void loadCrowdfundUsdcAddress();

    return () => {
      cancelled = true;
    };
  }, [property?.crowdfundAddress]);

  useEffect(() => {
    let cancelled = false;

    const loadCampaignLive = async () => {
      if (!property?.crowdfundAddress) return;
      try {
        const liveCampaign = await fetchCampaign(property.crowdfundAddress);
        if (!cancelled) {
          setCampaign(liveCampaign);
        }
      } catch (_error) {
        // Keep previously loaded campaign state on transient API failures.
      }
    };

    void loadCampaignLive();
    const timer = setInterval(() => {
      void loadCampaignLive();
    }, 10000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [property?.crowdfundAddress]);

  useEffect(() => {
    let cancelled = false;

    const loadPropertyClaimHistory = async () => {
      if (!property?.propertyId) {
        if (!cancelled) {
          setPropertyEquityClaims([]);
          setPropertyProfitClaims([]);
        }
        return;
      }
      try {
        const [equityClaims, profitClaims] = await Promise.all([
          fetchPropertyEquityClaims(property.propertyId),
          fetchPropertyProfitClaims(property.propertyId),
        ]);
        if (!cancelled) {
          setPropertyEquityClaims(equityClaims);
          setPropertyProfitClaims(profitClaims);
        }
      } catch (_error) {
        // Keep previous claim history on transient failures.
      }
    };

    void loadPropertyClaimHistory();
    const timer = setInterval(() => {
      void loadPropertyClaimHistory();
    }, 15000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [claimRefreshNonce, property?.propertyId]);

  useEffect(() => {
    if (pendingClaims.length === 0) {
      return;
    }
    const indexedProfit = new Set(propertyProfitClaims.map((claim) => claim.txHash.toLowerCase()));
    const indexedEquity = new Set(propertyEquityClaims.map((claim) => claim.txHash.toLowerCase()));
    setPendingClaims((current) =>
      current.filter((item) => {
        if (item.propertyId !== property?.propertyId) {
          return true;
        }
        const txHash = item.txHash.toLowerCase();
        if (item.type === 'claim-profit') {
          return !indexedProfit.has(txHash);
        }
        return !indexedEquity.has(txHash);
      })
    );
  }, [pendingClaims.length, property?.propertyId, propertyEquityClaims, propertyProfitClaims]);

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setSelectedGalleryImage(galleryImages[0] ?? null);
  }, [galleryImages]);

  useEffect(() => {
    let cancelled = false;

    const loadClaimableProfit = async () => {
      if (!property?.profitDistributorAddress || !connectedAddress) {
        setClaimableProfitBaseUnits(null);
        return;
      }

      try {
        const injected = getEthereumProvider();
        const rpcUrl = (import.meta as ImportMeta & { env: Record<string, string> }).env
          .VITE_BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';
        const provider = injected ? new BrowserProvider(injected as never) : new JsonRpcProvider(rpcUrl);
        const distributor = new Contract(
          property.profitDistributorAddress,
          PROFIT_DISTRIBUTOR_ABI,
          provider
        );
        const claimable = (await distributor.claimable(connectedAddress)) as bigint;
        if (!cancelled) {
          setClaimableProfitBaseUnits(claimable);
        }
      } catch (_error) {
        if (!cancelled) {
          setClaimableProfitBaseUnits(null);
        }
      }
    };

    void loadClaimableProfit();
    const timer = setInterval(() => {
      void loadClaimableProfit();
    }, 15000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [claimRefreshNonce, connectedAddress, property?.profitDistributorAddress]);

  useEffect(() => {
    let cancelled = false;

    const loadClaimableEquity = async () => {
      if (!property?.crowdfundAddress || !connectedAddress) {
        setClaimableEquityBaseUnits(null);
        setClaimableEquityError('');
        return;
      }

      try {
        const injected = getEthereumProvider();
        const rpcUrl = (import.meta as ImportMeta & { env: Record<string, string> }).env
          .VITE_BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';
        const provider = injected ? new BrowserProvider(injected as never) : new JsonRpcProvider(rpcUrl);
        const crowdfund = new Contract(property.crowdfundAddress, CROWDFUND_ABI, provider);
        const claimable = (await crowdfund.claimableTokens(connectedAddress)) as bigint;
        if (!cancelled) {
          setClaimableEquityBaseUnits(claimable);
          setClaimableEquityError('');
        }
      } catch (error) {
        if (!cancelled) {
          setClaimableEquityBaseUnits(null);
          const message = error instanceof Error ? error.message : 'Could not read claimable equity';
          if (message.includes('Equity token not set')) {
            setClaimableEquityError('Equity token is not configured for this campaign yet.');
          } else {
            setClaimableEquityError('Could not read claimable equity onchain.');
          }
        }
      }
    };

    void loadClaimableEquity();
    const timer = setInterval(() => {
      void loadClaimableEquity();
    }, 15000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [claimRefreshNonce, connectedAddress, property?.crowdfundAddress]);

  useEffect(() => {
    let cancelled = false;

    const loadMyInvestmentPosition = async () => {
      if (!property?.crowdfundAddress || !connectedAddress) {
        if (!cancelled) {
          setMyInvestedBaseUnits(0n);
        }
        return;
      }

      try {
        const investments = await fetchCampaignInvestments(property.crowdfundAddress);
        if (cancelled) return;
        const totalInvested = investments
          .filter((item) => item.investorAddress.toLowerCase() === connectedAddress.toLowerCase())
          .reduce<bigint>((sum, item) => sum + BigInt(item.usdcAmountBaseUnits), 0n);
        setMyInvestedBaseUnits(totalInvested);
      } catch (error) {
        if (!cancelled) {
          console.warn('[property.position] failed to load', error);
        }
      }
    };

    void loadMyInvestmentPosition();
    const timer = setInterval(() => {
      void loadMyInvestmentPosition();
    }, 15000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [claimRefreshNonce, connectedAddress, property?.crowdfundAddress]);

  const handleInvestWithUsdc = async () => {
    setTxError('');
    setTxStatus('');

    if (!property) {
      setTxError('Property is not loaded yet.');
      return;
    }

    if (!canInvest) {
      const notStarted = !hasCampaignStarted && campaignStartMs;
      setTxError(
        isTargetReached
          ? 'Target reached. Wait for campaign finalization; new investments are disabled.'
          : notStarted
          ? `Campaign has not started yet. Starts at ${new Date(campaignStartMs).toLocaleString()}.`
          : `Investing is unavailable while campaign state is ${campaignState}.`
      );
      return;
    }

    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      setTxError('Enter a valid USDC amount greater than 0.');
      return;
    }

    const injected = getEthereumProvider();
    if (!injected) {
      setTxError('No wallet provider found. Install a wallet extension.');
      return;
    }

    setIsInvesting(true);
    try {
      await ensureBaseSepolia(injected);

      await injected.request({ method: 'eth_requestAccounts' });
      const provider = new BrowserProvider(injected as never);
      const signer = await provider.getSigner();

      const amountBaseUnits = parseUnits(amountUsdc, 6);
      const crowdfund = new Contract(property.crowdfundAddress, CROWDFUND_ABI, signer);
      const requiredUsdcAddress = ((await crowdfund.usdcToken()) as string).toLowerCase();
      const usdc = new Contract(requiredUsdcAddress, ERC20_ABI, signer);
      const signerAddress = await signer.getAddress();
      const balance = (await usdc.balanceOf(signerAddress)) as bigint;
      if (balance < amountBaseUnits) {
        throw new Error(
          `Insufficient USDC balance for this property token. Required ${formatUnits(
            amountBaseUnits,
            6
          )} USDC, wallet has ${formatUnits(balance, 6)} USDC at token ${requiredUsdcAddress}.`
        );
      }

      const allowance = (await usdc.allowance(
        signerAddress,
        property.crowdfundAddress
      )) as bigint;
      if (allowance < amountBaseUnits) {
        setTxStatus('Submitting USDC approval...');
        try {
          const approveTx = await sendContractTransaction(signer, usdc, 'approve', [
            property.crowdfundAddress,
            amountBaseUnits,
          ]);
          await approveTx.wait();
        } catch (_approveError) {
          // Some tokens require resetting allowance to 0 before setting a new value.
          const resetTx = await sendContractTransaction(signer, usdc, 'approve', [
            property.crowdfundAddress,
            0n,
          ]);
          await resetTx.wait();
          const approveTx = await sendContractTransaction(signer, usdc, 'approve', [
            property.crowdfundAddress,
            amountBaseUnits,
          ]);
          await approveTx.wait();
        }
      }

      setTxStatus('Submitting investment...');
      const investTx = await sendContractTransaction(signer, crowdfund, 'invest', [amountBaseUnits]);
      await investTx.wait();

      setTxStatus(`Investment confirmed: ${investTx.hash}`);
      setMyInvestedBaseUnits((previous) => previous + amountBaseUnits);
      emitPortfolioActivity({
        txHash: investTx.hash,
        propertyId: property.propertyId,
        type: 'invest',
      });
      setAmountUsdc('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Investment transaction failed';
      setTxError(message);
    } finally {
      setIsInvesting(false);
    }
  };

  const handleInvestWithEth = async () => {
    setTxError('');
    setTxStatus('');

    if (!property) {
      setTxError('Property is not loaded yet.');
      return;
    }

    if (!canInvest) {
      const notStarted = !hasCampaignStarted && campaignStartMs;
      setTxError(
        isTargetReached
          ? 'Target reached. Wait for campaign finalization; new investments are disabled.'
          : notStarted
          ? `Campaign has not started yet. Starts at ${new Date(campaignStartMs).toLocaleString()}.`
          : `Investing is unavailable while campaign state is ${campaignState}.`
      );
      return;
    }

    if (!canSwapEthOnBaseSepolia) {
      setTxError('ETH investment is not configured. Set VITE_BASE_SEPOLIA_SWAP_ROUTER.');
      return;
    }

    if (!Number.isFinite(normalizedEthAmount) || normalizedEthAmount <= 0) {
      setTxError('Enter a valid ETH amount greater than 0.');
      return;
    }

    if (!minUsdcOutBaseUnits || minUsdcOutBaseUnits <= 0n) {
      setTxError('Unable to derive minimum USDC out from quote. Wait for live quote and retry.');
      return;
    }
    if (!ethQuote) {
      setTxError('Missing live quote for ETH investment. Wait for quote and retry.');
      return;
    }

    const injected = getEthereumProvider();
    if (!injected) {
      setTxError('No wallet provider found. Install a wallet extension.');
      return;
    }

    setIsInvesting(true);
    try {
      await ensureBaseSepolia(injected);
      await injected.request({ method: 'eth_requestAccounts' });
      const provider = new BrowserProvider(injected as never);
      const signer = await provider.getSigner();
      const signerAddress = await signer.getAddress();

      const ethAmountWei = parseUnits(amountEth, 18);
      const quotedAmountInWei = BigInt(ethQuote.amountInWei);
      if (quotedAmountInWei !== ethAmountWei) {
        throw new Error('Quote is stale for current ETH amount. Wait for refreshed quote and retry.');
      }
      const nativeBalanceWei = await provider.getBalance(signerAddress);
      if (ethAmountWei > nativeBalanceWei) {
        throw new Error(
          `Insufficient ETH balance for swap input. Requested ${formatUnits(
            ethAmountWei,
            18
          )} ETH but wallet has ${formatUnits(nativeBalanceWei, 18)} ETH.`
        );
      }
      const primaryFeeTier = ethQuote.feeTier;
      const executionFeeTiers = Array.from(
        new Set([primaryFeeTier, ...swapFeeCandidates])
      );

      const crowdfund = new Contract(property.crowdfundAddress, CROWDFUND_ABI, signer);
      const requiredUsdcAddress = ((await crowdfund.usdcToken()) as string).toLowerCase();
      if (ethQuote.usdcAddress.toLowerCase() !== requiredUsdcAddress) {
        throw new Error(
          `Quote token mismatch. Quote used ${ethQuote.usdcAddress}, but crowdfund requires ${requiredUsdcAddress}.`
        );
      }
      const usdc = new Contract(requiredUsdcAddress, ERC20_ABI, signer);
      const weth = new Contract(env.BASE_SEPOLIA_WETH, WETH_ABI, signer);
      const swapRouter = new Contract(env.BASE_SEPOLIA_SWAP_ROUTER, SWAP_ROUTER_ABI, signer);

      const usdcBefore = BigInt(await usdc.balanceOf(signerAddress));

      const deadline = Math.floor(Date.now() / 1000) + 20 * 60;
      let swapSucceeded = false;
      let lastNativeSwapError: unknown = null;
      let lastWrappedSwapError: unknown = null;

      // Path A: let router wrap native ETH internally.
      for (const feeTier of executionFeeTiers) {
        try {
          setTxStatus(`Swapping ETH -> USDC (native route, fee tier ${feeTier})...`);
          try {
            const swapTx = await sendContractTransaction(
              signer,
              swapRouter,
              'exactInputSingle((address,address,uint24,address,uint256,uint256,uint160))',
              [
                {
                  tokenIn: env.BASE_SEPOLIA_WETH,
                  tokenOut: requiredUsdcAddress,
                  fee: feeTier,
                  recipient: signerAddress,
                  amountIn: ethAmountWei,
                  amountOutMinimum: minUsdcOutBaseUnits,
                  sqrtPriceLimitX96: 0,
                },
              ],
              { value: ethAmountWei }
            );
            await swapTx.wait();
          } catch (_swapWithoutDeadlineError) {
            const swapTxWithDeadline = await sendContractTransaction(
              signer,
              swapRouter,
              'exactInputSingle((address,address,uint24,address,uint256,uint256,uint256,uint160))',
              [
                {
                  tokenIn: env.BASE_SEPOLIA_WETH,
                  tokenOut: requiredUsdcAddress,
                  fee: feeTier,
                  recipient: signerAddress,
                  deadline,
                  amountIn: ethAmountWei,
                  amountOutMinimum: minUsdcOutBaseUnits,
                  sqrtPriceLimitX96: 0,
                },
              ],
              { value: ethAmountWei }
            );
            await swapTxWithDeadline.wait();
          }
          swapSucceeded = true;
          break;
        } catch (nativeSwapError) {
          lastNativeSwapError = nativeSwapError;
        }
      }

      // Path B: explicit wrap + approve + swap.
      if (!swapSucceeded) {
        setTxStatus('Native swap route failed. Wrapping ETH to WETH...');
        try {
          const wrapTx = await sendContractTransaction(signer, weth, 'deposit', [], {
            value: ethAmountWei,
          });
          await wrapTx.wait();
        } catch (depositError) {
          try {
            const wrapViaReceiveTx = await signer.sendTransaction({
              to: env.BASE_SEPOLIA_WETH,
              value: ethAmountWei,
            });
            await wrapViaReceiveTx.wait();
          } catch (receiveWrapError) {
            throw new Error(
              `Native swap route failed: ${
                lastNativeSwapError instanceof Error
                  ? lastNativeSwapError.message
                  : String(lastNativeSwapError)
              }. WETH wrap failed. deposit() error: ${
                depositError instanceof Error ? depositError.message : String(depositError)
              }. receive() error: ${
                receiveWrapError instanceof Error
                  ? receiveWrapError.message
                  : String(receiveWrapError)
              }`
            );
          }
        }

        setTxStatus('Approving router for wrapped swap...');
        const approveRouterTx = await sendContractTransaction(signer, weth, 'approve', [
          env.BASE_SEPOLIA_SWAP_ROUTER,
          ethAmountWei,
        ]);
        await approveRouterTx.wait();

        for (const feeTier of executionFeeTiers) {
          try {
            setTxStatus(`Swapping ETH -> USDC (wrapped route, fee tier ${feeTier})...`);
            try {
              const swapTx = await sendContractTransaction(
                signer,
                swapRouter,
                'exactInputSingle((address,address,uint24,address,uint256,uint256,uint160))',
                [
                  {
                    tokenIn: env.BASE_SEPOLIA_WETH,
                    tokenOut: requiredUsdcAddress,
                    fee: feeTier,
                    recipient: signerAddress,
                    amountIn: ethAmountWei,
                    amountOutMinimum: minUsdcOutBaseUnits,
                    sqrtPriceLimitX96: 0,
                  },
                ]
              );
              await swapTx.wait();
            } catch (_swapWithoutDeadlineError) {
              const swapTxWithDeadline = await sendContractTransaction(
                signer,
                swapRouter,
                'exactInputSingle((address,address,uint24,address,uint256,uint256,uint256,uint160))',
                [
                  {
                    tokenIn: env.BASE_SEPOLIA_WETH,
                    tokenOut: requiredUsdcAddress,
                    fee: feeTier,
                    recipient: signerAddress,
                    deadline,
                    amountIn: ethAmountWei,
                    amountOutMinimum: minUsdcOutBaseUnits,
                    sqrtPriceLimitX96: 0,
                  },
                ]
              );
              await swapTxWithDeadline.wait();
            }
            swapSucceeded = true;
            break;
          } catch (wrappedSwapError) {
            lastWrappedSwapError = wrappedSwapError;
          }
        }
      }

      if (!swapSucceeded) {
        throw new Error(
          `ETH->USDC swap failed on fee tiers ${swapFeeCandidates.join(', ')}. Native route error: ${
            lastNativeSwapError instanceof Error
              ? lastNativeSwapError.message
              : String(lastNativeSwapError)
          }. Wrapped route error: ${
            lastWrappedSwapError instanceof Error
              ? lastWrappedSwapError.message
              : String(lastWrappedSwapError)
          }. This usually means no active pool/liquidity on Base Sepolia for these tiers.`
        );
      }

      const usdcAfter = BigInt(await usdc.balanceOf(signerAddress));
      const receivedUsdc = usdcAfter - usdcBefore;
      if (receivedUsdc <= 0n) {
        throw new Error('Swap returned 0 USDC.');
      }

      setTxStatus('Approving USDC for investment...');
      const approveCrowdfundTx = await sendContractTransaction(signer, usdc, 'approve', [
        property.crowdfundAddress,
        receivedUsdc,
      ]);
      await approveCrowdfundTx.wait();

      setTxStatus('Submitting investment with swapped USDC...');
      const investTx = await sendContractTransaction(signer, crowdfund, 'invest', [receivedUsdc]);
      await investTx.wait();

      setTxStatus(`ETH swap + investment confirmed: ${investTx.hash}`);
      setMyInvestedBaseUnits((previous) => previous + receivedUsdc);
      emitPortfolioActivity({
        txHash: investTx.hash,
        propertyId: property.propertyId,
        type: 'invest',
      });
      setAmountEth('');
      setQuotedUsdcOutBaseUnits(null);
      setEthQuote(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'ETH swap and investment transaction failed';
      setTxError(message);
    } finally {
      setIsInvesting(false);
    }
  };

  const handleInvest = async () => {
    if (investAsset === 'ETH') {
      await handleInvestWithEth();
      return;
    }
    await handleInvestWithUsdc();
  };

  useEffect(() => {
    let cancelled = false;

    if (investAsset !== 'ETH') {
      setQuoteError('');
      setQuotedUsdcOutBaseUnits(null);
      setIsQuotingEth(false);
      setEthQuote(null);
      return;
    }

    if (!canSwapEthOnBaseSepolia) {
      setQuoteError('ETH swap router is not configured.');
      setQuotedUsdcOutBaseUnits(null);
      setIsQuotingEth(false);
      setEthQuote(null);
      return;
    }

    if (!Number.isFinite(normalizedEthAmount) || normalizedEthAmount <= 0) {
      setQuoteError('');
      setQuotedUsdcOutBaseUnits(null);
      setIsQuotingEth(false);
      setEthQuote(null);
      return;
    }

    const quoteEthToUsdc = async () => {
      try {
        setIsQuotingEth(true);
        setQuoteError('');
        const quote = await fetchEthUsdcQuote({
          amountEth,
          slippagePercent,
          usdcAddress: effectiveUsdcAddress,
        });
        const amountOut = BigInt(quote.estimatedUsdcBaseUnits);
        if (!cancelled) {
          setEthQuote(quote);
          setQuotedUsdcOutBaseUnits(amountOut);
        }
      } catch (error) {
        if (!cancelled) {
          setEthQuote(null);
          setQuotedUsdcOutBaseUnits(null);
          setQuoteError(error instanceof Error ? error.message : 'Unable to estimate USDC output');
        }
      } finally {
        if (!cancelled) {
          setIsQuotingEth(false);
        }
      }
    };

    const timer = setTimeout(() => {
      void quoteEthToUsdc();
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    amountEth,
    canSwapEthOnBaseSepolia,
    effectiveUsdcAddress,
    investAsset,
    normalizedEthAmount,
    slippagePercent,
  ]);

  const withSigner = async () => {
    const injected = getEthereumProvider();
    if (!injected) {
      throw new Error('No wallet provider found. Install a wallet extension.');
    }

    await ensureBaseSepolia(injected);
    await injected.request({ method: 'eth_requestAccounts' });

    const provider = new BrowserProvider(injected as never);
    return provider.getSigner();
  };

  const sendContractTransaction = async (
    signer: Awaited<ReturnType<BrowserProvider['getSigner']>>,
    contract: Contract,
    functionName: string,
    args: unknown[] = [],
    overrides: { value?: bigint } = {}
  ) => {
    const txData = contract.interface.encodeFunctionData(functionName, args);
    const data = builderDataSuffix ? concat([txData, builderDataSuffix]) : txData;
    const to =
      typeof contract.target === 'string' ? contract.target : await contract.getAddress();
    return signer.sendTransaction({
      to,
      data,
      ...overrides,
    });
  };

  const handleClaimEquity = async () => {
    setTxError('');
    setTxStatus('');
    if (!property) {
      setTxError('Property is not loaded yet.');
      return;
    }
    if (!canAttemptEquityClaim) {
      setTxError(claimEquityUnavailableMessage);
      return;
    }

    setIsClaimingEquity(true);
    try {
      const signer = await withSigner();
      const crowdfund = new Contract(property.crowdfundAddress, CROWDFUND_ABI, signer);
      setTxStatus('Submitting equity claim...');
      const tx = await sendContractTransaction(signer, crowdfund, 'claimTokens');
      await tx.wait();
      setTxStatus(`Equity claim confirmed: ${tx.hash}`);
      setClaimRefreshNonce((current) => current + 1);
      emitPortfolioActivity({
        txHash: tx.hash,
        propertyId: property.propertyId,
        type: 'claim-equity',
      });
      addPendingClaim({
        txHash: tx.hash,
        propertyId: property.propertyId,
        type: 'claim-equity',
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to claim equity';
      setTxError(message);
    } finally {
      setIsClaimingEquity(false);
    }
  };

  const handleClaimProfit = async () => {
    setTxError('');
    setTxStatus('');
    if (!property) {
      setTxError('Property is not loaded yet.');
      return;
    }
    if (!canClaimProfit) {
      setTxError(claimProfitUnavailableMessage);
      return;
    }

    setIsClaimingProfit(true);
    try {
      const signer = await withSigner();
      const distributor = new Contract(
        property.profitDistributorAddress,
        PROFIT_DISTRIBUTOR_ABI,
        signer
      );
      setTxStatus('Submitting profit claim...');
      const tx = await sendContractTransaction(signer, distributor, 'claim');
      await tx.wait();
      setTxStatus(`Profit claim confirmed: ${tx.hash}`);
      setClaimableProfitBaseUnits(0n);
      setClaimRefreshNonce((current) => current + 1);
      emitPortfolioActivity({
        txHash: tx.hash,
        propertyId: property.propertyId,
        type: 'claim-profit',
      });
      addPendingClaim({
        txHash: tx.hash,
        propertyId: property.propertyId,
        type: 'claim-profit',
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to claim profit';
      setTxError(message);
    } finally {
      setIsClaimingProfit(false);
    }
  };

  const handleClaimRefund = async () => {
    setTxError('');
    setTxStatus('');
    if (!property) {
      setTxError('Property is not loaded yet.');
      return;
    }

    setIsClaimingRefund(true);
    try {
      const signer = await withSigner();
      const crowdfund = new Contract(property.crowdfundAddress, CROWDFUND_ABI, signer);
      setTxStatus('Submitting refund claim...');
      const tx = await sendContractTransaction(signer, crowdfund, 'claimRefund');
      await tx.wait();
      setTxStatus(`Refund confirmed: ${tx.hash}`);
      emitPortfolioActivity({
        txHash: tx.hash,
        propertyId: property.propertyId,
        type: 'claim-refund',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to claim refund';
      setTxError(message);
    } finally {
      setIsClaimingRefund(false);
    }
  };

  if (loading) {
    return (
      <div className="overflow-hidden min-h-screen">
        <div className="container mx-auto px-4 py-20 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full border-2 border-slate-700 border-t-emerald-500 animate-spin mx-auto mb-4" />
            <p className="text-slate-400">Loading property...</p>
          </div>
        </div>
      </div>
    );
  }

  if (errorMessage || !property) {
    return (
      <div className="overflow-hidden min-h-screen">
        <div className="container mx-auto px-4 py-12">
          <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-6 py-4 flex gap-3">
            <AlertIcon className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-200">{errorMessage || 'Property not found.'}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden min-h-screen">
      <div>
        <div className="container mx-auto px-4 py-8 md:py-12">
          {/* Back Button */}
          <Link
            to="/properties"
            className="inline-flex items-center gap-2 text-slate-400 hover:text-slate-200 transition mb-8 group"
          >
            <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            Back to Properties
          </Link>

          {/* Header */}
          <div className="mb-8 rounded-2xl bg-slate-900/80 backdrop-blur border border-slate-700/50 p-8">
            <div className="space-y-4">
              <h1 className="text-5xl md:text-6xl font-light tracking-tight text-white">
                {property.name}
              </h1>
              <p className="text-lg text-slate-300 max-w-2xl">{property.description}</p>
              
              <div className="flex flex-wrap items-center gap-3 pt-4">
                <div className={`px-4 py-2 rounded-full text-sm font-semibold border ${campaignPhaseBadge.bg} ${campaignPhaseBadge.border} ${campaignPhaseBadge.text}`}>
                  {campaignPhase}
                </div>
                <div className="px-4 py-2 rounded-full text-sm bg-slate-800/50 border border-slate-700/50 text-slate-300">
                  {property.location}
                </div>
                <div className="px-4 py-2 rounded-full text-sm bg-slate-800/50 border border-slate-700/50 text-slate-300">
                  Raised: ${Number(formatUnits(campaignRaisedBaseUnits, 6)).toLocaleString(undefined, { maximumFractionDigits: 2 })} / ${Number(formatUnits(campaignTargetBaseUnits, 6)).toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC
                </div>
                {projectedRoiPercent !== null && (
                  <div className="flex items-center gap-2 px-4 py-2 rounded-full text-sm bg-emerald-500/20 border border-emerald-500/30 text-emerald-300">
                    <TrendingUp className="w-4 h-4" />
                    {projectedRoiPercent.toLocaleString(undefined, { maximumFractionDigits: 1 })}% ROI
                  </div>
                )}
              </div>
              <div className="pt-3">
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Funding Progress (Live)</span>
                  <span className="text-slate-300">{fundingProgressPercent.toFixed(2)}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${fundingProgressPercent}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-8 lg:grid-cols-12">
            {/* Media Section */}
            <div className="lg:col-span-7 space-y-4">
              {/* Main Image */}
              <div className="rounded-2xl overflow-hidden bg-slate-900/80 backdrop-blur border border-slate-700/50 aspect-video">
                {selectedGalleryImage ? (
                  <img
                    src={selectedGalleryImage}
                    alt={property.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
                    <div className="text-center">
                      <svg className="w-12 h-12 text-slate-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="text-slate-500">No image available</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Gallery */}
              {galleryImages.length > 1 && (
                <div className="rounded-2xl bg-slate-900/80 backdrop-blur border border-slate-700/50 p-4">
                  <div className="grid grid-cols-5 gap-2">
                    {galleryImages.map((imageUrl) => (
                      <button
                        key={imageUrl}
                        onClick={() => setSelectedGalleryImage(imageUrl)}
                        className={`rounded-lg overflow-hidden border transition ${
                          selectedGalleryImage === imageUrl
                            ? 'border-emerald-500/50 ring-2 ring-emerald-500/30'
                            : 'border-slate-700/50 hover:border-slate-600'
                        }`}
                      >
                        <img
                          src={imageUrl}
                          alt="Property view"
                          className="w-full h-16 object-cover"
                          loading="lazy"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Video */}
              {property.youtubeEmbedUrl && (
                <div className="rounded-2xl overflow-hidden bg-slate-900/80 backdrop-blur border border-slate-700/50 aspect-video">
                  <iframe
                    title={`${property.name} video`}
                    src={property.youtubeEmbedUrl}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-5 space-y-4">
              {/* Investment Panel */}
              <div className="rounded-2xl bg-slate-900/80 backdrop-blur border border-slate-700/50 p-8 sticky top-24">
                <h2 className="text-2xl font-semibold text-white mb-6">Invest & Manage</h2>

                {/* Key Metrics */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="rounded-lg bg-slate-800/50 p-4">
                    <p className="text-xs text-slate-500 font-medium mb-1">Est. Sell Price</p>
                    <p className="text-lg font-semibold text-white">
                      {estimatedSellUsdc !== null
                        ? `$${estimatedSellUsdc.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                        : '--'}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-800/50 p-4">
                    <p className="text-xs text-slate-500 font-medium mb-1">Projected ROI</p>
                    <p className="text-lg font-semibold text-emerald-400">
                      {projectedRoiPercent !== null
                        ? `${projectedRoiPercent.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`
                        : '--'}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-800/50 p-4">
                    <p className="text-xs text-slate-500 font-medium mb-1">Fee</p>
                    <p className="text-lg font-semibold text-white">
                      {property.platformFeeBps === null ? '--' : `${(property.platformFeeBps / 100).toFixed(2)}%`}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-800/50 p-4">
                    <p className="text-xs text-slate-500 font-medium mb-1">Target</p>
                    <p className="text-lg font-semibold text-white">${toUsd(property.targetUsdcBaseUnits)}</p>
                  </div>
                </div>
                <div className="mb-6 rounded-lg bg-slate-800/40 border border-slate-700/50 p-4">
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="text-slate-400">Live Raised</span>
                    <span className="text-slate-200">
                      ${Number(formatUnits(campaignRaisedBaseUnits, 6)).toLocaleString(undefined, { maximumFractionDigits: 2 })} / ${Number(formatUnits(campaignTargetBaseUnits, 6)).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                      style={{ width: `${fundingProgressPercent}%` }}
                    />
                  </div>
                </div>

                {/* Scenarios */}
                {scenarioProjections && (
                  <div className="mb-6 rounded-lg bg-slate-800/40 border border-slate-700/50 p-4 text-sm">
                    <p className="font-semibold text-white mb-3">Return Scenarios</p>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Conservative</span>
                        <span className="text-white">${scenarioProjections.conservative.sell.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Base</span>
                        <span className="text-white">${scenarioProjections.base.sell.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Optimistic</span>
                        <span className="text-white">${scenarioProjections.optimistic.sell.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* User Position */}
                {isConnected && connectedAddress && (
                  <div className="mb-6 rounded-lg bg-slate-800/40 border border-slate-700/50 p-4 text-sm">
                    <p className="text-slate-300 mb-2">
                      My Invested: <span className="text-white font-semibold">{positionSummary.invested.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC</span>
                    </p>
                    <p className="text-slate-300">
                      Claimable: <span className="text-emerald-400 font-semibold">{positionSummary.claimableProfit === null ? '--' : `${positionSummary.claimableProfit.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC`}</span>
                    </p>
                  </div>
                )}

                {/* Investment Controls */}
                <div className="space-y-4 mb-6">
                  <div>
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Asset</label>
                    <select
                      value={investAsset}
                      onChange={(e) => setInvestAsset(e.target.value as 'USDC' | 'ETH')}
                      className="w-full mt-2 rounded-lg bg-slate-800/50 border border-slate-700 text-white px-4 py-3 focus:outline-none focus:border-emerald-500/50 transition"
                      disabled={txInFlight}
                    >
                      <option value="USDC">USDC (Direct)</option>
                      <option value="ETH" disabled={!canSwapEthOnBaseSepolia || hasNoUsdcRoute}>
                        ETH (Auto-swap)
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      {investAsset === 'USDC' ? 'Amount (USDC)' : 'Amount (ETH)'}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step={investAsset === 'USDC' ? '0.000001' : '0.000000000000000001'}
                      value={investAsset === 'USDC' ? amountUsdc : amountEth}
                      onChange={(e) => investAsset === 'USDC' ? setAmountUsdc(e.target.value) : setAmountEth(e.target.value)}
                      placeholder={investAsset === 'USDC' ? 'e.g. 100' : 'e.g. 0.1'}
                      className="w-full mt-2 rounded-lg bg-slate-800/50 border border-slate-700 text-white px-4 py-3 focus:outline-none focus:border-emerald-500/50 transition"
                      disabled={txInFlight}
                    />
                  </div>

                  {investAsset === 'ETH' && (
                    <div>
                      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Slippage (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="50"
                        step="0.1"
                        value={slippagePercent}
                        onChange={(e) => setSlippagePercent(e.target.value)}
                        className="w-full mt-2 rounded-lg bg-slate-800/50 border border-slate-700 text-white px-4 py-3 focus:outline-none focus:border-emerald-500/50 transition"
                        disabled={txInFlight}
                      />
                    </div>
                  )}

                  {investAsset === 'ETH' && (
                    <div className="rounded-lg bg-slate-800/40 border border-slate-700/50 p-4 text-xs">
                      <p className="text-slate-300">
                        Est. USDC: <span className="text-white font-semibold">{isQuotingEth ? 'Quoting...' : quotedUsdcOutBaseUnits ? `${formatUsdcUnits(quotedUsdcOutBaseUnits)} USDC` : '--'}</span>
                      </p>
                      {quoteError && <p className="text-red-400 mt-2">{quoteError}</p>}
                    </div>
                  )}
                </div>

                <div className="mb-4 rounded-lg border border-slate-700/50 bg-slate-900/50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Claim Sequence
                  </p>
                  <div className="mt-2 grid grid-cols-1 gap-2 text-xs">
                    <div className="flex items-center justify-between rounded border border-slate-700/50 bg-slate-950/40 px-3 py-2">
                      <span className="text-slate-300">1. Wallet + Investment</span>
                      <span
                        className={`rounded px-2 py-0.5 ${
                          claimSequence.walletReady && claimSequence.hasInvestment
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {claimSequence.walletReady && claimSequence.hasInvestment ? 'Ready' : 'Pending'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded border border-slate-700/50 bg-slate-950/40 px-3 py-2">
                      <span className="text-slate-300">2. Campaign Finalized</span>
                      <span
                        className={`rounded px-2 py-0.5 ${
                          claimSequence.campaignReady
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {claimSequence.campaignReady ? campaignState : 'Pending'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded border border-slate-700/50 bg-slate-950/40 px-3 py-2">
                      <span className="text-slate-300">3. Claim Equity</span>
                      <span
                        className={`rounded px-2 py-0.5 ${
                          claimSequence.equityReady
                            ? 'bg-blue-500/20 text-blue-300'
                            : 'bg-slate-700 text-slate-300'
                        }`}
                      >
                        {claimSequence.equityReady ? 'Available' : 'Waiting'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded border border-slate-700/50 bg-slate-950/40 px-3 py-2">
                      <span className="text-slate-300">4. Claim Profit</span>
                      <span
                        className={`rounded px-2 py-0.5 ${
                          claimSequence.profitReady
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-slate-700 text-slate-300'
                        }`}
                      >
                        {claimSequence.profitReady
                          ? 'Available'
                          : shouldClaimEquityFirst
                            ? 'Claim Equity First'
                            : 'Waiting'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Alerts */}
                {!walletAvailable && (
                  <div className="mb-4 rounded-lg bg-amber-500/10 border border-amber-500/30 px-4 py-3 text-amber-300 text-sm">
                    Connect a wallet to invest or claim.
                  </div>
                )}
                {walletAvailable && !canInvest && (
                  <div className="mb-4 rounded-lg bg-amber-500/10 border border-amber-500/30 px-4 py-3 text-amber-300 text-sm">
                    {investUnavailableMessage}
                  </div>
                )}
                {txError && (
                  <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-red-300 text-sm">
                    {txError}
                  </div>
                )}
                {txStatus && (
                  <div className="mb-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-4 py-3 text-emerald-300 text-sm">
                    {txStatus}
                  </div>
                )}
                {visiblePendingClaims.length > 0 && (
                  <div className="mb-4 rounded-lg bg-amber-500/10 border border-amber-500/30 px-4 py-3">
                    <p className="text-amber-200 text-xs font-medium">
                      Pending claim index sync ({visiblePendingClaims.length})
                    </p>
                    <div className="mt-2 space-y-2">
                      {visiblePendingClaims.map((pending) => (
                        <div
                          key={`property-pending:${pending.txHash}`}
                          className="rounded border border-amber-400/20 bg-slate-900/50 px-2 py-1.5 text-xs flex items-center justify-between gap-2"
                        >
                          <span className="text-amber-100 truncate">
                            {pending.type === 'claim-profit' ? 'Profit claim' : 'Equity claim'}
                          </span>
                          <a
                            href={basescanTxUrl(pending.txHash)}
                            target="_blank"
                            rel="noreferrer"
                            className="text-amber-200 hover:text-amber-100 shrink-0"
                          >
                            View tx
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {!canClaimProfit && (
                  <div className="mb-4 rounded-lg bg-slate-800/40 border border-slate-700/50 px-4 py-3 text-slate-300 text-xs">
                    Profit claim status: {claimProfitUnavailableMessage}
                  </div>
                )}
                {!canClaimEquity && (
                  <div className="mb-4 rounded-lg bg-slate-800/40 border border-slate-700/50 px-4 py-3 text-slate-300 text-xs">
                    Equity claim status: {claimEquityUnavailableMessage}
                  </div>
                )}

                {/* Main CTA */}
                <button
                  onClick={handleInvest}
                  disabled={isInvesting || !walletAvailable || txInFlight || !canInvest || (investAsset === 'ETH' && (isQuotingEth || !quotedUsdcOutBaseUnits || !minUsdcOutBaseUnits))}
                  className="w-full mb-3 py-4 px-6 bg-emerald-600 text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-emerald-500/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isInvesting ? 'Processing...' : canInvest ? (investAsset === 'ETH' ? 'Swap & Invest' : 'Invest') : 'Investment Unavailable'}
                </button>

                {/* Secondary CTAs */}
                <div className="space-y-2">
                  <button
                    onClick={handleClaimEquity}
                    disabled={isClaimingEquity || !walletAvailable || txInFlight || !canAttemptEquityClaim}
                    className="w-full py-3 border border-slate-700 text-slate-300 font-medium rounded-lg hover:bg-slate-800/50 transition disabled:opacity-60"
                  >
                    {isClaimingEquity
                      ? 'Claiming...'
                      : canClaimEquity || canAttemptEquityClaim
                        ? 'Claim Equity'
                        : 'No claimable equity'}
                  </button>
                  <button
                    onClick={handleClaimProfit}
                    disabled={isClaimingProfit || !walletAvailable || txInFlight || !canClaimProfit}
                    className="w-full py-3 border border-slate-700 text-slate-300 font-medium rounded-lg hover:bg-slate-800/50 transition disabled:opacity-60"
                  >
                    {isClaimingProfit
                      ? 'Claiming...'
                      : shouldClaimEquityFirst
                        ? 'Claim Equity First'
                      : canClaimProfit
                        ? 'Claim Profit'
                        : 'No claimable profit'}
                  </button>
                  <button
                    onClick={handleClaimRefund}
                    disabled={isClaimingRefund || !canClaimRefund || !walletAvailable || txInFlight}
                    className="w-full py-3 border border-slate-700 text-slate-300 font-medium rounded-lg hover:bg-slate-800/50 transition disabled:opacity-60"
                  >
                    {isClaimingRefund ? 'Claiming...' : canClaimRefund ? 'Claim Refund' : 'Refund Unavailable'}
                  </button>
                </div>
              </div>

              {/* Info Panel */}
              <div className="rounded-2xl bg-slate-900/80 backdrop-blur border border-slate-700/50 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Contract Details</h3>
                <div className="space-y-4 text-sm">
                  <div>
                    <p className="text-slate-400 mb-1">Crowdfund</p>
                    <p className="text-slate-300 font-mono text-xs break-all">{property.crowdfundAddress}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 mb-1">USDC Token</p>
                    <p className="text-slate-300 font-mono text-xs break-all">{effectiveUsdcAddress}</p>
                  </div>
                </div>
                <div className="mt-4 rounded-lg bg-amber-500/10 border border-amber-500/30 p-4">
                  <p className="text-amber-200 text-xs leading-relaxed">
                    Investing carries risk. Review{' '}
                    <Link to="/disclosures" className="underline font-semibold hover:text-amber-100">
                      Risk Disclosures
                    </Link>{' '}
                    before transacting.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .animate-pulse {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>
    </div>
  );
}
