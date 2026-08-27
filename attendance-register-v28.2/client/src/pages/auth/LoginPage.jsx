import { getFriendlyError } from '../../utils/errorMessages.js';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight, LockKeyhole, Mail } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import AuthLayout from '../../components/layout/AuthLayout.jsx';
import Input from '../../components/common/Input.jsx';
import Button from '../../components/common/Button.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { staggerContainer, staggerItem } from '../../utils/motion.js';
import { getHomePath } from '../../components/layout/navigation.js';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ identifier: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const user = await login(form.identifier.trim(), form.password);
      if (user.requiresPasswordChange) {
        toast('Signed in. Please change your initial password to continue.', { icon: '!' });
      } else {
        toast.success(`Welcome back, ${user.name}`);
      }
      navigate(getHomePath(user.role), { replace: true });
    } catch (err) {
      if (err.response?.status === 429) {
        const retryAfterSeconds = Number(err.response.headers?.['retry-after']);
        const retryMessage = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
          ? ` Please wait about ${Math.max(1, Math.ceil(retryAfterSeconds / 60))} minute${retryAfterSeconds >= 120 ? 's' : ''}.`
          : ' Please wait a few minutes before trying again.';
        setError(`Too many sign-in attempts.${retryMessage}`);
      } else {
        setError(getFriendlyError(err, 'Invalid credentials. Check your details and try again.'));
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthLayout title="Sign in to continue" subtitle="Use your college email or register number. Your role and workspace are detected automatically.">
      <motion.form
        onSubmit={handleSubmit}
        className="flex flex-col gap-5"
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >
        <motion.div variants={staggerItem}>
          <Input
            label="Email or register number"
            name="identifier"
            autoComplete="username"
            required
            icon={Mail}
            placeholder="you@college.edu or 23CSE045"
            value={form.identifier}
            onChange={(event) => setForm({ ...form, identifier: event.target.value })}
          />
        </motion.div>

        <motion.div variants={staggerItem}>
          <Input
            label="Password"
            type={showPassword ? 'text' : 'password'}
            name="password"
            autoComplete="current-password"
            required
            icon={LockKeyhole}
            placeholder="Enter your password"
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
            endAdornment={(
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                className="rounded-lg p-1 text-slate transition-colors hover:bg-indigo/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            )}
          />
        </motion.div>

        <motion.div variants={staggerItem} className="flex items-center justify-between gap-4">
          <span className="text-xs text-slate/70">Use your college account to sign in.</span>
          <Link to="/forgot-password" className="shrink-0 text-sm font-semibold text-ink transition-colors hover:text-amber">Forgot password?</Link>
        </motion.div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[14px] border border-clay/20 bg-clay-light/70 px-4 py-3 text-sm leading-6 text-clay"
            role="alert"
          >
            {error}
          </motion.div>
        )}

        <motion.div variants={staggerItem}>
          <Button type="submit" isLoading={isLoading} icon={ArrowRight} className="w-full" size="lg">
            Sign in
          </Button>
        </motion.div>
      </motion.form>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.42, duration: 0.35 }}
        className="mt-8 border-t border-ink/10 pt-5 text-center text-sm text-slate"
      >
        <p>
          New applicant?{' '}
          <Link to="/request-registration?role=student" className="font-semibold text-ink hover:text-amber">Request student access</Link>
          {' · '}
          <Link to="/request-registration?role=faculty" className="font-semibold text-ink hover:text-amber">Request faculty access</Link>
        </p>
        <p className="mt-2 text-xs text-slate/75">
          Already requested access?{' '}
          <Link to="/check-request-status" className="font-semibold text-ink hover:text-amber">Check request status</Link>
        </p>
      </motion.div>
    </AuthLayout>
  );
}
