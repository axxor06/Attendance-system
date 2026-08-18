import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import AuthLayout from '../../components/layout/AuthLayout.jsx';
import Input from '../../components/common/Input.jsx';
import Button from '../../components/common/Button.jsx';
import { authApi } from '../../api/auth.js';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setIsLoading(true);
    try {
      await authApi.forgotPassword({ email });
      toast.success('If an account exists, a reset code has been sent.');
      navigate('/reset-password', { state: { email } });
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthLayout title="Forgot your password?" subtitle="We'll send a reset code to your email">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Email address"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button type="submit" isLoading={isLoading} className="w-full">
          Send reset code
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate">
        <Link to="/login" className="font-medium text-ink hover:underline">Back to sign in</Link>
      </p>
    </AuthLayout>
  );
}
