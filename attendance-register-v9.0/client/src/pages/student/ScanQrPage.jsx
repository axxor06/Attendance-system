import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle, XCircle, Loader } from 'lucide-react';
import { qrApi } from '../../api/registration.js';
import { useAuth } from '../../context/AuthContext.jsx';
import Button from '../../components/common/Button.jsx';

export default function ScanQrPage() {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const token = searchParams.get('token');

  const [status, setStatus] = useState('scanning'); // 'scanning' | 'success' | 'error'
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) { setStatus('error'); setMessage('No QR token found in this link.'); return; }
    if (!user) { setStatus('error'); setMessage('Please log in first to mark your attendance.'); return; }
    if (user.role !== 'student') { setStatus('error'); setMessage('Only students can scan QR attendance codes.'); return; }

    qrApi.scan(token)
      .then(({ data }) => { setStatus('success'); setMessage(data.message); })
      .catch(err => { setStatus('error'); setMessage(err.response?.data?.message || 'Could not mark attendance.'); });
  }, [token, user]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm rounded-2xl border border-ink/10 bg-white p-8 text-center shadow-xl">
        <div className="mb-4 flex justify-center">
          {status === 'scanning' && <Loader size={48} className="animate-spin text-amber" />}
          {status === 'success' && <CheckCircle size={48} className="text-sage" />}
          {status === 'error' && <XCircle size={48} className="text-clay" />}
        </div>

        <h1 className="font-display text-xl font-semibold text-ink">
          {status === 'scanning' && 'Marking attendance…'}
          {status === 'success' && 'Attendance Marked!'}
          {status === 'error' && 'Could not mark attendance'}
        </h1>

        <p className="mt-2 text-sm text-slate">{message}</p>

        {(status === 'success' || status === 'error') && (
          <div className="mt-6">
            <Link to="/student">
              <Button className="w-full">Go to dashboard</Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
