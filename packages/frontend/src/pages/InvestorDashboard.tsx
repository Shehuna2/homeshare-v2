import { useEffect, useMemo, useState } from 'react';
import { fetchInvestments, InvestmentResponse } from '../lib/api';
import { useSelector } from 'react-redux';
import { RootState } from '../store';

export default function InvestorDashboard() {
  const { address } = useSelector((state: RootState) => state.user);
  const [investments, setInvestments] = useState<InvestmentResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadInvestments = async () => {
      try {
        const data = await fetchInvestments(address ?? undefined);
        if (isMounted) {
          setInvestments(data);
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

    loadInvestments();

    return () => {
      isMounted = false;
    };
  }, [address]);

  const summary = useMemo(() => {
    const totalInvested = investments.reduce((sum, investment) => sum + investment.amount, 0);
    const activeProperties = new Set(investments.map((investment) => investment.propertyId)).size;
    const totalReturns = totalInvested * 0.0;
    const byChain = investments.reduce<Record<string, number>>((acc, investment) => {
      acc[investment.chain] = (acc[investment.chain] ?? 0) + investment.amount;
      return acc;
    }, {});

    return { totalInvested, activeProperties, totalReturns, byChain };
  }, [investments]);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8 text-gray-900 dark:text-white">
        Investor Dashboard
      </h1>

      {loading && (
        <div className="text-gray-600 dark:text-gray-300">Loading investments...</div>
      )}

      {errorMessage && (
        <div className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-red-700 dark:bg-red-900/40 dark:text-red-200">
          {errorMessage}
        </div>
      )}

      {!loading && !errorMessage && investments.length === 0 && (
        <div className="mb-6 text-gray-600 dark:text-gray-300">No investments yet.</div>
      )}

      {/* Summary Cards */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
          <h3 className="text-sm text-gray-500 dark:text-gray-400 mb-2">Total Invested</h3>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            ${summary.totalInvested.toLocaleString()}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
          <h3 className="text-sm text-gray-500 dark:text-gray-400 mb-2">Active Properties</h3>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{summary.activeProperties}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
          <h3 className="text-sm text-gray-500 dark:text-gray-400 mb-2">Total Returns</h3>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            ${summary.totalReturns.toLocaleString()}
          </p>
        </div>
      </div>

      {/* By Chain */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg mb-8">
        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Investments by Chain</h2>
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
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Investment History</h2>
        {investments.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">No investments yet</p>
        ) : (
          <div className="space-y-4">
            {investments.map((investment) => (
              <div
                key={investment.id}
                className="flex flex-col gap-2 border-b border-gray-200 pb-4 last:border-b-0 dark:border-gray-700"
              >
                <div className="flex justify-between">
                  <span className="text-gray-900 dark:text-white">Property ID</span>
                  <span className="text-gray-600 dark:text-gray-300">{investment.propertyId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-900 dark:text-white">Amount</span>
                  <span className="text-gray-600 dark:text-gray-300">${investment.amount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-900 dark:text-white">Chain</span>
                  <span className="text-gray-600 dark:text-gray-300">{investment.chain}</span>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {new Date(investment.createdAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
