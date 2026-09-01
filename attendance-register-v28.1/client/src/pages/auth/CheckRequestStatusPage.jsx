import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { CheckCircle2, Clock3, Copy, ExternalLink, XCircle } from 'lucide-react';
import AuthLayout from '../../components/layout/AuthLayout.jsx';
import Input from '../../components/common/Input.jsx';
import Button from '../../components/common/Button.jsx';
import { registrationRequestApi } from '../../api/registration.js';
import { getFriendlyError } from '../../utils/errorMessages.js';

const STATUS_CODE_PATTERN = /^AR-[A-Z0-9]{4}-[A-Z0-9]{6}$/;

const STATUS_COPY = {
  pending: {
    title: 'Application under review',
    tone: 'border-amber/30 bg-amber-light/70 text-ink',
    icon: Clock3,
    description: 'Your registration request is waiting for approval.',
  },
  approved: {
    title: 'Registration approved',
    tone: 'border-sage/30 bg-sage-light text-sage',
    icon: CheckCircle2,
    description: 'Your account has been approved. You can sign in with the password you selected.',
  },
  rejected: {
    title: 'Registration not approved',
    tone: 'border-clay/25 bg-clay-light text-clay',
    icon: XCircle,
    description: 'Your registration request was not approved.',
  },
};

function parseStatusCredential(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;

  try {
    const url = new URL(raw, window.location.origin);
    const code = String(url.searchParams.get('code') || '').trim().toUpperCase();
    if (code) return STATUS_CODE_PATTERN.test(code) ? { code } : null;
    const requestId = url.searchParams.get('requestId');
    const statusToken = url.searchParams.get('statusToken');
    if (requestId && statusToken) return { requestId, statusToken };
  } catch {
    // Treat a plain reference as the input, not as a browser error.
  }

  const code = raw.toUpperCase();
  return STATUS_CODE_PATTERN.test(code) ? { code } : null;
}

function copyValue(value, label) {
  if (!value) return;
  if (!navigator.clipboard?.writeText) {
    toast.error(`Copy is unavailable. Select the ${label.toLowerCase()} manually.`);
    return;
  }
  navigator.clipboard.writeText(value)
    .then(() => toast.success(`${label} copied`))
    .catch(() => toast.error(`Could not copy the ${label.toLowerCase()}.`));
}

export default function CheckRequestStatusPage() {
  const location = useLocation();
  const initialValue = location.state?.statusCode
    || new URLSearchParams(window.location.search).get('code')
    || (new URLSearchParams(window.location.search).has('requestId') ? window.location.href : '');
  const [reference, setReference] = useState(initialValue);
  const [request, setRequest] = useState(null);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const requestInFlight = useRef(false);

  const handleCheck = useCallback(async ({ silent = false } = {}) => {
    const credentials = parseStatusCredential(reference);
    if (!credentials || requestInFlight.current) {
      if (!silent) setError('Enter a valid status reference like AR-7K4P-92XM, or paste your older private status link.');
      return;
    }
    requestInFlight.current = true;
    if (!silent) {
      setError('');
      setChecked(false);
      setRequest(null);
      setIsLoading(true);
    }
    try {
      const { data } = await registrationRequestApi.checkStatus(credentials);
      const nextRequest = data?.data?.request || null;
      setRequest(nextRequest);
      setChecked(true);
      if (!nextRequest && !silent) setError("We couldn't find that registration request. Check the reference and try again.");
      if (nextRequest?.status !== 'pending' && silent) toast.success(nextRequest.status === 'approved' ? 'Registration approved.' : 'Registration status updated.');
    } catch (err) {
      setError(getFriendlyError(err, 'This status reference is invalid or has expired.'));
      if (!silent) setChecked(true);
    } finally {
      requestInFlight.current = false;
      if (!silent) setIsLoading(false);
    }
  }, [reference]);

  useEffect(() => {
    if (!checked || request?.status !== 'pending' || !reference) return undefined;
    let timer;
    const schedule = () => {
      window.clearTimeout(timer);
      if (document.visibilityState !== 'visible') return;
      timer = window.setTimeout(async () => {
        await handleCheck({ silent: true });
        schedule();
      }, 15000);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') schedule();
      else window.clearTimeout(timer);
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    schedule();
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [checked, request?.status, reference, handleCheck]);

  const status = request ? STATUS_COPY[request.status] : null;
  const StatusIcon = status?.icon;

  return (
    <AuthLayout title="Check request status" subtitle="Enter the short reference you received after submitting your registration request.">
      <form onSubmit={(event) => { event.preventDefault(); handleCheck(); }} className="flex flex-col gap-4">
        <div className="relative">
          <Input label="Status reference" required placeholder="AR-7K4P-92XM" value={reference} onChange={(event) => { setReference(event.target.value.toUpperCase()); setError(''); setChecked(false); setRequest(null); }} autoCapitalize="characters" spellCheck="false" />
          {reference && <button type="button" onClick={() => copyValue(reference, 'Status reference')} className="absolute right-2 top-8 rounded-md p-2 text-slate transition-colors hover:bg-paper-dim hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber" aria-label="Copy status reference"><Copy size={15} /></button>}
        </div>
        <p className="text-xs leading-5 text-slate">Use the short code in the format <strong className="font-semibold text-ink">AR-7K4P-92XM</strong>. Older private status links are still accepted during the transition.</p>
        {error && <p className="rounded-xl border border-clay/20 bg-clay-light px-3.5 py-2.5 text-sm text-clay" role="alert">{error}</p>}
        <Button type="submit" isLoading={isLoading} className="mt-1 w-full">Check status</Button>
      </form>

      {checked && !request && !error && <div className="mt-5 rounded-xl border border-line bg-cream p-4 text-sm text-slate" role="status">We couldn't find that registration request.</div>}

      {request && status && (
        <section className={`mt-5 rounded-xl border p-5 ${status.tone}`} aria-live="polite">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] opacity-75"><StatusIcon size={16} /> Registration status</div>
          <h2 className="mt-3 text-xl font-semibold">{status.title}</h2>
          <p className="mt-2 text-sm leading-6 opacity-85">{status.description}</p>
          {request.status === 'approved' && request.assignedIdentifier && <div className="mt-4 rounded-lg border border-current/15 bg-white/35 p-3 text-sm leading-6"><strong>Your assigned identifier:</strong><div className="mt-2 flex items-center justify-between gap-3"><code className="break-all font-mono text-sm">{request.assignedIdentifier}</code><button type="button" onClick={() => copyValue(request.assignedIdentifier, 'Assigned identifier')} className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold underline">Copy</button></div></div>}
          {request.status === 'rejected' && request.rejectionReason && <div className="mt-4 rounded-lg border border-current/15 bg-white/35 p-3 text-sm leading-6"><strong>Review note:</strong> {request.rejectionReason}</div>}
          {request.status === 'pending' && <p className="mt-3 text-xs opacity-70">We check approximately every 15 seconds while this tab is visible.</p>}
          <p className="mt-3 text-xs opacity-70">Submitted {new Date(request.createdAt).toLocaleString()}{request.reviewedAt ? ` · Reviewed ${new Date(request.reviewedAt).toLocaleString()}` : ''}</p>
        </section>
      )}

      <p className="mt-5 text-center text-sm text-slate">Need to submit a request? <Link to="/request-registration" className="inline-flex items-center gap-1 font-medium text-ink hover:text-amber">Start registration <ExternalLink size={13} /></Link></p>
      <p className="mt-2 text-center text-sm text-slate"><Link to="/login" className="font-medium text-ink hover:text-amber">Back to sign in</Link></p>
    </AuthLayout>
  );
}
