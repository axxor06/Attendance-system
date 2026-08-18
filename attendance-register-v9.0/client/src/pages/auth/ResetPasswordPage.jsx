import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { CheckCircle2, KeyRound, ShieldCheck } from 'lucide-react';
import AuthLayout from '../../components/layout/AuthLayout.jsx';
import Input from '../../components/common/Input.jsx';
import OtpInput from '../../components/auth/OtpInput.jsx';
import Button from '../../components/common/Button.jsx';
import { authApi } from '../../api/auth.js';
import { isStrongPassword, PASSWORD_POLICY_MESSAGE, PASSWORD_POLICY_HINT } from '../../utils/passwordPolicy.js';

export default function ResetPasswordPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState(location.state?.email || '');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState(1);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function verifyCode(event) {
    event.preventDefault();
    setError('');
    if (otp.length < 4) {
      setError('Enter the reset code from your email.');
      return;
    }
    setIsLoading(true);
    try {
      await authApi.verifyResetOtp({ email: email.trim(), otp });
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || 'That reset code is invalid or expired.');
    } finally {
      setIsLoading(false);
    }
  }

  async function resetPassword(event) {
    event.preventDefault();
    setError('');
    if (!isStrongPassword(newPassword)) {
      setError(PASSWORD_POLICY_MESSAGE);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }
    setIsLoading(true);
    try {
      await authApi.resetPassword({ email: email.trim(), otp, newPassword });
      toast.success('Password reset. Please sign in.');
      navigate('/login', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Reset failed. Please verify the code again.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthLayout title={step === 1 ? 'Verify your reset code' : 'Choose a new password'} subtitle={step === 1 ? 'Confirm the code from your email before setting a new password.' : 'Use a strong password you have not used before.'}>
      <div className="mb-6 flex items-center gap-2 text-xs font-semibold text-slate">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 ${step === 1 ? 'bg-ink text-paper' : 'bg-sage-light text-sage'}`}><ShieldCheck size={13} /> 1. Verify code</span>
        <span className="h-px w-6 bg-ink/12" />
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 ${step === 2 ? 'bg-ink text-paper' : 'bg-ink/5 text-slate'}`}><KeyRound size={13} /> 2. New password</span>
      </div>

      {step === 1 ? (
        <form onSubmit={verifyCode} className="flex flex-col gap-5">
          {!location.state?.email && <Input label="Email address" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />}
          <div>
            <label className="mb-2 block text-sm font-medium text-ink/80">Reset code</label>
            <OtpInput value={otp} onChange={setOtp} />
          </div>
          {error && <p className="rounded-2xl border border-clay/20 bg-clay-light px-3.5 py-2.5 text-sm text-clay" role="alert">{error}</p>}
          <Button type="submit" isLoading={isLoading} disabled={!email.trim() || otp.length < 4} className="w-full">Verify code</Button>
        </form>
      ) : (
        <form onSubmit={resetPassword} className="flex flex-col gap-5">
          <div className="flex items-center gap-2 rounded-2xl border border-sage/20 bg-sage-light/75 px-4 py-3 text-sm text-sage"><CheckCircle2 size={17} /> Code verified for {email}</div>
          <Input label="New password" type="password" required minLength={12} hint={PASSWORD_POLICY_HINT} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
          <Input label="Confirm new password" type="password" required minLength={12} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
          {error && <p className="rounded-2xl border border-clay/20 bg-clay-light px-3.5 py-2.5 text-sm text-clay" role="alert">{error}</p>}
          <div className="flex gap-3"><Button type="button" variant="ghost" onClick={() => setStep(1)}>Back</Button><Button type="submit" icon={KeyRound} isLoading={isLoading} disabled={!newPassword || newPassword !== confirmPassword} className="flex-1">Set new password</Button></div>
        </form>
      )}
    </AuthLayout>
  );
}
