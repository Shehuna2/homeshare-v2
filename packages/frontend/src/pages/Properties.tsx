import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchCampaigns, fetchProperties, PropertyResponse, CampaignResponse } from '../lib/api';

const formatCountdown = (startTimeIso: string, nowMs: number): string | null => {
  const startMs = Date.parse(startTimeIso);
  if (Number.isNaN(startMs) || startMs <= nowMs) {
    return null;
  }
  const remaining = Math.floor((startMs - nowMs) / 1000);
  const days = Math.floor(remaining / 86400);
  const hours = Math.floor((remaining % 86400) / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const seconds = remaining % 60;
  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
};

export default function Properties() {
  const [properties, setProperties] = useState<PropertyResponse[]>([]);
  const [campaignByPropertyId, setCampaignByPropertyId] = useState<Record<string, CampaignResponse>>({});
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    let isMounted = true;

    const loadProperties = async () => {
      try {
        const [propertiesData, campaignsData] = await Promise.all([fetchProperties(), fetchCampaigns()]);
        const campaignMap = campaignsData.reduce<Record<string, CampaignResponse>>((acc, campaign) => {
          acc[campaign.propertyId] = campaign;
          return acc;
        }, {});
        if (isMounted) {
          setProperties(propertiesData);
          setCampaignByPropertyId(campaignMap);
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

    loadProperties();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

          return (
    <div className="bg-gradient-to-br from-slate-50 via-white to-slate-100 py-10 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="container mx-auto px-4">
        <div className="mb-8 rounded-2xl border border-white/70 bg-white/80 p-6 shadow-xl shadow-slate-200/40 backdrop-blur dark:border-white/10 dark:bg-slate-900/70 dark:shadow-black/40">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
            Property Listings
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-300">
            Discover active and upcoming campaigns, then invest directly onchain.
          </p>
        </div>

        <div className="mb-6 rounded-2xl border border-white/70 bg-white/80 p-4 shadow-lg shadow-slate-200/35 backdrop-blur dark:border-white/10 dark:bg-slate-900/65 dark:shadow-black/35">
          <div className="grid gap-3 md:grid-cols-4">
            <select className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white">
              <option>Base Networks</option>
              <option>Base Sepolia</option>
              <option>Base Mainnet</option>
            </select>
            <input
              type="text"
              placeholder="Search properties..."
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-slate-900 placeholder:text-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            />
            <select className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white">
              <option>All Status</option>
              <option>Draft</option>
              <option>Funding</option>
              <option>Funded</option>
            </select>
            <button className="rounded-xl bg-primary-600 px-6 py-2 text-white transition hover:bg-primary-700">
              Apply Filters
            </button>
          </div>
        </div>

        {loading && (
          <div className="text-slate-600 dark:text-slate-300">Loading properties...</div>
        )}

        {errorMessage && (
          <div className="mb-6 rounded-xl bg-red-50 px-4 py-3 text-red-700 dark:bg-red-900/40 dark:text-red-200">
            {errorMessage}
          </div>
        )}

        {!loading && !errorMessage && properties.length === 0 && (
          <div className="text-slate-600 dark:text-slate-300">No properties available yet.</div>
        )}

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {properties.map((property) => {
            const campaign = campaignByPropertyId[property.propertyId];
            const countdown =
              campaign?.state === 'ACTIVE' && campaign.startTime
                ? formatCountdown(campaign.startTime, nowMs)
                : null;

            return (
              <div
                key={property.propertyId}
                className="overflow-hidden rounded-2xl border border-white/70 bg-white/85 shadow-xl shadow-slate-200/35 backdrop-blur transition hover:-translate-y-1 hover:shadow-2xl dark:border-white/10 dark:bg-slate-900/70 dark:shadow-black/35"
              >
                {property.imageUrl || property.imageUrls?.[0] ? (
                  <img
                    src={property.imageUrl || property.imageUrls?.[0]}
                    alt={property.name}
                    className="h-52 w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-52 items-center justify-center bg-slate-200 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    No image
                  </div>
                )}
                <div className="p-6">
                  {countdown && (
                    <div className="mb-3 inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                      Starts in {countdown}
                    </div>
                  )}
                  <h3 className="mb-2 text-xl font-semibold text-slate-900 dark:text-white">
                    {property.name}
                  </h3>
                  <p className="mb-4 line-clamp-3 text-slate-600 dark:text-slate-300">
                    {property.description}
                  </p>
                  <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
                    Platform fee:{' '}
                    {property.platformFeeBps === null
                      ? 'Not available'
                      : `${(property.platformFeeBps / 100).toFixed(2)}%`}
                  </p>
                  <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
                    Est. sell price:{' '}
                    {property.estimatedSellUsdcBaseUnits
                      ? `$${(Number(property.estimatedSellUsdcBaseUnits) / 1_000_000).toLocaleString()} USDC`
                      : 'Not set'}
                  </p>
                  {property.estimatedSellUsdcBaseUnits && (
                    <p className="mb-3 text-xs text-emerald-700 dark:text-emerald-300">
                      Projected upside:{' '}
                      {(
                        ((Number(property.estimatedSellUsdcBaseUnits) -
                          Number(property.targetUsdcBaseUnits)) /
                          Number(property.targetUsdcBaseUnits || '1')) *
                        100
                      ).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      %
                    </p>
                  )}
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      Target: ${(Number(property.targetUsdcBaseUnits) / 1_000_000).toLocaleString()} USDC
                    </span>
                    <Link
                      to={`/properties/${property.propertyId}`}
                      className="rounded-lg bg-primary-600 px-4 py-2 text-white transition hover:bg-primary-700"
                    >
                      View Details
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
