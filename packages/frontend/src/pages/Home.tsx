import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="bg-gradient-to-br from-slate-50 via-white to-slate-100 py-12 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="container mx-auto space-y-8 px-4">
        <div className="rounded-2xl border border-white/70 bg-white/80 p-8 text-center shadow-xl shadow-slate-200/40 backdrop-blur dark:border-white/10 dark:bg-slate-900/70 dark:shadow-black/40">
          <h1 className="mb-4 text-4xl font-semibold tracking-tight text-slate-900 md:text-5xl dark:text-white">
            Base-Native Real Estate Crowdfunding
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-slate-600 dark:text-slate-300">
            Invest in real estate on Base with transparent onchain ownership and programmable payouts.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              to="/properties"
              className="rounded-xl bg-primary-600 px-8 py-3 text-white transition hover:bg-primary-700"
            >
              Browse Properties
            </Link>
            <Link
              to="/dashboard"
              className="rounded-xl border border-slate-300 bg-white px-8 py-3 text-slate-900 transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
            >
              Investor Dashboard
            </Link>
          </div>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-100">
          Investing carries risk of partial or total loss. Review{' '}
          <Link to="/disclosures" className="font-medium underline">
            Risk Disclosures
          </Link>{' '}
          before participating.
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          <div className="rounded-2xl border border-white/70 bg-white/85 p-6 shadow-lg shadow-slate-200/30 dark:border-white/10 dark:bg-slate-900/65 dark:shadow-black/30">
            <h3 className="mb-3 text-xl font-semibold text-slate-900 dark:text-white">Base Focused</h3>
            <p className="text-slate-600 dark:text-slate-300">
              Built specifically for Base to keep UX and liquidity simple.
            </p>
          </div>
          <div className="rounded-2xl border border-white/70 bg-white/85 p-6 shadow-lg shadow-slate-200/30 dark:border-white/10 dark:bg-slate-900/65 dark:shadow-black/30">
            <h3 className="mb-3 text-xl font-semibold text-slate-900 dark:text-white">Multiple Tokens</h3>
            <p className="text-slate-600 dark:text-slate-300">
              Use USDC for investments and receive transparent USDC profit distributions.
            </p>
          </div>
          <div className="rounded-2xl border border-white/70 bg-white/85 p-6 shadow-lg shadow-slate-200/30 dark:border-white/10 dark:bg-slate-900/65 dark:shadow-black/30">
            <h3 className="mb-3 text-xl font-semibold text-slate-900 dark:text-white">Fractional Ownership</h3>
            <p className="text-slate-600 dark:text-slate-300">
              Own property tokens representing shares in real estate assets.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/70 bg-white/85 p-8 shadow-xl shadow-slate-200/35 dark:border-white/10 dark:bg-slate-900/70 dark:shadow-black/35">
          <h2 className="mb-6 text-center text-3xl font-semibold text-slate-900 dark:text-white">
            Supported Network
          </h2>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-xl bg-slate-100 px-6 py-5 text-center dark:bg-slate-800/80">
              <h4 className="mb-2 text-lg font-semibold text-slate-900 dark:text-white">Base Sepolia</h4>
              <p className="text-slate-600 dark:text-slate-300">USDC, ETH</p>
            </div>
            <div className="rounded-xl bg-slate-100 px-6 py-5 text-center dark:bg-slate-800/80">
              <h4 className="mb-2 text-lg font-semibold text-slate-900 dark:text-white">Base</h4>
              <p className="text-slate-600 dark:text-slate-300">USDC, USDT, ETH</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
