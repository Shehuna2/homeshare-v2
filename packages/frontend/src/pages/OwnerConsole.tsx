import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useAccount } from 'wagmi';
import { getAddress } from 'ethers';
import { RootState } from '../store';
import { setUser, clearUser } from '../store/slices/userSlice';
import {
  archiveAdminProperty,
  approveProfitAllowance,
  createCloudinaryUploadSignature,
  createAdminIntentBatch,
  createPlatformFeeIntent,
  createProfitDistributionIntent,
  createPropertyIntent,
  fetchCampaignLifecyclePreflight,
  fetchAdminProperties,
  fetchAdminMetrics,
  fetchCampaigns,
  fetchProfitFlowStatus,
  fetchProfitPreflight,
  fetchPlatformFeeFlowStatus,
  fetchPlatformFeePreflight,
  fetchProperties,
  fetchPlatformFeeIntents,
  fetchProfitDistributionIntents,
  fetchPropertyIntents,
  finalizeCampaignAdmin,
  getAuthNonce,
  loginWithWallet,
  resetAdminIntent,
  repairCampaignSetupAdmin,
  restoreAdminProperty,
  retryAdminIntent,
  updateAdminProperty,
  withdrawCampaignFundsAdmin,
} from '../lib/api';
import { env } from '../config/env';
import type {
  AdminMetricsResponse,
  CampaignResponse,
  PlatformFeeIntentResponse,
  ProfitFlowStatusResponse,
  ProfitPreflightResponse,
  PlatformFeeFlowStatusResponse,
  PlatformFeePreflightResponse,
  AdminPropertyResponse,
  PropertyResponse,
  ProfitDistributionIntentResponse,
  PropertyIntentResponse,
  IntentType,
  CampaignLifecyclePreflightResponse,
} from '../lib/api';

const PROFIT_ADVANCED_KEY = 'homeshare:owner:profit-advanced';
const PLATFORM_ADVANCED_KEY = 'homeshare:owner:platform-advanced';
const COMBINED_HISTORY_KEY = 'homeshare:owner:combined-history';

const loadToggle = (key: string): boolean => {
  try {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
};

type CombinedSubmissionRecord = {
  id: string;
  createdAt: string;
  campaignAddress: string;
  propertyId: string;
  includeProfitIntent: boolean;
  includePlatformFeeIntent: boolean;
  profitIntentId: string | null;
  platformFeeIntentId: string | null;
  grossSettlementUsdc?: string;
  platformFeeUsdc?: string;
  netDistributionUsdc?: string;
  platformFeeRecipient?: string | null;
  profitDistributorAddress?: string | null;
};

type CombinedSubmissionProgress = {
  loading: boolean;
  error: string | null;
  profitIntentStatus: string | null;
  platformFeeIntentStatus: string | null;
  campaignMatchesTarget: boolean | null;
  profitDepositIndexed: boolean | null;
  claimablePoolPositive: boolean | null;
  unclaimedPoolBaseUnits: string | null;
};

type CombinedRowOutcome = 'completed' | 'in_progress' | 'needs_attention';
const PROFIT_INTENT_MAX_ATTEMPTS = 3;
type FullSettlementStepState = 'pending' | 'running' | 'done' | 'error' | 'skipped';
type FullSettlementStep = {
  key: 'precheck' | 'finalize' | 'withdraw' | 'repair' | 'submit';
  label: string;
  status: FullSettlementStepState;
  message: string;
};

const getProfitIntentBlockerMessage = (
  intent: ProfitDistributionIntentResponse | null | undefined
): string | null => {
  if (!intent) return null;
  const error = (intent.errorMessage || '').toLowerCase();
  if (error.includes('insufficient operator usdc balance')) {
    return 'Blocked: operator USDC is insufficient for investor deposit.';
  }
  if (intent.status === 'pending' && intent.attemptCount >= PROFIT_INTENT_MAX_ATTEMPTS) {
    return 'Blocked: max processing attempts reached. Reset/Retry this profit intent.';
  }
  if (intent.status === 'failed' && intent.errorMessage) {
    return `Blocked: ${intent.errorMessage}`;
  }
  return null;
};

const loadCombinedHistory = (): CombinedSubmissionRecord[] => {
  try {
    if (typeof window === 'undefined') return [];
    const raw = window.localStorage.getItem(COMBINED_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CombinedSubmissionRecord[];
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, 10);
  } catch {
    return [];
  }
};

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

const uploadFormDataWithProgress = (
  url: string,
  formData: FormData,
  onProgress: (percent: number) => void
): Promise<Record<string, unknown>> =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) {
        return;
      }
      const percent = Math.min(100, Math.round((event.loaded / event.total) * 100));
      onProgress(percent);
    };
    xhr.onerror = () => reject(new Error('Image upload failed'));
    xhr.onload = () => {
      let payload: Record<string, unknown> = {};
      try {
        payload = xhr.responseText ? (JSON.parse(xhr.responseText) as Record<string, unknown>) : {};
      } catch {
        payload = {};
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(payload);
        return;
      }
      const errorMessage =
        (payload?.error as { message?: string } | undefined)?.message || 'Image upload failed';
      reject(new Error(errorMessage));
    };
    xhr.send(formData);
  });

const readImageElement = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Invalid image file'));
    };
    image.src = objectUrl;
  });

const compressImageFile = async (file: File): Promise<File> => {
  const maxDimension = 1920;
  const maxBytesBeforeCompression = 1_500_000;
  if (file.size <= maxBytesBeforeCompression) {
    return file;
  }

  const image = await readImageElement(file);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (!width || !height) {
    return file;
  }

  const scale = Math.min(1, maxDimension / Math.max(width, height));
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const context = canvas.getContext('2d');
  if (!context) {
    return file;
  }
  context.drawImage(image, 0, 0, targetWidth, targetHeight);

  const preferredType = ['image/jpeg', 'image/webp', 'image/png'].includes(file.type)
    ? file.type
    : 'image/jpeg';
  const quality = preferredType === 'image/png' ? undefined : 0.82;
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((value) => resolve(value), preferredType, quality);
  });
  if (!blob) {
    return file;
  }
  if (blob.size >= file.size) {
    return file;
  }

  const extension = preferredType === 'image/webp' ? 'webp' : preferredType === 'image/png' ? 'png' : 'jpg';
  const compactName = file.name.replace(/\.[^.]+$/, '');
  return new File([blob], `${compactName}.${extension}`, {
    type: preferredType,
    lastModified: Date.now(),
  });
};

const toHexUtf8 = (value: string): `0x${string}` => {
  const bytes = new TextEncoder().encode(value);
  const hex = Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return `0x${hex}`;
};

const buildManualMessage = (address: string, nonce: string, chainId: number): string =>
  [
    'Homeshare wants you to sign in with your wallet.',
    `Address: ${address}`,
    `Chain ID: ${chainId}`,
    `Nonce: ${nonce}`,
    `Issued At: ${new Date().toISOString()}`,
  ].join('\n');

const formatUsdcInput = (amount: number): string =>
  amount.toLocaleString('en-US', {
    useGrouping: false,
    minimumFractionDigits: 0,
    maximumFractionDigits: 6,
  });

export default function OwnerConsole() {
  const dispatch = useDispatch();
  const { address, role, token, isAuthenticated } = useSelector((state: RootState) => state.user);
  const { address: connectedWalletAddress, isConnected } = useAccount();
  const [showCreatePropertyModal, setShowCreatePropertyModal] = useState(false);
  const [showCreateProfitModal, setShowCreateProfitModal] = useState(false);
  const [showPlatformFeeModal, setShowPlatformFeeModal] = useState(false);
  const [showCombinedIntentModal, setShowCombinedIntentModal] = useState(false);
  const [showSmartWithdrawModal, setShowSmartWithdrawModal] = useState(false);
  const [smartWithdrawCampaign, setSmartWithdrawCampaign] = useState<CampaignResponse | null>(null);
  const [smartWithdrawPreflight, setSmartWithdrawPreflight] =
    useState<CampaignLifecyclePreflightResponse | null>(null);
  const [smartWithdrawRecipient, setSmartWithdrawRecipient] = useState('');
  const [smartWithdrawStepMessage, setSmartWithdrawStepMessage] = useState('');
  const [isSmartWithdrawRunning, setIsSmartWithdrawRunning] = useState(false);
  const [showFullSettlementModal, setShowFullSettlementModal] = useState(false);
  const [fullSettlementCampaign, setFullSettlementCampaign] = useState<CampaignResponse | null>(null);
  const [fullSettlementRecipient, setFullSettlementRecipient] = useState('');
  const [fullSettlementGrossUsdc, setFullSettlementGrossUsdc] = useState('');
  const [fullSettlementGrossSource, setFullSettlementGrossSource] = useState('');
  const [fullSettlementFeeBps, setFullSettlementFeeBps] = useState('');
  const [fullSettlementFeeRecipient, setFullSettlementFeeRecipient] = useState('');
  const [fullSettlementDistributor, setFullSettlementDistributor] = useState('');
  const [fullSettlementPreflight, setFullSettlementPreflight] =
    useState<CampaignLifecyclePreflightResponse | null>(null);
  const [isRunningFullSettlement, setIsRunningFullSettlement] = useState(false);
  const [fullSettlementSteps, setFullSettlementSteps] = useState<FullSettlementStep[]>([]);
  const [showEditPropertyModal, setShowEditPropertyModal] = useState(false);
  const [showAllCampaignOverview] = useState(false);
  const [showAllCombinedSubmissions] = useState(false);
  const [showAllPropertyIntents] = useState(false);
  const [showAllProfitIntents] = useState(false);
  const [showAllPlatformFeeIntents] = useState(false);
  const [propertyForm, setPropertyForm] = useState({
    propertyId: '',
    name: '',
    description: '',
    location: '',
    imageUrl: '',
    imageUrlsText: '',
    youtubeEmbedUrl: '',
    targetUsdc: '',
    estimatedSellUsdc: '',
    conservativeSellUsdc: '',
    baseSellUsdc: '',
    optimisticSellUsdc: '',
    conservativeMultiplierPct: '',
    baseMultiplierPct: '',
    optimisticMultiplierPct: '',
    startTime: '',
    endTime: '',
    chainId: '84532',
  });
  const [propertyImageFile, setPropertyImageFile] = useState<File | null>(null);
  const [isUploadingPropertyImage, setIsUploadingPropertyImage] = useState(false);
  const [propertyImageUploadProgress, setPropertyImageUploadProgress] = useState(0);
  const [, setPropertyImageUploadState] = useState<
    'idle' | 'uploading' | 'success' | 'error'
  >('idle');
  const [, setPropertyImageUploadDebug] = useState('');
  const [platformFeeForm, setPlatformFeeForm] = useState({
    campaignAddress: '',
    platformFeeBps: '',
    platformFeeRecipient: '',
  });
  const [combinedForm, setCombinedForm] = useState({
    campaignAddress: '',
    includeProfitIntent: true,
    includePlatformFeeIntent: true,
    profitUsdcAmount: '',
    grossSettlementUsdc: '',
    platformFeeBps: '',
    platformFeeRecipient: '',
    profitDistributorAddress: '',
  });
  const [profitForm, setProfitForm] = useState({
    propertyId: '',
    profitDistributorAddress: '',
    usdcAmount: '',
  });
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [campaigns, setCampaigns] = useState<CampaignResponse[]>([]);
  const [properties, setProperties] = useState<PropertyResponse[]>([]);
  const [adminProperties, setAdminProperties] = useState<AdminPropertyResponse[]>([]);
  const [propertyCatalogLoading, setPropertyCatalogLoading] = useState(false);
  const [propertyActionLoadingId, setPropertyActionLoadingId] = useState<string | null>(null);
  const [, setBulkPropertyActionLoading] = useState<
    'archive' | 'restore' | null
  >(null);
  const [propertyCatalogQuery, setPropertyCatalogQuery] = useState('');
  const [propertyCatalogStatusFilter] = useState<
    'all' | 'active' | 'archived'
  >('all');
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>([]);
  const [editingPropertyId, setEditingPropertyId] = useState('');
  const [editPropertyForm, setEditPropertyForm] = useState({
    name: '',
    location: '',
    description: '',
    imageUrl: '',
    imageUrlsText: '',
    youtubeEmbedUrl: '',
    estimatedSellUsdc: '',
    conservativeSellUsdc: '',
    baseSellUsdc: '',
    optimisticSellUsdc: '',
    conservativeMultiplierPct: '',
    baseMultiplierPct: '',
    optimisticMultiplierPct: '',
  });
  const [initialEditPropertyForm, setInitialEditPropertyForm] = useState({
    name: '',
    location: '',
    description: '',
    imageUrl: '',
    imageUrlsText: '',
    youtubeEmbedUrl: '',
    estimatedSellUsdc: '',
    conservativeSellUsdc: '',
    baseSellUsdc: '',
    optimisticSellUsdc: '',
    conservativeMultiplierPct: '',
    baseMultiplierPct: '',
    optimisticMultiplierPct: '',
  });
  const [propertyIntents, setPropertyIntents] = useState<PropertyIntentResponse[]>([]);
  const [profitIntents, setProfitIntents] = useState<ProfitDistributionIntentResponse[]>([]);
  const [platformFeeIntents, setPlatformFeeIntents] = useState<PlatformFeeIntentResponse[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [, setIntentsLoading] = useState(false);
  const [intentActionLoadingKey, setIntentActionLoadingKey] = useState<string | null>(null);
  const [, setBulkRetryLoadingScope] = useState<string | null>(null);
  const [, setBulkResetLoadingScope] = useState<string | null>(null);
  const [adminMetrics, setAdminMetrics] = useState<AdminMetricsResponse | null>(null);
  const [profitPreflight, setProfitPreflight] = useState<ProfitPreflightResponse | null>(null);
  const [, setProfitFlowStatus] = useState<ProfitFlowStatusResponse | null>(null);
  const [, setProfitChecksLoading] = useState(false);
  const [isApprovingProfitAllowance, setIsApprovingProfitAllowance] = useState(false);
  const [platformFeePreflight, setPlatformFeePreflight] = useState<PlatformFeePreflightResponse | null>(null);
  const [, setPlatformFeeFlowStatus] = useState<PlatformFeeFlowStatusResponse | null>(null);
  const [, setPlatformFeeChecksLoading] = useState(false);
  const [campaignLifecyclePreflightByAddress, setCampaignLifecyclePreflightByAddress] = useState<
    Record<string, CampaignLifecyclePreflightResponse>
  >({});
  const [campaignLifecycleLoadingKey, setCampaignLifecycleLoadingKey] = useState<string | null>(null);
  const [combinedHistory, setCombinedHistory] = useState<CombinedSubmissionRecord[]>(() =>
    loadCombinedHistory()
  );
  const [combinedProgress, setCombinedProgress] = useState<Record<string, CombinedSubmissionProgress>>(
    {}
  );
  const [combinedProgressLoading, setCombinedProgressLoading] = useState(false);
  const [combinedToasts, setCombinedToasts] = useState<
    Array<{ id: string; text: string; tone: 'success' | 'warning' }>
  >([]);
  const [isSubmittingSettlement, setIsSubmittingSettlement] = useState(false);
  const [showProfitAdvanced] = useState(() => loadToggle(PROFIT_ADVANCED_KEY));
  const [showPlatformAdvanced] = useState(() =>
    loadToggle(PLATFORM_ADVANCED_KEY)
  );
  const [isAutoAuthenticating, setIsAutoAuthenticating] = useState(false);
  const lastAutoAuthAddressRef = useRef<string | null>(null);

  const isOwnerSession = isAuthenticated && role === 'owner' && !!token;
  const isAllowlistedConnectedWallet =
    isConnected &&
    !!connectedWalletAddress &&
    env.OWNER_ALLOWLIST.includes(connectedWalletAddress.toLowerCase());
  const hasMatchingConnectedWallet =
    !!connectedWalletAddress &&
    !!address &&
    connectedWalletAddress.toLowerCase() === address.toLowerCase();
  const canManageOwnerFlows = isOwnerSession && isConnected && hasMatchingConnectedWallet;
  const canViewOwnerConsole = canManageOwnerFlows || isAllowlistedConnectedWallet;
  const normalizedProfitAmount = Number(profitForm.usdcAmount || '0');
  const requestedProfitAmountBaseUnits =
    Number.isFinite(normalizedProfitAmount) && normalizedProfitAmount > 0
      ? Math.round(normalizedProfitAmount * 1_000_000).toString()
      : '0';
  const selectedProfitProperty =
    properties.find((property) => property.propertyId === profitForm.propertyId) ?? null;
  const effectiveProfitDistributorAddress =
    profitForm.profitDistributorAddress.trim() || selectedProfitProperty?.profitDistributorAddress || '';
  const selectedPlatformCampaign =
    campaigns.find((campaign) => campaign.campaignAddress === platformFeeForm.campaignAddress) ?? null;
  const effectivePlatformFeeRecipient =
    platformFeeForm.platformFeeRecipient.trim() || selectedPlatformCampaign?.platformFeeRecipient || '';
  const normalizedPlatformFeeBps = Number(platformFeeForm.platformFeeBps);
  const hasPlatformFeeBasicsValid =
    !!platformFeeForm.campaignAddress.trim() &&
    Number.isInteger(normalizedPlatformFeeBps) &&
    normalizedPlatformFeeBps >= 0 &&
    normalizedPlatformFeeBps <= 2000 &&
    (normalizedPlatformFeeBps === 0 || !!effectivePlatformFeeRecipient);
  const selectedCombinedCampaign =
    campaigns.find((campaign) => campaign.campaignAddress === combinedForm.campaignAddress) ?? null;
  const selectedPlatformFeeCampaign =
    campaigns.find((campaign) => campaign.campaignAddress === platformFeeForm.campaignAddress) ?? null;
  const selectedProfitCampaign =
    campaigns.find((campaign) => campaign.propertyId === profitForm.propertyId) ?? null;
  const selectedCombinedProperty =
    properties.find((property) => property.propertyId === (selectedCombinedCampaign?.propertyId ?? '')) ?? null;
  const effectiveCombinedDistributor =
    combinedForm.profitDistributorAddress.trim() ||
    selectedCombinedProperty?.profitDistributorAddress ||
    '';
  const effectiveCombinedRecipient =
    combinedForm.platformFeeRecipient.trim() ||
    selectedCombinedCampaign?.platformFeeRecipient ||
    '';
  const normalizedCombinedFeeBps = Number(combinedForm.platformFeeBps || '0');
  const normalizedCombinedGrossSettlementUsdc = Number(combinedForm.grossSettlementUsdc || '0');
  const computedCombinedFeeUsdc =
    Number.isFinite(normalizedCombinedGrossSettlementUsdc) &&
    normalizedCombinedGrossSettlementUsdc > 0 &&
    Number.isFinite(normalizedCombinedFeeBps) &&
    normalizedCombinedFeeBps >= 0
      ? (normalizedCombinedGrossSettlementUsdc * normalizedCombinedFeeBps) / 10_000
      : 0;
  const computedCombinedNetDistributionUsdc = Math.max(
    0,
    normalizedCombinedGrossSettlementUsdc - computedCombinedFeeUsdc
  );
  const previousCombinedOutcomeRef = useRef<Record<string, CombinedRowOutcome>>({});
  const platformFeeUiBlockedByCampaignState =
    !!selectedPlatformFeeCampaign &&
    (selectedPlatformFeeCampaign.state === 'ACTIVE' || selectedPlatformFeeCampaign.state === 'FAILED');
  const combinedUiBlockedByCampaignState =
    !!selectedCombinedCampaign &&
    (selectedCombinedCampaign.state === 'ACTIVE' || selectedCombinedCampaign.state === 'FAILED');
  const profitUiBlockedByCampaignState =
    !!selectedProfitCampaign &&
    (selectedProfitCampaign.state === 'ACTIVE' || selectedProfitCampaign.state === 'FAILED');
  const profitIntentById = useMemo(() => {
    const map = new Map<string, ProfitDistributionIntentResponse>();
    for (const intent of profitIntents) {
      map.set(intent.id, intent);
    }
    return map;
  }, [profitIntents]);
  const platformFeeIntentById = useMemo(() => {
    const map = new Map<string, PlatformFeeIntentResponse>();
    for (const intent of platformFeeIntents) {
      map.set(intent.id, intent);
    }
    return map;
  }, [platformFeeIntents]);
  const recentCampaigns = useMemo(() => {
    return [...campaigns].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }, [campaigns]);
  const visibleCampaigns = showAllCampaignOverview ? recentCampaigns : recentCampaigns.slice(0, 2);
  const visibleCombinedHistory = showAllCombinedSubmissions
    ? combinedHistory
    : combinedHistory.slice(0, 2);
  const visiblePropertyIntents = showAllPropertyIntents
    ? propertyIntents
    : propertyIntents.slice(0, 2);
  const visibleProfitIntents = showAllProfitIntents ? profitIntents : profitIntents.slice(0, 2);
  const visiblePlatformFeeIntents = showAllPlatformFeeIntents
    ? platformFeeIntents
    : platformFeeIntents.slice(0, 2);
  const filteredAdminProperties = useMemo(() => {
    const query = propertyCatalogQuery.trim().toLowerCase();
    return adminProperties.filter((property) => {
      const isArchived = !!property.archivedAt;
      if (propertyCatalogStatusFilter === 'active' && isArchived) return false;
      if (propertyCatalogStatusFilter === 'archived' && !isArchived) return false;
      if (!query) return true;
      return (
        property.propertyId.toLowerCase().includes(query) ||
        (property.name || '').toLowerCase().includes(query) ||
        (property.location || '').toLowerCase().includes(query)
      );
    });
  }, [adminProperties, propertyCatalogQuery, propertyCatalogStatusFilter]);
  const filteredAdminPropertyIds = useMemo(
    () => filteredAdminProperties.map((property) => property.propertyId),
    [filteredAdminProperties]
  );
  const allFilteredSelected =
    filteredAdminPropertyIds.length > 0 &&
    filteredAdminPropertyIds.every((id) => selectedPropertyIds.includes(id));
  const ownerHealthAlerts = useMemo(() => {
    if (!adminMetrics) {
      return [];
    }
    const alerts: Array<{ tone: 'warning' | 'danger'; text: string }> = [];
    const checks = adminMetrics.health?.checks;
    const staleSubmitted = adminMetrics.health?.staleSubmittedIntents ?? 0;
    const totals = adminMetrics.intents?.totals;

    if (checks && !checks.rpcConfigured) {
      alerts.push({
        tone: 'danger',
        text: 'RPC URL is not configured on backend workers.',
      });
    }
    if (checks && !checks.indexerHealthy) {
      alerts.push({
        tone: 'danger',
        text: 'Indexer has no chain state yet. Investor data may be stale.',
      });
    }
    if (checks && !checks.workersHealthy) {
      alerts.push({
        tone: 'warning',
        text: `Detected ${staleSubmitted} stale submitted intent(s) older than 5 minutes.`,
      });
    }
    if (totals && totals.failed > 0) {
      alerts.push({
        tone: 'warning',
        text: `${totals.failed} failed intent(s) need operator attention.`,
      });
    }
    const settlementAnomalies = adminMetrics.settlements?.anomalies;
    if (settlementAnomalies) {
      if (settlementAnomalies.feeTransferStaleSubmitted > 0) {
        alerts.push({
          tone: 'warning',
          text: `${settlementAnomalies.feeTransferStaleSubmitted} stale platform-fee transfer intent(s) older than 5 minutes.`,
        });
      }
      if (settlementAnomalies.profitDepositStaleSubmitted > 0) {
        alerts.push({
          tone: 'warning',
          text: `${settlementAnomalies.profitDepositStaleSubmitted} stale profit-deposit intent(s) older than 5 minutes.`,
        });
      }
      if (settlementAnomalies.orphanedFeeTransfers > 0) {
        alerts.push({
          tone: 'danger',
          text: `${settlementAnomalies.orphanedFeeTransfers} platform-fee transfer intent(s) reference unknown campaigns.`,
        });
      }
      if (settlementAnomalies.settlementFailures24h > 0) {
        alerts.push({
          tone: 'warning',
          text: `${settlementAnomalies.settlementFailures24h} settlement-related intent failure(s) in last 24h.`,
        });
      }
    }

    return alerts;
  }, [adminMetrics]);

  const getCombinedOutcome = (record: CombinedSubmissionRecord): CombinedRowOutcome => {
    const profitIntent = record.profitIntentId ? profitIntentById.get(record.profitIntentId) : null;
    const platformIntent = record.platformFeeIntentId
      ? platformFeeIntentById.get(record.platformFeeIntentId)
      : null;
    const progress = combinedProgress[record.id];
    const profitConfirmed =
      !record.includeProfitIntent || (profitIntent?.status ?? progress?.profitIntentStatus) === 'confirmed';
    const platformConfirmed =
      !record.includePlatformFeeIntent ||
      (platformIntent?.status ?? progress?.platformFeeIntentStatus) === 'confirmed';
    const campaignUpdated =
      !record.includePlatformFeeIntent || progress?.campaignMatchesTarget === true;
    const profitDepositIndexed =
      !record.includeProfitIntent || progress?.profitDepositIndexed === true;
    const hasError =
      !!progress?.error || profitIntent?.status === 'failed' || platformIntent?.status === 'failed';
    if (hasError) return 'needs_attention';
    if (profitConfirmed && platformConfirmed && campaignUpdated && profitDepositIndexed) {
      return 'completed';
    }
    return 'in_progress';
  };

  const intentStatusClass = (status: string) => {
    if (status === 'confirmed') return 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
    if (status === 'failed') return 'bg-red-500/20 text-red-300 border border-red-500/30';
    if (status === 'submitted') return 'bg-amber-500/20 text-amber-300 border border-amber-500/30';
    return 'bg-slate-700/40 text-slate-300 border border-slate-600/30';
  };

  const handlePropertyChange = (field: keyof typeof propertyForm, value: string) => {
    setPropertyForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleEditPropertyChange = (field: keyof typeof editPropertyForm, value: string) => {
    setEditPropertyForm((prev) => ({ ...prev, [field]: value }));
  };

  const handlePlatformFeeChange = (
    field: keyof typeof platformFeeForm,
    value: string
  ) => {
    setPlatformFeeForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSelectPlatformCampaign = (campaignAddress: string) => {
    const selected = campaigns.find((campaign) => campaign.campaignAddress === campaignAddress) ?? null;
    if (!selected) {
      setPlatformFeeForm((prev) => ({
        ...prev,
        campaignAddress,
      }));
      return;
    }
    setPlatformFeeForm((prev) => ({
      ...prev,
      campaignAddress: selected.campaignAddress,
      platformFeeBps:
        prev.platformFeeBps === '' ? String(selected.platformFeeBps ?? 0) : prev.platformFeeBps,
      platformFeeRecipient:
        prev.platformFeeRecipient === ''
          ? selected.platformFeeRecipient ?? ''
          : prev.platformFeeRecipient,
    }));
  };

  const handleCombinedChange = (field: keyof typeof combinedForm, value: string | boolean) => {
    setCombinedForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSelectCombinedCampaign = (campaignAddress: string) => {
    const selected = campaigns.find((campaign) => campaign.campaignAddress === campaignAddress) ?? null;
    const selectedProperty = properties.find((property) => property.propertyId === selected?.propertyId) ?? null;
    setCombinedForm((prev) => ({
      ...prev,
      campaignAddress,
      platformFeeBps:
        prev.platformFeeBps === '' ? String(selected?.platformFeeBps ?? 0) : prev.platformFeeBps,
      platformFeeRecipient:
        prev.platformFeeRecipient === ''
          ? selected?.platformFeeRecipient ?? ''
          : prev.platformFeeRecipient,
      profitDistributorAddress:
        prev.profitDistributorAddress === ''
          ? selectedProperty?.profitDistributorAddress ?? ''
          : prev.profitDistributorAddress,
    }));
  };

  const handleProfitChange = (field: keyof typeof profitForm, value: string) => {
    setProfitForm((prev) => ({ ...prev, [field]: value }));
  };

  const getInjectedProvider = (): EthereumProvider | null => {
    const injected = (window as Window & { ethereum?: EthereumProvider }).ethereum;
    return injected && typeof injected.request === 'function' ? injected : null;
  };

  const handleLogout = () => {
    dispatch(clearUser());
    setStatusMessage('Logged out.');
    setErrorMessage('');
  };

  const handleCreateProperty = async () => {
    setErrorMessage('');
    setStatusMessage('Creating property...');
    try {
      if (!token) {
        throw new Error('You must be logged in as an admin to create properties.');
      }
      if (isUploadingPropertyImage) {
        throw new Error('Image upload is still in progress. Wait for it to finish.');
      }
      if (propertyImageFile && !propertyForm.imageUrl.trim()) {
        throw new Error('Please upload the selected image before creating the property.');
      }

      const payload = {
        propertyId:
          propertyForm.propertyId.trim() ||
          propertyForm.name
            .toLowerCase()
            .replace(/[^a-z0-9- ]/g, '')
            .trim()
            .replace(/\s+/g, '-')
            .slice(0, 48),
        name: propertyForm.name,
        description: propertyForm.description,
        location: propertyForm.location,
        imageUrl: propertyForm.imageUrl.trim() || undefined,
        imageUrls: propertyForm.imageUrlsText
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean),
        youtubeEmbedUrl: propertyForm.youtubeEmbedUrl.trim() || undefined,
        targetUsdcBaseUnits: Math.round(Number(propertyForm.targetUsdc || '0') * 1_000_000).toString(),
        estimatedSellUsdcBaseUnits:
          propertyForm.estimatedSellUsdc.trim() === ''
            ? null
            : Math.round(Number(propertyForm.estimatedSellUsdc) * 1_000_000).toString(),
        conservativeSellUsdcBaseUnits:
          propertyForm.conservativeSellUsdc.trim() === ''
            ? null
            : Math.round(Number(propertyForm.conservativeSellUsdc) * 1_000_000).toString(),
        baseSellUsdcBaseUnits:
          propertyForm.baseSellUsdc.trim() === ''
            ? null
            : Math.round(Number(propertyForm.baseSellUsdc) * 1_000_000).toString(),
        optimisticSellUsdcBaseUnits:
          propertyForm.optimisticSellUsdc.trim() === ''
            ? null
            : Math.round(Number(propertyForm.optimisticSellUsdc) * 1_000_000).toString(),
        conservativeMultiplierBps:
          propertyForm.conservativeMultiplierPct.trim() === ''
            ? null
            : Math.round(Number(propertyForm.conservativeMultiplierPct) * 100),
        baseMultiplierBps:
          propertyForm.baseMultiplierPct.trim() === ''
            ? null
            : Math.round(Number(propertyForm.baseMultiplierPct) * 100),
        optimisticMultiplierBps:
          propertyForm.optimisticMultiplierPct.trim() === ''
            ? null
            : Math.round(Number(propertyForm.optimisticMultiplierPct) * 100),
        startTime: propertyForm.startTime ? new Date(propertyForm.startTime).toISOString() : undefined,
        endTime: propertyForm.endTime ? new Date(propertyForm.endTime).toISOString() : undefined,
        chainId: Number(propertyForm.chainId),
      };

      if (!payload.propertyId) {
        throw new Error('Property name is required');
      }

      if (!Number.isFinite(Number(propertyForm.targetUsdc)) || Number(propertyForm.targetUsdc) <= 0) {
        throw new Error('Target USDC must be greater than 0');
      }
      if (
        propertyForm.estimatedSellUsdc.trim() !== '' &&
        (!Number.isFinite(Number(propertyForm.estimatedSellUsdc)) ||
          Number(propertyForm.estimatedSellUsdc) <= 0)
      ) {
        throw new Error('Estimated sell price must be greater than 0 when provided');
      }
      for (const [label, value] of [
        ['Conservative sell price', propertyForm.conservativeSellUsdc],
        ['Base sell price', propertyForm.baseSellUsdc],
        ['Optimistic sell price', propertyForm.optimisticSellUsdc],
      ] as const) {
        if (value.trim() !== '' && (!Number.isFinite(Number(value)) || Number(value) <= 0)) {
          throw new Error(`${label} must be greater than 0 when provided`);
        }
      }
      for (const [label, value] of [
        ['Conservative multiplier', propertyForm.conservativeMultiplierPct],
        ['Base multiplier', propertyForm.baseMultiplierPct],
        ['Optimistic multiplier', propertyForm.optimisticMultiplierPct],
      ] as const) {
        if (value.trim() !== '' && (!Number.isFinite(Number(value)) || Number(value) <= 0)) {
          throw new Error(`${label} must be greater than 0 when provided`);
        }
      }

      if ((propertyForm.startTime && !propertyForm.endTime) || (!propertyForm.startTime && propertyForm.endTime)) {
        throw new Error('Provide both campaign start and end time');
      }
      if (propertyForm.startTime && propertyForm.endTime) {
        const startMs = new Date(propertyForm.startTime).getTime();
        const endMs = new Date(propertyForm.endTime).getTime();
        if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
          throw new Error('Invalid campaign schedule');
        }
        if (endMs <= startMs) {
          throw new Error('Campaign end time must be after start time');
        }
      }

      await createPropertyIntent(payload, token);
      setStatusMessage('Property intent created successfully.');
      void loadCampaigns();
      void loadIntents(token);
      setShowCreatePropertyModal(false);
      setPropertyForm({
        propertyId: '',
        name: '',
        description: '',
        location: '',
        imageUrl: '',
        imageUrlsText: '',
        youtubeEmbedUrl: '',
        targetUsdc: '',
        estimatedSellUsdc: '',
        conservativeSellUsdc: '',
        baseSellUsdc: '',
        optimisticSellUsdc: '',
        conservativeMultiplierPct: '',
        baseMultiplierPct: '',
        optimisticMultiplierPct: '',
        startTime: '',
        endTime: '',
        chainId: '84532',
      });
      setPropertyImageFile(null);
      setPropertyImageUploadProgress(0);
      setPropertyImageUploadState('idle');
      setPropertyImageUploadDebug('');
    } catch (error) {
      setErrorMessage((error as Error).message);
      setStatusMessage('');
    }
  };

  const handleUploadPropertyImage = async () => {
    setErrorMessage('');
    if (!token) {
      setErrorMessage('You must be logged in as an admin to upload images.');
      return;
    }
    if (!propertyImageFile) {
      setErrorMessage('Choose an image file first.');
      return;
    }

    setIsUploadingPropertyImage(true);
    setPropertyImageUploadProgress(0);
    setPropertyImageUploadState('uploading');
    setPropertyImageUploadDebug('');
    setStatusMessage('Uploading image...');
    try {
      const preparedFile = await compressImageFile(propertyImageFile);
      const signature = await createCloudinaryUploadSignature(token, {
        folder: 'homeshare/properties',
      });

      const formData = new FormData();
      formData.append('file', preparedFile);
      formData.append('api_key', signature.apiKey);
      formData.append('timestamp', signature.timestamp);
      formData.append('signature', signature.signature);
      formData.append('folder', signature.folder);
      if (signature.publicId) {
        formData.append('public_id', signature.publicId);
      }

      const data = await uploadFormDataWithProgress(
        signature.uploadUrl,
        formData,
        setPropertyImageUploadProgress
      );
      const secureUrlCandidate =
        (typeof data?.secure_url === 'string' ? data.secure_url : null) ||
        (typeof data?.url === 'string' ? data.url : null);
      if (!secureUrlCandidate) {
        setPropertyImageUploadDebug(JSON.stringify(data, null, 2).slice(0, 1200));
        throw new Error('Image upload failed');
      }

      setPropertyForm((prev) => ({ ...prev, imageUrl: secureUrlCandidate }));
      setStatusMessage(`Image uploaded successfully (${secureUrlCandidate}).`);
      setPropertyImageUploadProgress(100);
      setPropertyImageUploadState('success');
      setPropertyImageFile(null);
      setPropertyImageUploadDebug(JSON.stringify(data, null, 2).slice(0, 1200));
    } catch (error) {
      setErrorMessage((error as Error).message);
      setStatusMessage('');
      setPropertyImageUploadState('error');
    } finally {
      setIsUploadingPropertyImage(false);
    }
  };

  const handleCreatePlatformFeeIntent = async () => {
    setErrorMessage('');
    setStatusMessage('Submitting platform fee intent...');
    try {
      const payload = buildPlatformFeePayload();
      if (platformFeePreflight && !platformFeePreflight.checks.recipientValid) {
        throw new Error('Platform fee intent blocked: invalid fee recipient.');
      }
      await ensureSettlementIntentEligibility(payload.campaignAddress, 'Platform fee intent');

      await createPlatformFeeIntent(payload, token as string);

      setStatusMessage('Platform fee intent submitted.');
      if (
        platformFeePreflight &&
        (!platformFeePreflight.checks.operatorConfigured ||
          !platformFeePreflight.checks.ownerMatchesOperator ||
          !platformFeePreflight.checks.indexerHealthy ||
          !platformFeePreflight.checks.workersHealthy)
      ) {
        setStatusMessage(
          'Platform fee intent submitted with operational warnings. Check preflight flags before execution.'
        );
      }
      setPlatformFeeForm({
        campaignAddress: '',
        platformFeeBps: '',
        platformFeeRecipient: '',
      });
      setShowPlatformFeeModal(false);
      void loadCampaigns();
      void loadIntents(token);
      await refreshPlatformFeeChecks(
        token as string,
        payload.campaignAddress,
        payload.platformFeeBps,
        payload.platformFeeRecipient
      );
    } catch (error) {
      setErrorMessage((error as Error).message);
      setStatusMessage('');
    }
  };

  const buildPlatformFeePayload = () => {
    if (!token) {
      throw new Error('You must be logged in as an admin to update platform fees.');
    }

    const platformFeeBps = Number(platformFeeForm.platformFeeBps);
    if (!Number.isInteger(platformFeeBps) || platformFeeBps < 0 || platformFeeBps > 2000) {
      throw new Error('Platform fee must be an integer between 0 and 2000 bps.');
    }
    if (!platformFeeForm.campaignAddress.trim()) {
      throw new Error('Campaign address is required.');
    }
    if (platformFeeBps > 0 && !effectivePlatformFeeRecipient) {
      throw new Error('Fee recipient is required when fee is greater than 0. Use Advanced to set it.');
    }

    return {
      chainId: 84532,
      campaignAddress: platformFeeForm.campaignAddress.trim(),
      platformFeeBps,
      platformFeeRecipient: platformFeeBps === 0 ? null : effectivePlatformFeeRecipient,
    };
  };

  const buildSettlementBatchPayload = (input: {
    campaignAddress: string;
    grossSettlementUsdc: string;
    platformFeeBps: string;
    platformFeeRecipient: string;
    profitDistributorAddress: string;
  }) => {
    if (!token) {
      throw new Error('You must be logged in as an admin to submit intents.');
    }
    if (!input.campaignAddress.trim()) {
      throw new Error('Select a campaign for settlement.');
    }
    const selectedCampaign =
      campaigns.find((campaign) => campaign.campaignAddress === input.campaignAddress) ?? null;
    if (!selectedCampaign) {
      throw new Error('Selected campaign is not available.');
    }
    if (!input.profitDistributorAddress.trim()) {
      throw new Error('Profit distributor is missing for selected campaign/property.');
    }
    const bps = Number(input.platformFeeBps);
    if (!Number.isInteger(bps) || bps < 0 || bps > 2000) {
      throw new Error('Platform fee bps must be an integer between 0 and 2000.');
    }
    if (bps > 0 && !input.platformFeeRecipient.trim()) {
      throw new Error('Platform fee recipient is required when fee is greater than 0.');
    }
    const checksumCampaignAddress = getAddress(input.campaignAddress.trim());
    const checksumDistributorAddress = getAddress(input.profitDistributorAddress.trim());
    const checksumRecipientAddress = bps === 0 ? null : getAddress(input.platformFeeRecipient.trim());
    const grossSettlementUsdc = Number(input.grossSettlementUsdc);
    if (!Number.isFinite(grossSettlementUsdc) || grossSettlementUsdc <= 0) {
      throw new Error('Gross settlement amount must be greater than 0.');
    }
    const feeUsdc = (grossSettlementUsdc * bps) / 10_000;
    const netDistributionUsdc = grossSettlementUsdc - feeUsdc;
    if (!Number.isFinite(netDistributionUsdc) || netDistributionUsdc <= 0) {
      throw new Error('Net investor distribution must be greater than 0 after platform fee.');
    }
    return {
      selectedCampaign,
      checksumCampaignAddress,
      checksumDistributorAddress,
      checksumRecipientAddress,
      grossSettlementUsdc,
      feeUsdc,
      netDistributionUsdc,
      bps,
      payload: {
        chainId: 84532,
        includeProfitIntent: true,
        includePlatformFeeIntent: true,
        propertyId: selectedCampaign.propertyId,
        profitDistributorAddress: checksumDistributorAddress.toLowerCase(),
        usdcAmountBaseUnits: Math.round(netDistributionUsdc * 1_000_000).toString(),
        campaignAddress: checksumCampaignAddress.toLowerCase(),
        platformFeeBps: bps,
        platformFeeRecipient: bps === 0 ? null : checksumRecipientAddress?.toLowerCase(),
        platformFeeUsdcAmountBaseUnits: Math.round(feeUsdc * 1_000_000).toString(),
      } satisfies Parameters<typeof createAdminIntentBatch>[0],
    };
  };

  const submitSettlementBatch = async (input: {
    campaignAddress: string;
    grossSettlementUsdc: string;
    platformFeeBps: string;
    platformFeeRecipient: string;
    profitDistributorAddress: string;
    skipRecentDuplicateGuard?: boolean;
  }) => {
    const built = buildSettlementBatchPayload(input);
    await ensureSettlementIntentEligibility(built.checksumCampaignAddress, 'Settlement');
    if (!input.skipRecentDuplicateGuard) {
      const duplicateSettlement = combinedHistory.find((entry) => {
        if (!entry.grossSettlementUsdc || !entry.platformFeeUsdc || !entry.netDistributionUsdc) {
          return false;
        }
        const createdMs = new Date(entry.createdAt).getTime();
        const recentEnough = Number.isFinite(createdMs) && Date.now() - createdMs < 5 * 60 * 1000;
        return (
          recentEnough &&
          entry.campaignAddress.toLowerCase() === built.checksumCampaignAddress.toLowerCase() &&
          entry.grossSettlementUsdc === built.grossSettlementUsdc.toFixed(6) &&
          entry.platformFeeUsdc === built.feeUsdc.toFixed(6) &&
          entry.netDistributionUsdc === built.netDistributionUsdc.toFixed(6)
        );
      });
      if (duplicateSettlement) {
        throw new Error(
          'Similar settlement was just submitted recently. Refresh statuses before submitting again.'
        );
      }
    }
    const response = await createAdminIntentBatch(built.payload, token as string);
    const historyRecord: CombinedSubmissionRecord = {
      id:
        response.profitIntent?.id ||
        response.platformFeeIntent?.id ||
        `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      createdAt: new Date().toISOString(),
      campaignAddress: built.checksumCampaignAddress.toLowerCase(),
      propertyId: built.selectedCampaign.propertyId,
      includeProfitIntent: true,
      includePlatformFeeIntent: true,
      profitIntentId: response.profitIntent?.id ?? null,
      platformFeeIntentId: response.platformFeeIntent?.id ?? null,
      grossSettlementUsdc: built.grossSettlementUsdc.toFixed(6),
      platformFeeUsdc: built.feeUsdc.toFixed(6),
      netDistributionUsdc: built.netDistributionUsdc.toFixed(6),
      platformFeeRecipient: built.checksumRecipientAddress?.toLowerCase() ?? null,
      profitDistributorAddress: built.checksumDistributorAddress.toLowerCase(),
    };
    persistCombinedHistory([historyRecord, ...combinedHistory].slice(0, 10));
    return { response, built };
  };

  const handleCreateCombinedIntentBatch = async () => {
    if (isSubmittingSettlement) {
      return;
    }
    setErrorMessage('');
    setStatusMessage('Submitting settlement intents...');
    setIsSubmittingSettlement(true);
    try {
      const built = buildSettlementBatchPayload({
        campaignAddress: combinedForm.campaignAddress,
        grossSettlementUsdc: combinedForm.grossSettlementUsdc,
        platformFeeBps: combinedForm.platformFeeBps,
        platformFeeRecipient: effectiveCombinedRecipient,
        profitDistributorAddress: effectiveCombinedDistributor,
      });
      const confirmation = window.confirm(
        [
          'Confirm settlement submission',
          '',
          `Campaign: ${built.checksumCampaignAddress}`,
          `Property: ${built.selectedCampaign.propertyId}`,
          `Gross settlement: ${built.grossSettlementUsdc.toLocaleString(undefined, { maximumFractionDigits: 6 })} USDC`,
          `Platform fee (${built.bps} bps): ${built.feeUsdc.toLocaleString(undefined, { maximumFractionDigits: 6 })} USDC`,
          `Net investor distribution: ${built.netDistributionUsdc.toLocaleString(undefined, { maximumFractionDigits: 6 })} USDC`,
          `Fee recipient: ${built.bps === 0 ? 'N/A (fee disabled)' : built.checksumRecipientAddress}`,
          `Profit distributor: ${built.checksumDistributorAddress}`,
          '',
          'Proceed?',
        ].join('\n')
      );
      if (!confirmation) {
        setStatusMessage('Settlement submission cancelled.');
        return;
      }
      const { response } = await submitSettlementBatch({
        campaignAddress: combinedForm.campaignAddress,
        grossSettlementUsdc: combinedForm.grossSettlementUsdc,
        platformFeeBps: combinedForm.platformFeeBps,
        platformFeeRecipient: effectiveCombinedRecipient,
        profitDistributorAddress: effectiveCombinedDistributor,
      });
      const created: string[] = [];
      if (response.profitIntent) created.push('profit');
      if (response.platformFeeIntent) created.push('platform-fee');
      setStatusMessage(
        created.length > 0
          ? `Settlement submit successful: ${created.join(' + ')} intent(s) created.`
          : 'Settlement submit completed.'
      );

      setCombinedForm((prev) => ({
        ...prev,
        profitUsdcAmount: '',
        grossSettlementUsdc: '',
        includeProfitIntent: true,
        includePlatformFeeIntent: true,
      }));
      setShowCombinedIntentModal(false);

      void loadCampaigns();
      await loadIntents(token as string);
      await refreshCombinedProgress(token as string);
    } catch (error) {
      setErrorMessage((error as Error).message);
      setStatusMessage('');
    } finally {
      setIsSubmittingSettlement(false);
    }
  };

  const handleRetryCombinedSubmission = async (record: CombinedSubmissionRecord) => {
    if (!token || !canManageOwnerFlows) return;
    setErrorMessage('');
    setStatusMessage(`Retrying failed intents for ${record.propertyId}...`);
    try {
      if (record.profitIntentId) {
        const profitIntent = profitIntentById.get(record.profitIntentId);
        if (profitIntent?.status === 'failed') {
          await retryAdminIntent(token, 'profit', record.profitIntentId);
        }
      }
      if (record.platformFeeIntentId) {
        const platformIntent = platformFeeIntentById.get(record.platformFeeIntentId);
        if (platformIntent?.status === 'failed') {
          await retryAdminIntent(token, 'platformFee', record.platformFeeIntentId);
        }
      }
      setStatusMessage(`Retry queued for ${record.propertyId}.`);
      await handleRefreshCombinedStatuses();
    } catch (error) {
      setErrorMessage((error as Error).message);
      setStatusMessage('');
    }
  };

  const handleExportSettlementCsv = () => {
    if (combinedHistory.length === 0) return;
    const header = [
      'createdAt',
      'propertyId',
      'campaignAddress',
      'grossSettlementUsdc',
      'platformFeeUsdc',
      'netDistributionUsdc',
      'platformFeeRecipient',
      'profitDistributorAddress',
      'profitIntentId',
      'platformFeeIntentId',
      'profitIntentStatus',
      'platformFeeIntentStatus',
    ];
    const rows = combinedHistory.map((record) => {
      const profitStatus = record.profitIntentId
        ? (profitIntentById.get(record.profitIntentId)?.status ?? '')
        : '';
      const platformStatus = record.platformFeeIntentId
        ? (platformFeeIntentById.get(record.platformFeeIntentId)?.status ?? '')
        : '';
      return [
        record.createdAt,
        record.propertyId,
        record.campaignAddress,
        record.grossSettlementUsdc ?? '',
        record.platformFeeUsdc ?? '',
        record.netDistributionUsdc ?? '',
        record.platformFeeRecipient ?? '',
        record.profitDistributorAddress ?? '',
        record.profitIntentId ?? '',
        record.platformFeeIntentId ?? '',
        profitStatus,
        platformStatus,
      ];
    });
    const escape = (value: string) => `"${String(value).replace(/"/g, '""')}"`;
    const csv = [header, ...rows].map((line) => line.map((value) => escape(value)).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `settlements-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleCreateProfitIntent = async () => {
    setErrorMessage('');
    setStatusMessage('Submitting profit distribution intent...');
    try {
      const payload = buildProfitIntentPayload();
      const linkedCampaign = resolveCampaignForProperty(payload.propertyId);
      await ensureSettlementIntentEligibility(linkedCampaign.campaignAddress, 'Profit intent');
      if (!profitPreflight) {
        throw new Error('Profit preflight not loaded yet. Wait and retry.');
      }
      const failedChecks: string[] = [];
      if (!profitPreflight.checks.operatorConfigured) failedChecks.push('operator wallet not configured');
      if (!profitPreflight.checks.ownerMatchesOperator) failedChecks.push('profit distributor owner mismatch');
      if (!profitPreflight.checks.hasSufficientBalance) failedChecks.push('insufficient operator USDC balance');
      if (!profitPreflight.checks.indexerHealthy) failedChecks.push('indexer not healthy');
      if (!profitPreflight.checks.workersHealthy) failedChecks.push('worker backlog indicates unhealthy worker execution');
      if (failedChecks.length > 0) {
        throw new Error(`Profit intent blocked by preflight: ${failedChecks.join(', ')}`);
      }

      await createProfitDistributionIntent(payload, token as string);

      setStatusMessage('Profit distribution intent submitted.');
      setProfitForm({
        propertyId: '',
        profitDistributorAddress: '',
        usdcAmount: '',
      });
      setShowCreateProfitModal(false);
      void loadIntents(token);
      await refreshProfitChecks(token as string, payload.propertyId, payload.usdcAmountBaseUnits);
    } catch (error) {
      setErrorMessage((error as Error).message);
      setStatusMessage('');
    }
  };

  const buildProfitIntentPayload = () => {
    if (!token) {
      throw new Error('You must be logged in as an admin to create profit intents.');
    }
    if (!profitForm.propertyId.trim()) {
      throw new Error('Property ID is required.');
    }
    if (!effectiveProfitDistributorAddress) {
      throw new Error('Profit distributor address is required.');
    }
    const usdcAmount = Number(profitForm.usdcAmount);
    if (!Number.isFinite(usdcAmount) || usdcAmount <= 0) {
      throw new Error('USDC amount must be greater than 0.');
    }
    return {
      chainId: 84532,
      propertyId: profitForm.propertyId.trim(),
      profitDistributorAddress: effectiveProfitDistributorAddress,
      usdcAmountBaseUnits: Math.round(usdcAmount * 1_000_000).toString(),
    };
  };

  const refreshProfitChecks = async (
    authToken: string,
    propertyId: string,
    usdcAmountBaseUnits: string
  ) => {
    setProfitChecksLoading(true);
    try {
      const [preflight, flow] = await Promise.all([
        fetchProfitPreflight(authToken, {
          propertyId,
          usdcAmountBaseUnits,
        }),
        fetchProfitFlowStatus(authToken, propertyId),
      ]);
      setProfitPreflight(preflight);
      setProfitFlowStatus(flow);
    } catch {
      setProfitPreflight(null);
      setProfitFlowStatus(null);
    } finally {
      setProfitChecksLoading(false);
    }
  };

  const refreshPlatformFeeChecks = async (
    authToken: string,
    campaignAddress: string,
    platformFeeBps: number,
    platformFeeRecipient?: string | null
  ) => {
    setPlatformFeeChecksLoading(true);
    try {
      const [preflight, flow] = await Promise.all([
        fetchPlatformFeePreflight(authToken, {
          campaignAddress,
          platformFeeBps,
          platformFeeRecipient,
        }),
        fetchPlatformFeeFlowStatus(authToken, {
          campaignAddress,
          platformFeeBps,
          platformFeeRecipient,
        }),
      ]);
      setPlatformFeePreflight(preflight);
      setPlatformFeeFlowStatus(flow);
    } catch {
      setPlatformFeePreflight(null);
      setPlatformFeeFlowStatus(null);
    } finally {
      setPlatformFeeChecksLoading(false);
    }
  };

  const persistCombinedHistory = (next: CombinedSubmissionRecord[]) => {
    setCombinedHistory(next);
    try {
      window.localStorage.setItem(COMBINED_HISTORY_KEY, JSON.stringify(next.slice(0, 10)));
    } catch {
      // Ignore storage failures.
    }
  };

  const clearCombinedHistory = () => {
    setCombinedProgress({});
    persistCombinedHistory([]);
  };

  const refreshCombinedProgress = async (authToken: string) => {
    if (combinedHistory.length === 0) {
      return;
    }
    setCombinedProgressLoading(true);
    try {
      const next: Record<string, CombinedSubmissionProgress> = {};
      await Promise.all(
        combinedHistory.map(async (record) => {
          const baseProgress: CombinedSubmissionProgress = {
            loading: false,
            error: null,
            profitIntentStatus:
              record.profitIntentId && profitIntentById.get(record.profitIntentId)
                ? profitIntentById.get(record.profitIntentId)?.status ?? null
                : null,
            platformFeeIntentStatus:
              record.platformFeeIntentId && platformFeeIntentById.get(record.platformFeeIntentId)
                ? platformFeeIntentById.get(record.platformFeeIntentId)?.status ?? null
                : null,
            campaignMatchesTarget: null,
            profitDepositIndexed: null,
            claimablePoolPositive: null,
            unclaimedPoolBaseUnits: null,
          };

          try {
            const [profitFlow, platformFlow] = await Promise.all([
              record.includeProfitIntent
                ? fetchProfitFlowStatus(authToken, record.propertyId)
                : Promise.resolve(null),
              record.includePlatformFeeIntent
                ? fetchPlatformFeeFlowStatus(authToken, {
                    campaignAddress: record.campaignAddress,
                  })
                : Promise.resolve(null),
            ]);

            next[record.id] = {
              ...baseProgress,
              campaignMatchesTarget: platformFlow?.flags.campaignMatchesTarget ?? null,
              profitDepositIndexed: profitFlow?.flags.depositIndexed ?? null,
              claimablePoolPositive: profitFlow?.flags.claimablePoolPositive ?? null,
              unclaimedPoolBaseUnits: profitFlow?.unclaimedPoolBaseUnits ?? null,
            };
          } catch (error) {
            next[record.id] = {
              ...baseProgress,
              error: error instanceof Error ? error.message : 'failed to load combined flow status',
            };
          }
        })
      );
      setCombinedProgress(next);
    } finally {
      setCombinedProgressLoading(false);
    }
  };

  const handleApproveProfitAllowance = async () => {
    setErrorMessage('');
    setStatusMessage('Approving operator USDC allowance...');
    setIsApprovingProfitAllowance(true);
    try {
      const payload = buildProfitIntentPayload();
      const approval = await approveProfitAllowance(
        {
          chainId: 84532,
          propertyId: payload.propertyId,
          usdcAmountBaseUnits: payload.usdcAmountBaseUnits,
          mode: 'max',
        },
        token as string
      );
      if (!approval.checks.hasSufficientAllowance) {
        throw new Error('Allowance approval completed but allowance is still insufficient.');
      }
      setStatusMessage(
        approval.txHash
          ? `Allowance approved: ${approval.txHash}`
          : 'Allowance already sufficient; no approval tx required.'
      );
      await refreshProfitChecks(token as string, payload.propertyId, payload.usdcAmountBaseUnits);
    } catch (error) {
      setErrorMessage((error as Error).message);
      setStatusMessage('');
    } finally {
      setIsApprovingProfitAllowance(false);
    }
  };

  const handleApproveAndSubmitProfitIntent = async () => {
    setErrorMessage('');
    setStatusMessage('Approving allowance and submitting profit intent...');
    setIsApprovingProfitAllowance(true);
    try {
      const payload = buildProfitIntentPayload();
      const linkedCampaign = resolveCampaignForProperty(payload.propertyId);
      await ensureSettlementIntentEligibility(linkedCampaign.campaignAddress, 'Profit intent');
      const approval = await approveProfitAllowance(
        {
          chainId: 84532,
          propertyId: payload.propertyId,
          usdcAmountBaseUnits: payload.usdcAmountBaseUnits,
          mode: 'max',
        },
        token as string
      );
      if (!approval.checks.hasSufficientAllowance) {
        throw new Error('Allowance approval completed but allowance is still insufficient.');
      }

      await createProfitDistributionIntent(payload, token as string);
      setStatusMessage(
        approval.txHash
          ? `Allowance approved (${approval.txHash}) and profit intent submitted.`
          : 'Allowance already sufficient; profit intent submitted.'
      );
      setShowCreateProfitModal(false);
      void loadIntents(token);
      await refreshProfitChecks(token as string, payload.propertyId, payload.usdcAmountBaseUnits);
    } catch (error) {
      setErrorMessage((error as Error).message);
      setStatusMessage('');
    } finally {
      setIsApprovingProfitAllowance(false);
    }
  };

  const handleRefreshCombinedStatuses = async () => {
    if (!token) return;
    await loadIntents(token);
    await refreshCombinedProgress(token);
  };

  const openEditPropertyModal = (property: AdminPropertyResponse) => {
    const nextForm = {
      name: property.name ?? '',
      location: property.location ?? '',
      description: property.description ?? '',
      imageUrl: property.imageUrl ?? '',
      imageUrlsText: (property.imageUrls ?? []).join('\n'),
      youtubeEmbedUrl: property.youtubeEmbedUrl ?? '',
      estimatedSellUsdc: property.estimatedSellUsdcBaseUnits
        ? (Number(property.estimatedSellUsdcBaseUnits) / 1_000_000).toString()
        : '',
      conservativeSellUsdc: property.conservativeSellUsdcBaseUnits
        ? (Number(property.conservativeSellUsdcBaseUnits) / 1_000_000).toString()
        : '',
      baseSellUsdc: property.baseSellUsdcBaseUnits
        ? (Number(property.baseSellUsdcBaseUnits) / 1_000_000).toString()
        : '',
      optimisticSellUsdc: property.optimisticSellUsdcBaseUnits
        ? (Number(property.optimisticSellUsdcBaseUnits) / 1_000_000).toString()
        : '',
      conservativeMultiplierPct: property.conservativeMultiplierBps
        ? (property.conservativeMultiplierBps / 100).toString()
        : '',
      baseMultiplierPct: property.baseMultiplierBps
        ? (property.baseMultiplierBps / 100).toString()
        : '',
      optimisticMultiplierPct: property.optimisticMultiplierBps
        ? (property.optimisticMultiplierBps / 100).toString()
        : '',
    };
    setEditingPropertyId(property.propertyId);
    setEditPropertyForm(nextForm);
    setInitialEditPropertyForm(nextForm);
    setShowEditPropertyModal(true);
  };

  const handleSavePropertyEdits = async () => {
    if (!token || !editingPropertyId) {
      setErrorMessage('You must be logged in as an admin to update properties.');
      return;
    }

    setErrorMessage('');
    setStatusMessage('Updating property metadata...');
    try {
      await updateAdminProperty(token, editingPropertyId, {
        name: editPropertyForm.name.trim(),
        location: editPropertyForm.location.trim(),
        description: editPropertyForm.description.trim(),
        imageUrl: editPropertyForm.imageUrl.trim() || null,
        imageUrls: editPropertyForm.imageUrlsText
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean),
        youtubeEmbedUrl: editPropertyForm.youtubeEmbedUrl.trim() || null,
        estimatedSellUsdcBaseUnits:
          editPropertyForm.estimatedSellUsdc.trim() === ''
            ? null
            : Math.round(Number(editPropertyForm.estimatedSellUsdc) * 1_000_000).toString(),
        conservativeSellUsdcBaseUnits:
          editPropertyForm.conservativeSellUsdc.trim() === ''
            ? null
            : Math.round(Number(editPropertyForm.conservativeSellUsdc) * 1_000_000).toString(),
        baseSellUsdcBaseUnits:
          editPropertyForm.baseSellUsdc.trim() === ''
            ? null
            : Math.round(Number(editPropertyForm.baseSellUsdc) * 1_000_000).toString(),
        optimisticSellUsdcBaseUnits:
          editPropertyForm.optimisticSellUsdc.trim() === ''
            ? null
            : Math.round(Number(editPropertyForm.optimisticSellUsdc) * 1_000_000).toString(),
        conservativeMultiplierBps:
          editPropertyForm.conservativeMultiplierPct.trim() === ''
            ? null
            : Math.round(Number(editPropertyForm.conservativeMultiplierPct) * 100),
        baseMultiplierBps:
          editPropertyForm.baseMultiplierPct.trim() === ''
            ? null
            : Math.round(Number(editPropertyForm.baseMultiplierPct) * 100),
        optimisticMultiplierBps:
          editPropertyForm.optimisticMultiplierPct.trim() === ''
            ? null
            : Math.round(Number(editPropertyForm.optimisticMultiplierPct) * 100),
      });

      await Promise.all([loadCampaigns(), loadAdminProperties(token)]);
      setShowEditPropertyModal(false);
      setEditingPropertyId('');
      setStatusMessage('Property updated successfully.');
    } catch (error) {
      setErrorMessage((error as Error).message);
      setStatusMessage('');
    }
  };

  const handleArchiveProperty = async (propertyId: string) => {
    if (!token) return;
    const confirmed = window.confirm(
      `Archive property "${propertyId}"? It will be hidden from public property listings.`
    );
    if (!confirmed) return;

    setPropertyActionLoadingId(propertyId);
    setErrorMessage('');
    setStatusMessage(`Archiving property ${propertyId}...`);
    try {
      await archiveAdminProperty(token, propertyId);
      await Promise.all([loadCampaigns(), loadAdminProperties(token)]);
      setStatusMessage(`Property ${propertyId} archived.`);
    } catch (error) {
      setErrorMessage((error as Error).message);
      setStatusMessage('');
    } finally {
      setPropertyActionLoadingId(null);
    }
  };

  const handleRestoreProperty = async (propertyId: string) => {
    if (!token) return;
    setPropertyActionLoadingId(propertyId);
    setErrorMessage('');
    setStatusMessage(`Restoring property ${propertyId}...`);
    try {
      await restoreAdminProperty(token, propertyId);
      await Promise.all([loadCampaigns(), loadAdminProperties(token)]);
      setStatusMessage(`Property ${propertyId} restored.`);
    } catch (error) {
      setErrorMessage((error as Error).message);
      setStatusMessage('');
    } finally {
      setPropertyActionLoadingId(null);
    }
  };

  const togglePropertySelection = (propertyId: string) => {
    setSelectedPropertyIds((prev) =>
      prev.includes(propertyId) ? prev.filter((id) => id !== propertyId) : [...prev, propertyId]
    );
  };

  const toggleSelectAllFilteredProperties = () => {
    setSelectedPropertyIds((prev) => {
      if (allFilteredSelected) {
        return prev.filter((id) => !filteredAdminPropertyIds.includes(id));
      }
      const merged = new Set([...prev, ...filteredAdminPropertyIds]);
      return Array.from(merged);
    });
  };

  const handleBulkArchiveSelectedProperties = async () => {
    if (!token) return;
    const targets = adminProperties
      .filter((property) => selectedPropertyIds.includes(property.propertyId) && !property.archivedAt)
      .map((property) => property.propertyId);
    if (targets.length === 0) {
      setStatusMessage('No active selected properties to archive.');
      setErrorMessage('');
      return;
    }
    const confirmed = window.confirm(`Archive ${targets.length} selected properties?`);
    if (!confirmed) return;

    setBulkPropertyActionLoading('archive');
    setStatusMessage(`Archiving ${targets.length} properties...`);
    setErrorMessage('');
    try {
      await Promise.all(targets.map((propertyId) => archiveAdminProperty(token, propertyId)));
      await Promise.all([loadCampaigns(), loadAdminProperties(token)]);
      setSelectedPropertyIds([]);
      setStatusMessage(`Archived ${targets.length} properties.`);
    } catch (error) {
      setErrorMessage((error as Error).message);
      setStatusMessage('');
    } finally {
      setBulkPropertyActionLoading(null);
    }
  };

  const handleBulkRestoreSelectedProperties = async () => {
    if (!token) return;
    const targets = adminProperties
      .filter((property) => selectedPropertyIds.includes(property.propertyId) && !!property.archivedAt)
      .map((property) => property.propertyId);
    if (targets.length === 0) {
      setStatusMessage('No archived selected properties to restore.');
      setErrorMessage('');
      return;
    }

    setBulkPropertyActionLoading('restore');
    setStatusMessage(`Restoring ${targets.length} properties...`);
    setErrorMessage('');
    try {
      await Promise.all(targets.map((propertyId) => restoreAdminProperty(token, propertyId)));
      await Promise.all([loadCampaigns(), loadAdminProperties(token)]);
      setSelectedPropertyIds([]);
      setStatusMessage(`Restored ${targets.length} properties.`);
    } catch (error) {
      setErrorMessage((error as Error).message);
      setStatusMessage('');
    } finally {
      setBulkPropertyActionLoading(null);
    }
  };

  const handleQuickProfitIntent = async (propertyId: string, profitDistributorAddress: string) => {
    setErrorMessage('');
    setStatusMessage(`Submitting test profit intent for ${propertyId}...`);
    try {
      if (!token) {
        throw new Error('You must be logged in as an admin to create profit intents.');
      }

      await createProfitDistributionIntent(
        {
          chainId: 84532,
          propertyId,
          profitDistributorAddress,
          usdcAmountBaseUnits: (10 * 1_000_000).toString(),
        },
        token
      );

      setStatusMessage(`Test profit intent submitted for ${propertyId} (10 USDC).`);
      void loadIntents(token);
    } catch (error) {
      setErrorMessage((error as Error).message);
      setStatusMessage('');
    }
  };

  const prettyLifecycleReason = (reason: string): string => {
    if (reason === 'operator-wallet-not-configured') return 'Operator wallet is not configured';
    if (reason === 'campaign-owner-not-operator') return 'Campaign owner does not match operator wallet';
    if (reason === 'campaign-not-finishable-yet')
      return 'Campaign cannot be finalized yet (target not reached and end time not elapsed)';
    if (reason === 'campaign-usdc-balance-zero') return 'Campaign USDC balance is zero';
    if (reason.startsWith('campaign-state-')) {
      const state = reason.replace('campaign-state-', '').toUpperCase();
      return `Campaign state is ${state}`;
    }
    return reason;
  };

  const loadCampaignLifecyclePreflight = async (campaignAddress: string) => {
    if (!token) {
      throw new Error('You must be logged in as an admin to manage campaigns.');
    }
    const preflight = await fetchCampaignLifecyclePreflight(token, campaignAddress);
    setCampaignLifecyclePreflightByAddress((prev) => ({
      ...prev,
      [campaignAddress.toLowerCase()]: preflight,
    }));
    return preflight;
  };

  const resolveCampaignForProperty = (propertyId: string): CampaignResponse => {
    const campaign = campaigns.find((entry) => entry.propertyId === propertyId) ?? null;
    if (!campaign) {
      throw new Error(
        `No campaign found for property ${propertyId}. You can submit settlement intents only for deployed campaigns.`
      );
    }
    return campaign;
  };

  const ensureSettlementIntentEligibility = async (
    campaignAddress: string,
    label: 'Profit intent' | 'Platform fee intent' | 'Settlement'
  ) => {
    const preflight = await loadCampaignLifecyclePreflight(campaignAddress);
    const state = preflight.campaign.state;
    const balance = BigInt(preflight.campaign.campaignUsdcBalanceBaseUnits);
    if (state === 'ACTIVE') {
      throw new Error(`${label} blocked: campaign is ACTIVE. Finalize campaign first.`);
    }
    if (state === 'FAILED') {
      throw new Error(`${label} blocked: campaign FAILED and cannot be settled.`);
    }
    if (state === 'SUCCESS' && balance > 0n) {
      throw new Error(`${label} blocked: withdraw campaign funds first.`);
    }
    return preflight;
  };

  const handleFinalizeCampaign = async (campaignAddress: string) => {
    if (!token) {
      setErrorMessage('You must be logged in as an admin to manage campaigns.');
      return;
    }

    const actionKey = `finalize:${campaignAddress.toLowerCase()}`;
    setCampaignLifecycleLoadingKey(actionKey);
    setErrorMessage('');
    setStatusMessage('Checking finalize readiness...');
    try {
      const preflight = await loadCampaignLifecyclePreflight(campaignAddress);
      if (!preflight.actions.finalize.ready) {
        throw new Error(
          `Finalize blocked: ${preflight.actions.finalize.reasons
            .map(prettyLifecycleReason)
            .join('; ')}`
        );
      }
      setStatusMessage('Submitting finalize transaction...');
      const result = await finalizeCampaignAdmin(token, {
        campaignAddress,
        chainId: 84532,
      });
      setStatusMessage(`Finalize submitted: ${result.txHash}`);
      await Promise.all([loadCampaigns(), loadIntents(token)]);
      await loadCampaignLifecyclePreflight(campaignAddress);
    } catch (error) {
      setErrorMessage((error as Error).message);
      setStatusMessage('');
    } finally {
      setCampaignLifecycleLoadingKey(null);
    }
  };

  const handleRepairCampaignSetup = async (campaignAddress: string) => {
    if (!token) {
      setErrorMessage('You must be logged in as an admin to manage campaigns.');
      return;
    }

    const actionKey = `repair:${campaignAddress.toLowerCase()}`;
    setCampaignLifecycleLoadingKey(actionKey);
    setErrorMessage('');
    setStatusMessage('Checking campaign setup...');
    try {
      const preflight = await loadCampaignLifecyclePreflight(campaignAddress);
      if (preflight.campaign.state !== 'SUCCESS' && preflight.campaign.state !== 'WITHDRAWN') {
        throw new Error(
          `Repair blocked: campaign state is ${preflight.campaign.state}. Finalize/withdraw first.`
        );
      }
      setStatusMessage('Submitting repair transaction...');
      const result = await repairCampaignSetupAdmin(token, {
        campaignAddress,
        chainId: 84532,
      });
      setStatusMessage(
        result.txHash
          ? `Repair submitted: ${result.txHash}`
          : result.message || 'Campaign setup already healthy.'
      );
      await Promise.all([loadCampaigns(), loadIntents(token)]);
      await loadCampaignLifecyclePreflight(campaignAddress);
    } catch (error) {
      setErrorMessage((error as Error).message);
      setStatusMessage('');
    } finally {
      setCampaignLifecycleLoadingKey(null);
    }
  };

  const handleCheckCampaignLifecycle = async (campaignAddress: string) => {
    if (!token) {
      setErrorMessage('You must be logged in as an admin to manage campaigns.');
      return;
    }
    const actionKey = `check:${campaignAddress.toLowerCase()}`;
    setCampaignLifecycleLoadingKey(actionKey);
    setErrorMessage('');
    setStatusMessage('Loading campaign lifecycle checks...');
    try {
      await loadCampaignLifecyclePreflight(campaignAddress);
      setStatusMessage('Campaign lifecycle checks refreshed.');
    } catch (error) {
      setErrorMessage((error as Error).message);
      setStatusMessage('');
    } finally {
      setCampaignLifecycleLoadingKey(null);
    }
  };

  const openSmartWithdrawModal = async (campaign: CampaignResponse) => {
    const defaultRecipient = connectedWalletAddress || address || '';
    setSmartWithdrawCampaign(campaign);
    setSmartWithdrawRecipient(defaultRecipient);
    setSmartWithdrawPreflight(null);
    setSmartWithdrawStepMessage('Loading campaign checks...');
    setShowSmartWithdrawModal(true);
    try {
      const preflight = await loadCampaignLifecyclePreflight(campaign.campaignAddress);
      setSmartWithdrawPreflight(preflight);
      setSmartWithdrawStepMessage(
        preflight.actions.withdraw.ready
          ? 'Campaign is ready for withdraw.'
          : preflight.actions.finalize.ready
            ? 'Campaign must be finalized first. Auto-finalize is available.'
            : 'Withdraw is currently blocked by campaign checks.'
      );
    } catch (error) {
      setSmartWithdrawStepMessage((error as Error).message);
    }
  };

  const handleSmartWithdrawConfirm = async () => {
    if (!token || !smartWithdrawCampaign) {
      setErrorMessage('You must be logged in as an admin to manage campaigns.');
      return;
    }
    let recipient: string;
    try {
      recipient = getAddress(smartWithdrawRecipient.trim());
    } catch {
      setErrorMessage('Recipient address is invalid.');
      return;
    }

    setErrorMessage('');
    setIsSmartWithdrawRunning(true);
    try {
      setSmartWithdrawStepMessage('Checking campaign lifecycle...');
      let preflight = await loadCampaignLifecyclePreflight(smartWithdrawCampaign.campaignAddress);
      setSmartWithdrawPreflight(preflight);

      if (!preflight.actions.withdraw.ready) {
        if (preflight.actions.finalize.ready) {
          setSmartWithdrawStepMessage('Finalizing campaign before withdraw...');
          const finalizeResult = await finalizeCampaignAdmin(token, {
            campaignAddress: smartWithdrawCampaign.campaignAddress,
            chainId: 84532,
          });
          setSmartWithdrawStepMessage(`Finalize submitted: ${finalizeResult.txHash}`);
          await Promise.all([loadCampaigns(), loadIntents(token)]);
          preflight = await loadCampaignLifecyclePreflight(smartWithdrawCampaign.campaignAddress);
          setSmartWithdrawPreflight(preflight);
        } else {
          throw new Error(
            `Withdraw blocked: ${preflight.actions.withdraw.reasons
              .map(prettyLifecycleReason)
              .join('; ')}`
          );
        }
      }

      if (!preflight.actions.withdraw.ready) {
        throw new Error(
          `Withdraw still blocked after finalize check: ${preflight.actions.withdraw.reasons
            .map(prettyLifecycleReason)
            .join('; ')}`
        );
      }

      setSmartWithdrawStepMessage('Submitting withdraw transaction...');
      const withdrawResult = await withdrawCampaignFundsAdmin(token, {
        campaignAddress: smartWithdrawCampaign.campaignAddress,
        recipient,
        chainId: 84532,
      });
      setStatusMessage(`Withdraw submitted: ${withdrawResult.txHash}`);
      await Promise.all([loadCampaigns(), loadIntents(token)]);
      await loadCampaignLifecyclePreflight(smartWithdrawCampaign.campaignAddress);
      setShowSmartWithdrawModal(false);
      setSmartWithdrawCampaign(null);
      setSmartWithdrawPreflight(null);
      setSmartWithdrawStepMessage('');
    } catch (error) {
      setErrorMessage((error as Error).message);
      setStatusMessage('');
    } finally {
      setIsSmartWithdrawRunning(false);
    }
  };

  const createInitialFullSettlementSteps = (): FullSettlementStep[] => [
    { key: 'precheck', label: 'Precheck campaign state', status: 'pending', message: 'Pending' },
    { key: 'finalize', label: 'Finalize campaign (if needed)', status: 'pending', message: 'Pending' },
    { key: 'withdraw', label: 'Withdraw campaign funds', status: 'pending', message: 'Pending' },
    { key: 'repair', label: 'Repair setup (equity token mapping)', status: 'pending', message: 'Pending' },
    { key: 'submit', label: 'Submit settlement intents', status: 'pending', message: 'Pending' },
  ];

  const updateFullSettlementStep = (
    key: FullSettlementStep['key'],
    status: FullSettlementStepState,
    message: string
  ) => {
    setFullSettlementSteps((prev) =>
      prev.map((step) => (step.key === key ? { ...step, status, message } : step))
    );
  };

  const openFullSettlementModal = async (campaign: CampaignResponse) => {
    const property = properties.find((item) => item.propertyId === campaign.propertyId) ?? null;
    const latestForCampaign = combinedHistory.find(
      (entry) => entry.campaignAddress.toLowerCase() === campaign.campaignAddress.toLowerCase()
    );
    let suggestedGross = '';
    let suggestedSource = '';
    if (latestForCampaign?.grossSettlementUsdc) {
      const parsed = Number(latestForCampaign.grossSettlementUsdc);
      if (Number.isFinite(parsed) && parsed > 0) {
        suggestedGross = formatUsdcInput(parsed);
        suggestedSource = 'last settlement for this campaign';
      }
    }
    if (!suggestedGross && property?.baseSellUsdcBaseUnits) {
      const parsed = Number(property.baseSellUsdcBaseUnits) / 1_000_000;
      if (Number.isFinite(parsed) && parsed > 0) {
        suggestedGross = formatUsdcInput(parsed);
        suggestedSource = 'property base sell estimate';
      }
    }
    if (!suggestedGross && property?.estimatedSellUsdcBaseUnits) {
      const parsed = Number(property.estimatedSellUsdcBaseUnits) / 1_000_000;
      if (Number.isFinite(parsed) && parsed > 0) {
        suggestedGross = formatUsdcInput(parsed);
        suggestedSource = 'property estimated sell price';
      }
    }
    if (!suggestedGross) {
      const parsed = Number(campaign.targetUsdcBaseUnits) / 1_000_000;
      if (Number.isFinite(parsed) && parsed > 0) {
        suggestedGross = formatUsdcInput(parsed);
        suggestedSource = 'campaign target raise';
      }
    }

    setFullSettlementCampaign(campaign);
    setFullSettlementRecipient(connectedWalletAddress || address || '');
    setFullSettlementGrossUsdc(suggestedGross);
    setFullSettlementGrossSource(suggestedSource);
    setFullSettlementFeeBps(String(campaign.platformFeeBps ?? 0));
    setFullSettlementFeeRecipient(campaign.platformFeeRecipient ?? '');
    setFullSettlementDistributor(property?.profitDistributorAddress ?? '');
    setFullSettlementPreflight(null);
    setFullSettlementSteps(createInitialFullSettlementSteps());
    setShowFullSettlementModal(true);
    try {
      const preflight = await loadCampaignLifecyclePreflight(campaign.campaignAddress);
      setFullSettlementPreflight(preflight);
      updateFullSettlementStep('precheck', 'done', 'Precheck loaded.');
    } catch (error) {
      updateFullSettlementStep('precheck', 'error', (error as Error).message);
    }
  };

  const closeFullSettlementModal = () => {
    if (isRunningFullSettlement) return;
    setShowFullSettlementModal(false);
    setFullSettlementCampaign(null);
    setFullSettlementPreflight(null);
    setFullSettlementGrossSource('');
    setFullSettlementSteps([]);
  };

  const handleRunFullSettlement = async () => {
    if (!token || !fullSettlementCampaign) {
      setErrorMessage('You must be logged in as an admin to manage campaigns.');
      return;
    }
    let recipient: string;
    try {
      recipient = getAddress(fullSettlementRecipient.trim());
    } catch {
      setErrorMessage('Recipient address is invalid.');
      return;
    }

    setErrorMessage('');
    setStatusMessage('Running full settlement...');
    setIsRunningFullSettlement(true);
    if (fullSettlementSteps.length === 0) {
      setFullSettlementSteps(createInitialFullSettlementSteps());
    }
    let activeStep: FullSettlementStep['key'] = 'precheck';
    try {
      activeStep = 'precheck';
      updateFullSettlementStep('precheck', 'running', 'Loading precheck...');
      let preflight = await loadCampaignLifecyclePreflight(fullSettlementCampaign.campaignAddress);
      setFullSettlementPreflight(preflight);
      updateFullSettlementStep(
        'precheck',
        'done',
        `State=${preflight.campaign.state}, campaign USDC=${(
          Number(preflight.campaign.campaignUsdcBalanceBaseUnits) / 1_000_000
        ).toLocaleString(undefined, { maximumFractionDigits: 6 })}`
      );

      activeStep = 'finalize';
      if (preflight.actions.finalize.ready) {
        updateFullSettlementStep('finalize', 'running', 'Submitting finalize transaction...');
        const finalizeResult = await finalizeCampaignAdmin(token, {
          campaignAddress: fullSettlementCampaign.campaignAddress,
          chainId: 84532,
        });
        updateFullSettlementStep('finalize', 'done', `Finalize submitted: ${finalizeResult.txHash}`);
        await Promise.all([loadCampaigns(), loadIntents(token)]);
        preflight = await loadCampaignLifecyclePreflight(fullSettlementCampaign.campaignAddress);
        setFullSettlementPreflight(preflight);
      } else {
        updateFullSettlementStep('finalize', 'skipped', 'Already finalized or not required.');
      }

      activeStep = 'withdraw';
      if (!preflight.actions.withdraw.ready) {
        throw new Error(
          `Withdraw blocked: ${preflight.actions.withdraw.reasons.map(prettyLifecycleReason).join('; ')}`
        );
      }
      updateFullSettlementStep('withdraw', 'running', 'Submitting withdraw transaction...');
      const withdrawResult = await withdrawCampaignFundsAdmin(token, {
        campaignAddress: fullSettlementCampaign.campaignAddress,
        recipient,
        chainId: 84532,
      });
      updateFullSettlementStep('withdraw', 'done', `Withdraw submitted: ${withdrawResult.txHash}`);
      await Promise.all([loadCampaigns(), loadIntents(token)]);

      activeStep = 'repair';
      updateFullSettlementStep('repair', 'running', 'Repairing setup...');
      const repairResult = await repairCampaignSetupAdmin(token, {
        campaignAddress: fullSettlementCampaign.campaignAddress,
        chainId: 84532,
      });
      updateFullSettlementStep(
        'repair',
        'done',
        repairResult.txHash ? `Repair submitted: ${repairResult.txHash}` : repairResult.message
      );
      await Promise.all([loadCampaigns(), loadIntents(token)]);
      preflight = await loadCampaignLifecyclePreflight(fullSettlementCampaign.campaignAddress);
      setFullSettlementPreflight(preflight);

      activeStep = 'submit';
      updateFullSettlementStep('submit', 'running', 'Submitting settlement intents...');
      const { response } = await submitSettlementBatch({
        campaignAddress: fullSettlementCampaign.campaignAddress,
        grossSettlementUsdc: fullSettlementGrossUsdc,
        platformFeeBps: fullSettlementFeeBps,
        platformFeeRecipient: fullSettlementFeeRecipient,
        profitDistributorAddress: fullSettlementDistributor,
        skipRecentDuplicateGuard: true,
      });
      const created: string[] = [];
      if (response.platformFeeIntent) created.push('platform-fee');
      if (response.profitIntent) created.push('profit');
      updateFullSettlementStep(
        'submit',
        'done',
        created.length > 0 ? `Created ${created.join(' + ')} intent(s).` : 'No intents were created.'
      );
      await loadIntents(token);
      await refreshCombinedProgress(token);
      setStatusMessage('Full settlement completed.');
    } catch (error) {
      const message = (error as Error).message;
      setErrorMessage(message);
      setStatusMessage('');
      updateFullSettlementStep(activeStep, 'error', message);
    } finally {
      setIsRunningFullSettlement(false);
    }
  };

  const handleIntentAction = async (
    action: 'retry' | 'reset',
    intentType: IntentType,
    intentId: string
  ) => {
    if (!token) {
      setErrorMessage('You must be logged in as an admin to manage intents.');
      return;
    }

    setErrorMessage('');
    setStatusMessage(`${action === 'retry' ? 'Retrying' : 'Resetting'} ${intentType} intent...`);
    const actionKey = `${action}:${intentType}:${intentId}`;
    setIntentActionLoadingKey(actionKey);
    try {
      if (action === 'retry') {
        await retryAdminIntent(token, intentType, intentId);
      } else {
        await resetAdminIntent(token, intentType, intentId);
      }
      await loadIntents(token);
      await refreshCombinedProgress(token);
      setStatusMessage(
        `${intentType} intent ${action === 'retry' ? 'queued for retry' : 'reset to pending'}.`
      );
    } catch (error) {
      setErrorMessage((error as Error).message);
      setStatusMessage('');
    } finally {
      setIntentActionLoadingKey(null);
    }
  };

  const handleRetryFailedIntents = async (
    targets: Array<{ intentType: IntentType; intentId: string }>,
    scope: string
  ) => {
    if (!token) {
      setErrorMessage('You must be logged in as an admin to manage intents.');
      return;
    }
    if (targets.length === 0) {
      setStatusMessage('No failed intents found for retry.');
      setErrorMessage('');
      return;
    }

    setBulkRetryLoadingScope(scope);
    setErrorMessage('');
    setStatusMessage(`Retrying ${targets.length} failed intent(s)...`);

    try {
      for (const target of targets) {
        await retryAdminIntent(token, target.intentType, target.intentId);
      }
      await loadIntents(token);
      await refreshCombinedProgress(token);
      setStatusMessage(`Queued ${targets.length} failed intent(s) for retry.`);
    } catch (error) {
      setErrorMessage((error as Error).message);
      setStatusMessage('');
    } finally {
      setBulkRetryLoadingScope(null);
    }
  };

  const handleResetFailedIntents = async (
    targets: Array<{ intentType: IntentType; intentId: string }>,
    scope: string
  ) => {
    if (!token) {
      setErrorMessage('You must be logged in as an admin to manage intents.');
      return;
    }
    if (targets.length === 0) {
      setStatusMessage('No failed intents found for reset.');
      setErrorMessage('');
      return;
    }

    const confirmed = window.confirm(
      `Reset ${targets.length} failed intent(s) to pending with attempt count cleared?`
    );
    if (!confirmed) {
      return;
    }

    setBulkResetLoadingScope(scope);
    setErrorMessage('');
    setStatusMessage(`Resetting ${targets.length} failed intent(s)...`);

    try {
      for (const target of targets) {
        await resetAdminIntent(token, target.intentType, target.intentId);
      }
      await loadIntents(token);
      await refreshCombinedProgress(token);
      setStatusMessage(`Reset ${targets.length} failed intent(s) to pending.`);
    } catch (error) {
      setErrorMessage((error as Error).message);
      setStatusMessage('');
    } finally {
      setBulkResetLoadingScope(null);
    }
  };

  const loadCampaigns = async () => {
    setCampaignsLoading(true);
    try {
      const [campaignData, propertyData] = await Promise.all([
        fetchCampaigns(),
        fetchProperties(),
      ]);
      setCampaigns(campaignData);
      setProperties(propertyData);
    } catch (_error) {
      // Keep owner console usable even if campaign list fails.
    } finally {
      setCampaignsLoading(false);
    }
  };

  const loadAdminProperties = async (authToken: string | null) => {
    if (!authToken) {
      setAdminProperties([]);
      setPropertyCatalogLoading(false);
      return;
    }
    setPropertyCatalogLoading(true);
    try {
      const data = await fetchAdminProperties(authToken, true);
      setAdminProperties(data);
    } catch {
      setAdminProperties([]);
    } finally {
      setPropertyCatalogLoading(false);
    }
  };

  const loadIntents = async (authToken: string | null) => {
    setIntentsLoading(true);
    if (!authToken) {
      setPropertyIntents([]);
      setProfitIntents([]);
      setPlatformFeeIntents([]);
      setAdminMetrics(null);
      setIntentsLoading(false);
      return;
    }

    try {
      const [propertyData, profitData, platformFeeData, metrics] = await Promise.all([
        fetchPropertyIntents(authToken),
        fetchProfitDistributionIntents(authToken),
        fetchPlatformFeeIntents(authToken),
        fetchAdminMetrics(authToken),
      ]);
      setPropertyIntents(propertyData);
      setProfitIntents(profitData);
      setPlatformFeeIntents(platformFeeData);
      setAdminMetrics(metrics);
    } catch (_error) {
      // Keep console usable if one of the intent feeds fails.
    } finally {
      setIntentsLoading(false);
    }
  };

  useEffect(() => {
    if (canViewOwnerConsole) {
      void loadCampaigns();
      return;
    }
    setCampaigns([]);
    setProperties([]);
    setCampaignsLoading(false);
  }, [canViewOwnerConsole]);

  useEffect(() => {
    if (canManageOwnerFlows) {
      void loadIntents(token);
      void loadAdminProperties(token);
      return;
    }
    setPropertyIntents([]);
    setProfitIntents([]);
    setPlatformFeeIntents([]);
    setAdminMetrics(null);
    setAdminProperties([]);
    setCampaignLifecyclePreflightByAddress({});
    setIntentsLoading(false);
  }, [canManageOwnerFlows, token]);

  useEffect(() => {
    setSelectedPropertyIds((prev) =>
      prev.filter((id) => adminProperties.some((property) => property.propertyId === id))
    );
  }, [adminProperties]);

  useEffect(() => {
    const normalizedConnectedAddress = connectedWalletAddress?.toLowerCase() || '';

    if (!isConnected || !isAllowlistedConnectedWallet || !normalizedConnectedAddress) {
      lastAutoAuthAddressRef.current = null;
      return;
    }

    if (canManageOwnerFlows || isAutoAuthenticating) {
      return;
    }

    if (lastAutoAuthAddressRef.current === normalizedConnectedAddress) {
      return;
    }

    lastAutoAuthAddressRef.current = normalizedConnectedAddress;
    setIsAutoAuthenticating(true);
    setErrorMessage('');
    setStatusMessage('Allowlisted wallet detected. Authenticating admin session...');

    void (async () => {
      try {
        const injected = getInjectedProvider();
        if (!injected) {
          throw new Error('Wallet provider not found for automatic admin authentication');
        }

        const { nonce } = await getAuthNonce();
        const message = buildManualMessage(normalizedConnectedAddress, nonce, 84532);
        const signature = (await injected.request({
          method: 'personal_sign',
          params: [toHexUtf8(message), normalizedConnectedAddress],
        })) as string;

        const response = await loginWithWallet({
          address: normalizedConnectedAddress,
          signature,
          message,
          role: 'owner',
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
        lastAutoAuthAddressRef.current = null;
        console.error(
          `[auth.auto] owner_auto_login_failed address=${normalizedConnectedAddress.slice(0, 6)}...${normalizedConnectedAddress.slice(-4)} error=${
            error instanceof Error ? error.message : String(error)
          }`
        );
        setErrorMessage(error instanceof Error ? error.message : 'Automatic admin authentication failed');
        setStatusMessage('');
      } finally {
        setIsAutoAuthenticating(false);
      }
    })();
  }, [
    canManageOwnerFlows,
    connectedWalletAddress,
    dispatch,
    isAllowlistedConnectedWallet,
    isAutoAuthenticating,
    isConnected,
  ]);

  useEffect(() => {
    if (!profitForm.propertyId) {
      return;
    }
    const selected = properties.find((property) => property.propertyId === profitForm.propertyId);
    if (!selected) {
      return;
    }
    if (
      selected.profitDistributorAddress &&
      selected.profitDistributorAddress !== profitForm.profitDistributorAddress
    ) {
      setProfitForm((prev) => ({
        ...prev,
        profitDistributorAddress: selected.profitDistributorAddress,
      }));
    }
  }, [profitForm.propertyId, profitForm.profitDistributorAddress, properties]);

  useEffect(() => {
    if (!canManageOwnerFlows || !token || !profitForm.propertyId) {
      setProfitPreflight(null);
      setProfitFlowStatus(null);
      setProfitChecksLoading(false);
      return;
    }

    void refreshProfitChecks(token, profitForm.propertyId, requestedProfitAmountBaseUnits);
  }, [canManageOwnerFlows, profitForm.propertyId, requestedProfitAmountBaseUnits, token]);

  useEffect(() => {
    if (!canManageOwnerFlows || !token) {
      setPlatformFeePreflight(null);
      setPlatformFeeFlowStatus(null);
      setPlatformFeeChecksLoading(false);
      return;
    }

    const campaignAddress = platformFeeForm.campaignAddress.trim();
    const bps = Number(platformFeeForm.platformFeeBps);
    if (!campaignAddress || !Number.isInteger(bps) || bps < 0 || bps > 2000) {
      setPlatformFeePreflight(null);
      setPlatformFeeFlowStatus(null);
      setPlatformFeeChecksLoading(false);
      return;
    }
    if (bps > 0 && !effectivePlatformFeeRecipient) {
      setPlatformFeePreflight(null);
      setPlatformFeeFlowStatus(null);
      setPlatformFeeChecksLoading(false);
      return;
    }

    void refreshPlatformFeeChecks(
      token,
      campaignAddress,
      bps,
      bps === 0 ? null : effectivePlatformFeeRecipient
    );
  }, [
    canManageOwnerFlows,
    platformFeeForm.campaignAddress,
    platformFeeForm.platformFeeBps,
    platformFeeForm.platformFeeRecipient,
    effectivePlatformFeeRecipient,
    token,
  ]);

  useEffect(() => {
    if (!canManageOwnerFlows || !token || combinedHistory.length === 0) {
      setCombinedProgress({});
      setCombinedProgressLoading(false);
      return;
    }
    void refreshCombinedProgress(token);
  }, [
    canManageOwnerFlows,
    token,
    combinedHistory,
    profitIntentById,
    platformFeeIntentById,
  ]);

  useEffect(() => {
    if (combinedHistory.length === 0) {
      previousCombinedOutcomeRef.current = {};
      return;
    }

    const nextOutcomes: Record<string, CombinedRowOutcome> = {};
    const generatedToasts: Array<{ id: string; text: string; tone: 'success' | 'warning' }> = [];

    for (const record of combinedHistory) {
      const outcome = getCombinedOutcome(record);
      nextOutcomes[record.id] = outcome;
      const prev = previousCombinedOutcomeRef.current[record.id];
      if (!prev || prev === outcome) {
        continue;
      }
      if (outcome === 'completed') {
        generatedToasts.push({
          id: `${record.id}-${Date.now()}-ok`,
          tone: 'success',
          text: `${record.propertyId}: combined submission completed`,
        });
      } else if (outcome === 'needs_attention') {
        generatedToasts.push({
          id: `${record.id}-${Date.now()}-warn`,
          tone: 'warning',
          text: `${record.propertyId}: combined submission needs attention`,
        });
      }
    }

    previousCombinedOutcomeRef.current = nextOutcomes;
    if (generatedToasts.length > 0) {
      setCombinedToasts((prev) => [...generatedToasts, ...prev].slice(0, 5));
    }
  }, [combinedHistory, combinedProgress, profitIntentById, platformFeeIntentById]);

  useEffect(() => {
    if (combinedToasts.length === 0) {
      return;
    }
    const timer = setTimeout(() => {
      setCombinedToasts((prev) => prev.slice(0, -1));
    }, 5000);
    return () => clearTimeout(timer);
  }, [combinedToasts]);

  useEffect(() => {
    if (!canManageOwnerFlows || !token || combinedHistory.length === 0) {
      return;
    }
    const timer = setInterval(() => {
      void refreshCombinedProgress(token);
    }, 20000);
    return () => clearInterval(timer);
  }, [canManageOwnerFlows, token, combinedHistory, profitIntentById, platformFeeIntentById]);

  useEffect(() => {
    try {
      window.localStorage.setItem(PROFIT_ADVANCED_KEY, showProfitAdvanced ? '1' : '0');
    } catch {
      // Ignore localStorage failures.
    }
  }, [showProfitAdvanced]);

  useEffect(() => {
    try {
      window.localStorage.setItem(PLATFORM_ADVANCED_KEY, showPlatformAdvanced ? '1' : '0');
    } catch {
      // Ignore localStorage failures.
    }
  }, [showPlatformAdvanced]);

  // Retained helper flows (operator runbooks / manual recovery helpers).
  void handleCreateProfitIntent;
  void clearCombinedHistory;
  void togglePropertySelection;
  void toggleSelectAllFilteredProperties;
  void handleBulkArchiveSelectedProperties;
  void handleBulkRestoreSelectedProperties;
  void handleQuickProfitIntent;
  void handleRetryFailedIntents;
  void handleResetFailedIntents;

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Animated background orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-64 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '0s' }} />
        <div className="absolute bottom-1/3 -right-64 w-80 h-80 bg-emerald-500/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      {/* Content */}
      <div className="relative z-10 py-10">
        <div className="container mx-auto px-4">
          {/* Hero Section */}
          <div className="mb-8 rounded-2xl border border-white/10 bg-slate-900/50 p-6 shadow-2xl shadow-black/40 backdrop-blur">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
              Admin Console
            </h1>
            <p className="mt-2 text-slate-300">
              Operate intents, campaign settings, and property lifecycle from one control plane.
            </p>
          </div>

          {!canViewOwnerConsole && (
            <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-200 backdrop-blur">
              Admin operations are hidden. Connect an allowlisted admin wallet to unlock this console.
            </div>
          )}

          <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-200 backdrop-blur">
            Admin actions can materially affect investor outcomes. Review{' '}
            <Link to="/disclosures" className="font-medium underline">
              Risk Disclosures
            </Link>{' '}
            and ensure legal/compliance approvals are in place before production operations.
          </div>

          {/* Session & Controls Bar */}
          <div className="mb-8 rounded-2xl border border-white/10 bg-slate-900/50 px-4 py-4 shadow-xl shadow-black/25 backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-slate-300">
                Connected: {connectedWalletAddress ? `${connectedWalletAddress.slice(0, 6)}...${connectedWalletAddress.slice(-4)}` : 'Not connected'}
                {' '}| Session: {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Not authenticated'} {role ? `(${role})` : ''}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {canViewOwnerConsole && (
                  <>
                    <button
                      className="rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-500 px-4 py-2 text-white font-medium hover:shadow-lg hover:shadow-emerald-500/30 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                      onClick={() => setShowCreatePropertyModal(true)}
                      disabled={!canManageOwnerFlows}
                    >
                      Create Property
                    </button>
                    <button
                      className="rounded-lg border border-blue-500/50 bg-blue-500/10 px-4 py-2 text-blue-300 hover:bg-blue-500/20 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                      onClick={() => setShowCreateProfitModal(true)}
                      disabled={!canManageOwnerFlows}
                    >
                      Create Profit Intent
                    </button>
                    <button
                      className="rounded-lg border border-purple-500/50 bg-purple-500/10 px-4 py-2 text-purple-300 hover:bg-purple-500/20 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                      onClick={() => setShowPlatformFeeModal(true)}
                      disabled={!canManageOwnerFlows}
                    >
                      Create Platform Fee Intent
                    </button>
                    <button
                      className="rounded-lg border border-slate-600 bg-slate-800/50 px-4 py-2 text-slate-300 hover:bg-slate-700/50 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                      onClick={() => setShowCombinedIntentModal(true)}
                      disabled={!canManageOwnerFlows}
                    >
                      Settlement Wizard
                    </button>
                  </>
                )}
                {isAuthenticated && (
                  <button
                    className="rounded-lg border border-slate-600 bg-slate-800/50 px-4 py-2 text-slate-300 hover:bg-slate-700/50 transition-all"
                    onClick={handleLogout}
                  >
                    Log out
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Status Messages */}
          {(statusMessage || errorMessage) && (
            <div
              className={`mb-6 rounded-lg border px-4 py-3 backdrop-blur ${
                errorMessage
                  ? 'border-red-500/30 bg-red-500/10 text-red-200'
                  : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
              }`}
            >
              {errorMessage || statusMessage}
            </div>
          )}

          {/* Toast Notifications */}
          {combinedToasts.length > 0 && (
            <div className="mb-6 space-y-2">
              {combinedToasts.map((toast) => (
                <div
                  key={toast.id}
                  className={`rounded-lg border px-4 py-2 text-sm backdrop-blur ${
                    toast.tone === 'success'
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                      : 'border-amber-500/30 bg-amber-500/10 text-amber-200'
                  }`}
                >
                  {toast.text}
                </div>
              ))}
            </div>
          )}

          {/* Modal: Create Property */}
          {showCreatePropertyModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
              <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-white/10 bg-slate-900/95 p-6 shadow-2xl shadow-black/50 backdrop-blur">
                <div className="sticky top-0 z-10 -mx-6 -mt-6 mb-4 flex items-center justify-between border-b border-white/10 bg-slate-900/80 px-6 py-4 backdrop-blur">
                  <h2 className="text-xl font-bold text-white">Create Property</h2>
                  <button
                    className="rounded-lg border border-slate-600 px-3 py-1 text-sm text-slate-200 hover:bg-slate-800/70"
                    onClick={() => {
                      setShowCreatePropertyModal(false);
                      setPropertyImageFile(null);
                      setPropertyImageUploadProgress(0);
                      setPropertyImageUploadState('idle');
                      setPropertyImageUploadDebug('');
                    }}
                  >
                    Close
                  </button>
                </div>
                <div className="space-y-4">
                  <input
                    className="w-full rounded-lg border border-slate-700/60 bg-slate-900/70 px-4 py-2 text-slate-100 placeholder-slate-400 focus:border-blue-500/50 focus:outline-none transition-all"
                    placeholder="Property name"
                    value={propertyForm.name}
                    onChange={(event) => handlePropertyChange('name', event.target.value)}
                  />
                  <input
                    className="w-full rounded-lg border border-slate-700/60 bg-slate-900/70 px-4 py-2 text-slate-100 placeholder-slate-400 focus:border-blue-500/50 focus:outline-none transition-all"
                    placeholder="Property ID (optional)"
                    value={propertyForm.propertyId}
                    onChange={(event) => handlePropertyChange('propertyId', event.target.value)}
                  />
                  <input
                    className="w-full rounded-lg border border-slate-700/60 bg-slate-900/70 px-4 py-2 text-slate-100 placeholder-slate-400 focus:border-blue-500/50 focus:outline-none transition-all"
                    placeholder="Location"
                    value={propertyForm.location}
                    onChange={(event) => handlePropertyChange('location', event.target.value)}
                  />
                  <textarea
                    className="w-full rounded-lg border border-slate-700/60 bg-slate-900/70 px-4 py-2 text-slate-100 placeholder-slate-400 focus:border-blue-500/50 focus:outline-none transition-all"
                    placeholder="Description"
                    rows={3}
                    value={propertyForm.description}
                    onChange={(event) => handlePropertyChange('description', event.target.value)}
                  />
                  <input
                    className="w-full rounded-lg border border-slate-700/60 bg-slate-900/70 px-4 py-2 text-slate-100 placeholder-slate-400 focus:border-blue-500/50 focus:outline-none transition-all"
                    placeholder="Image URL (optional)"
                    value={propertyForm.imageUrl}
                    onChange={(event) => handlePropertyChange('imageUrl', event.target.value)}
                  />
                  <textarea
                    className="w-full rounded-lg border border-slate-700/60 bg-slate-900/70 px-4 py-2 text-slate-100 placeholder-slate-400 focus:border-blue-500/50 focus:outline-none transition-all"
                    placeholder="Gallery image URLs (one per line, optional)"
                    rows={3}
                    value={propertyForm.imageUrlsText}
                    onChange={(event) => handlePropertyChange('imageUrlsText', event.target.value)}
                  />
                  <div className="rounded-lg border border-dashed border-slate-600 p-3">
                    <p className="mb-2 text-xs text-slate-400">Or upload image directly to Cloudinary</p>
                    <div className="flex flex-col gap-2 md:flex-row md:items-center">
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        onChange={(event) => {
                          const file = event.target.files?.[0] ?? null;
                          setPropertyImageFile(file);
                        }}
                        className="text-sm text-slate-200"
                      />
                      <button
                        type="button"
                        className="rounded-lg border border-emerald-500/60 px-4 py-2 text-sm font-medium text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-60 transition-all"
                        onClick={handleUploadPropertyImage}
                        disabled={!propertyImageFile || isUploadingPropertyImage || !canManageOwnerFlows}
                      >
                        {isUploadingPropertyImage ? 'Uploading...' : 'Upload Image'}
                      </button>
                    </div>
                    {propertyImageFile && (
                      <p className="mt-2 text-xs text-slate-400">
                        Selected: {propertyImageFile.name} ({(propertyImageFile.size / 1024).toFixed(1)} KB)
                      </p>
                    )}
                    {isUploadingPropertyImage && (
                      <div className="mt-2">
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-700">
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all"
                            style={{ width: `${propertyImageUploadProgress}%` }}
                          />
                        </div>
                        <p className="mt-1 text-xs text-slate-400">Upload progress: {propertyImageUploadProgress}%</p>
                      </div>
                    )}
                  </div>
                  <input
                    className="w-full rounded-lg border border-slate-700/60 bg-slate-900/70 px-4 py-2 text-slate-100 placeholder-slate-400 focus:border-blue-500/50 focus:outline-none transition-all"
                    placeholder="YouTube URL (optional)"
                    value={propertyForm.youtubeEmbedUrl}
                    onChange={(event) => handlePropertyChange('youtubeEmbedUrl', event.target.value)}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <input
                      className="w-full rounded-lg border border-slate-700/60 bg-slate-900/70 px-4 py-2 text-slate-100 placeholder-slate-400 focus:border-blue-500/50 focus:outline-none transition-all"
                      placeholder="Target raise (USDC)"
                      value={propertyForm.targetUsdc}
                      onChange={(event) => handlePropertyChange('targetUsdc', event.target.value)}
                    />
                    <input
                      className="w-full rounded-lg border border-slate-700/60 bg-slate-900/70 px-4 py-2 text-slate-100 placeholder-slate-400 focus:border-blue-500/50 focus:outline-none transition-all"
                      placeholder="Estimated sell price (USDC)"
                      value={propertyForm.estimatedSellUsdc}
                      onChange={(event) =>
                        handlePropertyChange('estimatedSellUsdc', event.target.value)
                      }
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <input
                      className="w-full rounded-lg border border-slate-700/60 bg-slate-900/70 px-4 py-2 text-slate-100 placeholder-slate-400 focus:border-blue-500/50 focus:outline-none transition-all"
                      placeholder="Conservative sell (USDC)"
                      value={propertyForm.conservativeSellUsdc}
                      onChange={(event) =>
                        handlePropertyChange('conservativeSellUsdc', event.target.value)
                      }
                    />
                    <input
                      className="w-full rounded-lg border border-slate-700/60 bg-slate-900/70 px-4 py-2 text-slate-100 placeholder-slate-400 focus:border-blue-500/50 focus:outline-none transition-all"
                      placeholder="Base sell (USDC)"
                      value={propertyForm.baseSellUsdc}
                      onChange={(event) => handlePropertyChange('baseSellUsdc', event.target.value)}
                    />
                    <input
                      className="w-full rounded-lg border border-slate-700/60 bg-slate-900/70 px-4 py-2 text-slate-100 placeholder-slate-400 focus:border-blue-500/50 focus:outline-none transition-all"
                      placeholder="Optimistic sell (USDC)"
                      value={propertyForm.optimisticSellUsdc}
                      onChange={(event) =>
                        handlePropertyChange('optimisticSellUsdc', event.target.value)
                      }
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <input
                      className="w-full rounded-lg border border-slate-700/60 bg-slate-900/70 px-4 py-2 text-slate-100 placeholder-slate-400 focus:border-blue-500/50 focus:outline-none transition-all"
                      placeholder="Conservative multiplier %"
                      value={propertyForm.conservativeMultiplierPct}
                      onChange={(event) =>
                        handlePropertyChange('conservativeMultiplierPct', event.target.value)
                      }
                    />
                    <input
                      className="w-full rounded-lg border border-slate-700/60 bg-slate-900/70 px-4 py-2 text-slate-100 placeholder-slate-400 focus:border-blue-500/50 focus:outline-none transition-all"
                      placeholder="Base multiplier %"
                      value={propertyForm.baseMultiplierPct}
                      onChange={(event) => handlePropertyChange('baseMultiplierPct', event.target.value)}
                    />
                    <input
                      className="w-full rounded-lg border border-slate-700/60 bg-slate-900/70 px-4 py-2 text-slate-100 placeholder-slate-400 focus:border-blue-500/50 focus:outline-none transition-all"
                      placeholder="Optimistic multiplier %"
                      value={propertyForm.optimisticMultiplierPct}
                      onChange={(event) =>
                        handlePropertyChange('optimisticMultiplierPct', event.target.value)
                      }
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <label className="text-sm text-slate-300">
                      Campaign Start
                      <input
                        type="datetime-local"
                        className="mt-1 w-full rounded-lg border border-slate-700/60 bg-slate-900/70 px-4 py-2 text-slate-100 placeholder-slate-400 focus:border-blue-500/50 focus:outline-none transition-all"
                        value={propertyForm.startTime}
                        onChange={(event) => handlePropertyChange('startTime', event.target.value)}
                      />
                    </label>
                    <label className="text-sm text-slate-300">
                      Campaign End
                      <input
                        type="datetime-local"
                        className="mt-1 w-full rounded-lg border border-slate-700/60 bg-slate-900/70 px-4 py-2 text-slate-100 placeholder-slate-400 focus:border-blue-500/50 focus:outline-none transition-all"
                        value={propertyForm.endTime}
                        onChange={(event) => handlePropertyChange('endTime', event.target.value)}
                      />
                    </label>
                  </div>
                  <div className="sticky bottom-0 z-10 -mx-6 -mb-6 flex justify-end gap-2 border-t border-white/10 bg-slate-900/80 px-6 py-4 backdrop-blur">
                    <button
                      className="rounded-lg border border-slate-600 px-4 py-2 text-slate-200 hover:bg-slate-800/60 transition-all"
                      onClick={() => {
                        setShowCreatePropertyModal(false);
                        setPropertyImageFile(null);
                        setPropertyImageUploadProgress(0);
                        setPropertyImageUploadState('idle');
                        setPropertyImageUploadDebug('');
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      className="rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-500 px-6 py-2 text-white font-medium hover:shadow-lg hover:shadow-emerald-500/30 disabled:opacity-60 transition-all"
                      onClick={handleCreateProperty}
                      disabled={
                        !canManageOwnerFlows ||
                        isUploadingPropertyImage ||
                        Boolean(propertyImageFile && !propertyForm.imageUrl.trim())
                      }
                    >
                      Create Property Intent
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Modal: Edit Property */}
          {showEditPropertyModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
              <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-white/10 bg-slate-900/95 p-6 shadow-2xl shadow-black/50 backdrop-blur">
                <div className="sticky top-0 z-10 -mx-6 -mt-6 mb-4 flex items-center justify-between border-b border-white/10 bg-slate-900/80 px-6 py-4 backdrop-blur">
                  <h2 className="text-xl font-bold text-white">
                    Edit Property: {editingPropertyId}
                  </h2>
                  <button
                    className="rounded-lg border border-slate-600 px-3 py-1 text-sm text-slate-200 hover:bg-slate-800/70"
                    onClick={() => {
                      setShowEditPropertyModal(false);
                      setEditingPropertyId('');
                    }}
                  >
                    Close
                  </button>
                </div>
                <div className="space-y-4">
                  <input
                    className="w-full rounded-lg border border-slate-700/60 bg-slate-900/70 px-4 py-2 text-slate-100 placeholder-slate-400 focus:border-blue-500/50 focus:outline-none transition-all"
                    placeholder="Property name"
                    value={editPropertyForm.name}
                    onChange={(event) => handleEditPropertyChange('name', event.target.value)}
                  />
                  <input
                    className="w-full rounded-lg border border-slate-700/60 bg-slate-900/70 px-4 py-2 text-slate-100 placeholder-slate-400 focus:border-blue-500/50 focus:outline-none transition-all"
                    placeholder="Location"
                    value={editPropertyForm.location}
                    onChange={(event) => handleEditPropertyChange('location', event.target.value)}
                  />
                  <textarea
                    className="w-full rounded-lg border border-slate-700/60 bg-slate-900/70 px-4 py-2 text-slate-100 placeholder-slate-400 focus:border-blue-500/50 focus:outline-none transition-all"
                    placeholder="Description"
                    rows={3}
                    value={editPropertyForm.description}
                    onChange={(event) => handleEditPropertyChange('description', event.target.value)}
                  />
                  <input
                    className="w-full rounded-lg border border-slate-700/60 bg-slate-900/70 px-4 py-2 text-slate-100 placeholder-slate-400 focus:border-blue-500/50 focus:outline-none transition-all"
                    placeholder="Image URL"
                    value={editPropertyForm.imageUrl}
                    onChange={(event) => handleEditPropertyChange('imageUrl', event.target.value)}
                  />
                  <textarea
                    className="w-full rounded-lg border border-slate-700/60 bg-slate-900/70 px-4 py-2 text-slate-100 placeholder-slate-400 focus:border-blue-500/50 focus:outline-none transition-all"
                    placeholder="Gallery image URLs (one per line)"
                    rows={4}
                    value={editPropertyForm.imageUrlsText}
                    onChange={(event) => handleEditPropertyChange('imageUrlsText', event.target.value)}
                  />
                  <input
                    className="w-full rounded-lg border border-slate-700/60 bg-slate-900/70 px-4 py-2 text-slate-100 placeholder-slate-400 focus:border-blue-500/50 focus:outline-none transition-all"
                    placeholder="YouTube URL"
                    value={editPropertyForm.youtubeEmbedUrl}
                    onChange={(event) => handleEditPropertyChange('youtubeEmbedUrl', event.target.value)}
                  />
                  <div className="sticky bottom-0 z-10 -mx-6 -mb-6 flex justify-end gap-2 border-t border-white/10 bg-slate-900/80 px-6 py-4 backdrop-blur">
                    <button
                      className="rounded-lg border border-slate-600 px-4 py-2 text-slate-200 hover:bg-slate-800/60 transition-all"
                      onClick={() => setEditPropertyForm(initialEditPropertyForm)}
                    >
                      Reset Changes
                    </button>
                    <button
                      className="rounded-lg border border-slate-600 px-4 py-2 text-slate-200 hover:bg-slate-800/60 transition-all"
                      onClick={() => {
                        setShowEditPropertyModal(false);
                        setEditingPropertyId('');
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      className="rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-500 px-6 py-2 text-white font-medium hover:shadow-lg hover:shadow-emerald-500/30 disabled:opacity-60 transition-all"
                      onClick={handleSavePropertyEdits}
                      disabled={!canManageOwnerFlows || !editingPropertyId}
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Modal: Create Profit Intent */}
          {showCreateProfitModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
              <div className="w-full max-w-3xl rounded-2xl border border-white/10 bg-slate-900/95 p-6 shadow-2xl shadow-black/50 backdrop-blur">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xl font-bold text-white">Create Profit Distribution Intent</h2>
                  <button
                    className="rounded-lg border border-slate-600 px-3 py-1 text-sm text-slate-200 hover:bg-slate-800/70"
                    onClick={() => setShowCreateProfitModal(false)}
                  >
                    Close
                  </button>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <select
                    className="w-full rounded-lg border border-slate-700/60 bg-slate-900/70 px-4 py-2 text-slate-100 focus:border-blue-500/50 focus:outline-none transition-all"
                    value={profitForm.propertyId}
                    onChange={(event) => handleProfitChange('propertyId', event.target.value)}
                  >
                    <option value="">Select property</option>
                    {properties.map((property) => (
                      <option key={property.propertyId} value={property.propertyId}>
                        {property.propertyId}
                      </option>
                    ))}
                  </select>
                  <input
                    className="w-full rounded-lg border border-slate-700/60 bg-slate-900/70 px-4 py-2 text-slate-100 placeholder-slate-400 focus:border-blue-500/50 focus:outline-none transition-all"
                    placeholder="USDC amount"
                    value={profitForm.usdcAmount}
                    onChange={(event) => handleProfitChange('usdcAmount', event.target.value)}
                  />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    className="rounded-lg border border-blue-500/50 bg-blue-500/10 px-4 py-2 text-blue-300 hover:bg-blue-500/20 disabled:opacity-60 transition-all"
                    onClick={handleApproveProfitAllowance}
                    disabled={
                      !canManageOwnerFlows ||
                      isApprovingProfitAllowance ||
                      !profitForm.propertyId ||
                      !profitForm.usdcAmount ||
                      profitUiBlockedByCampaignState
                    }
                  >
                    {isApprovingProfitAllowance ? 'Approving...' : 'Approve USDC Allowance'}
                  </button>
                  <button
                    className="rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-500 px-4 py-2 text-white font-medium hover:shadow-lg hover:shadow-emerald-500/30 disabled:opacity-60 transition-all"
                    onClick={handleApproveAndSubmitProfitIntent}
                    disabled={
                      !canManageOwnerFlows ||
                      isApprovingProfitAllowance ||
                      !profitPreflight ||
                      !profitPreflight.checks.operatorConfigured ||
                      profitUiBlockedByCampaignState
                    }
                  >
                    {isApprovingProfitAllowance ? 'Processing...' : 'Approve + Submit Intent'}
                  </button>
                </div>
                {profitUiBlockedByCampaignState && (
                  <p className="mt-3 text-xs text-amber-300">
                    Profit intent is blocked until campaign is finalized and withdrawn.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Modal: Create Platform Fee Intent */}
          {showPlatformFeeModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
              <div className="w-full max-w-3xl rounded-2xl border border-white/10 bg-slate-900/95 p-6 shadow-2xl shadow-black/50 backdrop-blur">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xl font-bold text-white">Update Platform Fee (Intent)</h2>
                  <button
                    className="rounded-lg border border-slate-600 px-3 py-1 text-sm text-slate-200 hover:bg-slate-800/70"
                    onClick={() => setShowPlatformFeeModal(false)}
                  >
                    Close
                  </button>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <select
                    className="w-full rounded-lg border border-slate-700/60 bg-slate-900/70 px-4 py-2 text-slate-100 focus:border-blue-500/50 focus:outline-none transition-all"
                    value={platformFeeForm.campaignAddress}
                    onChange={(event) => handleSelectPlatformCampaign(event.target.value)}
                  >
                    <option value="">Select campaign</option>
                    {campaigns.map((campaign) => (
                      <option key={campaign.campaignAddress} value={campaign.campaignAddress}>
                        {campaign.propertyId}
                      </option>
                    ))}
                  </select>
                  <input
                    className="w-full rounded-lg border border-slate-700/60 bg-slate-900/70 px-4 py-2 text-slate-100 placeholder-slate-400 focus:border-blue-500/50 focus:outline-none transition-all"
                    placeholder="Platform fee bps (0-2000)"
                    value={platformFeeForm.platformFeeBps}
                    onChange={(event) => handlePlatformFeeChange('platformFeeBps', event.target.value)}
                  />
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    className="rounded-lg border border-slate-600 px-4 py-2 text-slate-200 hover:bg-slate-800/60 transition-all"
                    onClick={() => setShowPlatformFeeModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-500 px-6 py-2 text-white font-medium hover:shadow-lg hover:shadow-emerald-500/30 disabled:opacity-60 transition-all"
                    onClick={handleCreatePlatformFeeIntent}
                    disabled={
                      !canManageOwnerFlows || !hasPlatformFeeBasicsValid || platformFeeUiBlockedByCampaignState
                    }
                  >
                    Submit Platform Fee Intent
                  </button>
                </div>
                {platformFeeUiBlockedByCampaignState && (
                  <p className="mt-3 text-xs text-amber-300">
                    Platform fee intent is blocked until campaign is finalized and withdrawn.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Modal: Settlement Wizard */}
          {showCombinedIntentModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
              <div className="w-full max-w-3xl rounded-2xl border border-white/10 bg-slate-900/95 p-6 shadow-2xl shadow-black/50 backdrop-blur">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xl font-bold text-white">Settlement Wizard</h2>
                  <button
                    className="rounded-lg border border-slate-600 px-3 py-1 text-sm text-slate-200 hover:bg-slate-800/70"
                    onClick={() => setShowCombinedIntentModal(false)}
                  >
                    Close
                  </button>
                </div>
                <p className="mb-4 text-sm text-slate-300">
                  Submit platform fee and investor distribution intents together from one gross settlement amount.
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                  <select
                    className="w-full rounded-lg border border-slate-700/60 bg-slate-900/70 px-4 py-2 text-slate-100 focus:border-blue-500/50 focus:outline-none transition-all"
                    value={combinedForm.campaignAddress}
                    onChange={(event) => handleSelectCombinedCampaign(event.target.value)}
                  >
                    <option value="">Select campaign</option>
                    {campaigns.map((campaign) => (
                      <option key={campaign.campaignAddress} value={campaign.campaignAddress}>
                        {campaign.propertyId}
                      </option>
                    ))}
                  </select>
                  <input
                    className="w-full rounded-lg border border-slate-700/60 bg-slate-900/70 px-4 py-2 text-slate-100 placeholder-slate-400 focus:border-blue-500/50 focus:outline-none transition-all"
                    placeholder="Gross settlement amount (USDC)"
                    value={combinedForm.grossSettlementUsdc}
                    onChange={(event) => handleCombinedChange('grossSettlementUsdc', event.target.value)}
                  />
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <input
                    className="w-full rounded-lg border border-slate-700/60 bg-slate-900/70 px-4 py-2 text-slate-100 placeholder-slate-400 focus:border-blue-500/50 focus:outline-none transition-all"
                    placeholder="Platform fee bps (0-2000)"
                    value={combinedForm.platformFeeBps}
                    onChange={(event) => handleCombinedChange('platformFeeBps', event.target.value)}
                  />
                  <input
                    className="w-full rounded-lg border border-slate-700/60 bg-slate-900/70 px-4 py-2 text-slate-100 placeholder-slate-400 focus:border-blue-500/50 focus:outline-none transition-all"
                    placeholder="Platform fee recipient (optional if already configured)"
                    value={combinedForm.platformFeeRecipient}
                    onChange={(event) => handleCombinedChange('platformFeeRecipient', event.target.value)}
                  />
                </div>
                <div className="mt-4 grid gap-3 rounded-lg border border-slate-700/60 bg-slate-900/50 p-4 text-sm md:grid-cols-2">
                  <div className="text-slate-300">
                    Platform fee ({Number.isFinite(normalizedCombinedFeeBps) ? normalizedCombinedFeeBps : 0} bps):{' '}
                    <span className="font-semibold text-white">
                      {computedCombinedFeeUsdc.toLocaleString(undefined, { maximumFractionDigits: 6 })} USDC
                    </span>
                  </div>
                  <div className="text-slate-300">
                    Net investor distribution:{' '}
                    <span className="font-semibold text-emerald-300">
                      {computedCombinedNetDistributionUsdc.toLocaleString(undefined, { maximumFractionDigits: 6 })} USDC
                    </span>
                  </div>
                  <div className="text-slate-400 md:col-span-2">
                    This submits both intents: platform fee update + profit distribution deposit.
                  </div>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    className="rounded-lg border border-slate-600 px-4 py-2 text-slate-200 hover:bg-slate-800/60 transition-all"
                    onClick={() => setShowCombinedIntentModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-500 px-6 py-2 text-white font-medium hover:shadow-lg hover:shadow-emerald-500/30 disabled:opacity-60 transition-all"
                    onClick={handleCreateCombinedIntentBatch}
                    disabled={
                      !canManageOwnerFlows ||
                      !combinedForm.campaignAddress ||
                      isSubmittingSettlement ||
                      combinedUiBlockedByCampaignState
                    }
                  >
                    {isSubmittingSettlement ? 'Submitting...' : 'Submit Settlement Intents'}
                  </button>
                </div>
                {combinedUiBlockedByCampaignState && (
                  <p className="mt-3 text-xs text-amber-300">
                    Settlement intents are blocked until campaign is finalized and withdrawn.
                  </p>
                )}
              </div>
            </div>
          )}

          {showSmartWithdrawModal && smartWithdrawCampaign && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
              <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/15 bg-slate-900/95 p-6 shadow-2xl shadow-black/50 backdrop-blur">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-semibold text-white">Smart Withdraw Flow</h3>
                    <p className="mt-1 text-sm text-slate-400">
                      {smartWithdrawCampaign.propertyId} · {smartWithdrawCampaign.campaignAddress}
                    </p>
                  </div>
                  <button
                    className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800/60 transition-all"
                    onClick={() => {
                      if (isSmartWithdrawRunning) return;
                      setShowSmartWithdrawModal(false);
                      setSmartWithdrawCampaign(null);
                      setSmartWithdrawPreflight(null);
                      setSmartWithdrawStepMessage('');
                    }}
                    disabled={isSmartWithdrawRunning}
                  >
                    Close
                  </button>
                </div>

                <div className="space-y-3 rounded-lg border border-white/10 bg-slate-950/40 p-4 text-sm">
                  <p className="text-slate-200">
                    This action will:
                    {' '}
                    <span className="font-medium">1) check readiness</span>,
                    {' '}
                    <span className="font-medium">2) finalize if required</span>,
                    {' '}
                    <span className="font-medium">3) withdraw funds</span>.
                  </p>
                  <div className="rounded border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs text-blue-200">
                    {smartWithdrawStepMessage || 'Waiting...'}
                  </div>
                  {smartWithdrawPreflight && (
                    <div className="grid gap-2 text-xs text-slate-300 md:grid-cols-2">
                      <div className="rounded border border-white/10 bg-slate-900/40 p-2">
                        <div className="font-medium text-slate-200">Finalize Ready</div>
                        <div className={smartWithdrawPreflight.actions.finalize.ready ? 'text-emerald-300' : 'text-amber-300'}>
                          {smartWithdrawPreflight.actions.finalize.ready ? 'Yes' : 'No'}
                        </div>
                      </div>
                      <div className="rounded border border-white/10 bg-slate-900/40 p-2">
                        <div className="font-medium text-slate-200">Withdraw Ready</div>
                        <div className={smartWithdrawPreflight.actions.withdraw.ready ? 'text-emerald-300' : 'text-amber-300'}>
                          {smartWithdrawPreflight.actions.withdraw.ready ? 'Yes' : 'No'}
                        </div>
                      </div>
                      {!smartWithdrawPreflight.actions.withdraw.ready &&
                        smartWithdrawPreflight.actions.withdraw.reasons.length > 0 && (
                          <div className="md:col-span-2 rounded border border-amber-500/30 bg-amber-500/10 p-2 text-amber-200">
                            {smartWithdrawPreflight.actions.withdraw.reasons.map(prettyLifecycleReason).join('; ')}
                          </div>
                        )}
                    </div>
                  )}
                </div>

                <div className="mt-4">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Recipient Address
                  </label>
                  <input
                    type="text"
                    value={smartWithdrawRecipient}
                    onChange={(event) => setSmartWithdrawRecipient(event.target.value)}
                    className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white focus:border-emerald-500/50 focus:outline-none"
                    disabled={isSmartWithdrawRunning}
                  />
                </div>

                <div className="mt-5 flex items-center justify-end gap-2">
                  <button
                    className="rounded border border-slate-600 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800/60 transition-all disabled:opacity-60"
                    onClick={() => {
                      if (isSmartWithdrawRunning) return;
                      setShowSmartWithdrawModal(false);
                      setSmartWithdrawCampaign(null);
                      setSmartWithdrawPreflight(null);
                      setSmartWithdrawStepMessage('');
                    }}
                    disabled={isSmartWithdrawRunning}
                  >
                    Cancel
                  </button>
                  <button
                    className="rounded border border-emerald-500/60 bg-emerald-500/15 px-3 py-2 text-sm font-medium text-emerald-200 hover:bg-emerald-500/25 transition-all disabled:opacity-60"
                    onClick={() => void handleSmartWithdrawConfirm()}
                    disabled={!canManageOwnerFlows || isSmartWithdrawRunning}
                  >
                    {isSmartWithdrawRunning ? 'Running...' : 'Run Finalize + Withdraw'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {showFullSettlementModal && fullSettlementCampaign && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
              <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-white/15 bg-slate-900/95 p-6 shadow-2xl shadow-black/50 backdrop-blur">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-semibold text-white">Run Full Settlement</h3>
                    <p className="mt-1 text-sm text-slate-400">
                      {fullSettlementCampaign.propertyId} · {fullSettlementCampaign.campaignAddress}
                    </p>
                  </div>
                  <button
                    className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800/60 transition-all"
                    onClick={closeFullSettlementModal}
                    disabled={isRunningFullSettlement}
                  >
                    Close
                  </button>
                </div>

                <div className="grid gap-3 rounded-lg border border-white/10 bg-slate-950/40 p-4 text-sm md:grid-cols-2">
                  <label className="text-slate-300">
                    Gross settlement (USDC)
                    <input
                      type="number"
                      min="0"
                      step="0.000001"
                      className="mt-1 w-full rounded border border-slate-700 bg-slate-900/60 px-3 py-2 text-white focus:border-cyan-500/60 focus:outline-none"
                      value={fullSettlementGrossUsdc}
                      onChange={(event) => setFullSettlementGrossUsdc(event.target.value)}
                      disabled={isRunningFullSettlement}
                    />
                    {fullSettlementGrossSource && (
                      <span className="mt-1 block text-xs text-slate-400">
                        Suggested from {fullSettlementGrossSource}
                      </span>
                    )}
                  </label>
                  <label className="text-slate-300">
                    Platform fee (bps)
                    <input
                      type="number"
                      min="0"
                      max="2000"
                      step="1"
                      className="mt-1 w-full rounded border border-slate-700 bg-slate-900/60 px-3 py-2 text-white focus:border-cyan-500/60 focus:outline-none"
                      value={fullSettlementFeeBps}
                      onChange={(event) => setFullSettlementFeeBps(event.target.value)}
                      disabled={isRunningFullSettlement}
                    />
                  </label>
                  <label className="text-slate-300">
                    Platform fee recipient
                    <input
                      type="text"
                      className="mt-1 w-full rounded border border-slate-700 bg-slate-900/60 px-3 py-2 text-white focus:border-cyan-500/60 focus:outline-none"
                      value={fullSettlementFeeRecipient}
                      onChange={(event) => setFullSettlementFeeRecipient(event.target.value)}
                      disabled={isRunningFullSettlement}
                    />
                  </label>
                  <label className="text-slate-300">
                    Profit distributor
                    <input
                      type="text"
                      className="mt-1 w-full rounded border border-slate-700 bg-slate-900/60 px-3 py-2 text-white focus:border-cyan-500/60 focus:outline-none"
                      value={fullSettlementDistributor}
                      onChange={(event) => setFullSettlementDistributor(event.target.value)}
                      disabled={isRunningFullSettlement}
                    />
                  </label>
                  <label className="text-slate-300 md:col-span-2">
                    Withdraw recipient
                    <input
                      type="text"
                      className="mt-1 w-full rounded border border-slate-700 bg-slate-900/60 px-3 py-2 text-white focus:border-cyan-500/60 focus:outline-none"
                      value={fullSettlementRecipient}
                      onChange={(event) => setFullSettlementRecipient(event.target.value)}
                      disabled={isRunningFullSettlement}
                    />
                  </label>
                </div>

                {fullSettlementPreflight && (
                  <div className="mt-3 rounded border border-white/10 bg-slate-950/40 p-3 text-xs text-slate-300">
                    <p>
                      State: <span className="text-white">{fullSettlementPreflight.campaign.state}</span> · Campaign balance:{' '}
                      <span className="text-white">
                        {(Number(fullSettlementPreflight.campaign.campaignUsdcBalanceBaseUnits) / 1_000_000).toLocaleString(undefined, {
                          maximumFractionDigits: 6,
                        })}{' '}
                        USDC
                      </span>
                    </p>
                    <p>
                      Equity token: {fullSettlementPreflight.postSettlementHealth.equityTokenSet ? 'Configured' : 'Missing'} ·
                      Claimable wallets: {fullSettlementPreflight.postSettlementHealth.equityClaimableWallets} equity,{' '}
                      {fullSettlementPreflight.postSettlementHealth.profitClaimableWallets} profit
                    </p>
                  </div>
                )}

                <div className="mt-4 space-y-2 rounded-lg border border-white/10 bg-slate-950/50 p-4">
                  {fullSettlementSteps.map((step) => (
                    <div key={step.key} className="flex items-start justify-between gap-3 text-sm">
                      <div className="text-slate-200">{step.label}</div>
                      <div className="text-right">
                        <div
                          className={
                            step.status === 'done'
                              ? 'text-emerald-300'
                              : step.status === 'running'
                                ? 'text-cyan-300'
                                : step.status === 'error'
                                  ? 'text-red-300'
                                  : step.status === 'skipped'
                                    ? 'text-amber-300'
                                    : 'text-slate-400'
                          }
                        >
                          {step.status.toUpperCase()}
                        </div>
                        <div className="text-xs text-slate-400">{step.message}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 flex items-center justify-end gap-2">
                  <button
                    className="rounded border border-slate-600 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800/60 transition-all disabled:opacity-60"
                    onClick={closeFullSettlementModal}
                    disabled={isRunningFullSettlement}
                  >
                    Cancel
                  </button>
                  <button
                    className="rounded border border-cyan-500/60 bg-cyan-500/15 px-3 py-2 text-sm font-medium text-cyan-200 hover:bg-cyan-500/25 transition-all disabled:opacity-60"
                    onClick={() => void handleRunFullSettlement()}
                    disabled={!canManageOwnerFlows || isRunningFullSettlement}
                  >
                    {isRunningFullSettlement ? 'Running...' : 'Run Full Settlement'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {canViewOwnerConsole && (
            <>
              {/* Property Catalog */}
              <div className="mb-8 rounded-2xl border border-white/10 bg-slate-900/50 p-6 shadow-xl shadow-black/25 backdrop-blur">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-white">Property Catalog</h2>
                  <button
                    className="rounded-lg border border-blue-500/50 bg-blue-500/10 px-3 py-1 text-sm text-blue-300 hover:bg-blue-500/20 transition-all"
                    onClick={() => void loadAdminProperties(token)}
                    disabled={!canManageOwnerFlows || propertyCatalogLoading}
                  >
                    {propertyCatalogLoading ? 'Refreshing...' : 'Refresh'}
                  </button>
                </div>
                <div className="mb-4">
                  <input
                    className="w-full rounded-lg border border-slate-700/60 bg-slate-900/70 px-4 py-2 text-slate-100 placeholder-slate-400 focus:border-blue-500/50 focus:outline-none transition-all"
                    placeholder="Search by propertyId, name, location"
                    value={propertyCatalogQuery}
                    onChange={(event) => setPropertyCatalogQuery(event.target.value)}
                  />
                </div>
                {propertyCatalogLoading ? (
                  <p className="text-slate-400">Loading properties...</p>
                ) : adminProperties.length === 0 ? (
                  <p className="text-slate-400">No properties found.</p>
                ) : (
                  <div className="overflow-hidden rounded-lg border border-white/10">
                    <div className="max-h-96 overflow-auto">
                      <table className="min-w-full text-sm">
                        <thead className="sticky top-0 z-10 bg-slate-900/80 border-b border-white/10">
                          <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                            <th className="px-3 py-2 font-semibold">Property</th>
                            <th className="px-3 py-2 font-semibold">Status</th>
                            <th className="px-3 py-2 font-semibold">Location</th>
                            <th className="px-3 py-2 font-semibold text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {filteredAdminProperties.map((property) => {
                            const isArchived = !!property.archivedAt;
                            const isLoading = propertyActionLoadingId === property.propertyId;
                            return (
                              <tr key={property.propertyId} className="bg-slate-900/30 hover:bg-slate-900/50 transition-colors">
                                <td className="px-3 py-2 align-middle">
                                  <div className="font-medium text-white">{property.propertyId}</div>
                                  <div className="text-xs text-slate-400">{property.name}</div>
                                </td>
                                <td className="px-3 py-2 align-middle">
                                  <span
                                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                      isArchived
                                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                    }`}
                                  >
                                    {isArchived ? 'Archived' : 'Active'}
                                  </span>
                                </td>
                                <td className="px-3 py-2 align-middle text-slate-300">{property.location || 'N/A'}</td>
                                <td className="px-3 py-2 align-middle text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <button
                                      className="rounded border border-blue-500/50 bg-blue-500/10 px-2 py-1 text-xs text-blue-300 hover:bg-blue-500/20 disabled:opacity-60 transition-all"
                                      onClick={() => openEditPropertyModal(property)}
                                      disabled={!canManageOwnerFlows || isLoading}
                                    >
                                      Edit
                                    </button>
                                    {isArchived ? (
                                      <button
                                        className="rounded border border-emerald-500/50 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-60 transition-all"
                                        onClick={() => void handleRestoreProperty(property.propertyId)}
                                        disabled={!canManageOwnerFlows || isLoading}
                                      >
                                        {isLoading ? 'Restoring...' : 'Restore'}
                                      </button>
                                    ) : (
                                      <button
                                        className="rounded border border-amber-500/50 bg-amber-500/10 px-2 py-1 text-xs text-amber-300 hover:bg-amber-500/20 disabled:opacity-60 transition-all"
                                        onClick={() => void handleArchiveProperty(property.propertyId)}
                                        disabled={!canManageOwnerFlows || isLoading}
                                      >
                                        {isLoading ? 'Archiving...' : 'Archive'}
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Campaign Overview */}
              <div className="mb-8 rounded-2xl border border-white/10 bg-slate-900/50 p-6 shadow-xl shadow-black/25 backdrop-blur">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-white">Campaign Fee Overview</h2>
                  <button
                    className="rounded-lg border border-slate-600 px-3 py-1 text-sm text-slate-200 hover:bg-slate-800/60 transition-all"
                    onClick={() => void loadCampaigns()}
                  >
                    Refresh
                  </button>
                </div>
                {campaignsLoading ? (
                  <p className="text-slate-400">Loading campaigns...</p>
                ) : campaigns.length === 0 ? (
                  <p className="text-slate-400">No campaigns indexed yet.</p>
                ) : (
                  <div className="overflow-hidden rounded-lg border border-white/10">
                    <div className="max-h-96 overflow-auto">
                      <table className="min-w-full text-sm">
                        <thead className="sticky top-0 z-10 bg-slate-900/80 border-b border-white/10">
                          <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                            <th className="px-3 py-2 font-semibold">Property</th>
                            <th className="px-3 py-2 font-semibold">State</th>
                            <th className="px-3 py-2 font-semibold">Raised / Target</th>
                            <th className="px-3 py-2 font-semibold">Fee</th>
                            <th className="px-3 py-2 font-semibold text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {visibleCampaigns.map((campaign) => {
                            const raisedUsdc = Number(campaign.raisedUsdcBaseUnits) / 1_000_000;
                            const targetUsdc = Number(campaign.targetUsdcBaseUnits) / 1_000_000;
                            const campaignKey = campaign.campaignAddress.toLowerCase();
                            const lifecycle = campaignLifecyclePreflightByAddress[campaignKey] ?? null;
                            const isChecking = campaignLifecycleLoadingKey === `check:${campaignKey}`;
                            const isFinalizing = campaignLifecycleLoadingKey === `finalize:${campaignKey}`;
                            const isRepairing = campaignLifecycleLoadingKey === `repair:${campaignKey}`;
                            const isWithdrawing = campaignLifecycleLoadingKey === `withdraw:${campaignKey}`;

                            return (
                              <tr key={campaign.campaignAddress} className="bg-slate-900/30 hover:bg-slate-900/50 transition-colors">
                                <td className="px-3 py-2 align-middle">
                                  <div className="font-medium text-white">{campaign.propertyId}</div>
                                  <div className="font-mono text-[11px] text-slate-400">
                                    {campaign.campaignAddress.slice(0, 8)}...
                                  </div>
                                </td>
                                <td className="px-3 py-2 align-middle">
                                  <span
                                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                      campaign.state === 'SUCCESS'
                                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                        : campaign.state === 'FAILED'
                                          ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                    }`}
                                  >
                                    {campaign.state}
                                  </span>
                                </td>
                                <td className="px-3 py-2 align-middle font-mono text-xs text-slate-300">
                                  {raisedUsdc.toLocaleString(undefined, {
                                    maximumFractionDigits: 0,
                                  })}{' '}
                                  /{' '}
                                  {targetUsdc.toLocaleString(undefined, {
                                    maximumFractionDigits: 0,
                                  })}
                                </td>
                                <td className="px-3 py-2 align-middle text-slate-300">
                                  {campaign.platformFeeBps === null ? 'Not set' : `${(campaign.platformFeeBps / 100).toFixed(2)}%`}
                                </td>
                                <td className="px-3 py-2 align-middle text-right">
                                  <div className="flex flex-wrap items-center justify-end gap-2">
                                    <button
                                      className="rounded border border-blue-500/50 bg-blue-500/10 px-2 py-1 text-xs text-blue-300 hover:bg-blue-500/20 disabled:opacity-60 transition-all"
                                      onClick={() => void handleCheckCampaignLifecycle(campaign.campaignAddress)}
                                      disabled={!canManageOwnerFlows || isChecking || isFinalizing || isWithdrawing}
                                    >
                                      {isChecking ? 'Checking...' : 'Check'}
                                    </button>
                                    <button
                                      className="rounded border border-amber-500/50 bg-amber-500/10 px-2 py-1 text-xs text-amber-300 hover:bg-amber-500/20 disabled:opacity-60 transition-all"
                                      onClick={() => void handleFinalizeCampaign(campaign.campaignAddress)}
                                      disabled={
                                        !canManageOwnerFlows ||
                                        campaign.state !== 'ACTIVE' ||
                                        isChecking ||
                                        isFinalizing ||
                                        isWithdrawing
                                      }
                                    >
                                      {isFinalizing ? 'Finalizing...' : 'Finalize'}
                                    </button>
                                    <button
                                      className="rounded border border-violet-500/50 bg-violet-500/10 px-2 py-1 text-xs text-violet-300 hover:bg-violet-500/20 disabled:opacity-60 transition-all"
                                      onClick={() => void handleRepairCampaignSetup(campaign.campaignAddress)}
                                      disabled={
                                        !canManageOwnerFlows ||
                                        (campaign.state !== 'SUCCESS' && campaign.state !== 'WITHDRAWN') ||
                                        isChecking ||
                                        isFinalizing ||
                                        isRepairing ||
                                        isWithdrawing
                                      }
                                    >
                                      {isRepairing ? 'Repairing...' : 'Repair Setup'}
                                    </button>
                                    <button
                                      className="rounded border border-emerald-500/50 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-60 transition-all"
                                      onClick={() => void openSmartWithdrawModal(campaign)}
                                      disabled={
                                        !canManageOwnerFlows ||
                                        isChecking ||
                                        isFinalizing ||
                                        isRepairing ||
                                        isWithdrawing
                                      }
                                    >
                                      {isWithdrawing ? 'Withdrawing...' : 'Withdraw'}
                                    </button>
                                    <button
                                      className="rounded border border-cyan-500/50 bg-cyan-500/10 px-2 py-1 text-xs text-cyan-300 hover:bg-cyan-500/20 disabled:opacity-60 transition-all"
                                      onClick={() => void openFullSettlementModal(campaign)}
                                      disabled={
                                        !canManageOwnerFlows ||
                                        isChecking ||
                                        isFinalizing ||
                                        isRepairing ||
                                        isWithdrawing ||
                                        isRunningFullSettlement
                                      }
                                    >
                                      Run Full Settlement
                                    </button>
                                  </div>
                                  {lifecycle && (
                                    <div className="mt-2 rounded border border-white/10 bg-slate-950/60 px-2 py-2 text-left text-[10px] text-slate-300">
                                      <p className="font-semibold text-slate-200">Post-Settlement Health</p>
                                      <p className="mt-1">
                                        Equity token:{' '}
                                        <span
                                          className={
                                            lifecycle.postSettlementHealth.equityTokenSet
                                              ? 'text-emerald-300'
                                              : 'text-amber-300'
                                          }
                                        >
                                          {lifecycle.postSettlementHealth.equityTokenSet ? 'Configured' : 'Missing'}
                                        </span>
                                      </p>
                                      <p>
                                        Wallets: {lifecycle.postSettlementHealth.investorWallets} total,{' '}
                                        {lifecycle.postSettlementHealth.equityClaimableWallets} equity-claimable,{' '}
                                        {lifecycle.postSettlementHealth.profitClaimableWallets} profit-claimable
                                      </p>
                                      {lifecycle.postSettlementHealth.claimabilityReadErrors > 0 && (
                                        <p className="text-amber-300">
                                          Claim read warnings: {lifecycle.postSettlementHealth.claimabilityReadErrors}
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Combined Submissions */}
              <div className="mb-8 rounded-2xl border border-white/10 bg-slate-900/50 p-6 shadow-xl shadow-black/25 backdrop-blur">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-white">Recent Combined Submissions</h2>
                  <div className="flex items-center gap-2">
                    <button
                      className="rounded-lg border border-slate-600 px-3 py-1 text-sm text-slate-200 hover:bg-slate-800/60 transition-all"
                      onClick={handleExportSettlementCsv}
                      disabled={combinedHistory.length === 0}
                    >
                      Export CSV
                    </button>
                    <button
                      className="rounded-lg border border-slate-600 px-3 py-1 text-sm text-slate-200 hover:bg-slate-800/60 transition-all"
                      onClick={() => void handleRefreshCombinedStatuses()}
                      disabled={!canManageOwnerFlows || combinedProgressLoading}
                    >
                      {combinedProgressLoading ? 'Refreshing...' : 'Refresh Status'}
                    </button>
                  </div>
                </div>
                {combinedHistory.length === 0 ? (
                  <p className="text-sm text-slate-400">No combined submissions yet.</p>
                ) : (
                  <div className="space-y-3">
                    {visibleCombinedHistory.map((record) => {
                      const profitIntent = record.profitIntentId
                        ? profitIntentById.get(record.profitIntentId)
                        : null;
                      const platformIntent = record.platformFeeIntentId
                        ? platformFeeIntentById.get(record.platformFeeIntentId)
                        : null;
                      const progress = combinedProgress[record.id];
                      const outcome = getCombinedOutcome(record);
                      const profitBlockerMessage = getProfitIntentBlockerMessage(profitIntent);
                      const depositStepStatus =
                        progress?.profitDepositIndexed === true
                          ? 'confirmed'
                          : profitBlockerMessage
                            ? 'failed'
                            : profitIntent?.status ?? 'pending';

                      return (
                        <div
                          key={record.id}
                          className={`rounded-lg border p-3 backdrop-blur transition-all ${
                            outcome === 'completed'
                              ? 'border-emerald-500/30 bg-emerald-500/5'
                              : outcome === 'needs_attention'
                                ? 'border-red-500/30 bg-red-500/5'
                                : 'border-white/10 bg-slate-800/30'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <div className="font-medium text-white">{record.propertyId}</div>
                              <div className="text-xs text-slate-400">{record.campaignAddress}</div>
                            </div>
                            <span
                              className={`text-xs px-2 py-1 rounded font-medium ${
                                outcome === 'completed'
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : outcome === 'needs_attention'
                                    ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              }`}
                            >
                              {outcome === 'completed'
                                ? 'Completed'
                                : outcome === 'needs_attention'
                                  ? 'Needs Attention'
                                  : 'In Progress'}
                            </span>
                          </div>
                          {profitIntent && (
                            <div className="mt-2 flex items-center gap-2 text-xs">
                              <span className="text-slate-400">Profit:</span>
                              <span className={`${intentStatusClass(profitIntent.status)} px-2 py-0.5 rounded font-medium`}>
                                {profitIntent.status}
                              </span>
                            </div>
                          )}
                          {platformIntent && (
                            <div className="mt-1 flex items-center gap-2 text-xs">
                              <span className="text-slate-400">Platform Fee:</span>
                              <span className={`${intentStatusClass(platformIntent.status)} px-2 py-0.5 rounded font-medium`}>
                                {platformIntent.status}
                              </span>
                            </div>
                          )}
                          {(record.grossSettlementUsdc || record.netDistributionUsdc) && (
                            <div className="mt-2 text-xs text-slate-300">
                              Gross {record.grossSettlementUsdc ?? '--'} USDC | Fee {record.platformFeeUsdc ?? '--'} USDC | Net {record.netDistributionUsdc ?? '--'} USDC
                            </div>
                          )}
                          <div className="mt-2 rounded border border-white/10 bg-slate-900/35 p-2 text-xs text-slate-300">
                            <div className="font-medium text-slate-200">Execution Order</div>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              <span className="text-slate-400">1. setPlatformFee</span>
                              <span
                                className={`${intentStatusClass(
                                  progress?.campaignMatchesTarget === true
                                    ? 'confirmed'
                                    : platformIntent?.status ?? 'pending'
                                )} px-2 py-0.5 rounded font-medium`}
                              >
                                {progress?.campaignMatchesTarget === true
                                  ? 'confirmed'
                                  : platformIntent?.status ?? 'pending'}
                              </span>
                            </div>
                            {(record.platformFeeUsdc && Number(record.platformFeeUsdc) > 0) && (
                              <div className="mt-1 flex flex-wrap items-center gap-2">
                                <span className="text-slate-400">2. transferPlatformFee</span>
                                <span className={`${intentStatusClass(platformIntent?.status ?? 'pending')} px-2 py-0.5 rounded font-medium`}>
                                  {platformIntent?.status ?? 'pending'}
                                </span>
                              </div>
                            )}
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              <span className="text-slate-400">3. depositInvestorProfit</span>
                              <span
                                className={`${intentStatusClass(
                                  depositStepStatus
                                )} px-2 py-0.5 rounded font-medium`}
                              >
                                {depositStepStatus}
                              </span>
                            </div>
                            {profitBlockerMessage && (
                              <div className="mt-2 rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-[11px] text-red-200">
                                {profitBlockerMessage}
                              </div>
                            )}
                          </div>
                          {(profitIntent?.status === 'failed' || platformIntent?.status === 'failed') && (
                            <div className="mt-2">
                              <button
                                className="rounded border border-blue-500/50 bg-blue-500/10 px-2 py-1 text-xs text-blue-300 hover:bg-blue-500/20 transition-all"
                                onClick={() => void handleRetryCombinedSubmission(record)}
                                disabled={!canManageOwnerFlows}
                              >
                                Retry Failed Pair
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Intents Overview */}
              <div className="grid gap-6 lg:grid-cols-3">
                {/* Property Intents */}
                <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-6 shadow-xl shadow-black/25 backdrop-blur">
                  <h3 className="mb-4 text-lg font-bold text-white">Property Intents</h3>
                  {propertyIntents.length === 0 ? (
                    <p className="text-sm text-slate-400">No property intents yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {visiblePropertyIntents.map((intent) => (
                        <div key={intent.id} className="rounded-lg border border-white/10 bg-slate-800/30 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-white">{intent.propertyId}</span>
                            <span className={`text-xs px-2 py-0.5 rounded font-medium ${intentStatusClass(intent.status)}`}>
                              {intent.status}
                            </span>
                          </div>
                          <div className="mt-2 text-xs text-slate-400">Attempts: {intent.attemptCount}</div>
                          {intent.errorMessage && (
                            <div className="mt-1 text-xs text-red-400">{intent.errorMessage}</div>
                          )}
                          {intent.status === 'failed' && (
                            <div className="mt-2 flex gap-2">
                              <button
                                className="rounded border border-blue-500/50 bg-blue-500/10 px-2 py-1 text-xs text-blue-300 hover:bg-blue-500/20 disabled:opacity-50 transition-all"
                                onClick={() => void handleIntentAction('retry', 'property', intent.id)}
                                disabled={!canManageOwnerFlows || intentActionLoadingKey === `retry:property:${intent.id}`}
                              >
                                {intentActionLoadingKey === `retry:property:${intent.id}` ? 'Retrying...' : 'Retry'}
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Profit Intents */}
                <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-6 shadow-xl shadow-black/25 backdrop-blur">
                  <h3 className="mb-4 text-lg font-bold text-white">Profit Intents</h3>
                  {profitIntents.length === 0 ? (
                    <p className="text-sm text-slate-400">No profit intents yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {visibleProfitIntents.map((intent) => (
                        <div key={intent.id} className="rounded-lg border border-white/10 bg-slate-800/30 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-white">{intent.propertyId}</span>
                            <span className={`text-xs px-2 py-0.5 rounded font-medium ${intentStatusClass(intent.status)}`}>
                              {intent.status}
                            </span>
                          </div>
                          <div className="mt-2 text-xs text-slate-400">
                            ${(Number(intent.usdcAmountBaseUnits) / 1_000_000).toLocaleString()} USDC
                          </div>
                          {intent.status === 'failed' && (
                            <div className="mt-2 flex gap-2">
                              <button
                                className="rounded border border-blue-500/50 bg-blue-500/10 px-2 py-1 text-xs text-blue-300 hover:bg-blue-500/20 disabled:opacity-50 transition-all"
                                onClick={() => void handleIntentAction('retry', 'profit', intent.id)}
                                disabled={!canManageOwnerFlows || intentActionLoadingKey === `retry:profit:${intent.id}`}
                              >
                                {intentActionLoadingKey === `retry:profit:${intent.id}` ? 'Retrying...' : 'Retry'}
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Platform Fee Intents */}
                <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-6 shadow-xl shadow-black/25 backdrop-blur">
                  <h3 className="mb-4 text-lg font-bold text-white">Platform Fee Intents</h3>
                  {platformFeeIntents.length === 0 ? (
                    <p className="text-sm text-slate-400">No platform fee intents yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {visiblePlatformFeeIntents.map((intent) => (
                        <div key={intent.id} className="rounded-lg border border-white/10 bg-slate-800/30 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-white">
                              {(intent.platformFeeBps / 100).toFixed(2)}%
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded font-medium ${intentStatusClass(intent.status)}`}>
                              {intent.status}
                            </span>
                          </div>
                          <div className="mt-2 text-xs font-mono text-slate-400 break-all">
                            {intent.campaignAddress.slice(0, 12)}...
                          </div>
                          {intent.usdcAmountBaseUnits && BigInt(intent.usdcAmountBaseUnits) > 0n && (
                            <div className="mt-1 text-xs text-slate-300">
                              Transfer:{' '}
                              {(Number(intent.usdcAmountBaseUnits) / 1_000_000).toLocaleString(undefined, {
                                maximumFractionDigits: 6,
                              })}{' '}
                              USDC
                            </div>
                          )}
                          {intent.status === 'failed' && (
                            <div className="mt-2 flex gap-2">
                              <button
                                className="rounded border border-blue-500/50 bg-blue-500/10 px-2 py-1 text-xs text-blue-300 hover:bg-blue-500/20 disabled:opacity-50 transition-all"
                                onClick={() => void handleIntentAction('retry', 'platformFee', intent.id)}
                                disabled={!canManageOwnerFlows || intentActionLoadingKey === `retry:platformFee:${intent.id}`}
                              >
                                {intentActionLoadingKey === `retry:platformFee:${intent.id}` ? 'Retrying...' : 'Retry'}
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* System Health */}
              {adminMetrics && (
                <div className="mt-8 rounded-2xl border border-white/10 bg-slate-900/50 p-6 shadow-xl shadow-black/25 backdrop-blur">
                  <h2 className="mb-4 text-xl font-bold text-white">System Health</h2>
                  {adminMetrics.intents?.totals && (
                    <div className="grid gap-3 md:grid-cols-4">
                      <div className="rounded-lg border border-white/10 bg-slate-800/30 p-3">
                        <div className="text-xs text-slate-400">Pending</div>
                        <div className="mt-1 text-2xl font-bold text-white">{adminMetrics.intents.totals.pending}</div>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-slate-800/30 p-3">
                        <div className="text-xs text-slate-400">Submitted</div>
                        <div className="mt-1 text-2xl font-bold text-white">{adminMetrics.intents.totals.submitted}</div>
                      </div>
                      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
                        <div className="text-xs text-emerald-400">Confirmed</div>
                        <div className="mt-1 text-2xl font-bold text-emerald-300">{adminMetrics.intents.totals.confirmed}</div>
                      </div>
                      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                        <div className="text-xs text-red-400">Failed</div>
                        <div className="mt-1 text-2xl font-bold text-red-300">{adminMetrics.intents.totals.failed}</div>
                      </div>
                    </div>
                  )}
                  {adminMetrics.settlements && (
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div className="rounded-lg border border-white/10 bg-slate-800/30 p-4">
                        <div className="text-xs uppercase tracking-wide text-slate-400">Platform Fee Transfers</div>
                        <div className="mt-2 grid grid-cols-4 gap-2 text-center text-xs">
                          <div>
                            <div className="text-slate-400">Pending</div>
                            <div className="font-semibold text-white">{adminMetrics.settlements.platformFeeTransfers.pending}</div>
                          </div>
                          <div>
                            <div className="text-slate-400">Submitted</div>
                            <div className="font-semibold text-amber-300">{adminMetrics.settlements.platformFeeTransfers.submitted}</div>
                          </div>
                          <div>
                            <div className="text-slate-400">Confirmed</div>
                            <div className="font-semibold text-emerald-300">{adminMetrics.settlements.platformFeeTransfers.confirmed}</div>
                          </div>
                          <div>
                            <div className="text-slate-400">Failed</div>
                            <div className="font-semibold text-red-300">{adminMetrics.settlements.platformFeeTransfers.failed}</div>
                          </div>
                        </div>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-slate-800/30 p-4">
                        <div className="text-xs uppercase tracking-wide text-slate-400">Profit Deposits</div>
                        <div className="mt-2 grid grid-cols-4 gap-2 text-center text-xs">
                          <div>
                            <div className="text-slate-400">Pending</div>
                            <div className="font-semibold text-white">{adminMetrics.settlements.profitDeposits.pending}</div>
                          </div>
                          <div>
                            <div className="text-slate-400">Submitted</div>
                            <div className="font-semibold text-amber-300">{adminMetrics.settlements.profitDeposits.submitted}</div>
                          </div>
                          <div>
                            <div className="text-slate-400">Confirmed</div>
                            <div className="font-semibold text-emerald-300">{adminMetrics.settlements.profitDeposits.confirmed}</div>
                          </div>
                          <div>
                            <div className="text-slate-400">Failed</div>
                            <div className="font-semibold text-red-300">{adminMetrics.settlements.profitDeposits.failed}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  {adminMetrics.settlements && (
                    <div className="mt-4 grid gap-3 md:grid-cols-4">
                      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                        <div className="text-xs text-amber-300">Stale Fee Transfers</div>
                        <div className="mt-1 text-xl font-bold text-amber-200">
                          {adminMetrics.settlements.anomalies.feeTransferStaleSubmitted}
                        </div>
                      </div>
                      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                        <div className="text-xs text-amber-300">Stale Profit Deposits</div>
                        <div className="mt-1 text-xl font-bold text-amber-200">
                          {adminMetrics.settlements.anomalies.profitDepositStaleSubmitted}
                        </div>
                      </div>
                      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                        <div className="text-xs text-red-300">Orphaned Fee Intents</div>
                        <div className="mt-1 text-xl font-bold text-red-200">
                          {adminMetrics.settlements.anomalies.orphanedFeeTransfers}
                        </div>
                      </div>
                      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                        <div className="text-xs text-red-300">Settlement Failures (24h)</div>
                        <div className="mt-1 text-xl font-bold text-red-200">
                          {adminMetrics.settlements.anomalies.settlementFailures24h}
                        </div>
                      </div>
                    </div>
                  )}
                  {ownerHealthAlerts.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {ownerHealthAlerts.map((alert, index) => (
                        <div
                          key={`${alert.text}-${index}`}
                          className={
                            alert.tone === 'danger'
                              ? 'rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200'
                              : 'rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200'
                          }
                        >
                          {alert.text}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
