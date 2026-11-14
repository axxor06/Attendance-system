import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import jsQR from 'jsqr';
import { AlertCircle, Camera, CheckCircle2, Clock, KeyRound, ScanLine } from 'lucide-react';
import clsx from 'clsx';
import { qrApi } from '../../api/registration.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { canonicalRole } from '../../components/layout/navigation.js';
import Button from '../../components/common/Button.jsx';
import { requestBadgeRefresh } from '../../context/BadgeContext.jsx';
import { getFriendlyError } from '../../utils/errorMessages.js';
import { classifyScanError, extractCodeFromScan, formatCodeForDisplay, isCompleteCode, normalizeCodeInput } from '../../utils/attendanceCode.js';

const COPY = {
  invalid: { title: 'Code not recognised', tone: 'error', hint: 'Check the code on the screen and try again.' },
  expired: { title: 'Code expired', tone: 'error', hint: 'Ask your faculty to generate a new code.' },
  already: { title: 'Already marked', tone: 'info', hint: null },
  'not-allowed': { title: 'Cannot mark attendance', tone: 'error', hint: null },
  'rate-limited': { title: 'Too many attempts', tone: 'error', hint: 'Wait a few minutes before trying again.' },
  network: { title: 'No connection', tone: 'error', hint: 'Check your internet connection and try again.' },
  error: { title: 'Something went wrong', tone: 'error', hint: 'Please try again.' },
};

const CAMERA_PROBLEM = {
  denied: 'Camera access is blocked. Allow it in your browser settings, or enter the code instead.',
  unavailable: 'The camera could not be started. Enter the code instead.',
};

export default function ScanQrPage() {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const frameRef = useRef(null);
  const busyRef = useRef(false);
  const inputRef = useRef(null);
  const [mode, setMode] = useState('code');
  const [code, setCode] = useState('');
  const [phase, setPhase] = useState('idle'); // idle | submitting | success | failed
  const [result, setResult] = useState(null);
  const [failure, setFailure] = useState(null);
  const [cameraState, setCameraState] = useState('off'); // off | starting | on | denied | unavailable

  const stopCamera = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const submitCode = useCallback(async (value) => {
    const normalized = extractCodeFromScan(value);
    if (busyRef.current) return;
    if (normalized.length !== 8) {
      setFailure({ kind: 'invalid', message: 'Attendance codes have 8 letters and numbers.' });
      setPhase('failed');
      return;
    }
    busyRef.current = true;
    stopCamera();
    setCameraState('off');
    setPhase('submitting');
    setFailure(null);
    try {
      const { data } = await qrApi.scan(normalized);
      setResult(data?.data || {});
      setPhase('success');
      requestBadgeRefresh();
    } catch (error) {
      setFailure({ kind: classifyScanError(error), message: getFriendlyError(error, 'The code could not be validated.') });
      setPhase('failed');
    } finally {
      busyRef.current = false;
    }
  }, [stopCamera]);

  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraState('starting');
    if (!navigator.mediaDevices?.getUserMedia) { setCameraState('unavailable'); return; }
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      const video = videoRef.current;
      if (!video) { stopCamera(); return; }
      video.srcObject = streamRef.current;
      await video.play();
      setCameraState('on');
      let detector = null;
      if ('BarcodeDetector' in window) {
        try { detector = new window.BarcodeDetector({ formats: ['qr_code'] }); } catch { detector = null; }
      }
      const tick = async () => {
        if (!streamRef.current || busyRef.current) return;
        try {
          let raw = '';

          // First try the browser's native QR detector.
          if (detector) {
            try {
              const found = await detector.detect(video);
              raw = found[0]?.rawValue || '';
            } catch {
              raw = '';
            }
          }

          // Validate the native result before accepting it.
          let normalized = raw ? extractCodeFromScan(raw) : '';

          // Try jsQR if native detection fails or returns an invalid code.
          if (normalized.length !== 8 && video.videoWidth > 0 && canvasRef.current) {
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const context = canvas.getContext('2d', { willReadFrequently: true });
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const image = context.getImageData(0, 0, canvas.width, canvas.height);
            const result = jsQR(
              image.data,
              image.width,
              image.height,
              { inversionAttempts: 'attemptBoth' }
            );

            if (result?.data) {
              raw = result.data;
              normalized = extractCodeFromScan(raw);
            }
          }

          if (normalized.length === 8) {
            await submitCode(normalized);
            return;
          }
        } catch { /* a frame can fail while the camera refocuses; try the next one */ }

        if (streamRef.current && !busyRef.current) {
          frameRef.current = requestAnimationFrame(tick);
        }
      };
      frameRef.current = requestAnimationFrame(tick);
    } catch (error) {
      stopCamera();
      setCameraState(error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError' ? 'denied' : 'unavailable');
    }
  }, [stopCamera, submitCode]);

  // Links like /scan-qr?code=K7M2P9Q4 (from a phone's own camera app) submit automatically.
  useEffect(() => {
    const fromLink = searchParams.get('code') || searchParams.get('token');
    if (fromLink && user && canonicalRole(user.role) === 'user') submitCode(fromLink);
  }, [searchParams, user, submitCode]);

  useEffect(() => stopCamera, [stopCamera]);
  useEffect(() => { if (mode === 'code') { stopCamera(); setCameraState('off'); } }, [mode, stopCamera]);

  function reset() {
    setPhase('idle');
    setFailure(null);
    setResult(null);
    setCode('');
    if (mode === 'code') requestAnimationFrame(() => inputRef.current?.focus());
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (isCompleteCode(code) && phase !== 'submitting') submitCode(code);
  }

  if (!user) {
    return (
      <div className="mx-auto w-full max-w-md rounded-lg border border-line bg-surface p-6 text-center">
        <h1 className="font-display text-xl font-semibold text-ink">Sign in to mark attendance</h1>
        <p className="mt-2 text-sm text-slate">Attendance can only be recorded for a signed-in student.</p>
        <Link to="/login" className="mt-5 inline-block"><Button>Sign in</Button></Link>
      </div>
    );
  }
  if (canonicalRole(user.role) !== 'user') {
    return (
      <div className="mx-auto w-full max-w-md rounded-lg border border-line bg-surface p-6 text-center">
        <h1 className="font-display text-xl font-semibold text-ink">Students only</h1>
        <p className="mt-2 text-sm text-slate">Only students can mark attendance with a code.</p>
      </div>
    );
  }

  if (phase === 'success') {
    return (
      <div className="mx-auto w-full max-w-md rounded-lg border border-sage/30 bg-surface p-6 text-center sm:p-8" role="status">
        <CheckCircle2 className="mx-auto text-sage" size={44} aria-hidden="true" />
        <h1 className="mt-4 font-display text-xl font-semibold text-ink">You are marked present</h1>
        {result?.subject?.name && <p className="mt-2 text-sm text-slate">{result.subject.name}{result.periodName ? ` · ${result.periodName}` : ''}</p>}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Link to="/student" className="flex-1"><Button className="w-full">Go to dashboard</Button></Link>
          <Link to="/student/attendance" className="flex-1"><Button variant="outline" className="w-full">View attendance</Button></Link>
        </div>
      </div>
    );
  }

  const copy = failure ? COPY[failure.kind] || COPY.error : null;
  const submitting = phase === 'submitting';

  return (
    <div className="mx-auto w-full max-w-lg">
      <header className="mb-5">
        <h1 className="font-display text-2xl font-semibold text-ink">Mark attendance</h1>
        <p className="mt-1 text-sm text-slate">Enter the 8-character code your faculty shows in class, or scan the QR code.</p>
      </header>

      <div className="rounded-lg border border-line bg-surface">
        <div className="grid grid-cols-2 border-b border-line" role="tablist" aria-label="How to mark attendance">
          {[['code', 'Enter code', KeyRound], ['scan', 'Scan QR', ScanLine]].map(([value, label, Icon]) => (
            <button key={value} type="button" role="tab" aria-selected={mode === value} disabled={submitting}
              onClick={() => { setMode(value); setFailure(null); setPhase('idle'); if (value === 'scan') startCamera(); }}
              className={clsx('flex min-h-12 items-center justify-center gap-2 border-b-2 text-sm font-semibold transition-colors', mode === value ? 'border-accent text-ink' : 'border-transparent text-slate hover:text-ink')}>
              <Icon size={16} aria-hidden="true" />{label}
            </button>
          ))}
        </div>

        <div className="p-5 sm:p-6">
          {failure && (
            <div className={clsx('mb-5 flex gap-3 rounded-md border p-3.5 text-sm', copy.tone === 'info' ? 'border-indigo/30 bg-indigo-light text-ink' : 'border-clay/30 bg-clay-light text-ink')} role="alert">
              {copy.tone === 'info' ? <Clock size={18} className="mt-0.5 shrink-0 text-indigo" aria-hidden="true" /> : <AlertCircle size={18} className="mt-0.5 shrink-0 text-clay" aria-hidden="true" />}
              <div className="min-w-0">
                <p className="font-semibold">{copy.title}</p>
                <p className="mt-0.5 break-words text-ink-light">{failure.message}</p>
                {copy.hint && <p className="mt-1 text-xs text-slate">{copy.hint}</p>}
                {failure.kind === 'already' && <Link to="/student/attendance" className="mt-2 inline-block text-xs font-semibold text-accent hover:underline">View my attendance</Link>}
              </div>
            </div>
          )}

          {mode === 'code' ? (
            <form onSubmit={handleSubmit} noValidate>
              <label htmlFor="attendance-code" className="text-sm font-medium text-ink-light">Attendance code</label>
              <input
                id="attendance-code" ref={inputRef} value={formatCodeForDisplay(code)}
                onChange={(event) => { setCode(normalizeCodeInput(event.target.value)); if (failure) { setFailure(null); setPhase('idle'); } }}
                onPaste={(event) => { event.preventDefault(); setCode(extractCodeFromScan(event.clipboardData.getData('text'))); }}
                inputMode="text" autoComplete="off" autoCapitalize="characters" autoCorrect="off" spellCheck={false} maxLength={9}
                placeholder="K7M2 P9Q4" disabled={submitting} aria-describedby="attendance-code-hint"
                className="field field-lg mt-1.5 text-center font-mono text-2xl font-semibold uppercase tracking-[0.25em] sm:text-3xl"
              />
              <p id="attendance-code-hint" className="mt-2 text-xs text-slate">8 letters and numbers. Spaces and lowercase are fine.</p>
              <Button type="submit" size="lg" className="mt-5 w-full" isLoading={submitting} disabled={!isCompleteCode(code) || submitting}>
                {submitting ? 'Validating…' : 'Validate & Mark Attendance'}
              </Button>
            </form>
          ) : (
            <div>
              <div className="relative overflow-hidden rounded-md bg-nav-deep">
                <video ref={videoRef} className={clsx('aspect-square w-full object-cover sm:aspect-video', cameraState !== 'on' && 'invisible')} muted playsInline aria-label="Camera preview" />
                <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
                {cameraState === 'on' && <div className="pointer-events-none absolute inset-[18%] rounded-lg border-2 border-white/80" aria-hidden="true" />}
                {cameraState !== 'on' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center text-sm text-white/80">
                    <Camera size={26} aria-hidden="true" />
                    <p>{cameraState === 'starting' ? 'Starting camera…' : submitting ? 'Validating…' : 'Camera is off'}</p>
                  </div>
                )}
              </div>
              <p className="mt-3 text-center text-xs text-slate" role="status">{cameraState === 'on' ? 'Hold the QR code inside the frame.' : ''}</p>
              {(cameraState === 'denied' || cameraState === 'unavailable') && (
                <div className="mt-3 rounded-md border border-amber/30 bg-amber-light p-3 text-sm text-ink" role="alert">{CAMERA_PROBLEM[cameraState]}</div>
              )}
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                {cameraState !== 'on' && <Button type="button" className="flex-1" icon={Camera} onClick={startCamera} disabled={submitting || cameraState === 'starting'}>{cameraState === 'denied' || cameraState === 'unavailable' ? 'Try camera again' : 'Start camera'}</Button>}
                <Button type="button" variant="outline" className="flex-1" icon={KeyRound} onClick={() => setMode('code')} disabled={submitting}>Enter code instead</Button>
              </div>
            </div>
          )}

          {failure && failure.kind !== 'invalid' && failure.kind !== 'network' && failure.kind !== 'rate-limited' && (
            <Button type="button" variant="ghost" size="sm" className="mt-3" onClick={reset}>Start over</Button>
          )}
        </div>
      </div>
    </div>
  );
}
