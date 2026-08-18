import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, BookOpen, Trash2 } from 'lucide-react';
import { subjectApi } from '../../api/academicsExtra.js';
import { classApi } from '../../api/academics.js';
import { userApi } from '../../api/users.js';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Modal from '../../components/common/Modal.jsx';
import Input from '../../components/common/Input.jsx';
import Select from '../../components/common/Select.jsx';
import Badge from '../../components/common/Badge.jsx';
import ConfirmDialog from '../../components/common/ConfirmDialog.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { SkeletonTable } from '../../components/common/Skeleton.jsx';

const emptyForm = { name: '', code: '', department: '', semester: '', classId: '', faculty: [] };

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);
  const [facultyList, setFacultyList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function loadAll() {
    setIsLoading(true);
    const [subRes, classRes, facRes] = await Promise.all([
      subjectApi.list(),
      classApi.list(),
      userApi.list({ role: 'faculty', limit: 100 }),
    ]);
    setSubjects(subRes.data.data.subjects);
    setClasses(classRes.data.data.classes);
    setFacultyList(facRes.data.data.users);
    setIsLoading(false);
  }

  useEffect(() => { loadAll(); }, []);

  function openCreate() {
    setForm(emptyForm);
    setError('');
    setModalOpen(true);
  }

  // When a class is picked, auto-derive department & semester from it.
  function handleClassChange(classId) {
    const selected = classes.find((c) => c._id === classId);
    setForm((f) => ({
      ...f,
      classId,
      department: selected?.department?._id || '',
      semester: selected?.semester?._id || '',
    }));
  }

  function toggleFaculty(facultyId) {
    setForm((f) => ({
      ...f,
      faculty: f.faculty.includes(facultyId)
        ? f.faculty.filter((id) => id !== facultyId)
        : [...f.faculty, facultyId],
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setIsSaving(true);
    try {
      await subjectApi.create(form);
      toast.success('Subject created');
      setModalOpen(false);
      loadAll();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create subject');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    setIsDeleting(true);
    try {
      await subjectApi.remove(deleteTarget._id);
      toast.success('Subject deleted');
      setDeleteTarget(null);
      loadAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not delete subject');
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Subjects</h1>
          <p className="mt-1 text-sm text-slate">Assign subjects to classes and faculty</p>
        </div>
        <Button icon={Plus} onClick={openCreate} disabled={classes.length === 0}>New subject</Button>
      </div>

      {isLoading ? (
        <SkeletonTable cols={4} />
      ) : subjects.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No subjects yet"
          message={classes.length === 0 ? 'Create a class first, then add subjects to it.' : 'Add your first subject.'}
          action={classes.length > 0 && <Button icon={Plus} onClick={openCreate}>New subject</Button>}
        />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink/8 bg-ink/3 text-left text-xs font-semibold uppercase tracking-wide text-slate">
                <th className="px-5 py-3">Subject</th>
                <th className="px-5 py-3">Class</th>
                <th className="px-5 py-3">Faculty</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/5">
              {subjects.map((s) => (
                <tr key={s._id}>
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-ink">{s.name}</p>
                    <p className="font-mono text-xs text-slate">{s.code}</p>
                  </td>
                  <td className="px-5 py-3.5 text-ink/80">{s.class?.name}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex flex-wrap gap-1">
                      {s.faculty?.length > 0 ? (
                        s.faculty.map((f) => <Badge key={f._id} variant="neutral">{f.name}</Badge>)
                      ) : (
                        <span className="text-xs text-slate">Unassigned</span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex justify-end">
                      <button onClick={() => setDeleteTarget(s)} className="rounded-lg p-2 text-ink/50 hover:bg-clay-light hover:text-clay">
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

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="New subject" maxWidth="max-w-lg">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Subject name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Input
            label="Subject code"
            required
            placeholder="e.g. CS301"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
          />
          <Select
            label="Class"
            required
            value={form.classId}
            onChange={(e) => handleClassChange(e.target.value)}
          >
            <option value="">Select class</option>
            {classes.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </Select>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink/80">Faculty (select one or more)</label>
            {facultyList.length === 0 ? (
              <p className="text-xs text-slate">No faculty created yet.</p>
            ) : (
              <div className="flex max-h-40 flex-col gap-1.5 overflow-y-auto rounded-xl border border-ink/15 p-2.5">
                {facultyList.map((f) => (
                  <label key={f._id} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-ink/5">
                    <input
                      type="checkbox"
                      checked={form.faculty.includes(f._id)}
                      onChange={() => toggleFaculty(f._id)}
                      className="h-4 w-4 rounded border-ink/30 accent-ink"
                    />
                    {f.name}
                  </label>
                ))}
              </div>
            )}
          </div>

          {error && <p className="rounded-xl bg-clay-light px-3.5 py-2.5 text-sm text-clay">{error}</p>}
          <div className="mt-2 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={isSaving}>Create subject</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete subject"
        message={`Delete "${deleteTarget?.name}"? Only possible if it has no attendance records yet.`}
        confirmLabel="Delete"
        isLoading={isDeleting}
      />
    </div>
  );
}
