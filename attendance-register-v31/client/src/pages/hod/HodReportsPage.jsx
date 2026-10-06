import { motion } from 'framer-motion';
import { fadeUp } from '../../utils/motion.js';
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { FileText, FileSpreadsheet } from 'lucide-react';
import { subjectApi } from '../../api/academicsExtra.js';
import { classApi } from '../../api/academics.js';
import { reportApi } from '../../api/misc.js';
import { getFriendlyError } from '../../utils/errorMessages.js';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Select from '../../components/common/Select.jsx';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function HodReportsPage() {
  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [selectedSubject, setSelectedSubject] = useState('');
  const [downloadingSubject, setDownloadingSubject] = useState(null);

  const [selectedClass, setSelectedClass] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [downloadingMonthly, setDownloadingMonthly] = useState(null);

  const loadOptions = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    const [subjectResult, classResult] = await Promise.allSettled([subjectApi.list(), classApi.list()]);
    if (subjectResult.status === 'fulfilled') setSubjects(subjectResult.value.data?.data?.subjects || []);
    else setSubjects([]);
    if (classResult.status === 'fulfilled') setClasses(classResult.value.data?.data?.classes || []);
    else setClasses([]);
    if (subjectResult.status === 'rejected' || classResult.status === 'rejected') {
      setLoadError('Some report options could not be loaded. Retry when the connection is ready.');
    }
    setIsLoading(false);
  }, []);

  useEffect(() => { loadOptions(); }, [loadOptions]);
  useEffect(() => {
    setSelectedSubject((current) => subjects.some((subject) => subject._id === current) ? current : '');
    setSelectedClass((current) => classes.some((classItem) => classItem._id === current) ? current : '');
  }, [classes, subjects]);

  async function handleSubjectDownload(format) {
    if (!selectedSubject) {
      toast.error('Select a subject first.');
      return;
    }
    setDownloadingSubject(format);
    try {
      await reportApi.downloadSubjectReport(selectedSubject, format);
    } catch (err) {
      toast.error(getFriendlyError(err, 'Could not generate the subject report.'));
    } finally {
      setDownloadingSubject(null);
    }
  }

  async function handleMonthlyDownload(format) {
    if (!selectedClass) {
      toast.error('Select a class first.');
      return;
    }
    setDownloadingMonthly(format);
    try {
      await reportApi.downloadClassMonthlyReport(selectedClass, { format, year: selectedYear, month: selectedMonth });
    } catch (err) {
      toast.error(getFriendlyError(err, 'Could not generate the monthly report.'));
    } finally {
      setDownloadingMonthly(null);
    }
  }

  const years = Array.from({ length: 5 }).map((_, i) => new Date().getFullYear() - i);

  return (
    <motion.div className="flex flex-col gap-6" {...fadeUp}>
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">Reports</h1>
        <p className="mt-1 text-sm text-slate">Export attendance reports as PDF or Excel</p>
      </div>

      {loadError && (
        <Card className="border-clay/20 bg-clay-light/60 px-5 py-4" role="alert">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="text-sm font-semibold text-clay">Report options need attention</p><p className="mt-1 text-sm text-clay/80">{loadError}</p></div>
            <Button type="button" variant="outline" onClick={loadOptions}>Retry</Button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-display text-base font-semibold text-ink">Subject report</h2>
          <p className="mb-4 mt-1 text-sm text-slate">Every student's attendance for a single subject</p>

          <Select
            label="Subject"
            disabled={isLoading || subjects.length === 0}
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            hint={isLoading ? 'Loading subjects…' : subjects.length === 0 ? 'No subjects are available in your scope.' : undefined}
          >
            <option value="">{isLoading ? 'Loading subjects…' : 'Select subject'}</option>
            {subjects.map((s) => (
              <option key={s._id} value={s._id}>{s.name} ({s.code}) - {s.class?.name}</option>
            ))}
          </Select>

          <div className="mt-4 flex gap-2.5">
            <Button
              variant="outline"
              icon={FileText}
              isLoading={downloadingSubject === 'pdf'}
              onClick={() => handleSubjectDownload('pdf')}
              disabled={isLoading || subjects.length === 0}
              className="flex-1"
            >
              PDF
            </Button>
            <Button
              variant="outline"
              icon={FileSpreadsheet}
              isLoading={downloadingSubject === 'excel'}
              onClick={() => handleSubjectDownload('excel')}
              disabled={isLoading || subjects.length === 0}
              className="flex-1"
            >
              Excel
            </Button>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-display text-base font-semibold text-ink">Monthly class report</h2>
          <p className="mb-4 mt-1 text-sm text-slate">Every student in a class for a given month</p>

          <Select
            label="Class"
            disabled={isLoading || classes.length === 0}
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            hint={isLoading ? 'Loading classes…' : classes.length === 0 ? 'No classes are available in your scope.' : undefined}
          >
            <option value="">{isLoading ? 'Loading classes…' : 'Select class'}</option>
            {classes.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </Select>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <Select label="Month" value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))}>
              {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </Select>
            <Select label="Year" value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </Select>
          </div>

          <div className="mt-4 flex gap-2.5">
            <Button
              variant="outline"
              icon={FileText}
              isLoading={downloadingMonthly === 'pdf'}
              onClick={() => handleMonthlyDownload('pdf')}
              disabled={isLoading || classes.length === 0}
              className="flex-1"
            >
              PDF
            </Button>
            <Button
              variant="outline"
              icon={FileSpreadsheet}
              isLoading={downloadingMonthly === 'excel'}
              onClick={() => handleMonthlyDownload('excel')}
              disabled={isLoading || classes.length === 0}
              className="flex-1"
            >
              Excel
            </Button>
          </div>
        </Card>
      </div>
    </motion.div>
  );
}
