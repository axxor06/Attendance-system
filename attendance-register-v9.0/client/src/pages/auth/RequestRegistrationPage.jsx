import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import AuthLayout from '../../components/layout/AuthLayout.jsx';
import Input from '../../components/common/Input.jsx';
import Select from '../../components/common/Select.jsx';
import Button from '../../components/common/Button.jsx';
import { registrationRequestApi } from '../../api/registration.js';
import { classApi } from '../../api/academics.js';
import { isStrongPassword, PASSWORD_POLICY_MESSAGE, PASSWORD_POLICY_HINT } from '../../utils/passwordPolicy.js';

export default function RequestRegistrationPage() {
  const [classes, setClasses] = useState([]);
  const [isClassesLoading, setIsClassesLoading] = useState(true);
  const [classLoadError, setClassLoadError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', registerNumber: '', phone: '', classId: '', password: '' });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [privateDetails, setPrivateDetails] = useState(null);

  const loadClasses = useCallback(async () => {
    setIsClassesLoading(true);
    setClassLoadError('');
    try {
      const { data } = await classApi.publicOptions();
      setClasses(Array.isArray(data?.data?.classes) ? data.data.classes : []);
    } catch (err) {
      setClasses([]);
      setClassLoadError(err.response?.data?.message || 'Could not load available classes.');
    } finally {
      setIsClassesLoading(false);
    }
  }, []);

  useEffect(() => { loadClasses(); }, [loadClasses]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!isStrongPassword(form.password)) {
      setError(PASSWORD_POLICY_MESSAGE);
      return;
    }
    if (!form.classId) {
      setError('Select your class before submitting the request.');
      return;
    }
    setIsLoading(true);
    try {
      const { data } = await registrationRequestApi.submit(form);
      const details = data.data;
      setPrivateDetails({
        requestId: String(details.requestId),
        statusToken: details.statusToken,
      });
      setSubmitted(true);
      toast.success('Request submitted! The HOD will review it shortly.');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not submit request.');
    } finally {
      setIsLoading(false);
    }
  }

  if (submitted) {
    return (
      <AuthLayout title="Request submitted!" subtitle="Your registration is pending HOD approval">
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-amber/30 bg-amber/10 p-5 text-sm text-ink">
            <p className="font-semibold">Save your private status details</p>
            <p className="mt-1 text-slate">These details are the only way to check this request later. Do not share the status token.</p>
            <div className="mt-4 space-y-3">
              <PrivateDetail label="Request ID" value={privateDetails?.requestId} />
              <PrivateDetail label="Status token" value={privateDetails?.statusToken} sensitive />
            </div>
          </div>
          <div className="rounded-2xl bg-sage-light p-5 text-sm text-sage">
            <p className="font-semibold">What happens next?</p>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li>The HOD will review your request</li>
              <li>You'll receive an email once approved</li>
              <li>You can then log in with your email and the password you just set</li>
            </ul>
          </div>
          <p className="text-sm text-slate">
            Check status anytime:{' '}
            <Link to="/check-request-status" className="font-medium text-ink hover:underline">
              Track your request →
            </Link>
          </p>
          <Link to="/login">
            <Button variant="outline" className="w-full">Back to sign in</Button>
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Request registration" subtitle="Submit your details — the HOD will approve your account">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Full name"
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <Input
          label="Email address"
          type="email"
          required
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <Input
          label="Register number"
          placeholder="e.g. 23CSE045"
          value={form.registerNumber}
          onChange={(e) => setForm({ ...form, registerNumber: e.target.value })}
        />
        <Input
          label="Phone (optional)"
          type="tel"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
        {classLoadError ? (
          <div className="rounded-[14px] border border-clay/20 bg-clay-light/60 px-4 py-3" role="alert">
            <p className="text-sm font-semibold text-clay">Class list unavailable</p>
            <p className="mt-1 text-sm text-clay/80">{classLoadError}</p>
            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={loadClasses}>Retry class loading</Button>
          </div>
        ) : (
          <Select
            label="Class"
            required
            disabled={isClassesLoading || classes.length === 0}
            value={form.classId}
            onChange={(e) => setForm({ ...form, classId: e.target.value })}
            hint={isClassesLoading ? 'Loading available classes…' : classes.length === 0 ? 'No classes are currently open for registration.' : undefined}
          >
            <option value="">{isClassesLoading ? 'Loading classes…' : 'Select your class'}</option>
            {classes.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </Select>
        )}
        <Input
          label="Set a password"
          type="password"
          hint={PASSWORD_POLICY_HINT}
          required
          minLength={12}
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />

        {error && <p className="rounded-xl bg-clay-light px-3.5 py-2.5 text-sm text-clay">{error}</p>}

        <Button type="submit" isLoading={isLoading} disabled={isClassesLoading || classes.length === 0} className="mt-1 w-full">
          Submit for approval
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-slate">
        Already approved?{' '}
        <Link to="/login" className="font-medium text-ink hover:underline">Sign in</Link>
      </p>
    </AuthLayout>
  );
}

function PrivateDetail({ label, value, sensitive = false }) {
  async function copyValue() {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error(`Could not copy the ${label.toLowerCase()}.`);
    }
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-wide text-slate">
        <span>{label}</span>
        <button type="button" onClick={copyValue} className="font-semibold normal-case tracking-normal text-ink hover:underline">Copy</button>
      </div>
      <code className={`block break-all rounded-lg bg-white px-3 py-2 text-xs ${sensitive ? 'text-slate' : 'text-ink'}`}>{value || 'Unavailable'}</code>
    </div>
  );
}
