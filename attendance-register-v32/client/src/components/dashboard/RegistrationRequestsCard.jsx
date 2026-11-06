import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, UserPlus } from 'lucide-react';
import clsx from 'clsx';
import { useBadges } from '../../context/BadgeContext.jsx';

/**
 * Top-of-dashboard card for pending registrations. Numbers come from the database:
 * the initial dashboard payload, then the badge poll keeps them current while the
 * page is open (and after any approve/reject, which triggers an immediate refresh).
 * The whole card is one link to the requests page.
 */
export default function RegistrationRequestsCard({ initial }) {
  const { registrations, loaded } = useBadges();
  const summary = (loaded && registrations) || initial || { pending: 0, students: 0, faculty: 0 };
  const pending = summary.pending || 0;
  const empty = pending === 0;

  return (
    <Link
      to="/hod/registrations"
      aria-label={empty ? 'Registration requests: none pending. Open requests.' : `Registration requests: ${pending} pending, ${summary.students} students and ${summary.faculty} faculty. Review requests.`}
      className={clsx(
        'group block rounded-lg border bg-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
        empty ? 'border-line hover:border-accent/40' : 'border-clay/40 border-l-4 border-l-clay hover:bg-paper',
      )}
    >
      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex min-w-0 items-start gap-4">
          <span className={clsx('flex h-11 w-11 shrink-0 items-center justify-center rounded-md', empty ? 'bg-sage-light text-sage' : 'bg-clay-light text-clay')} aria-hidden="true">
            {empty ? <CheckCircle2 size={22} /> : <UserPlus size={22} />}
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold text-ink">Registration requests</h2>
            {empty ? (
              <p className="mt-1 text-sm text-slate">No pending requests. New student and faculty registrations will appear here.</p>
            ) : (
              <>
                <p className="mt-1 flex items-baseline gap-2"><span className="font-mono text-4xl font-semibold leading-none tabular-nums text-ink">{pending}</span><span className="text-sm font-medium text-slate">pending</span></p>
                <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-light">
                  <span><span className="font-mono font-semibold tabular-nums text-ink">{summary.students}</span> {summary.students === 1 ? 'student' : 'students'}</span>
                  <span><span className="font-mono font-semibold tabular-nums text-ink">{summary.faculty}</span> faculty</span>
                </p>
              </>
            )}
          </div>
        </div>
        <span className={clsx('inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold', empty ? 'border border-line text-ink group-hover:border-accent/50' : 'bg-accent text-white')}>
          {empty ? 'View requests' : 'Review requests'}
          <ArrowRight aria-hidden="true" size={15} className="transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}
