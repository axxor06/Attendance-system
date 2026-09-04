import { getFriendlyError } from '../../utils/errorMessages.js';
import { motion } from 'framer-motion';
import { fadeUp } from '../../utils/motion.js';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Building2, Pencil, Trash2 } from 'lucide-react';
import { departmentApi } from '../../api/academics.js';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Modal from '../../components/common/Modal.jsx';
import Input from '../../components/common/Input.jsx';
import ConfirmDialog from '../../components/common/ConfirmDialog.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { SkeletonTable } from '../../components/common/Skeleton.jsx';

const emptyForm = { name: '', code: '', description: '' };

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function loadDepartments() {
    setIsLoading(true);
    setLoadError('');
    try {
      const { data } = await departmentApi.list({ includeInactive: true });
      setDepartments(data?.data?.departments || []);
    } catch (err) {
      setLoadError(getFriendlyError(err, 'Departments could not be loaded.'));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { loadDepartments(); }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setModalOpen(true);
  }

  function openEdit(dept) {
    setEditing(dept);
    setForm({ name: dept.name, code: dept.code, description: dept.description || '' });
    setError('');
    setModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setIsSaving(true);
    try {
      if (editing) {
        await departmentApi.update(editing._id, form);
        toast.success('Department updated');
      } else {
        await departmentApi.create(form);
        toast.success('Department created');
      }
      setModalOpen(false);
      loadDepartments();
    } catch (err) {
      setError(getFriendlyError(err, 'The department could not be saved.'));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    setIsDeleting(true);
    try {
      await departmentApi.remove(deleteTarget._id);
      toast.success('Department deleted');
      setDeleteTarget(null);
      loadDepartments();
    } catch (err) {
      toast.error(getFriendlyError(err, 'Could not delete department'));
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <motion.div className="flex flex-col gap-6" {...fadeUp}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Departments</h1>
          <p className="mt-1 text-sm text-slate">Manage academic departments</p>
        </div>
        <Button icon={Plus} onClick={openCreate}>New department</Button>
      </div>

      {loadError && <Card className="border-clay/20 bg-clay-light/60 p-5" role="alert"><p className="text-sm text-clay">{loadError}</p><Button type="button" variant="outline" size="sm" className="mt-3" onClick={loadDepartments}>Try again</Button></Card>}

      {isLoading ? (
        <SkeletonTable cols={4} />
      ) : departments.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No departments yet"
          message="Create your first department to start organizing classes and subjects."
          action={<Button icon={Plus} onClick={openCreate}>New department</Button>}
        />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink/8 bg-indigo/3 text-left text-xs font-semibold uppercase tracking-wide text-slate">
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Code</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/5">
              {departments.map((d) => (
                <tr key={d._id}>
                  <td className="px-5 py-3.5 font-medium text-ink">{d.name}</td>
                  <td className="px-5 py-3.5 font-mono text-xs text-slate">{d.code}</td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs ${d.isActive ? 'text-sage' : 'text-slate'}`}>
                      {d.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex justify-end gap-1">
                      <button type="button" aria-label={`Edit ${d.name}`} title={`Edit ${d.name}`} onClick={() => openEdit(d)} className="rounded-lg p-2 text-ink/50 hover:bg-indigo/5 hover:text-ink">
                        <Pencil size={15} />
                      </button>
                      <button type="button" aria-label={`Delete ${d.name}`} title={`Delete ${d.name}`} onClick={() => setDeleteTarget(d)} className="rounded-lg p-2 text-ink/50 hover:bg-clay-light hover:text-clay">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit department' : 'New department'}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Department name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Input
            label="Code"
            required
            placeholder="e.g. CSE"
            maxLength={10}
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
          />
          <Input
            label="Description (optional)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          {error && <p className="rounded-xl bg-clay-light px-3.5 py-2.5 text-sm text-clay">{error}</p>}
          <div className="mt-2 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={isSaving}>{editing ? 'Save changes' : 'Create department'}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete department"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        isLoading={isDeleting}
      />
    </motion.div>
  );
}
