import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, Mail } from 'lucide-react';
import AuthLayout from '../../components/layout/AuthLayout.jsx';
import Input from '../../components/common/Input.jsx';
import Button from '../../components/common/Button.jsx';
import { authApi } from '../../api/auth.js';
import { getFriendlyError } from '../../utils/errorMessages.js';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await authApi.forgotPassword({ email: email.trim() });
      setSent(true);
    } catch (err) {
      setError(getFriendlyError(err, 'We could not start the reset flow. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthLayout title={sent ? 'Check your inbox' : 'Forgot your password?'} subtitle={sent ? 'Use the secure code from your email to choose a new password.' : 'We will send a secure, expiring reset code to your email.'}>
      {sent ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3 rounded-xl border border-sage/20 bg-sage-light/70 p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sage text-white"><CheckCircle2 size={18} /></div>
            <div><p className="text-sm font-semibold text-ink">Reset code sent</p><p className="mt-1 text-sm leading-6 text-slate">If an account matches <span className="font-semibold text-ink">{email.trim()}</span>, a reset code is on its way.</p></div>
          </div>
          <div className="rounded-xl border border-line bg-paper p-4 text-sm leading-6 text-slate"><div className="flex items-center gap-2 font-semibold text-ink"><Mail size={16} className="text-amber" /> Next step</div><p className="mt-2">Enter the code on the next screen. It expires for your protection and can only be used once.</p></div>
          <Button type="button" variant="primary" onClick={() => navigate('/reset-password', { state: { email: email.trim() } })} className="w-full">Enter reset code</Button>
          <button type="button" onClick={() => { setSent(false); setError(''); }} className="text-sm font-semibold text-slate transition-colors hover:text-amber">Use a different email</button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input label="Email address" type="email" required value={email} onChange={(event) => { setEmail(event.target.value); setError(''); }} hint="Use the email address attached to your college account." />
          {error && <p className="rounded-xl border border-clay/20 bg-clay-light px-3.5 py-2.5 text-sm text-clay" role="alert">{error}</p>}
          <Button type="submit" isLoading={isLoading} className="w-full">Send reset code</Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm text-slate"><Link to="/login" className="font-medium text-ink transition-colors hover:text-amber">Back to sign in</Link></p>
    </AuthLayout>
  );
}
