import { AlertTriangle, ArrowLeft, Home, LogIn, RefreshCw, ShieldAlert, WifiOff } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getErrorPageState } from '../../utils/errorMessages.js';

const ICONS = {
  network: WifiOff,
  forbidden: ShieldAlert,
  unauthorized: LogIn,
  'not-found': AlertTriangle,
  validation: AlertTriangle,
  server: AlertTriangle,
};

export default function ErrorPage({ error, kind, title, message, onRetry }) {
  const navigate = useNavigate();
  const location = useLocation();
  const state = error ? getErrorPageState(error) : { kind: kind || 'server', title: title || 'Something went wrong', message: message || 'Please try again.' };
  const Icon = ICONS[state.kind] || AlertTriangle;
  const isAuthError = state.kind === 'unauthorized';

  function goBack() {
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-5 py-10 text-ink">
      <section className="w-full max-w-xl rounded-[28px] border border-ink/10 bg-white p-7 shadow-[0_20px_60px_rgba(79,70,165,0.1)] sm:p-10" role="alert" aria-live="assertive">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-amber-light/60 text-amber">
            <Icon size={26} aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber">Attendance Register</p>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-[-0.03em]">{state.title}</h1>
            <p className="mt-3 text-sm leading-6 text-slate">{state.message}</p>
          </div>
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          {onRetry && (
            <button type="button" onClick={onRetry} className="inline-flex items-center gap-2 rounded-xl bg-indigo px-4 py-2.5 text-sm font-semibold text-paper transition hover:bg-indigo/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber">
              <RefreshCw size={15} aria-hidden="true" /> Try again
            </button>
          )}
          {!onRetry && <button type="button" onClick={() => window.location.reload()} className="inline-flex items-center gap-2 rounded-xl bg-indigo px-4 py-2.5 text-sm font-semibold text-paper transition hover:bg-indigo/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"><RefreshCw size={15} aria-hidden="true" /> Reload page</button>}
          <Link to={isAuthError ? '/login' : '/'} className="inline-flex items-center gap-2 rounded-xl border border-ink/15 bg-white px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber">
            {isAuthError ? <LogIn size={15} aria-hidden="true" /> : <Home size={15} aria-hidden="true" />}
            {isAuthError ? 'Sign in' : 'Go to start'}
          </Link>
          {location.key !== 'default' && <button type="button" onClick={goBack} className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate transition hover:bg-paper hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"><ArrowLeft size={15} aria-hidden="true" /> Go back</button>}
        </div>
        {state.kind === 'network' && <p className="mt-6 text-xs leading-5 text-slate">If the problem continues, check that the API is running and that your network or LAN configuration allows access to it.</p>}
        {state.kind === 'forbidden' && <p className="mt-6 text-xs leading-5 text-slate">If you believe this is incorrect, contact an administrator. Do not try to change identifiers in the URL.</p>}
      </section>
    </main>
  );
}
