import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="py-16">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-xl rounded-2xl border border-slate-700/50 bg-slate-900/80 p-10 text-center shadow-2xl shadow-black/30 backdrop-blur">
          <h1 className="mb-3 text-6xl font-semibold tracking-tight text-white">404</h1>
          <p className="mb-8 text-lg text-slate-300">Page not found</p>
          <Link
            to="/"
            className="inline-block rounded-xl bg-emerald-600 px-8 py-3 text-white transition hover:bg-emerald-500 hover:shadow-lg hover:shadow-emerald-500/20"
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
