import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { User, Mail, Phone, Hash, Building2, Layers, Pencil, ShieldCheck, Save, LockKeyhole } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { authApi } from '../../api/auth.js';
import { departmentApi } from '../../api/academics.js';
import Card from '../../components/common/Card.jsx';
import Badge from '../../components/common/Badge.jsx';
import Button from '../../components/common/Button.jsx';
import ConfirmDialog from '../../components/common/ConfirmDialog.jsx';
import Input from '../../components/common/Input.jsx';
import Select from '../../components/common/Select.jsx';
import PhotoUpload from '../../components/common/PhotoUpload.jsx';
import OtpInput from '../../components/auth/OtpInput.jsx';
import { uploadApi } from '../../api/uploads.js';
import { calculateAge } from '../../utils/dateOfBirth.js';
import { getFriendlyError } from '../../utils/errorMessages.js';
import { fadeUp, staggerContainer, staggerItem } from '../../utils/motion.js';
import { canonicalRole, ROLE_LABELS } from '../../components/layout/navigation.js';

const ROLE_COLORS = {
  super_admin: 'absent',
  admin: 'indigo',
  hod: 'indigo',
  faculty: 'amber',
  student: 'sage',
};

const ROLE_AVATAR_CLASSES = {
  super_admin: 'bg-clay/15 text-clay',
  admin: 'bg-indigo/10 text-ink',
  hod: 'bg-indigo/15 text-indigo',
  faculty: 'bg-amber/15 text-amber',
  student: 'bg-sage/15 text-sage',
};

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isScopeChangeConfirmOpen, setIsScopeChangeConfirmOpen] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ phone: user?.phone || '', employeeId: user?.employeeId || '', dateOfBirth: user?.dateOfBirth || '', designation: user?.designation || '', qualification: user?.qualification || '', admissionYear: user?.admissionYear || '', avatarUrl: user?.avatarUrl || '', department: user?.department?._id || '' });
  const [departments, setDepartments] = useState([]);

  // Email changes go through their own verify-before-apply flow rather than
  // the general profile save, so a stolen session can't silently redirect
  // the account's recovery address. `emailStep` resumes as 'sent' if the
  // account already has an unconfirmed change pending (e.g. after reload).
  const [emailStep, setEmailStep] = useState(user?.pendingEmail ? 'sent' : 'idle');
  const [pendingEmail, setPendingEmail] = useState(user?.pendingEmail || '');
  const [newEmail, setNewEmail] = useState('');
  const [emailOtp, setEmailOtp] = useState('');
  const [isSendingEmailCode, setIsSendingEmailCode] = useState(false);
  const [isConfirmingEmailCode, setIsConfirmingEmailCode] = useState(false);
  const [isCancellingEmailChange, setIsCancellingEmailChange] = useState(false);
  const [emailChangeError, setEmailChangeError] = useState('');

  useEffect(() => {
    setEmailStep(user?.pendingEmail ? 'sent' : 'idle');
    setPendingEmail(user?.pendingEmail || '');
  }, [user?.pendingEmail]);

  const role = canonicalRole(user?.role);
  const roleColor = ROLE_COLORS[role] || 'neutral';
  const initials = user?.name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'U';
  const canEditName = ['super_admin', 'admin'].includes(role);
  const canEditPhoto = role !== 'user';
  const profileDescription = canEditName ? 'Manage your personal and account details.' : role === 'admin' ? 'Update your contact details and profile photo.' : 'Update your email and phone number.';

  useEffect(() => {
    if (role !== 'super_admin') return undefined;
    let active = true;
    departmentApi.publicOptions().then(({ data }) => {
      if (active) setDepartments(data?.data?.departments || []);
    }).catch(() => { if (active) setDepartments([]); });
    return () => { active = false; };
  }, [role]);

  function startEditing() {
    setForm({ phone: user?.phone || '', employeeId: user?.employeeId || '', dateOfBirth: user?.dateOfBirth || '', designation: user?.designation || '', qualification: user?.qualification || '', admissionYear: user?.admissionYear || '', avatarUrl: user?.avatarUrl || '', department: user?.department?._id || '', name: user?.name || '' });
    setError('');
    setNewEmail('');
    setEmailOtp('');
    setEmailChangeError('');
    setIsEditing(true);
  }

  async function handleSendEmailCode() {
    const target = (emailStep === 'sent' ? pendingEmail : newEmail).trim().toLowerCase();
    if (!target) return;
    setEmailChangeError('');
    setIsSendingEmailCode(true);
    try {
      const { data } = await authApi.requestEmailChange(target);
      setPendingEmail(data?.data?.pendingEmail || target);
      setEmailOtp('');
      setEmailStep('sent');
      toast.success('Verification code sent to the new address.');
    } catch (err) {
      setEmailChangeError(getFriendlyError(err, 'Unable to send a verification code.'));
    } finally {
      setIsSendingEmailCode(false);
    }
  }

  async function handleConfirmEmailCode() {
    setEmailChangeError('');
    setIsConfirmingEmailCode(true);
    try {
      await authApi.confirmEmailChange(emailOtp);
      await refreshUser();
      setEmailStep('idle');
      setNewEmail('');
      setEmailOtp('');
      toast.success('Email address updated.');
    } catch (err) {
      setEmailChangeError(getFriendlyError(err, 'That code is incorrect or has expired.'));
    } finally {
      setIsConfirmingEmailCode(false);
    }
  }

  async function handleCancelEmailChange() {
    setEmailChangeError('');
    setIsCancellingEmailChange(true);
    try {
      await authApi.cancelEmailChange();
      await refreshUser();
      setEmailStep('idle');
      setNewEmail('');
      setEmailOtp('');
    } catch (err) {
      setEmailChangeError(getFriendlyError(err, 'Unable to cancel the pending change.'));
    } finally {
      setIsCancellingEmailChange(false);
    }
  }

  async function persistProfile({ confirmDepartmentChange = false } = {}) {
    setError('');
    setIsSaving(true);
    try {
      const payload = { phone: form.phone.trim() };
      if (canEditName) {
        payload.name = form.name.trim();
        payload.employeeId = form.employeeId.trim();
        payload.dateOfBirth = form.dateOfBirth || null;
        payload.designation = form.designation.trim();
        payload.qualification = form.qualification.trim();
        payload.admissionYear = form.admissionYear ? Number(form.admissionYear) : null;
      }
      if (canEditPhoto && form.avatarUrl !== (user?.avatarUrl || '')) payload.avatarUrl = form.avatarUrl || null;
      if (role === 'super_admin') {
        payload.department = form.department;
        if (confirmDepartmentChange) payload.departmentChangeConfirmed = true;
      }
      await authApi.updateMe(payload);
      await refreshUser();
      setIsEditing(false);
      setIsScopeChangeConfirmOpen(false);
      toast.success('Profile details updated');
    } catch (err) {
      setError(getFriendlyError(err, 'Unable to update your profile. Please check the highlighted fields.'));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const currentDepartmentId = user?.department?._id || user?.department || '';
    if (role === 'super_admin' && form.department !== currentDepartmentId) {
      setIsScopeChangeConfirmOpen(true);
      return;
    }
    await persistProfile();
  }

  const fields = [
    { label: 'Full name', value: user?.name, icon: User, locked: !canEditName },
    { label: 'Email address', value: user?.email, icon: Mail, note: user?.pendingEmail ? `Verification pending for ${user.pendingEmail}` : undefined },
    { label: 'Phone', value: user?.phone || 'Not set', icon: Phone },
    { label: 'Date of birth', value: user?.dateOfBirth || 'Not set', icon: User },
    { label: 'Age', value: user?.age ?? calculateAge(user?.dateOfBirth) ?? 'Not available', icon: User },
    ...(role !== 'user' ? [{ label: 'Designation', value: user?.designation || 'Not provided', icon: ShieldCheck }, { label: 'Qualification', value: user?.qualification || 'Not provided', icon: ShieldCheck }] : []),
    ...(role === 'user' ? [{ label: 'Admission year', value: user?.admissionYear || 'Not provided', icon: Layers }] : []),
    ...(role === 'user' ? [{ label: 'Register number', value: user?.registerNumber || 'Not set', icon: Hash, locked: true }] : []),
    ...(role !== 'user' ? [{ label: 'Employee ID', value: user?.employeeId || 'Not set', icon: Hash, locked: !canEditName }] : []),
    ...((role === 'user' || user?.department) ? [{ label: 'Department', value: user?.department?.name || user?.department?.code || 'Not assigned', icon: Building2, locked: role !== 'super_admin' }] : []),
    ...(role === 'user' ? [{ label: 'Program', value: user?.department?.programLevel ? `${user.department.programLevel.charAt(0).toUpperCase()}${user.department.programLevel.slice(1)}` : 'Not assigned', icon: Layers, locked: true }] : []),
    ...(role === 'user' ? [{ label: 'Semester', value: user?.class?.semester?.label || (user?.class?.semester?.number ? `Semester ${user.class.semester.number}` : 'Not assigned'), icon: Layers, locked: true }] : []),
    ...(user?.department?.semesterCount ? [{ label: 'Program duration', value: `${user.department.semesterCount} semesters`, icon: Layers, locked: true }] : []),
    ...((role === 'user' || user?.class) ? [{ label: 'Class', value: user?.class?.name || user?.class?.code || 'Not assigned', icon: Layers, locked: true }] : []),
  ];

  return (
    <motion.div className="flex max-w-3xl flex-col gap-6" {...fadeUp}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber">Account</p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-[-0.04em] text-ink">My profile</h1>
          <p className="mt-2 text-sm text-slate">{profileDescription}</p>
        </div>
        {!isEditing && <Button type="button" variant="outline" icon={Pencil} onClick={startEditing}>Edit contact details</Button>}
      </div>

      <Card className="overflow-hidden bg-cream p-6 sm:p-7">
        <div className="flex flex-wrap items-center gap-5">
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 280, damping: 22 }}
            className={`flex h-20 w-20 items-center justify-center rounded-xl font-display text-2xl font-bold shadow-lg ${ROLE_AVATAR_CLASSES[role] || ROLE_AVATAR_CLASSES.student}`}
          >
            {user?.avatarUrl ? <img src={user.avatarUrl} alt="Profile" className="h-full w-full rounded-xl object-cover" /> : initials}
          </motion.div>
          <div className="min-w-0">
            <h2 className="font-display text-xl font-semibold text-ink">{user?.name}</h2>
            <p className="mt-1 truncate text-sm text-slate">{user?.email}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge variant={roleColor} className="capitalize">{ROLE_LABELS[role] || user?.role}</Badge>
              <Badge variant={user?.isActive ? 'present' : 'absent'}>{user?.isActive ? 'Active' : 'Inactive'}</Badge>
            </div>
          </div>
        </div>
      </Card>

      {isEditing ? (
        <Card id="settings" className="bg-cream p-6 sm:p-7">
          <div className="mb-5 flex items-start gap-3 border-b border-ink/8 pb-5">
            <div className="rounded-lg bg-indigo-light p-2.5 text-indigo"><ShieldCheck size={18} /></div>
            <div><h2 className="font-display text-lg font-semibold text-ink">Edit profile</h2><p className="mt-1 text-sm text-slate">Update the fields available to your role.</p></div>
          </div>
          <div className="mb-1 rounded-xl border border-ink/10 bg-white/60 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate">Email address</p>
              <p className="truncate text-sm text-ink/70">{user?.email}</p>
            </div>
            {emailStep === 'idle' ? (
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <Input label="New email address" type="email" placeholder="you@example.com" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} />
                </div>
                <Button type="button" variant="outline" isLoading={isSendingEmailCode} disabled={!newEmail.trim()} onClick={handleSendEmailCode}>Send code</Button>
              </div>
            ) : (
              <div className="mt-3 flex flex-col gap-3">
                <p className="text-sm text-slate">Enter the code sent to <span className="font-medium text-ink">{pendingEmail}</span> to confirm this change.</p>
                <div className="flex flex-wrap items-center gap-3">
                  <OtpInput value={emailOtp} onChange={setEmailOtp} />
                  <Button type="button" isLoading={isConfirmingEmailCode} disabled={emailOtp.length !== 6} onClick={handleConfirmEmailCode}>Confirm</Button>
                  <Button type="button" variant="ghost" isLoading={isCancellingEmailChange} onClick={handleCancelEmailChange}>Cancel</Button>
                </div>
                <button type="button" onClick={handleSendEmailCode} disabled={isSendingEmailCode} className="self-start text-xs font-medium text-ink/60 hover:text-ink disabled:opacity-50">
                  {isSendingEmailCode ? 'Sending...' : "Didn't get a code? Resend"}
                </button>
              </div>
            )}
            {emailChangeError && <p className="mt-2 text-sm text-clay" role="alert">{emailChangeError}</p>}
          </div>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {canEditName && <Input label="Full name" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />}
            {canEditName && <Input label="Employee ID" value={form.employeeId} onChange={(event) => setForm({ ...form, employeeId: event.target.value })} />}
            <Input label="Phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
            {canEditName && <Input label="Date of birth" type="date" max={new Date().toISOString().slice(0, 10)} value={form.dateOfBirth} onChange={(event) => setForm({ ...form, dateOfBirth: event.target.value })} />}
            {canEditName && <Input label="Designation" value={form.designation} onChange={(event) => setForm({ ...form, designation: event.target.value })} />}
            {canEditName && <Input label="Qualification" value={form.qualification} onChange={(event) => setForm({ ...form, qualification: event.target.value })} />}
            {canEditName && <Input label="Admission year" type="number" min="2000" max="2200" value={form.admissionYear} onChange={(event) => setForm({ ...form, admissionYear: event.target.value })} />}
            {role === 'super_admin' && <>
              <Select label="Department" required value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })}><option value="">Select department</option>{departments.map((department) => <option key={department._id} value={department._id}>{department.name} ({department.code})</option>)}</Select>
              {form.department !== (user?.department?._id || user?.department || '') && <p className="rounded-xl border border-amber/25 bg-amber-light/65 px-4 py-3 text-sm text-ink" role="status">Changing department updates your workspace scope immediately. Records from the previous department will no longer be available after the change.</p>}
            </>}
            {canEditPhoto && <PhotoUpload label="Profile photo" initialUrl={form.avatarUrl} onUpload={async (file) => { const { data } = await uploadApi.profilePhoto(file); const url = data?.data?.image?.url; setForm((current) => ({ ...current, avatarUrl: url || '' })); return data?.data; }} onRemove={() => setForm((current) => ({ ...current, avatarUrl: '' }))} />}
            {error && <p className="rounded-xl border border-clay/20 bg-clay-light/70 px-4 py-3 text-sm text-clay" role="alert">{error}</p>}
            <div className="flex flex-wrap justify-end gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsEditing(false)}>Cancel</Button>
              <Button type="submit" icon={Save} isLoading={isSaving}>Save changes</Button>
            </div>
          </form>
        </Card>
      ) : (
        <Card id="settings" className="overflow-hidden bg-cream">
          <div className="flex items-center justify-between border-b border-ink/8 px-6 py-4">
            <div><h3 className="font-display text-base font-semibold text-ink">Account details</h3><p className="mt-1 text-xs text-slate">{canEditName ? 'Review and manage your account details.' : 'Academic identifiers are managed by authorized academic staff.'}</p></div>
            <LockKeyhole size={17} className="text-slate/60" aria-hidden="true" />
          </div>
          <motion.div className="divide-y divide-ink/5" variants={staggerContainer} initial="initial" animate="animate">
            {fields.map(({ label, value, icon: Icon, locked, note }) => (
              <motion.div key={label} variants={staggerItem} className="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-white/45">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo/5 text-ink/50"><Icon size={16} /></div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate">{label}</p>
                  <p className="truncate text-sm font-medium text-ink">{value}</p>
                  {note && <p className="truncate text-xs font-medium text-amber">{note}</p>}
                </div>
                {locked && <span className="ml-auto text-[10px] font-bold uppercase tracking-[0.14em] text-slate/55">Protected</span>}
              </motion.div>
            ))}
          </motion.div>
        </Card>
      )}
      <ConfirmDialog
        isOpen={isScopeChangeConfirmOpen}
        onClose={() => setIsScopeChangeConfirmOpen(false)}
        onConfirm={() => persistProfile({ confirmDepartmentChange: true })}
        title="Change workspace department?"
        message="Your department change takes effect immediately. The previous department’s records will leave your workspace, and this profile will be refreshed before you continue."
        confirmLabel="Change department"
        isLoading={isSaving}
        variant="primary"
      />
    </motion.div>
  );
}
