import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import AuthLayout from '../../components/layout/AuthLayout.jsx';
import OtpInput from '../../components/auth/OtpInput.jsx';
import Button from '../../components/common/Button.jsx';
import Input from '../../components/common/Input.jsx';
import { authApi } from '../../api/auth.js';

export default function VerifyEmailPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const [email, setEmail] = useState(location.state?.email || '');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await authApi.verifyEmail({ email, otp });
      toast.success('Email verified! You can now log in.');
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.message || 'Verification failed.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResend() {
    if (!email) {
      setError('Enter your email first.');
      return;
    }
    setIsResending(true);
    try {
      await authApi.resendOtp({ email, purpose: 'email_verification' });
      toast.success('A new code has been sent.');
    } catch {
      toast.error('Could not resend code. Try again shortly.');
    } finally {
      setIsResending(false);
    }
  }

  return (
    <AuthLayout title="Verify your email" subtitle="Enter the 6-digit code we sent to your inbox">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {!location.state?.email && (
          <Input
            label="Email address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        )}

        <div>
          <label className="mb-2 block text-sm font-medium text-ink/80">Verification code</label>
          <OtpInput value={otp} onChange={setOtp} />
        </div>

        {error && (
          <p className="rounded-xl bg-clay-light px-3.5 py-2.5 text-sm text-clay">{error}</p>
        )}

        <Button type="submit" isLoading={isLoading} disabled={otp.length !== 6} className="w-full">
          Verify email
        </Button>

        <button
          type="button"
          onClick={handleResend}
          disabled={isResending}
          className="text-sm font-medium text-ink/60 hover:text-ink disabled:opacity-50"
        >
          {isResending ? 'Sending...' : "Didn't get a code? Resend"}
        </button>
      </form>
    </AuthLayout>
  );
}
