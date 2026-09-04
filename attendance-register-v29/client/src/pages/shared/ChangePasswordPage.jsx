import { useState } from 'react';
import { motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { KeyRound } from 'lucide-react';
import { authApi } from '../../api/auth.js';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import PasswordField from '../../components/common/PasswordField.jsx';
import { fadeUp, staggerContainer, staggerItem } from '../../utils/motion.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { isStrongPassword, PASSWORD_POLICY_MESSAGE, PASSWORD_POLICY_HINT } from '../../utils/passwordPolicy.js';
import { getFriendlyError } from '../../utils/errorMessages.js';

export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  function handleChange(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
    setError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    if (!isStrongPassword(form.newPassword)) {
      setError(PASSWORD_POLICY_MESSAGE);
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      setError('Passwords do not match. Re-enter the confirmation password.');
      return;
    }
    setIsLoading(true);
    try {
      await authApi.changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword });
      await logout();
      toast.success('Password changed successfully. Please sign in again.');
      navigate('/login', { replace: true, state: { message: 'Your password was changed. Please sign in again.' } });
    } catch (err) {
      setError(getFriendlyError(err, 'Could not change password. Please verify your current password and try again.'));
    } finally {
      setIsLoading(false);
    }
  }

  const isReady = Boolean(form.currentPassword && isStrongPassword(form.newPassword) && form.newPassword === form.confirmPassword);

  return (
    <motion.div className="flex max-w-lg flex-col gap-6" {...fadeUp}>
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">Change password</h1>
        <p className="mt-1 text-sm text-slate">Update your account password securely. Your session will end after the change.</p>
      </div>

      {location.state?.firstLogin && (
        <div className="rounded-xl border border-amber/25 bg-amber-light/70 px-4 py-3 text-sm text-ink" role="status">
          Your account uses an initial password. Change it now before continuing to your workspace.
        </div>
      )}

      <Card className="p-6">
        <motion.form onSubmit={handleSubmit} className="flex flex-col gap-5" variants={staggerContainer} initial="initial" animate="animate">
          <motion.div variants={staggerItem}>
            <PasswordField label="Current password" name="currentPassword" value={form.currentPassword} onChange={handleChange} />
          </motion.div>
          <motion.div variants={staggerItem} className="border-t border-ink/8 pt-4">
            <PasswordField
              label="New password"
              name="newPassword"
              value={form.newPassword}
              onChange={handleChange}
              confirmName="confirmPassword"
              confirmValue={form.confirmPassword}
              onConfirmChange={handleChange}
              hint={PASSWORD_POLICY_HINT}
            />
          </motion.div>

          {error && <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-clay-light px-3.5 py-2.5 text-sm text-clay" role="alert">{error}</motion.p>}

          <motion.div variants={staggerItem}>
            <Button type="submit" isLoading={isLoading} icon={KeyRound} disabled={!isReady || isLoading} className="w-full">
              Update password
            </Button>
          </motion.div>
        </motion.form>
      </Card>
    </motion.div>
  );
}
