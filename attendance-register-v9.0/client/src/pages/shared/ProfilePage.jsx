import { useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { User, Mail, Phone, Hash, Building2, Layers, Pencil, ShieldCheck, Save, LockKeyhole } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { authApi } from '../../api/auth.js';
import Card from '../../components/common/Card.jsx';
import Badge from '../../components/common/Badge.jsx';
import Button from '../../components/common/Button.jsx';
import Input from '../../components/common/Input.jsx';
import { fadeUp, staggerContainer, staggerItem } from '../../utils/motion.js';
import { ROLE_LABELS } from '../../components/layout/navigation.js';

const ROLE_COLORS = {
  super_admin: 'absent',
  admin: 'indigo',
  hod: 'indigo',
  faculty: 'amber',
  student: 'sage',
};

const ROLE_AVATAR_CLASSES = {
  super_admin: 'bg-clay/15 text-clay',
  admin: 'bg-ink/10 text-ink',
  hod: 'bg-indigo/15 text-indigo',
  faculty: 'bg-amber/15 text-amber',
  student: 'bg-sage/15 text-sage',
};

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ email: user?.email || '', phone: user?.phone || '' });

  const roleColor = ROLE_COLORS[user?.role] || 'neutral';
  const initials = user?.name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'U';
  const canEditName = ['super_admin', 'admin', 'hod'].includes(user?.role);

  function startEditing() {
    setForm({ email: user?.email || '', phone: user?.phone || '', name: user?.name || '' });
    setError('');
    setIsEditing(true);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setIsSaving(true);
    try {
      const payload = { email: form.email.trim(), phone: form.phone.trim() };
      if (canEditName) payload.name = form.name.trim();
      await authApi.updateMe(payload);
      await refreshUser();
      setIsEditing(false);
      toast.success('Profile details updated');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update your profile.');
    } finally {
      setIsSaving(false);
    }
  }

  const fields = [
    { label: 'Full name', value: user?.name, icon: User, locked: !canEditName },
    { label: 'Email address', value: user?.email, icon: Mail },
    { label: 'Phone', value: user?.phone || 'Not set', icon: Phone },
    ...(user?.role === 'student' ? [{ label: 'Register number', value: user?.registerNumber || 'Not set', icon: Hash, locked: true }] : []),
    ...(user?.role !== 'student' ? [{ label: 'Employee ID', value: user?.employeeId || 'Not set', icon: Hash, locked: true }] : []),
    ...(user?.department ? [{ label: 'Department', value: user?.department?.name || '—', icon: Building2, locked: true }] : []),
    ...(user?.class ? [{ label: 'Class', value: user?.class?.name || '—', icon: Layers, locked: true }] : []),
  ];

  return (
    <motion.div className="flex max-w-3xl flex-col gap-6" {...fadeUp}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber">Account</p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-[-0.04em] text-ink">My profile</h1>
          <p className="mt-2 text-sm text-slate">Keep your contact details current without changing academic identity records.</p>
        </div>
        {!isEditing && <Button type="button" variant="outline" icon={Pencil} onClick={startEditing}>Edit contact details</Button>}
      </div>

      <Card className="overflow-hidden border-white/70 bg-white/62 p-6 backdrop-blur-xl sm:p-7">
        <div className="flex flex-wrap items-center gap-5">
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 280, damping: 22 }}
            className={`flex h-20 w-20 items-center justify-center rounded-[24px] font-display text-2xl font-bold shadow-lg ${ROLE_AVATAR_CLASSES[user?.role] || ROLE_AVATAR_CLASSES.student}`}
          >
            {initials}
          </motion.div>
          <div className="min-w-0">
            <h2 className="font-display text-xl font-semibold text-ink">{user?.name}</h2>
            <p className="mt-1 truncate text-sm text-slate">{user?.email}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge variant={roleColor} className="capitalize">{ROLE_LABELS[user?.role] || user?.role}</Badge>
              <Badge variant={user?.isActive ? 'present' : 'absent'}>{user?.isActive ? 'Active' : 'Inactive'}</Badge>
            </div>
          </div>
        </div>
      </Card>

      {isEditing ? (
        <Card className="border-white/70 bg-white/62 p-6 backdrop-blur-xl sm:p-7">
          <div className="mb-5 flex items-start gap-3 border-b border-ink/8 pb-5">
            <div className="rounded-2xl bg-indigo-light p-2.5 text-indigo"><ShieldCheck size={18} /></div>
            <div><h2 className="font-display text-lg font-semibold text-ink">Edit profile</h2><p className="mt-1 text-sm text-slate">Email and phone are editable. Academic identifiers stay protected.</p></div>
          </div>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {canEditName && <Input label="Full name" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />}
            <Input label="Email address" type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
            <Input label="Phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
            {error && <p className="rounded-2xl border border-clay/20 bg-clay-light/70 px-4 py-3 text-sm text-clay" role="alert">{error}</p>}
            <div className="flex flex-wrap justify-end gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsEditing(false)}>Cancel</Button>
              <Button type="submit" icon={Save} isLoading={isSaving}>Save changes</Button>
            </div>
          </form>
        </Card>
      ) : (
        <Card className="overflow-hidden border-white/70 bg-white/62 backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-ink/8 px-6 py-4">
            <div><h3 className="font-display text-base font-semibold text-ink">Account details</h3><p className="mt-1 text-xs text-slate">Protected fields are managed by authorized academic staff.</p></div>
            <LockKeyhole size={17} className="text-slate/60" aria-hidden="true" />
          </div>
          <motion.div className="divide-y divide-ink/5" variants={staggerContainer} initial="initial" animate="animate">
            {fields.map(({ label, value, icon: Icon, locked }) => (
              <motion.div key={label} variants={staggerItem} className="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-white/45">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ink/5 text-ink/50"><Icon size={16} /></div>
                <div className="min-w-0"><p className="text-xs font-medium text-slate">{label}</p><p className="truncate text-sm font-medium text-ink">{value}</p></div>
                {locked && <span className="ml-auto text-[10px] font-bold uppercase tracking-[0.14em] text-slate/55">Protected</span>}
              </motion.div>
            ))}
          </motion.div>
        </Card>
      )}
    </motion.div>
  );
}
