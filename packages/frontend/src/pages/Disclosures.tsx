export default function Disclosures() {
  return (
    <div className="py-10">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-4xl rounded-2xl border border-slate-700/50 bg-slate-900/80 p-7 shadow-2xl shadow-black/30 backdrop-blur">
          <h1 className="mb-6 text-3xl font-semibold tracking-tight text-white">
            Risk Disclosures
          </h1>
          <div className="space-y-4 text-slate-300">
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
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              This page is a product-level summary. Full disclosure text is maintained in
              `docs/INVESTOR_DISCLOSURES.md` and must be legal-approved for production.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
