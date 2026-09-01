import { getFriendlyError } from '../../utils/errorMessages.js';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Layers, Trash2, Users, BookOpen } from 'lucide-react';
import { classApi, semesterApi, departmentApi } from '../../api/academics.js';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Modal from '../../components/common/Modal.jsx';
import Input from '../../components/common/Input.jsx';
import Select from '../../components/common/Select.jsx';
import ConfirmDialog from '../../components/common/ConfirmDialog.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { SkeletonTable } from '../../components/common/Skeleton.jsx';

export default function ClassesPage() {
  const [classes, setClasses] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [classModalOpen, setClassModalOpen] = useState(false);
  const [classForm, setClassForm] = useState({ department: '', semester: '' });
  const [classError, setClassError] = useState('');
  const [isSavingClass, setIsSavingClass] = useState(false);

  const [semModalOpen, setSemModalOpen] = useState(false);
  const [semForm, setSemForm] = useState({ number: '', label: '', departmentId: '' });
  const [semError, setSemError] = useState('');
  const [isSavingSem, setIsSavingSem] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function loadAll() {
    setIsLoading(true);
    setLoadError('');
    try {
      const [classRes, semRes, deptRes] = await Promise.all([
        classApi.list(),
        semesterApi.list(),
        departmentApi.list(),
      ]);
      const nextClasses = classRes.data?.data?.classes || [];
      const nextSemesters = semRes.data?.data?.semesters || [];
      setClasses(nextClasses);
      setSemesters(nextSemesters);
      setDepartments(deptRes.data?.data?.departments || []);
      setClassForm((current) => ({ ...current, semester: nextSemesters.some((item) => item._id === current.semester) ? current.semester : '' }));
    } catch (err) {
      setClasses([]);
      setSemesters([]);
      setDepartments([]);
      setLoadError(getFriendlyError(err, 'Classes, semesters, and departments could not be loaded.'));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

  const selectedClassDepartment = departments.find((department) => department._id === classForm.department);
  const selectedSemesterDepartment = departments.find((department) => department._id === semForm.departmentId);
  const availableSemesters = semesters.filter((semester) => semester.isActive !== false && Number(semester.number) <= Number(selectedClassDepartment?.semesterCount || (selectedClassDepartment?.programLevel === 'diploma' ? 6 : 8)));

  async function handleCreateClass(e) {
    e.preventDefault();
    setClassError('');
    setIsSavingClass(true);
    try {
      await classApi.create(classForm);
      toast.success('Class created');
      setClassModalOpen(false);
      setClassForm({ department: '', semester: '' });
      loadAll();
    } catch (err) {
      setClassError(getFriendlyError(err, 'Could not create class'));
    } finally {
      setIsSavingClass(false);
    }
  }

  async function handleCreateSemester(e) {
    e.preventDefault();
    setSemError('');
    setIsSavingSem(true);
    try {
      const maxSemester = Number(selectedSemesterDepartment?.semesterCount || (selectedSemesterDepartment?.programLevel === 'diploma' ? 6 : 8));
      const number = Number(semForm.number);
      if (!Number.isInteger(number) || number < 1 || number > maxSemester) {
        throw new Error(`Choose a semester number from 1 to ${maxSemester} for this program.`);
      }
      await semesterApi.create({ number, label: semForm.label || undefined, departmentId: semForm.departmentId });
      toast.success('Semester created');
      setSemModalOpen(false);
      setSemForm({ number: '', label: '', departmentId: '' });
      loadAll();
    } catch (err) {
      setSemError(getFriendlyError(err, 'Could not create semester'));
    } finally {
      setIsSavingSem(false);
    }
  }

  async function handleDeleteClass() {
    setIsDeleting(true);
    try {
      await classApi.remove(deleteTarget._id);
      toast.success('Class deleted');
      setDeleteTarget(null);
      loadAll();
    } catch (err) {
      toast.error(getFriendlyError(err, 'Could not delete class'));
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Classes & Semesters</h1>
          <p className="mt-1 text-sm text-slate">One class per department + semester combination</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" icon={Plus} onClick={() => setSemModalOpen(true)}>New semester</Button>
          <Button icon={Plus} onClick={() => setClassModalOpen(true)}>New class</Button>
        </div>
      </div>

      {loadError && <Card className="border-clay/20 bg-clay-light/60 p-5" role="alert"><p className="text-sm text-clay">{loadError}</p><Button type="button" variant="outline" size="sm" className="mt-3" onClick={loadAll}>Try again</Button></Card>}

      {isLoading ? (
        <SkeletonTable cols={4} />
      ) : classes.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No classes yet"
          message="Create a department and semester, then combine them into a class."
          action={<Button icon={Plus} onClick={() => setClassModalOpen(true)}>New class</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((c) => (
            <Card key={c._id} className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-display text-base font-semibold text-ink">{c.name}</p>
                  <p className="font-mono text-xs text-slate">{c.code}</p>
                </div>
                <button
                  type="button"
                  aria-label={`Delete ${c.name}`}
                  title={`Delete ${c.name}`}
                  onClick={() => setDeleteTarget(c)}
                  className="rounded-lg p-1.5 text-ink/40 hover:bg-clay-light hover:text-clay"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="mt-4 flex items-center gap-4 text-xs text-slate">
                <span className="flex items-center gap-1"><Users size={13} /> Students</span>
                <span className="flex items-center gap-1"><BookOpen size={13} /> Subjects</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {semesters.length > 0 && (
        <Card className="p-5">
          <h2 className="mb-3 font-display text-base font-semibold text-ink">Semesters</h2>
          <div className="flex flex-wrap gap-2">
            {semesters.map((s) => (
              <span key={s._id} className="rounded-full bg-indigo/5 px-3 py-1.5 text-xs font-medium text-ink">
                {s.label}
              </span>
            ))}
          </div>
        </Card>
      )}

      <Modal isOpen={classModalOpen} onClose={() => setClassModalOpen(false)} title="New class">
        <form onSubmit={handleCreateClass} className="flex flex-col gap-4">
          <Select
            label="Department"
            required
            value={classForm.department}
            onChange={(e) => setClassForm({ ...classForm, department: e.target.value, semester: '' })}
          >
            <option value="">Select department</option>
            {departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
          </Select>
          <Select
            label="Semester"
            required
            value={classForm.semester}
            onChange={(e) => setClassForm({ ...classForm, semester: e.target.value })}
          >
            <option value="">Select semester</option>
            {availableSemesters.map((s) => <option key={s._id} value={s._id}>{s.label}</option>)}
          </Select>
          {classError && <p className="rounded-xl bg-clay-light px-3.5 py-2.5 text-sm text-clay">{classError}</p>}
          <div className="mt-2 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setClassModalOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={isSavingClass}>Create class</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={semModalOpen} onClose={() => setSemModalOpen(false)} title="New semester">
        <form onSubmit={handleCreateSemester} className="flex flex-col gap-4">
          <Select label="Program / department" required value={semForm.departmentId} onChange={(e) => setSemForm({ ...semForm, departmentId: e.target.value, number: '' })}>
            <option value="">Select program</option>
            {departments.map((d) => <option key={d._id} value={d._id}>{d.name} · {d.semesterCount || (d.programLevel === 'diploma' ? 6 : 8)} semesters</option>)}
          </Select>
          <Input
            label="Semester number"
            type="number"
            min={1}
            max={selectedSemesterDepartment?.semesterCount || (selectedSemesterDepartment?.programLevel === 'diploma' ? 6 : 8)}
            required
            value={semForm.number}
            onChange={(e) => setSemForm({ ...semForm, number: e.target.value })}
            hint={selectedSemesterDepartment ? `This program supports semesters 1–${selectedSemesterDepartment.semesterCount || (selectedSemesterDepartment.programLevel === 'diploma' ? 6 : 8)}.` : 'Choose the program first.'}
          />
          <Input
            label="Label (optional)"
            placeholder="Defaults to 'Semester N'"
            value={semForm.label}
            onChange={(e) => setSemForm({ ...semForm, label: e.target.value })}
          />
          {semError && <p className="rounded-xl bg-clay-light px-3.5 py-2.5 text-sm text-clay">{semError}</p>}
          <div className="mt-2 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setSemModalOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={isSavingSem}>Create semester</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteClass}
        title="Delete class"
        message={`Delete "${deleteTarget?.name}"? This is only possible if no students or subjects are assigned to it.`}
        confirmLabel="Delete"
        isLoading={isDeleting}
      />
    </div>
  );
}
