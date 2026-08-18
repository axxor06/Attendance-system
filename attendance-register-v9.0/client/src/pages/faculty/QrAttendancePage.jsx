import { useCallback, useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Wifi, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { subjectApi } from '../../api/academicsExtra.js';
import { periodApi } from '../../api/academicsExtra.js';
import { qrApi } from '../../api/registration.js';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Select from '../../components/common/Select.jsx';
import Input from '../../components/common/Input.jsx';
import Badge from '../../components/common/Badge.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { fadeUp, staggerContainer, staggerItem } from '../../utils/motion.js';

function todayIso() { return format(new Date(), 'yyyy-MM-dd'); }
function getDayName(d) {
  return ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][new Date(d).getDay()];
}
function secondsLeft(expiresAt) {
  return Math.max(0, Math.round((new Date(expiresAt) - Date.now()) / 1000));
}

function CountdownRing({ totalSeconds, secondsLeft }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const pct = totalSeconds > 0 ? secondsLeft / totalSeconds : 0;
  const color = pct > 0.5 ? '#3F766D' : pct > 0.25 ? '#B27A35' : '#B5564E';

  return (
    <div className="relative flex items-center justify-center">
      <svg width="88" height="88" className="-rotate-90">
        <circle cx="44" cy="44" r={r} fill="none" stroke="rgba(22,43,73,0.08)" strokeWidth="6" />
        <motion.circle
          cx="44" cy="44" r={r} fill="none"
          stroke={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={circ}
          animate={{ strokeDashoffset: circ * (1 - pct) }}
          transition={{ duration: 0.5 }}
        />
      </svg>
      <div className="absolute text-center">
        <p className="font-display text-lg font-bold text-ink">{secondsLeft}</p>
        <p className="text-[10px] text-slate">secs</p>
      </div>
    </div>
  );
}

export default function QrAttendancePage() {
  const QR_TOTAL_SECS = 300; // 5 minutes
  const [subjects, setSubjects] = useState([]);
  const [dayPeriods, setDayPeriods] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [date, setDate] = useState(todayIso());
  const [subjectId, setSubjectId] = useState('');
  const [periodOrder, setPeriodOrder] = useState('');

  const [session, setSession] = useState(null);
  const [stats, setStats] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  const pollRef = useRef(null);
  const timerRef = useRef(null);

  const loadSubjects = useCallback(async () => {
    try {
      const { data } = await subjectApi.mySubjects();
      setSubjects(data?.data?.subjects || []);
    } catch (err) {
      setSubjects([]);
      setLoadError(err.response?.data?.message || 'Could not load subjects.');
    }
  }, []);

  const loadPeriods = useCallback(async () => {
    if (!date) return;
    try {
      const { data } = await periodApi.getByDay(getDayName(date));
      setDayPeriods(data?.data?.template?.periods?.filter((period) => period.kind === 'class') || []);
    } catch (err) {
      setDayPeriods([]);
      setLoadError(err.response?.data?.message || 'Could not load periods.');
    }
  }, [date]);

  useEffect(() => { loadSubjects(); }, [loadSubjects]);
  useEffect(() => { loadPeriods(); }, [loadPeriods]);

  const pollStats = useCallback(async () => {
    if (!subjectId || !date || !periodOrder) return;
    try {
      const { data } = await qrApi.stats({ subjectId, date, periodOrder });
      setStats(data.data.session);
    } catch { /* non-critical */ }
  }, [subjectId, date, periodOrder]);

  useEffect(() => {
    clearInterval(pollRef.current);
    if (session && timeLeft > 0) {
      pollRef.current = setInterval(pollStats, 3000);
      pollStats();
    }
    return () => clearInterval(pollRef.current);
  }, [session, timeLeft, pollStats]);

  useEffect(() => {
    clearInterval(timerRef.current);
    if (!session?.expiresAt) return;
    setTimeLeft(secondsLeft(session.expiresAt));
    timerRef.current = setInterval(() => {
      const left = secondsLeft(session.expiresAt);
      setTimeLeft(left);
      if (left === 0) clearInterval(timerRef.current);
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [session?.expiresAt]);

  async function handleGenerate() {
    if (!subjectId || !date || !periodOrder) return;
    setIsGenerating(true);
    try {
      const { data } = await qrApi.generate({ subjectId, date, periodOrder: Number(periodOrder) });
      setSession(data.data);
      setStats(null);
    } catch (err) {
      alert(err.response?.data?.message || 'Could not generate QR');
    } finally { setIsGenerating(false); }
  }

  const isExpired = timeLeft === 0 && !!session;
  const qrValue = session ? `${window.location.origin}/scan-qr?token=${session.token}` : '';

  return (
    <motion.div className="flex flex-col gap-6" {...fadeUp}>
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">QR Attendance</h1>
        <p className="mt-1 text-sm text-slate">Generate a secure QR — students scan to mark themselves present</p>
      </div>

      {loadError && (
        <Card className="border-clay/20 bg-clay-light/60 p-4" role="alert">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-clay">{loadError}</p>
            <Button type="button" size="sm" variant="outline" onClick={() => { setLoadError(''); loadSubjects(); loadPeriods(); }}>Try again</Button>
          </div>
        </Card>
      )}

      <Card className="p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input label="Date" type="date" value={date}
            onChange={e => { setDate(e.target.value); setSession(null); setLoadError(''); }} max={todayIso()} />
          <Select label="Subject" value={subjectId}
            onChange={e => { setSubjectId(e.target.value); setSession(null); }}>
            <option value="">Select subject</option>
            {subjects.map(s => (
              <option key={s._id} value={s._id}>{s.name} — {s.class?.name}</option>
            ))}
          </Select>
          <Select label="Period" value={periodOrder}
            onChange={e => { setPeriodOrder(e.target.value); setSession(null); }}
            disabled={dayPeriods.length === 0}>
            <option value="">{dayPeriods.length === 0 ? 'No periods configured' : 'Select period'}</option>
            {dayPeriods.map(p => <option key={p.order} value={p.order}>{p.name}</option>)}
          </Select>
        </div>
        <div className="mt-4 flex justify-end">
          <Button
            icon={session ? RefreshCw : undefined}
            isLoading={isGenerating}
            disabled={!subjectId || !date || !periodOrder}
            onClick={handleGenerate}
            variant={session ? 'outline' : 'primary'}
          >
            {session ? 'Regenerate QR' : 'Generate QR'}
          </Button>
        </div>
      </Card>

      <AnimatePresence>
        {session && (
          <motion.div
            key="session"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="grid grid-cols-1 gap-6 lg:grid-cols-2"
          >
            {/* QR Card */}
            <Card className="flex flex-col items-center gap-5 p-6">
              <div className="text-center">
                <p className="font-display text-lg font-semibold text-ink">{session.subject?.name}</p>
                <p className="text-sm text-slate">{session.periodName} · {format(new Date(date), 'EEEE, MMM d')}</p>
              </div>

              <div className="relative">
                <AnimatePresence mode="wait">
                  {isExpired ? (
                    <motion.div
                      key="expired"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex h-52 w-52 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-clay/40 bg-clay-light gap-3"
                    >
                      <AlertCircle size={32} className="text-clay" />
                      <p className="font-semibold text-clay">QR Expired</p>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="qr"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="rounded-2xl bg-white p-4 shadow-lg ring-1 ring-ink/8"
                    >
                      <QRCodeSVG value={qrValue} size={196} level="M" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="flex items-center gap-4">
                <CountdownRing totalSeconds={QR_TOTAL_SECS} secondsLeft={timeLeft} />
                <div>
                  {isExpired ? (
                    <Button icon={RefreshCw} onClick={handleGenerate} isLoading={isGenerating}>
                      New QR
                    </Button>
                  ) : (
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 text-sm font-medium text-sage">
                        <Wifi size={14} className="animate-pulse" />
                        Active
                      </div>
                      <p className="text-xs text-slate">Auto-expires in {timeLeft}s</p>
                    </div>
                  )}
                </div>
              </div>

              <p className="text-center text-xs text-slate/60 px-2">
                Students open <strong className="text-ink">{window.location.host}/scan-qr</strong> or scan this QR
              </p>
            </Card>

            {/* Live stats */}
            <Card className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-base font-semibold text-ink">Live attendance</h2>
                {!isExpired && (
                  <Badge variant="present" className="flex items-center gap-1">
                    <Wifi size={11} className="animate-pulse" /> Live
                  </Badge>
                )}
              </div>

              {!stats ? (
                <EmptyState title="Waiting for scans…" message="Students who scan will appear here instantly." />
              ) : (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div className="mb-4 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-sage-light p-4 text-center">
                      <motion.p
                        key={stats.scannedCount}
                        initial={{ scale: 1.3 }} animate={{ scale: 1 }}
                        className="font-display text-3xl font-bold text-sage"
                      >
                        {stats.scannedCount}
                      </motion.p>
                      <p className="text-xs font-medium text-sage/70 mt-0.5">via QR</p>
                    </div>
                    <div className="rounded-2xl bg-ink/5 p-4 text-center">
                      <p className="font-display text-3xl font-bold text-ink">{stats.totalMarked}</p>
                      <p className="text-xs font-medium text-slate mt-0.5">total marked</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto">
                    <AnimatePresence>
                      {stats.scannedStudents?.map(s => (
                        <motion.div
                          key={s._id}
                          initial={{ opacity: 0, x: -12, height: 0 }}
                          animate={{ opacity: 1, x: 0, height: 'auto' }}
                          transition={{ duration: 0.3 }}
                          className="flex items-center gap-2.5 rounded-xl bg-sage-light/60 px-3 py-2"
                        >
                          <CheckCircle2 size={14} className="shrink-0 text-sage" />
                          <p className="text-sm font-medium text-ink">{s.name}</p>
                          {s.registerNumber && (
                            <p className="ml-auto font-mono text-xs text-slate">{s.registerNumber}</p>
                          )}
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
