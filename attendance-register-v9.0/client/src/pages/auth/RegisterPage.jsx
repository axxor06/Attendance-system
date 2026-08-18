import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import AuthLayout from '../../components/layout/AuthLayout.jsx';
import Input from '../../components/common/Input.jsx';
import Select from '../../components/common/Select.jsx';
import Button from '../../components/common/Button.jsx';
import { authApi } from '../../api/auth.js';
import { classApi } from '../../api/academics.js';
import { isStrongPassword, PASSWORD_POLICY_MESSAGE, PASSWORD_POLICY_HINT } from '../../utils/passwordPolicy.js';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [classes, setClasses] = useState([]);
  const [isClassesLoading, setIsClassesLoading] = useState(true);
  const [classLoadError, setClassLoadError] = useState('');
  const [form, setForm] = useState({
    name: '', email: '', password: '', registerNumber: '', classId: '',
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const loadClasses = useCallback(async () => {
    setIsClassesLoading(true);
    setClassLoadError('');
    try {
      const { data } = await classApi.publicOptions();
      setClasses(Array.isArray(data?.data?.classes) ? data.data.classes : []);
    } catch (err) {
      setClasses([]);
      setClassLoadError(err.response?.data?.message || 'Could not load available classes.');
    } finally {
      setIsClassesLoading(false);
    }
  }, []);

  useEffect(() => { loadClasses(); }, [loadClasses]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!isStrongPassword(form.password)) {
      setError(PASSWORD_POLICY_MESSAGE);
      return;
    }
    if (!form.classId) {
      setError('Select your class before creating the account.');
      return;
    }
    setIsLoading(true);
    try {
      await authApi.register(form);
      toast.success('Account created. Check your email for a verification code.');
      navigate('/verify-email', { state: { email: form.email } });
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthLayout title="Create your student account" subtitle="You'll verify your email with a one-time code next">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Full name"
          name="name"
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <Input
          label="Email address"
          type="email"
          name="email"
          required
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <Input
          label="Register number"
          name="registerNumber"
          placeholder="e.g. 23CSE045"
          value={form.registerNumber}
          onChange={(e) => setForm({ ...form, registerNumber: e.target.value })}
        />
        {classLoadError ? (
          <div className="rounded-[14px] border border-clay/20 bg-clay-light/60 px-4 py-3" role="alert">
            <p className="text-sm font-semibold text-clay">Class list unavailable</p>
            <p className="mt-1 text-sm text-clay/80">{classLoadError}</p>
            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={loadClasses}>Retry class loading</Button>
          </div>
        ) : (
          <Select
            label="Class"
            name="classId"
            required
            disabled={isClassesLoading || classes.length === 0}
            value={form.classId}
            onChange={(e) => setForm({ ...form, classId: e.target.value })}
            hint={isClassesLoading ? 'Loading available classes…' : classes.length === 0 ? 'No classes are currently open for registration.' : undefined}
          >
            <option value="">{isClassesLoading ? 'Loading classes…' : 'Select your class'}</option>
            {classes.map((c) => (
              <option key={c._id} value={c._id}>{c.name}</option>
            ))}
          </Select>
        )}
        <Input
          label="Password"
          type="password"
          name="password"
          hint={PASSWORD_POLICY_HINT}
          required
          minLength={12}
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />

        {error && (
          <p className="rounded-xl bg-clay-light px-3.5 py-2.5 text-sm text-clay" role="alert">{error}</p>
        )}

        <Button type="submit" isLoading={isLoading} disabled={isClassesLoading || classes.length === 0} className="mt-1 w-full">
          Create account
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-ink hover:underline">Sign in</Link>
      </p>
    </AuthLayout>
  );
}
