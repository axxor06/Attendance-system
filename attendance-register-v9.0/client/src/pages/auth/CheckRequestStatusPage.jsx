import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import AuthLayout from '../../components/layout/AuthLayout.jsx';
import Input from '../../components/common/Input.jsx';
import Button from '../../components/common/Button.jsx';
import { registrationRequestApi } from '../../api/registration.js';

const STATUS_COPY = {
  pending: {
    title: 'Pending review',
    tone: 'border-amber/30 bg-amber/10 text-ink',
    description: 'Your request is waiting for department approval.',
  },
  approved: {
    title: 'Approved',
    tone: 'border-sage/30 bg-sage-light text-sage',
    description: 'Your student account has been created. You can sign in with the password you selected.',
  },
  rejected: {
    title: 'Not approved',
    tone: 'border-clay/25 bg-clay-light text-clay',
    description: 'The department did not approve this registration request.',
  },
};

export default function CheckRequestStatusPage() {
  const [form, setForm] = useState({ requestId: '', statusToken: '' });
  const [request, setRequest] = useState(null);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setChecked(false);
    setRequest(null);
    setIsLoading(true);
    try {
      const { data } = await registrationRequestApi.checkStatus(form);
      setRequest(data.data.request);
      setChecked(true);
      if (!data.data.request) {
        toast.error('No request matched those private details.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Could not check the request status.');
    } finally {
      setIsLoading(false);
    }
  }

  const status = request ? STATUS_COPY[request.status] : null;

  return (
    <AuthLayout title="Check request status" subtitle="Use the private details you received after submitting your registration request">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Request ID"
          required
          placeholder="Paste your request ID"
          value={form.requestId}
          onChange={(event) => setForm({ ...form, requestId: event.target.value })}
        />
        <Input
          label="Status token"
          type="password"
          required
          placeholder="Paste your private status token"
          value={form.statusToken}
          onChange={(event) => setForm({ ...form, statusToken: event.target.value })}
        />
        {error && <p className="rounded-xl bg-clay-light px-3.5 py-2.5 text-sm text-clay">{error}</p>}
        <Button type="submit" isLoading={isLoading} className="mt-1 w-full">Check status</Button>
      </form>

      {checked && !request && (
        <div className="mt-5 rounded-2xl border border-ink/10 bg-white p-4 text-sm text-slate">
          The details did not match an active private status record. Check that both values were copied exactly.
        </div>
      )}

      {request && status && (
        <section className={`mt-5 rounded-2xl border p-5 ${status.tone}`} aria-live="polite">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] opacity-70">Current status</p>
          <h2 className="mt-1 text-xl font-semibold">{status.title}</h2>
          <p className="mt-2 text-sm opacity-85">{status.description}</p>
          {request.rejectionReason && (
            <p className="mt-3 border-t border-current/15 pt-3 text-sm"><span className="font-semibold">Reason:</span> {request.rejectionReason}</p>
          )}
          <p className="mt-3 text-xs opacity-70">
            Submitted {new Date(request.createdAt).toLocaleString()}
            {request.reviewedAt ? ` · Reviewed ${new Date(request.reviewedAt).toLocaleString()}` : ''}
          </p>
        </section>
      )}

      <p className="mt-5 text-center text-sm text-slate">
        Need to submit a request?{' '}
        <Link to="/request-registration" className="font-medium text-ink hover:underline">Start registration</Link>
      </p>
      <p className="mt-2 text-center text-sm text-slate">
        <Link to="/login" className="font-medium text-ink hover:underline">Back to sign in</Link>
      </p>
    </AuthLayout>
  );
}
