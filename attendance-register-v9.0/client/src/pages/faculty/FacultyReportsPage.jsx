import { motion } from 'framer-motion';
import { fadeUp } from '../../utils/motion.js';
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { FileText, FileSpreadsheet } from 'lucide-react';
import { subjectApi } from '../../api/academicsExtra.js';
import { reportApi } from '../../api/misc.js';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Select from '../../components/common/Select.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';

export default function FacultyReportsPage() {
  const [subjects, setSubjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [downloading, setDownloading] = useState(null);

  const loadSubjects = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const { data } = await subjectApi.mySubjects();
      setSubjects(data?.data?.subjects || []);
    } catch (err) {
      setSubjects([]);
      setLoadError(err.response?.data?.message || 'Page could not be loaded.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadSubjects(); }, [loadSubjects]);

  async function handleDownload(format) {
    if (!selectedSubject) {
      toast.error('Select a subject first.');
      return;
    }
    setDownloading(format);
    try {
      await reportApi.downloadSubjectReport(selectedSubject, format);
    } catch {
      toast.error('Could not generate report.');
    } finally {
      setDownloading(null);
    }
  }

  return (
    <motion.div className="flex flex-col gap-6" {...fadeUp}>
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">Reports</h1>
        <p className="mt-1 text-sm text-slate">Export attendance reports for your subjects</p>
      </div>

      {isLoading ? (
        <Card className="max-w-md p-5"><div className="skeleton h-12 rounded-xl" /></Card>
      ) : loadError ? (
        <Card className="max-w-md border-clay/20 bg-clay-light/60 p-5" role="alert">
          <p className="font-semibold text-clay">Page could not be loaded.</p>
          <p className="mt-1 text-sm text-clay/80">{loadError}</p>
          <Button type="button" variant="outline" className="mt-4" onClick={loadSubjects}>Try again</Button>
        </Card>
      ) : subjects.length === 0 ? (
        <EmptyState title="No subjects assigned yet" message="Reports will be available once you're assigned subjects." />
      ) : (
        <Card className="max-w-md p-5">
          <Select
            label="Subject"
            disabled={subjects.length === 0}
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
          >
            <option value="">Select subject</option>
            {subjects.map((s) => (
              <option key={s._id} value={s._id}>{s.name} - {s.class?.name}</option>
            ))}
          </Select>

          <div className="mt-4 flex gap-2.5">
            <Button
              variant="outline"
              icon={FileText}
              isLoading={downloading === 'pdf'}
              onClick={() => handleDownload('pdf')}
              className="flex-1"
            >
              PDF
            </Button>
            <Button
              variant="outline"
              icon={FileSpreadsheet}
              isLoading={downloading === 'excel'}
              onClick={() => handleDownload('excel')}
              className="flex-1"
            >
              Excel
            </Button>
          </div>
        </Card>
      )}
    </motion.div>
  );
}
