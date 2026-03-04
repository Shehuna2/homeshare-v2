export default function Disclosures() {
  return (
    <div className="bg-gradient-to-br from-slate-50 via-white to-slate-100 py-10 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-4xl rounded-2xl border border-white/70 bg-white/85 p-7 shadow-xl shadow-slate-200/40 backdrop-blur dark:border-white/10 dark:bg-slate-900/70 dark:shadow-black/40">
          <h1 className="mb-6 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
            Risk Disclosures
          </h1>
          <div className="space-y-4 text-slate-700 dark:text-slate-300">
            <p>
              Investments in tokenized real-estate offerings are speculative and can result in partial
              or total loss of capital.
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li>No guaranteed returns. Profit distributions are not guaranteed.</li>
              <li>Liquidity may be limited and exits may be delayed or unavailable.</li>
              <li>Smart-contract, wallet, and network failures may cause losses.</li>
              <li>Regulatory and jurisdiction rules may restrict participation.</li>
              <li>Platform, protocol, and transaction fees reduce net outcomes.</li>
            </ul>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              This page is a product-level summary. Full disclosure text is maintained in
              `docs/INVESTOR_DISCLOSURES.md` and must be legal-approved for production.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
