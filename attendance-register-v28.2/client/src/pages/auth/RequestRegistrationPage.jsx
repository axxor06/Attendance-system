import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import AuthLayout from '../../components/layout/AuthLayout.jsx';
import Input from '../../components/common/Input.jsx';
import Select from '../../components/common/Select.jsx';
import Button from '../../components/common/Button.jsx';
import PasswordField from '../../components/common/PasswordField.jsx';
import PhotoUpload from '../../components/common/PhotoUpload.jsx';
import { registrationRequestApi } from '../../api/registration.js';
import { uploadApi } from '../../api/uploads.js';
import { classApi, departmentApi } from '../../api/academics.js';
import { calculateAge, isValidDateOnly } from '../../utils/dateOfBirth.js';
import { isStrongPassword } from '../../utils/passwordPolicy.js';
import { getFriendlyError } from '../../utils/errorMessages.js';

const ROLE_OPTIONS = [
  { value: 'student', label: 'Student', description: 'Request a student account and select your class.' },
  { value: 'faculty', label: 'Faculty', description: 'Request a faculty account for HOD review.' },
];

export default function RequestRegistrationPage() {
  const [searchParams] = useSearchParams();
  const [requestedRole, setRequestedRole] = useState(searchParams.get('role') === 'faculty' ? 'faculty' : 'student');
  const [classes, setClasses] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [isOptionsLoading, setIsOptionsLoading] = useState(true);
  const [optionsError, setOptionsError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', phone: '', dateOfBirth: '', classId: '', departmentId: '', password: '', confirmPassword: '', avatarUrl: '' });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [privateDetails, setPrivateDetails] = useState(null);

  const loadOptions = useCallback(async () => {
    setIsOptionsLoading(true);
    setOptionsError('');
    try {
      const { data } = requestedRole === 'student'
        ? await classApi.publicOptions()
        : await departmentApi.publicOptions();
      if (requestedRole === 'student') {
        setClasses(Array.isArray(data?.data?.classes) ? data.data.classes : []);
      } else {
        setDepartments(Array.isArray(data?.data?.departments) ? data.data.departments : []);
      }
    } catch (err) {
      setOptionsError(getFriendlyError(err, `Could not load available ${requestedRole === 'student' ? 'classes' : 'departments'}. Please try again.`));
    } finally {
      setIsOptionsLoading(false);
    }
  }, [requestedRole]);

  useEffect(() => { loadOptions(); }, [loadOptions]);

  function changeRole(role) {
    setRequestedRole(role);
    setError('');
    setForm((current) => ({ ...current, classId: '', departmentId: '' }));
  }

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    if (!form.dateOfBirth || !isValidDateOnly(form.dateOfBirth)) return setError('Enter a valid date of birth that is not in the future.');
    if (!isStrongPassword(form.password)) return setError('Please complete every password requirement.');
    if (form.password !== form.confirmPassword) return setError('Passwords do not match.');
    if (requestedRole === 'student' && !form.classId) return setError('Select your class before submitting the request.');
    if (requestedRole === 'faculty' && !form.departmentId) return setError('Select your department before submitting the request.');
    setIsLoading(true);
    try {
      const { data } = await registrationRequestApi.submit({ ...form, requestedRole, confirmPassword: undefined });
      const details = data.data;
      const statusCode = String(details.statusCode || '').trim().toUpperCase();
      if (!statusCode) throw new Error('The request was submitted, but no status reference was returned.');
      const statusUrl = new URL('/check-request-status', window.location.origin);
      statusUrl.searchParams.set('code', statusCode);
      setPrivateDetails({ statusCode, statusLink: statusUrl.toString() });
      setSubmitted(true);
      toast.success('Request submitted. Save your status reference.');
    } catch (err) {
      setError(getFriendlyError(err, 'Unable to submit your request. Please check the highlighted fields.'));
    } finally {
      setIsLoading(false);
    }
  }

  if (submitted) {
    const accountLabel = requestedRole === 'faculty' ? 'faculty' : 'student';
    return (
      <AuthLayout title="Request submitted" subtitle={`Your ${accountLabel} request is pending HOD approval`}>
        <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-amber/25 bg-amber-light/70 p-5 text-sm text-ink">
            <p className="font-semibold">Save your status reference</p>
            <p className="mt-1 leading-6 text-slate">Use this short code to check your request later. Keep it private because it is the credential for viewing your application status.</p>
            <div className="mt-4"><PrivateDetail label="Status reference" value={privateDetails?.statusCode} /></div>
            <Link to="/check-request-status" state={{ statusCode: privateDetails?.statusCode }} className="mt-3 inline-flex text-sm font-semibold text-ink hover:text-amber">Open status page →</Link>
          </div>
          <div className="rounded-xl bg-sage-light p-5 text-sm text-sage"><p className="font-semibold">What happens next?</p><ul className="mt-2 list-disc space-y-1 pl-5"><li>The HOD will review your request.</li><li>You may receive an email after review.</li><li>When approved, sign in with the password you selected.</li></ul></div>
          <p className="text-sm text-slate">Check status anytime: <Link to="/check-request-status" className="font-medium text-ink hover:underline">Track your request →</Link></p>
          <Link to="/login"><Button variant="outline" className="w-full">Back to sign in</Button></Link>
        </div>
      </AuthLayout>
    );
  }

  const age = calculateAge(form.dateOfBirth);
  const options = requestedRole === 'student' ? classes : departments;
  const optionLabel = requestedRole === 'student' ? 'class' : 'department';
  return (
    <AuthLayout title="Request registration" subtitle="Submit your details — the HOD will review your request">
      <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl bg-indigo/5 p-1" role="tablist" aria-label="Registration role">
        {ROLE_OPTIONS.map((option) => (
          <button key={option.value} type="button" role="tab" aria-selected={requestedRole === option.value} onClick={() => changeRole(option.value)} className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${requestedRole === option.value ? 'bg-indigo text-paper shadow-sm' : 'text-slate hover:bg-white hover:text-ink'}`}>
            {option.label}
          </button>
        ))}
      </div>
      <p className="mb-4 text-xs text-slate">{ROLE_OPTIONS.find((option) => option.value === requestedRole)?.description}</p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input label="Full name" required value={form.name} onChange={(e) => update('name', e.target.value)} />
        <Input label="Gmail address" type="email" required value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="you@gmail.com" />
        <Input label="Phone (optional)" type="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)} />
        <div>
          <Input label="Date of birth" type="date" required max={new Date().toISOString().slice(0, 10)} value={form.dateOfBirth} onChange={(e) => update('dateOfBirth', e.target.value)} />
          {age !== null && <p className="mt-1.5 text-xs font-semibold text-sage">Calculated age: {age}</p>}
        </div>
        <PhotoUpload label="Profile photo (optional)" onUpload={async (file) => { const { data } = await uploadApi.registrationPhoto(file); const url = data?.data?.image?.url; update('avatarUrl', url || ''); return data?.data; }} onRemove={() => update('avatarUrl', '')} />
        {optionsError ? <div className="rounded-[14px] border border-clay/20 bg-clay-light/60 px-4 py-3" role="alert"><p className="text-sm font-semibold text-clay">{optionLabel[0].toUpperCase() + optionLabel.slice(1)} list unavailable</p><p className="mt-1 text-sm text-clay/80">{optionsError}</p><Button type="button" variant="outline" size="sm" className="mt-3" onClick={loadOptions}>Retry loading</Button></div> : <Select label={requestedRole === 'student' ? 'Class' : 'Department'} required disabled={isOptionsLoading || options.length === 0} value={requestedRole === 'student' ? form.classId : form.departmentId} onChange={(e) => update(requestedRole === 'student' ? 'classId' : 'departmentId', e.target.value)} hint={isOptionsLoading ? `Loading available ${optionLabel} options…` : options.length === 0 ? `No ${optionLabel} options are currently available.` : undefined}><option value="">{isOptionsLoading ? `Loading ${optionLabel} options…` : `Select your ${optionLabel}`}</option>{options.map((item) => <option key={item._id} value={item._id}>{item.name}{item.code ? ` (${item.code})` : ''}</option>)}</Select>}
        <PasswordField label="Set a password" value={form.password} onChange={(e) => update('password', e.target.value)} confirmValue={form.confirmPassword} onConfirmChange={(e) => update('confirmPassword', e.target.value)} />
        {error && <p className="rounded-xl bg-clay-light px-3.5 py-2.5 text-sm text-clay" role="alert">{error}</p>}
        <Button type="submit" isLoading={isLoading} disabled={isOptionsLoading || options.length === 0} className="mt-1 w-full">Submit {requestedRole === 'faculty' ? 'faculty' : 'student'} request</Button>
      </form>
      <p className="mt-5 text-center text-sm text-slate">Already approved? <Link to="/login" className="font-medium text-ink hover:underline">Sign in</Link></p>
    </AuthLayout>
  );
}

function PrivateDetail({ label, value }) {
  async function copyValue() {
    if (!value) return;
    try { await navigator.clipboard.writeText(value); toast.success(`${label} copied`); } catch { toast.error(`Could not copy the ${label.toLowerCase()}.`); }
  }
  return <div><div className="mb-1 flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-wide text-slate"><span>{label}</span><button type="button" onClick={copyValue} className="rounded-md px-2 py-1 font-semibold normal-case tracking-normal text-ink transition-colors hover:bg-paper-dim hover:text-amber">Copy</button></div><code className="block max-h-20 overflow-auto break-all rounded-lg border border-line bg-paper px-3 py-2 text-xs text-ink">{value || 'Unavailable'}</code></div>;
}
