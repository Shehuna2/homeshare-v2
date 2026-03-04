import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="bg-gradient-to-br from-slate-50 via-white to-slate-100 py-16 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-xl rounded-2xl border border-white/70 bg-white/85 p-10 text-center shadow-xl shadow-slate-200/40 backdrop-blur dark:border-white/10 dark:bg-slate-900/70 dark:shadow-black/40">
          <h1 className="mb-3 text-6xl font-semibold tracking-tight text-slate-900 dark:text-white">404</h1>
          <p className="mb-8 text-lg text-slate-600 dark:text-slate-300">Page not found</p>
          <Link
            to="/"
            className="inline-block rounded-xl bg-primary-600 px-8 py-3 text-white transition hover:bg-primary-700"
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
