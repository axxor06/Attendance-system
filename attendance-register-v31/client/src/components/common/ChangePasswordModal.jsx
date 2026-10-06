import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, KeyRound, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { authApi } from '../../api/auth.js';
import Modal from './Modal.jsx';
import Button from './Button.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { getFriendlyError } from '../../utils/errorMessages.js';

function PasswordField({ label, name, value, onChange }) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium text-ink/80">
      {label}
      <span className="relative">
        <input
          type={visible ? 'text' : 'password'}
          name={name}
          value={value}
          onChange={onChange}
          minLength={12}
          required
          className="w-full border border-ink/15 bg-white px-3.5 py-2.5 pr-10 text-sm text-ink transition-colors focus:border-ink/40 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? `Hide ${label}` : `Show ${label}`}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate transition-colors hover:text-ink"
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </span>
    </label>
  );
}

export default function ChangePasswordModal({ isOpen, onClose }) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [done, setDone] = useState(false);

  function handleChange(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
    setError('');
    setDone(false);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (form.newPassword !== form.confirmPassword) return setError('New passwords do not match.');
    if (form.newPassword.length < 12) return setError('New password must be at least 12 characters.');
    setIsLoading(true);
    try {
      await authApi.changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword });
      await logout();
      toast.success('Password changed successfully. Please sign in again.');
      onClose?.();
      navigate('/login', { replace: true, state: { message: 'Your password was changed. Please sign in again.' } });
    } catch (requestError) {
      setError(getFriendlyError(requestError, 'Could not change password. Please review the form and try again.'));
    } finally {
      setIsLoading(false);
    }
  }

  function handleClose() {
    setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setError('');
    setDone(false);
    onClose?.();
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Change password" maxWidth="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm leading-6 text-slate">Keep your account protected with a unique password you do not reuse elsewhere.</p>
        <PasswordField label="Current password" name="currentPassword" value={form.currentPassword} onChange={handleChange} />
        <PasswordField label="New password" name="newPassword" value={form.newPassword} onChange={handleChange} />
        <PasswordField label="Confirm new password" name="confirmPassword" value={form.confirmPassword} onChange={handleChange} />
        <p className="text-xs text-slate">Use at least 12 characters, including an uppercase letter, a number, and a symbol.</p>
        {error && <p className="border border-clay/20 bg-clay-light px-3 py-2.5 text-sm text-clay">{error}</p>}
        {done && <p className="flex items-center gap-2 border border-sage/20 bg-sage-light px-3 py-2.5 text-sm text-sage"><ShieldCheck size={16} /> Password updated. Your current session has been signed out.</p>}
        <div className="flex justify-end gap-2 border-t border-ink/10 pt-4">
          <button type="button" onClick={handleClose} className="px-4 py-2 text-sm font-medium text-slate transition-colors hover:text-ink">Cancel</button>
          <Button type="submit" isLoading={isLoading} icon={KeyRound} disabled={!form.currentPassword || !form.newPassword || form.newPassword !== form.confirmPassword}>Update password</Button>
        </div>
      </form>
    </Modal>
  );
}
