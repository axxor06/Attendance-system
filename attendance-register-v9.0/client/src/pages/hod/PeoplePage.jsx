import { motion } from 'framer-motion';
import { fadeUp } from '../../utils/motion.js';
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Users, KeyRound, Trash2, Search, Pencil } from 'lucide-react';
import { userApi } from '../../api/users.js';
import { classApi, departmentApi } from '../../api/academics.js';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Modal from '../../components/common/Modal.jsx';
import Input from '../../components/common/Input.jsx';
import Select from '../../components/common/Select.jsx';
import Badge from '../../components/common/Badge.jsx';
import ConfirmDialog from '../../components/common/ConfirmDialog.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { SkeletonTable } from '../../components/common/Skeleton.jsx';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { ROLE_LABELS } from '../../components/layout/navigation.js';

const emptyForm = {
  name: '', email: '', role: 'student', registerNumber: '', employeeId: '', department: '', classId: '',
};

export default function PeoplePage() {
  const { user } = useAuth();
  const roleTabs = user?.role === 'super_admin'
    ? ['student', 'faculty', 'hod', 'admin']
    : user?.role === 'admin'
      ? ['student', 'faculty', 'hod']
      : ['student', 'faculty'];
  const [roleTab, setRoleTab] = useState('student');
  const [users, setUsers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [optionsError, setOptionsError] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 350);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [resetTarget, setResetTarget] = useState(null);
  const [isResetting, setIsResetting] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [editError, setEditError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [resetResult, setResetResult] = useState(null);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const { data } = await userApi.list({ role: roleTab, search: debouncedSearch || undefined, limit: 100 });
      const nextUsers = data?.data?.users;
      if (!Array.isArray(nextUsers)) {
        throw new Error('The users response did not contain a valid users list.');
      }
      setUsers(nextUsers);
    } catch (err) {
      setUsers([]);
      setLoadError(err.response?.data?.message || err.message || 'Could not load accounts.');
    } finally {
      setIsLoading(false);
    }
  }, [roleTab, debouncedSearch]);

  const loadOptions = useCallback(async () => {
    setOptionsError('');
    const [classResult, departmentResult] = await Promise.allSettled([classApi.list(), departmentApi.list()]);
    const failures = [];
    if (classResult.status === 'fulfilled') {
      setClasses(Array.isArray(classResult.value.data?.data?.classes) ? classResult.value.data.data.classes : []);
    } else failures.push('classes');
    if (departmentResult.status === 'fulfilled') {
      setDepartments(Array.isArray(departmentResult.value.data?.data?.departments) ? departmentResult.value.data?.data?.departments || [] : []);
    } else failures.push('departments');
    if (failures.length > 0) setOptionsError(`Could not load ${failures.join(' and ')} options.`);
  }, []);

  useEffect(() => { loadOptions(); }, [loadOptions]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const canEditIdentity = ['super_admin', 'admin'].includes(user?.role);

  function openCreate() {
    // Always re-derive role from the active tab when opening the modal,
    // so switching tabs and then clicking "New" never carries over the wrong role.
    setForm({ ...emptyForm, role: roleTab });
    setError('');
    setModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setIsSaving(true);
    try {
      // Build a clean payload scoped to the active role. Delete the fields
      // that belong to the other role so the backend never receives an empty
      // classId (for faculty) or empty department (for a student), which
      // would fail isMongoId() validation even with optional({ values: 'falsy' }).
      const payload = { ...form, role: roleTab };
      if (payload.role === 'student') {
        delete payload.department;
        delete payload.employeeId;
      } else {
        delete payload.classId;
        delete payload.registerNumber;
      }
      // Safety net: strip any remaining empty strings.
      Object.keys(payload).forEach((k) => {
        if (payload[k] === '') delete payload[k];
      });
      await userApi.create(payload);
      toast.success(`${ROLE_LABELS[roleTab] || roleTab} account created. Secure reset code emailed.`);
      setModalOpen(false);
      loadUsers();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create account');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    setIsDeleting(true);
    try {
      await userApi.remove(deleteTarget._id);
      toast.success('Account deleted');
      setDeleteTarget(null);
      loadUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not delete account');
    } finally {
      setIsDeleting(false);
    }
  }

  function openEdit(target) {
    setEditTarget(target);
    setEditError('');
    setEditForm({
      ...emptyForm,
      name: target.name || '',
      email: target.email || '',
      phone: target.phone || '',
      registerNumber: target.registerNumber || '',
      employeeId: target.employeeId || '',
      department: target.department?._id || '',
      classId: target.class?._id || '',
      role: target.role,
    });
  }

  async function handleEditSubmit(event) {
    event.preventDefault();
    setEditError('');
    setIsEditing(true);
    try {
      const payload = { name: editForm.name, email: editForm.email, phone: editForm.phone };
      if (editForm.role === 'student') {
        payload.classId = editForm.classId;
        if (canEditIdentity) payload.registerNumber = editForm.registerNumber;
      } else {
        payload.department = editForm.department;
        if (canEditIdentity) payload.employeeId = editForm.employeeId;
      }
      Object.keys(payload).forEach((key) => { if (payload[key] === '') delete payload[key]; });
      await userApi.update(editTarget._id, payload);
      toast.success('Account details updated');
      setEditTarget(null);
      loadUsers();
    } catch (err) {
      setEditError(err.response?.data?.message || 'Could not update account.');
    } finally {
      setIsEditing(false);
    }
  }

  async function handleResetPassword() {
    setIsResetting(true);
    try {
      await userApi.resetPassword(resetTarget._id);
      setResetResult({ email: resetTarget.email });
      toast.success('Secure reset code emailed to the user');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not reset password');
    } finally {
      setIsResetting(false);
    }
  }

  return (
    <motion.div className="flex flex-col gap-6" {...fadeUp}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">People</h1>
          <p className="mt-1 text-sm text-slate">Create and manage accounts within your access scope</p>
        </div>
        <Button icon={Plus} onClick={openCreate}>New {ROLE_LABELS[roleTab] || roleTab}</Button>
      </div>

      <div className="flex items-center gap-2 border-b border-ink/8" role="tablist" aria-label="People role filters">
        {roleTabs.map((r) => (
          <button
            type="button"
            role="tab"
            aria-selected={roleTab === r}
            key={r}
            onClick={() => setRoleTab(r)}
            className={`border-b-2 px-1 pb-3 text-sm font-medium capitalize transition-colors ${
              roleTab === r ? 'border-ink text-ink' : 'border-transparent text-slate hover:text-ink'
            }`}
          >
            {ROLE_LABELS[r] || r}
          </button>
        ))}
      </div>

      {optionsError && (
        <Card className="border-clay/20 bg-clay-light/60 px-5 py-4" role="alert">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-clay">{optionsError} Creating some account types may be unavailable.</p>
            <Button type="button" variant="outline" onClick={loadOptions}>Try again</Button>
          </div>
        </Card>
      )}

      <div className="relative max-w-xs">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${roleTab}s...`}
          aria-label={`Search ${ROLE_LABELS[roleTab] || roleTab} accounts`}
          className="w-full rounded-xl border border-ink/15 bg-white py-2 pl-9 pr-3 text-sm focus:border-ink/40 focus:outline-none"
        />
      </div>

      {isLoading ? (
        <SkeletonTable cols={4} />
      ) : loadError ? (
        <Card className="border-clay/20 bg-clay-light/60 p-6" role="alert">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-white/70 p-2 text-clay"><Users size={18} /></div>
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold text-clay">Could not load accounts</h2>
              <p className="mt-1 text-sm text-clay/80">{loadError}</p>
              <Button type="button" variant="outline" className="mt-4" onClick={loadUsers}>Try again</Button>
            </div>
          </div>
        </Card>
      ) : users.length === 0 ? (
        <EmptyState
          icon={Users}
          title={`No ${ROLE_LABELS[roleTab] || roleTab} accounts yet`}
          message={`Create your first ${ROLE_LABELS[roleTab] || roleTab} account.`}
          action={<Button icon={Plus} onClick={openCreate}>New {ROLE_LABELS[roleTab] || roleTab}</Button>}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
          <table className="min-w-[760px] w-full text-sm">
            <caption className="sr-only">{ROLE_LABELS[roleTab] || roleTab} accounts</caption>
            <thead>
              <tr className="border-b border-ink/8 bg-ink/3 text-left text-xs font-semibold uppercase tracking-wide text-slate">
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">{roleTab === 'student' ? 'Register No.' : 'Employee ID'}</th>
                <th className="px-5 py-3">{roleTab === 'student' ? 'Class' : 'Department'}</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/5">
              {users.map((u) => (
                <tr key={u._id}>
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-ink">{u.name}</p>
                    <p className="text-xs text-slate">{u.email}</p>
                  </td>
                  <td className="px-5 py-3.5 font-mono text-xs text-slate">
                    {roleTab === 'student' ? u.registerNumber : u.employeeId}
                  </td>
                  <td className="px-5 py-3.5 text-ink/80">
                    {roleTab === 'student' ? u.class?.name : u.department?.name}
                  </td>
                  <td className="px-5 py-3.5">
                    {u.isActive ? <Badge variant="present">Active</Badge> : <Badge variant="absent">Inactive</Badge>}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex justify-end gap-1">
                        <button
                        type="button"
                        onClick={() => openEdit(u)}
                        className="rounded-lg p-2 text-ink/50 hover:bg-indigo-light hover:text-indigo"
                        title="Edit account"
                        aria-label={`Edit ${u.name}`}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => { setResetTarget(u); setResetResult(null); }}
                        className="rounded-lg p-2 text-ink/50 hover:bg-amber-light/40 hover:text-amber"
                        title="Reset password"
                      >
                        <KeyRound size={15} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(u)}
                        className="rounded-lg p-2 text-ink/50 hover:bg-clay-light hover:text-clay"
                        title="Delete"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </Card>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={`New ${form.role}`}>
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
          {form.role === 'student' ? (
            <>
              <Input
                label="Register number"
                value={form.registerNumber}
                onChange={(e) => setForm({ ...form, registerNumber: e.target.value })}
              />
              <Select
                label="Class"
                required
                value={form.classId}
                onChange={(e) => setForm({ ...form, classId: e.target.value })}
                error={classes.length === 0 ? 'No classes exist yet — create a class first' : undefined}
              >
                <option value="">Select class</option>
                {classes.map((c) => (
                  // value is always c._id (a real MongoDB ObjectId string),
                  // never the display name — this is what gets sent to the backend
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </Select>
            </>
          ) : (
            <>
              <Input
                label="Employee ID"
                value={form.employeeId}
                onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
              />
              <Select
                label="Department (optional)"
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
              >
                <option value="">None</option>
                {departments.map((d) => (
                  <option key={d._id} value={d._id}>{d.name}</option>
                ))}
              </Select>
            </>
          )}
          <p className="text-xs text-slate">
            A secure, expiring reset code will be emailed automatically. The user will choose a password from the reset screen.
          </p>
          {error && <p className="rounded-xl bg-clay-light px-3.5 py-2.5 text-sm text-clay">{error}</p>}
          <div className="mt-2 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={isSaving}>Create account</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!editTarget} onClose={() => setEditTarget(null)} title="Edit account">
        <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
          <Input label="Full name" required value={editForm.name} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} />
          <Input label="Email address" type="email" required value={editForm.email} onChange={(event) => setEditForm({ ...editForm, email: event.target.value })} />
          <Input label="Phone" value={editForm.phone} onChange={(event) => setEditForm({ ...editForm, phone: event.target.value })} />
          {editForm.role === 'student' ? (
            <>
              {canEditIdentity && <Input label="Register number" value={editForm.registerNumber} onChange={(event) => setEditForm({ ...editForm, registerNumber: event.target.value })} />}
              <Select label="Class" required value={editForm.classId} onChange={(event) => setEditForm({ ...editForm, classId: event.target.value })}>
                <option value="">Select class</option>
                {classes.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
              </Select>
            </>
          ) : (
            <>
              {canEditIdentity && <Input label="Employee ID" value={editForm.employeeId} onChange={(event) => setEditForm({ ...editForm, employeeId: event.target.value })} />}
              <Select label="Department" value={editForm.department} onChange={(event) => setEditForm({ ...editForm, department: event.target.value })}>
                <option value="">None</option>
                {departments.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
              </Select>
            </>
          )}
          <p className="text-xs text-slate">Role, password, and authorization boundaries remain protected. Administrators can update identity IDs; HOD edits remain department-scoped.</p>
          {editError && <p className="rounded-xl bg-clay-light px-3.5 py-2.5 text-sm text-clay" role="alert">{editError}</p>}
          <div className="mt-2 flex justify-end gap-3"><Button type="button" variant="ghost" onClick={() => setEditTarget(null)}>Cancel</Button><Button type="submit" isLoading={isEditing}>Save changes</Button></div>
        </form>
      </Modal>

      <Modal isOpen={!!resetTarget} onClose={() => setResetTarget(null)} title="Reset password">
        {resetResult ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm leading-6 text-slate">
              A secure, expiring password-reset code was sent to <span className="font-medium text-ink">{resetResult.email}</span>. The user can enter it from the Forgot Password screen to choose a new password.
            </p>
            <div className="border border-sage/20 bg-sage-light px-4 py-3 text-sm text-sage">
              No password is displayed or returned by the administrator reset flow.
            </div>
            <Button onClick={() => setResetTarget(null)} className="mt-1">Done</Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-slate">
              Send a secure password-reset code to <span className="font-medium text-ink">{resetTarget?.name}</span>? Their existing sessions will be revoked and they will choose a new password after entering the code.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setResetTarget(null)}>Cancel</Button>
              <Button variant="amber" onClick={handleResetPassword} isLoading={isResetting}>Reset password</Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete account"
        message={`Delete ${deleteTarget?.name}'s account? This cannot be undone.`}
        confirmLabel="Delete"
        isLoading={isDeleting}
      />
    </motion.div>
  );
}
