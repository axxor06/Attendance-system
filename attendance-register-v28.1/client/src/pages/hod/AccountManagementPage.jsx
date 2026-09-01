import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Smartphone,
  UsersRound,
} from 'lucide-react';
import { userApi } from '../../api/users.js';
import { classApi, departmentApi, semesterApi } from '../../api/academics.js';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Modal from '../../components/common/Modal.jsx';
import Input from '../../components/common/Input.jsx';
import Select from '../../components/common/Select.jsx';
import Badge from '../../components/common/Badge.jsx';
import ConfirmDialog from '../../components/common/ConfirmDialog.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { SkeletonTable } from '../../components/common/Skeleton.jsx';
import PasswordField from '../../components/common/PasswordField.jsx';
import PhotoUpload from '../../components/common/PhotoUpload.jsx';
import PortalPopover from '../../components/common/PortalPopover.jsx';
import { uploadApi } from '../../api/uploads.js';
import { calculateAge } from '../../utils/dateOfBirth.js';
import { getFriendlyError } from '../../utils/errorMessages.js';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';
import { ROLE_LABELS } from '../../components/layout/navigation.js';
import { isStrongPassword, PASSWORD_POLICY_MESSAGE } from '../../utils/passwordPolicy.js';

const EMPTY_FORM = {
  name: '', email: '', phone: '', role: '', registerNumber: '', employeeId: '', department: '', classId: '', dateOfBirth: '', avatarUrl: '', password: '', confirmPassword: '',
};

const ROLE_COPY = {
  user: {
    title: 'Students',
    singular: 'student',
    description: 'Manage enrolled learners, class placement, access status, and device recovery.',
    searchPlaceholder: 'Search students by name, email, or register number',
    idLabel: 'Register number',
    placementLabel: 'Class',
  },
  admin: {
    title: 'Faculty',
    singular: 'faculty member',
    description: 'Manage teaching staff profiles and their academic department assignments.',
    searchPlaceholder: 'Search faculty by name, email, or employee ID',
    idLabel: 'Employee ID',
    placementLabel: 'Department',
  },
};

function buildForm(role, user = null) {
  return {
    ...EMPTY_FORM,
    role,
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    registerNumber: user?.registerNumber || '',
    employeeId: user?.employeeId || '',
    department: user?.department?._id || '',
    classId: user?.class?._id || '',
    dateOfBirth: user?.dateOfBirth || '',
    avatarUrl: user?.avatarUrl || '',
  };
}

export default function AccountManagementPage({ managedRole, tutorsOnly = false }) {
  const copy = tutorsOnly
    ? { ...ROLE_COPY.admin, title: 'Tutors', singular: 'tutor', description: 'Review Faculty assigned as class tutors and the classes they guide.', searchPlaceholder: 'Search tutors by name, email, or employee ID' }
    : ROLE_COPY[managedRole] || ROLE_COPY.user;
  const [users, setUsers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [summary, setSummary] = useState({ total: 0, active: 0, inactive: 0 });
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [semesterFilter, setSemesterFilter] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 25 });
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [optionsError, setOptionsError] = useState('');
  const requestSequence = useRef(0);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(buildForm(managedRole));
  const [createError, setCreateError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState(buildForm(managedRole));
  const [editError, setEditError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [profileTarget, setProfileTarget] = useState(null);
  const [profileSummary, setProfileSummary] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [resetTarget, setResetTarget] = useState(null);
  const [resetResult, setResetResult] = useState(null);
  const [showResetCredential, setShowResetCredential] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [deviceResetTarget, setDeviceResetTarget] = useState(null);
  const [isDeviceResetting, setIsDeviceResetting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [openActionId, setOpenActionId] = useState('');

  const updateCreate = (key, value) => setCreateForm((current) => ({ ...current, [key]: value }));
  const updateEdit = (key, value) => setEditForm((current) => ({ ...current, [key]: value }));

  const loadUsers = useCallback(async ({ signal } = {}) => {
    const requestId = ++requestSequence.current;
    setIsLoading(true);
    setLoadError('');
    try {
      const { data } = await userApi.list({
        role: managedRole,
        department: departmentFilter || undefined,
        semester: managedRole === 'user' ? semesterFilter || undefined : undefined,
        tutorsOnly: tutorsOnly || undefined,
        sortBy,
        sortOrder,
        search: debouncedSearch || undefined,
        page,
        limit: 25,
      }, { signal });
      if (signal?.aborted || requestId !== requestSequence.current) return;
      const payload = data?.data || {};
      if (!Array.isArray(payload.users)) throw new Error('The accounts response did not contain a valid list.');
      setUsers(payload.users);
      setPagination(payload.pagination || { page, pages: 1, total: payload.users.length, limit: 25 });
      setSummary(payload.summary || { total: payload.pagination?.total || payload.users.length, active: 0, inactive: 0 });
    } catch (err) {
      if (signal?.aborted || requestId !== requestSequence.current || err.code === 'ERR_CANCELED' || err.name === 'CanceledError') return;
      setUsers([]);
      setSummary({ total: 0, active: 0, inactive: 0 });
      setPagination({ page, pages: 1, total: 0, limit: 25 });
      setLoadError(getFriendlyError(err, `Unable to load ${copy.title.toLowerCase()}.`));
    } finally {
      if (!signal?.aborted && requestId === requestSequence.current) setIsLoading(false);
    }
  }, [copy.title, debouncedSearch, departmentFilter, managedRole, page, semesterFilter, sortBy, sortOrder, tutorsOnly]);

  const loadOptions = useCallback(async () => {
    setOptionsError('');
    const tasks = [['departments', departmentApi.list()]];
    if (managedRole === 'user' && !tutorsOnly) {
      tasks.push(['classes', classApi.list()], ['semesters', semesterApi.list()]);
    }
    const results = await Promise.allSettled(tasks.map(([, request]) => request));
    const failures = [];
    tasks.forEach(([label], index) => {
      const result = results[index];
      if (result.status === 'fulfilled') {
        const values = result.value.data?.data || {};
        if (label === 'departments') setDepartments(values.departments || []);
        if (label === 'classes') setClasses(values.classes || []);
        if (label === 'semesters') setSemesters(values.semesters || []);
      } else {
        if (label === 'departments') setDepartments([]);
        if (label === 'classes') setClasses([]);
        if (label === 'semesters') setSemesters([]);
        failures.push(label);
      }
    });
    if (failures.length) setOptionsError(`Some placement options could not be loaded: ${failures.join(' and ')}.`);
  }, [managedRole, tutorsOnly]);

  useEffect(() => {
    const controller = new AbortController();
    loadUsers({ signal: controller.signal });
    return () => controller.abort();
  }, [loadUsers]);
  useEffect(() => { loadOptions(); }, [loadOptions]);
  useEffect(() => { setPage(1); }, [debouncedSearch, departmentFilter, managedRole, semesterFilter, sortBy, sortOrder, tutorsOnly]);

  useEffect(() => {
    let active = true;
    if (!profileTarget) {
      setProfileSummary(null);
      setProfileError('');
      return undefined;
    }
    setProfileLoading(true);
    setProfileError('');
    userApi.getSummary(profileTarget._id)
      .then(({ data }) => { if (active) setProfileSummary(data?.data || null); })
      .catch((err) => { if (active) setProfileError(getFriendlyError(err, 'Unable to load the authorized profile summary.')); })
      .finally(() => { if (active) setProfileLoading(false); });
    return () => { active = false; };
  }, [profileTarget]);

  const visibleRange = useMemo(() => {
    if (!pagination.total || !users.length) return 'No records in this view';
    return `Showing ${(pagination.page - 1) * pagination.limit + 1}–${Math.min(pagination.page * pagination.limit, pagination.total)} of ${pagination.total}`;
  }, [pagination, users.length]);

  function openCreate() {
    setCreateForm(buildForm(managedRole));
    setCreateError('');
    setCreateOpen(true);
  }

  async function handleCreate(event) {
    event.preventDefault();
    setCreateError('');
    if (createForm.password !== createForm.confirmPassword) {
      setCreateError('Passwords do not match.');
      return;
    }
    if (createForm.password && !isStrongPassword(createForm.password)) {
      setCreateError(PASSWORD_POLICY_MESSAGE);
      return;
    }
    setIsCreating(true);
    try {
      const payload = { ...createForm, role: managedRole };
      delete payload.confirmPassword;
      if (managedRole === 'user') {
        delete payload.employeeId;
        delete payload.department;
      } else {
        delete payload.registerNumber;
        delete payload.classId;
      }
      Object.keys(payload).forEach((key) => { if (payload[key] === '') delete payload[key]; });
      await userApi.create(payload);
      toast.success(`${ROLE_LABELS[managedRole]} account created.`);
      setCreateOpen(false);
      loadUsers();
    } catch (err) {
      setCreateError(getFriendlyError(err, `Unable to create ${copy.singular}.`));
    } finally {
      setIsCreating(false);
    }
  }

  function openEdit(user) {
    setEditTarget(user);
    setEditForm(buildForm(managedRole, user));
    setEditError('');
  }

  async function handleEdit(event) {
    event.preventDefault();
    setEditError('');
    setIsEditing(true);
    try {
      const payload = {
        name: editForm.name,
        email: editForm.email,
        phone: editForm.phone,
        dateOfBirth: editForm.dateOfBirth || null,
      };
      if (editForm.avatarUrl !== (editTarget.avatarUrl || '')) payload.avatarUrl = editForm.avatarUrl || null;
      if (managedRole === 'user') {
        payload.classId = editForm.classId;
        payload.registerNumber = editForm.registerNumber;
      } else {
        payload.department = editForm.department;
        payload.employeeId = editForm.employeeId;
      }
      Object.keys(payload).forEach((key) => { if (payload[key] === '') delete payload[key]; });
      await userApi.update(editTarget._id, payload);
      toast.success('Account details updated.');
      setEditTarget(null);
      loadUsers();
    } catch (err) {
      setEditError(getFriendlyError(err, 'Unable to update this account.'));
    } finally {
      setIsEditing(false);
    }
  }

  async function handleDelete() {
    setIsDeleting(true);
    try {
      await userApi.remove(deleteTarget._id);
      toast.success('Account deactivated.');
      setDeleteTarget(null);
      loadUsers();
    } catch (err) {
      toast.error(getFriendlyError(err, 'Unable to deactivate this account.'));
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleResetPassword() {
    setIsResetting(true);
    try {
      const { data } = await userApi.resetPassword(resetTarget._id);
      const resetCredential = data?.data?.resetCredential;
      if (!resetCredential) throw new Error('The reset response did not include a permanent password.');
      setResetResult({ email: resetTarget.email, resetCredential });
      setShowResetCredential(true);
      toast.success('Permanent password generated.');
    } catch (err) {
      toast.error(getFriendlyError(err, 'Unable to reset the password.'));
    } finally {
      setIsResetting(false);
    }
  }

  async function handleResetDevice() {
    setIsDeviceResetting(true);
    try {
      await userApi.resetDevice(deviceResetTarget._id);
      toast.success('Student device binding reset.');
      setDeviceResetTarget(null);
      loadUsers();
    } catch (err) {
      toast.error(getFriendlyError(err, 'Unable to reset this device binding.'));
    } finally {
      setIsDeviceResetting(false);
    }
  }

  async function copyResetCredential() {
    if (!resetResult?.resetCredential) return;
    try {
      await navigator.clipboard.writeText(resetResult.resetCredential);
      toast.success('Permanent password copied.');
    } catch {
      toast.error('Copy was blocked. Select the password and copy it manually.');
    }
  }

  function closeReset() {
    if (isResetting) return;
    setResetTarget(null);
    setResetResult(null);
    setShowResetCredential(false);
  }

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-5 border-b border-line pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow">Institution directory</p>
          <h1 className="page-title mt-2">{copy.title}</h1>
          <p className="page-lede mt-2 max-w-2xl">{copy.description}</p>
        </div>
        {!tutorsOnly && <Button icon={Plus} onClick={openCreate}>Add {copy.singular}</Button>}
      </header>

      <section className="grid gap-3 sm:grid-cols-3" aria-label={`${copy.title} summary`}>
        <Stat label="Total records" value={summary.total} />
        <Stat label="Active" value={summary.active} tone="positive" />
        <Stat label="Inactive" value={summary.inactive} tone="muted" />
      </section>

      {optionsError && <InlineNotice message={optionsError} onRetry={loadOptions} />}

      <section className="directory-toolbar" aria-label={`${copy.title} filters`}>
        <div className="directory-search min-w-0 flex-1" aria-busy={isLoading}>
          <Search size={17} className="directory-search-icon" aria-hidden="true" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={copy.searchPlaceholder} aria-label={copy.searchPlaceholder} className="field directory-search-input" />
        </div>
        {(managedRole === 'admin' || managedRole === 'user') && <div className="w-full min-w-[210px] sm:w-[240px]">
          <Select label="Department" value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}>
            <option value="">All Departments</option>
            {departments.map((department) => <option key={department._id} value={department._id}>{department.name}{department.code ? ` · ${department.code}` : ''}</option>)}
          </Select>
        </div>}
        {managedRole === 'user' && <div className="w-full min-w-[180px] sm:w-[200px]">
          <Select label="Semester" value={semesterFilter} onChange={(event) => setSemesterFilter(event.target.value)}>
            <option value="">All semesters</option>
            {semesters.map((semester) => <option key={semester._id} value={semester._id}>{semester.label || `Semester ${semester.number}`}</option>)}
          </Select>
        </div>}
        <div className="w-full min-w-[170px] sm:w-[190px]">
          <Select label="Sort by" value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
            <option value="name">Name</option>
            <option value="department">Department</option>
            {managedRole === 'user' && <option value="semester">Semester</option>}
            <option value="class">Class</option>
          </Select>
        </div>
        <button type="button" className="min-h-10 rounded-lg border border-line bg-surface px-3 text-xs font-bold text-ink transition hover:border-indigo/40 hover:bg-indigo-light focus:outline-none focus:ring-2 focus:ring-indigo/20" onClick={() => setSortOrder((value) => value === 'asc' ? 'desc' : 'asc')} aria-label={`Sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`}>
          {sortOrder === 'asc' ? 'Ascending' : 'Descending'}
        </button>
        <div className="flex shrink-0 items-center gap-2 text-sm text-slate">{isLoading && <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo"><span className="h-2 w-2 animate-pulse rounded-full bg-indigo" />Searching</span>}<span>{visibleRange}</span></div>
      </section>

      {isLoading ? <SkeletonTable cols={5} /> : loadError ? (
        <InlineNotice message={loadError} onRetry={loadUsers} error />
      ) : users.length === 0 ? (
        <EmptyState icon={UsersRound} title={`No ${copy.title.toLowerCase()} found`} message={search || departmentFilter || semesterFilter || tutorsOnly ? 'Try a different search or filter.' : `Add the first ${copy.singular} to this institution.`} action={!search && !departmentFilter && !semesterFilter && !tutorsOnly && <Button icon={Plus} onClick={openCreate}>Add {copy.singular}</Button>} />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="directory-table min-w-[760px] w-full text-sm">
              <caption className="sr-only">{copy.title} directory</caption>
              <thead><tr><th>Name</th><th>{copy.idLabel}</th><th>{tutorsOnly ? 'Tutor classes' : copy.placementLabel}</th><th>Status</th><th className="text-right">Actions</th></tr></thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user._id}>
                    <td><p className="font-semibold text-ink">{user.name}</p><p className="mt-0.5 text-xs text-slate">{user.email}</p></td>
                    <td className="font-mono text-xs text-slate">{managedRole === 'user' ? user.registerNumber || '—' : user.employeeId || '—'}</td>
                    <td className="text-ink/75">{managedRole === 'user' ? `${user.class?.name || 'Unassigned'}${user.class?.semester?.label ? ` · ${user.class.semester.label}` : ''}` : tutorsOnly ? user.tutorClasses?.map((classDoc) => `${classDoc.name} · ID ${classDoc._id}`).join(', ') || 'No active class' : user.department?.name || 'Unassigned'}</td>
                    <td>{user.isActive ? <Badge variant="present">Active</Badge> : <Badge variant="absent">Inactive</Badge>}</td>
                    <td><div className="flex justify-end"><ActionMenu account={user} isOpen={openActionId === String(user._id)} onOpen={() => setOpenActionId(String(user._id))} onClose={() => setOpenActionId('')} onView={() => setProfileTarget(user)} onEdit={() => openEdit(user)} onReset={() => { setResetTarget(user); setResetResult(null); setShowResetCredential(false); }} onDeviceReset={() => setDeviceResetTarget(user)} onDelete={() => setDeleteTarget(user)} showDeviceReset={managedRole === 'user' && Boolean(user.deviceBoundAt)} /></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {!isLoading && !loadError && pagination.pages > 1 && <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate"><span>{visibleRange}</span><div className="flex items-center gap-2"><Button type="button" variant="outline" size="sm" icon={ChevronLeft} disabled={pagination.page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</Button><span className="px-2 text-xs font-semibold text-ink">Page {pagination.page} of {pagination.pages}</span><Button type="button" variant="outline" size="sm" icon={ChevronRight} disabled={pagination.page >= pagination.pages} onClick={() => setPage((value) => Math.min(pagination.pages, value + 1))}>Next</Button></div></div>}

      <AccountFormModal mode="create" isOpen={createOpen} onClose={() => setCreateOpen(false)} role={managedRole} form={createForm} update={updateCreate} classes={classes} departments={departments} error={createError} isSaving={isCreating} onSubmit={handleCreate} />
      <AccountFormModal mode="edit" isOpen={Boolean(editTarget)} onClose={() => setEditTarget(null)} role={managedRole} form={editForm} update={updateEdit} classes={classes} departments={departments} error={editError} isSaving={isEditing} onSubmit={handleEdit} />

      <Modal isOpen={Boolean(profileTarget)} onClose={() => setProfileTarget(null)} title={`${ROLE_LABELS[managedRole]} profile`}>
        {profileLoading && <div className="py-12 text-center text-sm text-slate">Loading authorized profile details…</div>}
        {profileError && <InlineNotice message={profileError} onRetry={() => setProfileTarget({ ...profileTarget })} error />}
        {!profileLoading && !profileError && profileTarget && <AccountDetail user={profileSummary?.user || profileTarget} summary={profileSummary} role={managedRole} />}
      </Modal>

      <Modal isOpen={Boolean(resetTarget)} onClose={closeReset} title="Reset password">
        {resetResult ? <div className="space-y-4"><div className="notice-success"><CheckCircle2 size={19} /><div><p className="font-semibold text-ink">Permanent password generated</p><p className="mt-1 text-sm text-slate">This credential is shown once for {resetResult.email}. Existing sessions were revoked.</p></div></div><div className="border border-line bg-paper p-4"><p className="eyebrow">One-time display credential</p><div className="mt-2 flex items-center gap-2 border border-line bg-surface px-3 py-2"><code className="min-w-0 flex-1 break-all font-mono text-sm text-ink">{showResetCredential ? resetResult.resetCredential : '••••••••••••••••'}</code><button type="button" className="icon-button" onClick={() => setShowResetCredential((value) => !value)} aria-label={showResetCredential ? 'Hide permanent password' : 'Show permanent password'}>{showResetCredential ? <EyeOff size={16} /> : <Eye size={16} />}</button><button type="button" className="icon-button" onClick={copyResetCredential} aria-label="Copy permanent password"><Copy size={16} /></button></div></div><p className="notice-caution"><strong>Shown once.</strong> It is not stored in plaintext and cannot be viewed after this window closes.</p><Button className="w-full" onClick={closeReset}>Done</Button></div> : <div className="space-y-5"><p className="text-sm leading-6 text-slate">Generate a permanent password for <strong className="text-ink">{resetTarget?.name}</strong>? All active sessions will be revoked.</p><div className="flex justify-end gap-2"><Button variant="ghost" onClick={closeReset} disabled={isResetting}>Cancel</Button><Button variant="amber" onClick={handleResetPassword} isLoading={isResetting}>Generate permanent password</Button></div></div>}
      </Modal>

      <ConfirmDialog isOpen={Boolean(deviceResetTarget)} onClose={() => setDeviceResetTarget(null)} onConfirm={handleResetDevice} title="Reset student device" message={`Reset the device binding for ${deviceResetTarget?.name}? Current sessions will be revoked.`} confirmLabel="Reset device" isLoading={isDeviceResetting} />
      <ConfirmDialog isOpen={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title="Deactivate account" message={`Deactivate ${deleteTarget?.name}'s account? Attendance history is retained.`} confirmLabel="Deactivate" isLoading={isDeleting} />
    </div>
  );
}

function Stat({ label, value, tone = 'default' }) {
  return <div className="metric-strip"><span className="eyebrow">{label}</span><strong className={`mt-2 block text-2xl font-semibold ${tone === 'positive' ? 'text-sage' : tone === 'muted' ? 'text-slate' : 'text-ink'}`}>{value}</strong></div>;
}

function InlineNotice({ message, onRetry, error = false }) {
  return <div className={error ? 'notice-error' : 'notice-caution'} role="alert"><p className="text-sm">{message}</p>{onRetry && <Button type="button" variant="outline" size="sm" className="mt-3" onClick={onRetry}>Try again</Button>}</div>;
}

function AccountFormModal({ mode, isOpen, onClose, role, form, update, classes, departments, error, isSaving, onSubmit }) {
  const isStudent = role === 'user';
  return <Modal isOpen={isOpen} onClose={onClose} title={`${mode === 'create' ? 'Add' : 'Edit'} ${ROLE_LABELS[role]}`}><form onSubmit={onSubmit} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><Input label="Full name" required value={form.name} onChange={(event) => update('name', event.target.value)} /><Input label="Email address" type="email" required value={form.email} onChange={(event) => update('email', event.target.value)} /><Input label="Phone" value={form.phone} onChange={(event) => update('phone', event.target.value)} /><div><Input label="Date of birth" type="date" max={new Date().toISOString().slice(0, 10)} value={form.dateOfBirth} onChange={(event) => update('dateOfBirth', event.target.value)} />{form.dateOfBirth && <p className="mt-1 text-xs text-sage">Age: {calculateAge(form.dateOfBirth) ?? '—'}</p>}</div></div>{isStudent ? <div className="grid gap-4 sm:grid-cols-2"><Input label="Register number" value={form.registerNumber} onChange={(event) => update('registerNumber', event.target.value)} /><Select label="Class" required value={form.classId} onChange={(event) => update('classId', event.target.value)}><option value="">Select class</option>{classes.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</Select></div> : <div className="grid gap-4 sm:grid-cols-2"><Input label="Employee ID" value={form.employeeId} onChange={(event) => update('employeeId', event.target.value)} /><Select label="Department" required value={form.department} onChange={(event) => update('department', event.target.value)}><option value="">Select department</option>{departments.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</Select></div>}{mode === 'create' && <><PhotoUpload label="Profile photo (optional)" onUpload={async (file) => { const { data } = await uploadApi.registrationPhoto(file); const url = data?.data?.image?.url; update('avatarUrl', url || ''); return data?.data; }} onRemove={() => update('avatarUrl', '')} /><PasswordField label="Initial password (optional)" value={form.password} onChange={(event) => update('password', event.target.value)} confirmValue={form.confirmPassword} onConfirmChange={(event) => update('confirmPassword', event.target.value)} hint="If omitted, a secure setup code is emailed. The first sign-in must change it." /></>}{mode === 'edit' && <PhotoUpload label="Profile photo" initialUrl={form.avatarUrl} onUpload={async (file) => { const { data } = await uploadApi.profilePhoto(file); const url = data?.data?.image?.url; update('avatarUrl', url || ''); return data?.data; }} onRemove={() => update('avatarUrl', '')} />}{error && <p className="notice-error text-sm" role="alert">{error}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" isLoading={isSaving}>{mode === 'create' ? 'Create account' : 'Save changes'}</Button></div></form></Modal>;
}

function AccountDetail({ user, summary, role }) {
  const isStudent = role === 'user';
  return <div className="space-y-5"><div className="flex items-center gap-4 border-b border-line pb-5"><Avatar user={user} /><div className="min-w-0"><h2 className="text-xl font-semibold text-ink">{user.name}</h2><p className="truncate text-sm text-slate">{user.email}</p><Badge variant={user.isActive ? 'present' : 'absent'}>{user.isActive ? 'Active account' : 'Inactive account'}</Badge></div></div><dl className="grid gap-3 sm:grid-cols-2"><Detail label="Phone" value={user.phone || 'Not provided'} /><Detail label="Date of birth" value={user.dateOfBirth || 'Not provided'} /><Detail label={isStudent ? 'Register number' : 'Employee ID'} value={isStudent ? user.registerNumber || 'Not provided' : user.employeeId || 'Not provided'} /><Detail label="Department" value={user.department?.name || 'Not assigned'} /><Detail label="Class" value={user.class?.name || 'Not assigned'} /><Detail label="Last login" value={user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'Not available'} />{!isStudent && <><Detail label="Designation" value={user.designation || 'Not provided'} /><Detail label="Qualification" value={user.qualification || 'Not provided'} /></>}{isStudent && <Detail label="Device" value={summary?.deviceStatus?.bound ? 'Bound to one approved device' : 'Not bound yet'} />}</dl>{isStudent && <div className="border-t border-line pt-4"><p className="eyebrow">Attendance</p><p className="mt-2 text-2xl font-semibold text-ink">{summary?.attendance?.overall?.percentage ?? 0}%</p><p className="mt-1 text-sm text-slate">{summary?.attendance?.overall?.present ?? 0} attended of {summary?.attendance?.overall?.total ?? 0} recorded sessions.</p></div>}</div>;
}

function Detail({ label, value }) { return <div className="border border-line bg-surface px-3 py-2.5"><dt className="eyebrow">{label}</dt><dd className="mt-1 text-sm font-medium text-ink">{value}</dd></div>; }
function Avatar({ user }) { const [failed, setFailed] = useState(false); const initials = user?.name?.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'U'; return <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-ink text-sm font-semibold text-paper">{user?.avatarUrl && !failed ? <img src={user.avatarUrl} alt={`${user.name} profile`} className="h-full w-full object-cover" onError={() => setFailed(true)} /> : initials}</div>; }


function ActionMenu({ account, isOpen, onOpen, onClose, onView, onEdit, onReset, onDeviceReset, onDelete, showDeviceReset }) {
  const anchorRef = useRef(null);
  const run = (action) => {
    onClose();
    action();
  };
  return <>
    <button ref={anchorRef} type="button" className="icon-button" aria-label={`Actions for ${account.name}`} aria-expanded={isOpen} onClick={() => (isOpen ? onClose() : onOpen())}><MoreHorizontal size={18} /></button>
    <PortalPopover anchorRef={anchorRef} isOpen={isOpen} onClose={onClose} width={210} role="menu" className="rounded-xl border border-line bg-cream p-1.5 shadow-xl">
      <button type="button" role="menuitem" className="flex min-h-10 w-full items-center gap-2 rounded-lg border-0 bg-transparent px-3 py-2.5 text-left text-sm text-ink transition hover:bg-paper-dim focus:outline-none focus:ring-2 focus:ring-indigo/20" onClick={() => run(onView)}><Eye size={15} />View profile</button>
      <button type="button" role="menuitem" className="flex min-h-10 w-full items-center gap-2 rounded-lg border-0 bg-transparent px-3 py-2.5 text-left text-sm text-ink transition hover:bg-paper-dim focus:outline-none focus:ring-2 focus:ring-indigo/20" onClick={() => run(onEdit)}><Pencil size={15} />Edit details</button>
      <button type="button" role="menuitem" className="flex min-h-10 w-full items-center gap-2 rounded-lg border-0 bg-transparent px-3 py-2.5 text-left text-sm text-ink transition hover:bg-paper-dim focus:outline-none focus:ring-2 focus:ring-indigo/20" onClick={() => run(onReset)}><KeyRound size={15} />Reset password</button>
      {showDeviceReset && <button type="button" role="menuitem" className="flex min-h-10 w-full items-center gap-2 rounded-lg border-0 bg-transparent px-3 py-2.5 text-left text-sm text-ink transition hover:bg-paper-dim focus:outline-none focus:ring-2 focus:ring-indigo/20" onClick={() => run(onDeviceReset)}><Smartphone size={15} />Reset device</button>}
      <button type="button" role="menuitem" className="flex min-h-10 w-full items-center gap-2 rounded-lg border-0 bg-transparent px-3 py-2.5 text-left text-sm text-clay transition hover:bg-clay-light focus:outline-none focus:ring-2 focus:ring-clay/20" onClick={() => run(onDelete)}><UsersRound size={15} />Deactivate</button>
    </PortalPopover>
  </>;
}
