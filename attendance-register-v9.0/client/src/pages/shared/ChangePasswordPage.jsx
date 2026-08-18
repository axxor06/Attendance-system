import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { KeyRound, Eye, EyeOff } from 'lucide-react';
import { authApi } from '../../api/auth.js';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import { fadeUp, staggerContainer, staggerItem } from '../../utils/motion.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { getPasswordChecks, isStrongPassword, PASSWORD_POLICY_MESSAGE, PASSWORD_POLICY_HINT } from '../../utils/passwordPolicy.js';

function PasswordInput({ label, name, value, onChange, hint }) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-ink/80">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          name={name}
          required
          minLength={12}
          value={value}
          onChange={onChange}
          className="w-full rounded-xl border border-ink/15 bg-white px-3.5 py-2.5 pr-10 text-sm text-ink placeholder:text-slate/60 focus:border-ink/40 focus:outline-none transition-colors"
        />
        <button
          type="button"
          onClick={() => setShow(v => !v)}
          aria-label={show ? 'Hide password' : 'Show password'}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {hint && <p className="text-xs text-slate">{hint}</p>}
    </div>
  );
}

function StrengthBar({ password }) {
  const passwordChecks = getPasswordChecks(password);
  const checks = [
    passwordChecks.length,
    passwordChecks.uppercase,
    passwordChecks.lowercase,
    passwordChecks.number,
    passwordChecks.symbol,
  ];
  const score = checks.filter(Boolean).length;
  const colors = ['', 'bg-clay', 'bg-clay', 'bg-amber', 'bg-amber', 'bg-sage'];
  const labels = ['', 'Weak', 'Weak', 'Fair', 'Good', 'Strong'];

  if (!password) return null;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-1">
        {[1,2,3,4,5].map(i => (
          <motion.div
            key={i}
            className={`h-1.5 flex-1 rounded-full ${i <= score ? colors[score] : 'bg-ink/10'}`}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: i * 0.05 }}
          />
        ))}
      </div>
      {score > 0 && (
        <p className={`text-xs font-medium ${score <= 1 ? 'text-clay' : score <= 2 ? 'text-amber' : 'text-sage'}`}>
          {labels[score]} password
        </p>
      )}
    </div>
  );
}

export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (form.newPassword !== form.confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    if (!isStrongPassword(form.newPassword)) {
      setError(PASSWORD_POLICY_MESSAGE);
      return;
    }
    setIsLoading(true);
    try {
      await authApi.changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword });
      await logout();
      toast.success('Password changed successfully. Please sign in again.');
      navigate('/login', { replace: true, state: { message: 'Your password was changed. Please sign in again.' } });
    } catch (err) {
      setError(err.response?.data?.message || 'Could not change password.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <motion.div className="flex flex-col gap-6 max-w-lg" {...fadeUp}>
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">Change Password</h1>
        <p className="mt-1 text-sm text-slate">Update your account password securely</p>
      </div>

      <Card className="p-6">
        <motion.form
          onSubmit={handleSubmit}
          className="flex flex-col gap-5"
          variants={staggerContainer}
          initial="initial"
          animate="animate"
        >
          <motion.div variants={staggerItem}>
            <PasswordInput
              label="Current password"
              name="currentPassword"
              value={form.currentPassword}
              onChange={handleChange}
            />
          </motion.div>

          <motion.div variants={staggerItem} className="border-t border-ink/8 pt-4">
            <PasswordInput
              label="New password"
              name="newPassword"
              value={form.newPassword}
              onChange={handleChange}
              hint={PASSWORD_POLICY_HINT}
            />
            <div className="mt-2">
              <StrengthBar password={form.newPassword} />
            </div>
          </motion.div>

          <motion.div variants={staggerItem}>
            <PasswordInput
              label="Confirm new password"
              name="confirmPassword"
              value={form.confirmPassword}
              onChange={handleChange}
            />
            {form.confirmPassword && form.newPassword !== form.confirmPassword && (
              <p className="mt-1 text-xs text-clay">Passwords do not match</p>
            )}
          </motion.div>

          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-xl bg-clay-light px-3.5 py-2.5 text-sm text-clay"
            >
              {error}
            </motion.p>
          )}


          <motion.div variants={staggerItem}>
            <Button
              type="submit"
              isLoading={isLoading}
              icon={KeyRound}
              disabled={!form.currentPassword || !form.newPassword || form.newPassword !== form.confirmPassword}
              className="w-full"
            >
              Update password
            </Button>
          </motion.div>
        </motion.form>
      </Card>

      <div className="rounded-2xl border border-ink/8 bg-white p-4">
        <p className="text-xs font-semibold text-ink mb-2">Password tips</p>
        <ul className="space-y-1 text-xs text-slate">
          <li>• At least 12 characters long</li>
          <li>• Include uppercase letters (A–Z)</li>
          <li>• Include lowercase letters (a–z)</li>
          <li>• Include a number (0–9)</li>
          <li>• Include a symbol (!@#$…)</li>
        </ul>
      </div>
    </motion.div>
  );
}
