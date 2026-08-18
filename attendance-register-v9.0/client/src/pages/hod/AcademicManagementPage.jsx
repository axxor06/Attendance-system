import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Plus, ChevronRight, ChevronDown, Building2, Layers,
  BookOpen, Pencil, Trash2
} from 'lucide-react';
import { departmentApi, semesterApi, classApi } from '../../api/academics.js';
import { subjectApi } from '../../api/academicsExtra.js';
import { userApi } from '../../api/users.js';
import { useAuth } from '../../context/AuthContext.jsx';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Modal from '../../components/common/Modal.jsx';
import Input from '../../components/common/Input.jsx';
import Badge from '../../components/common/Badge.jsx';
import ConfirmDialog from '../../components/common/ConfirmDialog.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { SkeletonCard } from '../../components/common/Skeleton.jsx';

// ─── Dept Modal ───────────────────────────────────────────────────────────────
function DeptModal({ open, onClose, initial, onSave }) {
  const [form, setForm] = useState({ name: '', code: '', description: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(initial || { name: '', code: '', description: '' });
    setError('');
  }, [open, initial]);

  async function handleSubmit(e) {
    e.preventDefault(); setError(''); setSaving(true);
    try { await onSave(form); onClose(); }
    catch (err) { setError(err.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  }

  return (
    <Modal isOpen={open} onClose={onClose} title={initial ? 'Edit department' : 'New department'}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input label="Department name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Input label="Code (e.g. CSE)" required maxLength={10} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
        <Input label="Description (optional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        {error && <p className="rounded-xl bg-clay-light px-3 py-2 text-sm text-clay">{error}</p>}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" isLoading={saving}>{initial ? 'Save' : 'Create'}</Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Subject Modal ─────────────────────────────────────────────────────────────
function SubjectModal({ open, onClose, classDoc, facultyList, initial, onSave }) {
  const [form, setForm] = useState({ name: '', code: '', faculty: [] });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(initial
      ? { name: initial.name, code: initial.code, faculty: initial.faculty?.map(f => f._id || f) || [] }
      : { name: '', code: '', faculty: [] });
    setError('');
  }, [open, initial]);

  function toggleFaculty(id) {
    setForm(f => ({ ...f, faculty: f.faculty.includes(id) ? f.faculty.filter(x => x !== id) : [...f.faculty, id] }));
  }

  async function handleSubmit(e) {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      await onSave({ ...form, classId: classDoc._id, department: classDoc.department?._id, semester: classDoc.semester?._id });
      onClose();
    }
    catch (err) { setError(err.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  }

  return (
    <Modal isOpen={open} onClose={onClose} title={initial ? 'Edit subject' : `New subject — ${classDoc?.name}`} maxWidth="max-w-lg">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input label="Subject name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Input label="Code (e.g. CS301)" required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink/80">Assign faculty</label>
          <div className="flex max-h-36 flex-col gap-1 overflow-y-auto rounded-xl border border-ink/15 p-2.5">
            {facultyList.length === 0 && <p className="text-xs text-slate px-1">No faculty added yet.</p>}
            {facultyList.map(f => (
              <label key={f._id} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-ink/5 cursor-pointer">
                <input type="checkbox" checked={form.faculty.includes(f._id)} onChange={() => toggleFaculty(f._id)} className="h-4 w-4 accent-ink" />
                {f.name}
              </label>
            ))}
          </div>
        </div>
        {error && <p className="rounded-xl bg-clay-light px-3 py-2 text-sm text-clay">{error}</p>}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" isLoading={saving}>{initial ? 'Save' : 'Add subject'}</Button>
        </div>
      </form>
    </Modal>
  );
}

import { fadeUp } from '../../utils/motion.js';

// ─── Main Component ────────────────────────────────────────────────────────────
export default function AcademicManagementPage() {
  const { user } = useAuth();
  const canManageInstitutionStructure = ['super_admin', 'admin'].includes(user?.role);
  const [departments, setDepartments] = useState([]);
  const [allClasses, setAllClasses] = useState([]);
  const [allSubjects, setAllSubjects] = useState([]);
  const [allSemesters, setAllSemesters] = useState([]);
  const [facultyList, setFacultyList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Expand state: { [deptId]: true }
  const [expandedDepts, setExpandedDepts] = useState({});
  // { [classId]: true }
  const [expandedClasses, setExpandedClasses] = useState({});

  // Modals
  const [deptModal, setDeptModal] = useState({ open: false, initial: null });
  const [subjectModal, setSubjectModal] = useState({ open: false, classDoc: null, initial: null });
  const [semModal, setSemModal] = useState({ open: false, deptId: null });
  const [semNumber, setSemNumber] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    const results = await Promise.allSettled([
      departmentApi.list(),
      classApi.list(),
      subjectApi.list(),
      semesterApi.list(),
      userApi.list({ role: 'faculty', limit: 100 }),
    ]);
    const [deptRes, classRes, subRes, semRes, facRes] = results;
    if (deptRes.status === 'fulfilled') setDepartments(deptRes.value.data?.data?.departments || []);
    if (classRes.status === 'fulfilled') setAllClasses(classRes.value.data?.data?.classes || []);
    if (subRes.status === 'fulfilled') setAllSubjects(subRes.value.data?.data?.subjects || []);
    if (semRes.status === 'fulfilled') setAllSemesters(semRes.value.data?.data?.semesters || []);
    if (facRes.status === 'fulfilled') setFacultyList(facRes.value.data?.data?.users || []);
    const labels = ['departments', 'classes', 'subjects', 'semesters', 'faculty'];
    const failed = results.map((result, index) => (result.status === 'rejected' ? labels[index] : null)).filter(Boolean);
    if (failed.length > 0) setLoadError(`Could not load ${failed.join(', ')}. Existing data remains available; retry when the connection is ready.`);
    setIsLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function toggleDept(id) { setExpandedDepts(p => ({ ...p, [id]: !p[id] })); }
  function toggleClass(id) { setExpandedClasses(p => ({ ...p, [id]: !p[id] })); }

  // ── Dept handlers ──
  async function saveDept(form) {
    if (deptModal.initial) await departmentApi.update(deptModal.initial._id, form);
    else await departmentApi.create(form);
    toast.success(deptModal.initial ? 'Department updated' : 'Department created');
    load();
  }

  // ── Auto-create a class when adding a new semester to a dept ──
  async function addSemesterToDept(deptId) {
    if (!semNumber) return;
    let semDoc = allSemesters.find(s => s.number === Number(semNumber));
    if (!semDoc) {
      const res = await semesterApi.create({ number: Number(semNumber) });
      semDoc = res.data.data.semester;
    }
    await classApi.create({ department: deptId, semester: semDoc._id });
    toast.success(`Semester ${semNumber} added and class created`);
    setSemModal({ open: false, deptId: null }); setSemNumber('');
    load();
  }

  // ── Subject handlers ──
  async function saveSubject(form) {
    if (subjectModal.initial) await subjectApi.update(subjectModal.initial._id, form);
    else await subjectApi.create(form);
    toast.success(subjectModal.initial ? 'Subject updated' : 'Subject added');
    load();
  }

  // ── Delete ──
  async function handleDelete() {
    setIsDeleting(true);
    try {
      if (deleteTarget.type === 'department') await departmentApi.remove(deleteTarget.id);
      if (deleteTarget.type === 'subject') await subjectApi.remove(deleteTarget.id);
      toast.success(`${deleteTarget.type} deleted`);
      setDeleteTarget(null); load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not delete');
    } finally { setIsDeleting(false); }
  }

  return (
    <motion.div className="flex flex-col gap-6" {...fadeUp}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Academic Management</h1>
          <p className="mt-1 text-sm text-slate">Departments → Semesters → Subjects, all in one place</p>
        </div>
        {canManageInstitutionStructure && (
          <Button icon={Plus} onClick={() => setDeptModal({ open: true, initial: null })}>
            New department
          </Button>
        )}
      </div>

      {loadError && (
        <Card className="border-clay/20 bg-clay-light/60 px-5 py-4" role="alert">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="text-sm font-semibold text-clay">Some academic data needs attention</p><p className="mt-1 text-sm text-clay/80">{loadError}</p></div>
            <Button type="button" variant="outline" onClick={load}>Retry</Button>
          </div>
        </Card>
      )}

      {user?.role === 'hod' && (
        <Card className="border-amber/20 bg-amber-light/25 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-xl bg-amber/20 p-2 text-amber"><Building2 size={16} /></div>
            <div>
              <p className="text-sm font-semibold text-ink">Academic management</p>
              <p className="mt-1 text-sm leading-6 text-slate">You can manage subjects and people within your department. Institution-wide departments, semesters, and timetable settings are managed by administrators.</p>
            </div>
          </div>
        </Card>
      )}

      {isLoading ? (
        <div className="flex flex-col gap-4">
          {[1,2,3].map(i => <SkeletonCard key={i} />)}
        </div>
      ) : departments.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No departments yet"
          message="Create your first department to start building the academic structure."
          action={canManageInstitutionStructure ? <Button icon={Plus} onClick={() => setDeptModal({ open: true, initial: null })}>New department</Button> : undefined}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {departments.map(dept => {
            const deptClasses = allClasses.filter(c => c.department?._id === dept._id || c.department === dept._id);
            const isExpanded = expandedDepts[dept._id];

            return (
              <Card key={dept._id} className="overflow-hidden">
                {/* Department header */}
                <div className="flex items-center gap-3 px-5 py-4">
                  <button onClick={() => toggleDept(dept._id)} className="text-ink/40 hover:text-ink">
                    {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </button>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ink/8">
                    <Building2 size={16} className="text-ink/60" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display text-base font-semibold text-ink">{dept.name}</p>
                    <p className="font-mono text-xs text-slate">{dept.code} · {deptClasses.length} semester{deptClasses.length !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="flex gap-1.5">
                    {canManageInstitutionStructure && (
                      <>
                        <Button size="sm" variant="outline" icon={Plus}
                          onClick={() => { setSemModal({ open: true, deptId: dept._id }); setSemNumber(''); }}>
                          Add semester
                        </Button>
                        <button type="button" title="Edit department" aria-label={`Edit ${dept.name}`} onClick={() => setDeptModal({ open: true, initial: dept })}
                          className="rounded-lg p-2 text-ink/40 hover:bg-ink/5 hover:text-ink">
                          <Pencil size={15} />
                        </button>
                        <button type="button" title="Delete department" aria-label={`Delete ${dept.name}`} onClick={() => setDeleteTarget({ type: 'department', id: dept._id, label: dept.name })}
                          className="rounded-lg p-2 text-ink/40 hover:bg-clay-light hover:text-clay">
                          <Trash2 size={15} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Semesters / Classes */}
                {isExpanded && (
                  <div className="border-t border-ink/5">
                    {deptClasses.length === 0 ? (
                      <p className="px-14 py-4 text-sm text-slate">No semesters yet. Click "Add semester" to create one.</p>
                    ) : (
                      deptClasses.map(cls => {
                        const subjects = allSubjects.filter(s => s.class?._id === cls._id || s.class === cls._id);
                        const classExpanded = expandedClasses[cls._id];

                        return (
                          <div key={cls._id} className="border-t border-ink/5">
                            <div className="flex items-center gap-3 bg-ink/2 px-14 py-3">
                              <button onClick={() => toggleClass(cls._id)} className="text-ink/40 hover:text-ink">
                                {classExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                              </button>
                              <Layers size={14} className="shrink-0 text-ink/50" />
                              <p className="flex-1 text-sm font-medium text-ink">
                                {cls.semester?.label}
                                <span className="ml-2 font-mono text-xs text-slate">{cls.code}</span>
                              </p>
                              <Badge variant="neutral">{subjects.length} subject{subjects.length !== 1 ? 's' : ''}</Badge>
                              <Button size="sm" variant="ghost" icon={Plus}
                                onClick={() => setSubjectModal({ open: true, classDoc: cls, initial: null })}>
                                Add subject
                              </Button>
                            </div>

                            {classExpanded && (
                              <div className="pl-20 pr-5 pb-3">
                                {subjects.length === 0 ? (
                                  <p className="py-2 text-xs text-slate">No subjects yet.</p>
                                ) : (
                                  <div className="flex flex-col gap-1.5 pt-2">
                                    {subjects.map(sub => (
                                      <div key={sub._id} className="flex items-center gap-3 rounded-xl border border-ink/8 bg-white px-4 py-2.5">
                                        <BookOpen size={13} className="shrink-0 text-ink/40" />
                                        <div className="flex-1 min-w-0">
                                          <p className="text-sm font-medium text-ink">{sub.name}</p>
                                          <div className="flex flex-wrap gap-1.5 mt-1">
                                            <span className="font-mono text-[11px] text-slate">{sub.code}</span>
                                            {sub.faculty?.length > 0 && sub.faculty.map(f => (
                                              <Badge key={f._id} variant="neutral" className="text-[11px]">{f.name}</Badge>
                                            ))}
                                          </div>
                                        </div>
                                        <div className="flex gap-1">
                                          <button onClick={() => setSubjectModal({ open: true, classDoc: cls, initial: sub })}
                                            className="rounded-lg p-1.5 text-ink/40 hover:bg-ink/5 hover:text-ink">
                                            <Pencil size={13} />
                                          </button>
                                          <button onClick={() => setDeleteTarget({ type: 'subject', id: sub._id, label: sub.name })}
                                            className="rounded-lg p-1.5 text-ink/40 hover:bg-clay-light hover:text-clay">
                                            <Trash2 size={13} />
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Dept Modal */}
      <DeptModal open={deptModal.open} onClose={() => setDeptModal({ open: false, initial: null })} initial={deptModal.initial} onSave={saveDept} />

      {/* Add Semester Modal */}
      <Modal isOpen={semModal.open} onClose={() => setSemModal({ open: false, deptId: null })} title="Add semester to department">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate">Enter the semester number. If it doesn't exist yet it will be created automatically.</p>
          <Input
            label="Semester number"
            type="number"
            min={1}
            max={12}
            value={semNumber}
            onChange={(e) => setSemNumber(e.target.value)}
            placeholder="e.g. 3"
          />
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setSemModal({ open: false, deptId: null })}>Cancel</Button>
            <Button onClick={() => addSemesterToDept(semModal.deptId)} disabled={!semNumber}>Add semester</Button>
          </div>
        </div>
      </Modal>

      {/* Subject Modal */}
      <SubjectModal
        open={subjectModal.open}
        onClose={() => setSubjectModal({ open: false, classDoc: null, initial: null })}
        classDoc={subjectModal.classDoc}
        facultyList={facultyList}
        initial={subjectModal.initial}
        onSave={saveSubject}
      />

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={`Delete ${deleteTarget?.type}`}
        message={`Delete "${deleteTarget?.label}"? This cannot be undone.`}
        confirmLabel="Delete"
        isLoading={isDeleting}
      />
    </motion.div>
  );
}
