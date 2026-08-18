import { motion } from 'framer-motion';
import { fadeUp } from '../../utils/motion.js';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { subjectApi } from '../../api/academicsExtra.js';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { SkeletonCard } from '../../components/common/Skeleton.jsx';

export default function FacultySubjectsPage() {
  const [subjects, setSubjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

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

  return (
    <motion.div className="flex flex-col gap-6" {...fadeUp}>
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">My Subjects</h1>
        <p className="mt-1 text-sm text-slate">Subjects assigned to you</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : loadError ? (
        <Card className="border-clay/20 bg-clay-light/60 p-6" role="alert">
          <p className="font-semibold text-clay">Page could not be loaded.</p>
          <p className="mt-1 text-sm text-clay/80">{loadError}</p>
          <Button type="button" variant="outline" className="mt-4" onClick={loadSubjects}>Try again</Button>
        </Card>
      ) : subjects.length === 0 ? (
        <EmptyState icon={BookOpen} title="No subjects assigned" message="Your HOD will assign subjects to you." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {subjects.map((s) => (
            <Card key={s._id} className="p-5">
              <p className="font-display text-base font-semibold text-ink">{s.name}</p>
              <p className="font-mono text-xs text-slate">{s.code}</p>
              <p className="mt-2 text-sm text-ink/70">{s.class?.name}</p>
              <Link to={`/faculty/take-attendance?subjectId=${s._id}`}>
                <Button size="sm" variant="outline" className="mt-4 w-full">Take attendance</Button>
              </Link>
            </Card>
          ))}
        </div>
      )}
    </motion.div>
  );
}
