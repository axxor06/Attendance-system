import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import jsQR from 'jsqr';
import { Camera, CheckCircle, Info, Loader, ScanLine, XCircle } from 'lucide-react';
import { qrApi } from '../../api/registration.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { canonicalRole } from '../../components/layout/navigation.js';
import Button from '../../components/common/Button.jsx';
import Input from '../../components/common/Input.jsx';
import { getFriendlyError } from '../../utils/errorMessages.js';

function tokenFromScanValue(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw, window.location.origin);
    return url.searchParams.get('token') || raw;
  } catch {
    return raw;
  }
}

function readableQrError(error) {
  const message = getFriendlyError(error, 'Unable to validate QR code.');
  const normalized = message.toLowerCase();
  if (normalized.includes('already recorded') || normalized.includes('attendance already') || normalized.includes('already marked')) return 'Attendance has already been recorded.';
  if (normalized.includes('expired')) return 'This attendance session has expired.';
  if (normalized.includes('not enrolled')) return 'You are not enrolled in this class.';
  if (normalized.includes('not for your class') || normalized.includes('wrong class')) return 'This QR code is not for your class.';
  return message;
}

function isLocalhost() {
  return ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
}

export default function ScanQrPage() {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);
  const frameRef = useRef(null);
  const manualInputRef = useRef(null);
  const submittedRef = useRef(false);
  const [manualValue, setManualValue] = useState('');
  const [status, setStatus] = useState('ready');
  const [cameraState, setCameraState] = useState('idle');
  const [scannerMode, setScannerMode] = useState('native');
  const [message, setMessage] = useState('Point your camera at the attendance QR code, or paste its link below.');
  const [cameraError, setCameraError] = useState('');

  const stopCamera = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    detectorRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const focusManualEntry = useCallback(() => {
    manualInputRef.current?.focus();
    manualInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  const submitToken = useCallback(async (value) => {
    const token = tokenFromScanValue(value);
    if (!token || submittedRef.current) return;
    if (!user) {
      setStatus('error');
      setMessage('Please log in first to mark your attendance.');
      return;
    }
    if (canonicalRole(user.role) !== 'user') {
      setStatus('error');
      setMessage('Only students can scan QR attendance codes.');
      return;
    }
    submittedRef.current = true;
    stopCamera();
    setStatus('submitting');
    setMessage('Validating this attendance session…');
    try {
      const { data } = await qrApi.scan(token);
      setStatus('success');
      setCameraState('idle');
      setMessage(data.message || 'Attendance marked successfully.');
    } catch (error) {
      submittedRef.current = false;
      setStatus('error');
      setCameraState('idle');
      setMessage(readableQrError(error));
    }
  }, [stopCamera, user]);

  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraError('');
    setCameraState('requesting');

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState('unavailable');
      setCameraError('Camera scanning is unavailable in this browser. Use the manual QR link field below.');
      return;
    }

    if (!window.isSecureContext && !isLocalhost()) {
      setCameraState('unavailable');
      setCameraError('Camera access requires HTTPS on phones and other devices. Use a secure URL or enter the QR link manually below.');
      return;
    }

    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      setCameraState('granted');

      if (!videoRef.current) throw new Error('Camera preview is unavailable.');
      videoRef.current.srcObject = streamRef.current;
      await videoRef.current.play();

      let detector = null;
      if ('BarcodeDetector' in window) {
        try {
          detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        } catch {
          detector = null;
        }
      }
      detectorRef.current = detector;
      setScannerMode(detector ? 'native' : 'compatibility');
      setStatus('scanning');
      setMessage(detector
        ? 'Hold the QR code inside the frame.'
        : 'Camera scanning is using compatibility mode. Hold the QR code inside the frame.');

      const detect = async () => {
        if (!videoRef.current || submittedRef.current || !streamRef.current) return;
        try {
          const video = videoRef.current;
          if (detectorRef.current) {
            const codes = await detectorRef.current.detect(video);
            if (codes[0]?.rawValue) {
              await submitToken(codes[0].rawValue);
              return;
            }
          } else if (video.videoWidth > 0 && video.videoHeight > 0 && canvasRef.current) {
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const context = canvas.getContext('2d', { willReadFrequently: true });
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const image = context.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(image.data, image.width, image.height, { inversionAttempts: 'attemptBoth' });
            if (code?.data) {
              await submitToken(code.data);
              return;
            }
          }
        } catch {
          // Camera frames can be unavailable while a device switches focus; retry on the next frame.
        }
        frameRef.current = requestAnimationFrame(detect);
      };
      frameRef.current = requestAnimationFrame(detect);
    } catch (error) {
      stopCamera();
      const denied = error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError';
      setCameraState(denied ? 'denied' : 'unavailable');
      setCameraError(denied
        ? 'Camera permission is required. Allow camera access or use the manual QR link field below.'
        : 'Unable to start the camera. Check the device camera and use the manual QR link field if needed.');
    }
  }, [stopCamera, submitToken]);

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) submitToken(token);
    return stopCamera;
  }, [searchParams, stopCamera, submitToken]);

  function resetScanner() {
    stopCamera();
    submittedRef.current = false;
    setStatus('ready');
    setCameraState('idle');
    setMessage('Point your camera at the attendance QR code, or paste its link below.');
    setCameraError('');
  }

  const icon = status === 'success' ? <CheckCircle size={42} className="text-sage" />
    : status === 'error' ? <XCircle size={42} className="text-clay" />
      : status === 'submitting' ? <Loader size={42} className="animate-spin text-amber" />
        : <ScanLine size={42} className="text-amber" />;

  const cameraStatusMessage = cameraState === 'requesting'
    ? 'Requesting camera permission…'
    : cameraState === 'granted'
      ? scannerMode === 'native' ? 'Native QR detection active.' : 'Compatibility QR detection active.'
      : cameraState === 'denied'
        ? 'Camera permission was denied.'
        : '';

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4 py-8">
      <div className="w-full max-w-lg rounded-2xl border border-line bg-cream p-6 text-center shadow-[0_18px_48px_rgba(79,70,165,0.12)] sm:p-8">
        <div className={`mb-4 flex justify-center ${status === 'success' ? 'animate-[pulse_1.2s_ease-out_1]' : ''}`}>{icon}</div>
        <h1 className="font-display text-xl font-semibold text-ink">
          {status === 'success' ? 'Attendance marked' : status === 'error' ? 'QR could not be used' : 'Scan attendance QR'}
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate">{message}</p>

        {status !== 'success' && (
          <>
            <div className="mt-6 overflow-hidden rounded-2xl border border-ink/10 bg-indigo/5">
              <video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline aria-label="QR camera preview" />
              <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
              {status !== 'scanning' && (
                <div className="flex aspect-video items-center justify-center px-6 text-center text-sm text-slate">
                  <div><Camera size={28} className="mx-auto mb-2 text-ink/45" /><p>Camera preview appears here after permission is granted.</p></div>
                </div>
              )}
            </div>
            {cameraStatusMessage && <p className="mt-3 text-left text-xs text-slate" role="status">{cameraStatusMessage}</p>}
            {cameraError && <p className="mt-3 rounded-xl border border-amber/25 bg-amber-light/70 px-3 py-2 text-left text-xs text-ink" role="alert">{cameraError}</p>}
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Button type="button" className="flex-1" onClick={startCamera} icon={Camera} disabled={status === 'submitting' || status === 'scanning'}>
                {status === 'scanning' ? 'Camera active' : 'Try camera again'}
              </Button>
              {cameraError && <Button type="button" variant="outline" className="flex-1" onClick={focusManualEntry} disabled={status === 'submitting'}>Enter QR link manually</Button>}
            </div>
            <div className="my-5 flex items-center gap-3 text-xs text-slate"><span className="h-px flex-1 bg-indigo/10" />Or use the QR link<span className="h-px flex-1 bg-indigo/10" /></div>
            <div className="text-left"><Input ref={manualInputRef} label="QR link or token" value={manualValue} onChange={(event) => setManualValue(event.target.value)} placeholder="Paste the QR link" /></div>
            <Button type="button" variant="outline" className="mt-3 w-full" onClick={() => submitToken(manualValue)} disabled={!manualValue.trim() || status === 'submitting'} icon={ScanLine}>Validate QR</Button>
            <p className="mt-4 flex items-start gap-2 text-left text-xs leading-5 text-slate"><Info size={15} className="mt-0.5 shrink-0 text-amber" />Camera access usually requires HTTPS or localhost. If native detection is unavailable, this page uses a client-side compatibility decoder. The server still validates the session, expiry, class, subject, enrollment, and authenticated student before recording attendance.</p>
          </>
        )}

        {status === 'success' && <div className="mt-6"><Link to="/student"><Button className="w-full">Go to dashboard</Button></Link></div>}
        {status === 'error' && <div className="mt-4 flex gap-3"><Button type="button" variant="outline" className="flex-1" onClick={resetScanner}>Try again</Button><Link to="/student" className="flex-1"><Button className="w-full">Dashboard</Button></Link></div>}
      </div>
    </div>
  );
}
