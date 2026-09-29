import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import { AuthLayout } from '@/components/layouts/AuthLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export function CustomerLogin() {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const [mobileNumber, setMobileNumber] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (ev: FormEvent) => {
    ev.preventDefault();
    setError(null);
    if (!mobileNumber || !password) {
      setError('Please enter your mobile number and password.');
      return;
    }

    setLoading(true);
    const syntheticEmail = `${mobileNumber.replace(/[^0-9]/g, '')}@customer.local`;
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: syntheticEmail,
      password,
    });

    if (signInError) {
      setError(
        signInError.message.includes('Invalid login')
          ? 'Incorrect mobile number or password. Please try again.'
          : signInError.message
      );
      setLoading(false);
      return;
    }

    await refreshProfile();
    navigate('/app');
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to view the catalogue and your orders."
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <Input
          label="Mobile Number"
          type="tel"
          required
          value={mobileNumber}
          onChange={(e) => setMobileNumber(e.target.value)}
          placeholder="e.g. 0412 345 678"
          autoComplete="tel"
        />

        <Input
          label="Password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />

        <Button type="submit" loading={loading} fullWidth size="lg">
          Sign In
        </Button>

        <p className="text-center text-sm text-slate-600">
          Don't have an account?{' '}
          <Link
            to="/register"
            className="font-medium text-blue-600 hover:text-blue-700"
          >
            Register here
          </Link>
        </p>

        <div className="pt-2 text-center">
          <Link
            to="/admin/login"
            className="text-xs text-slate-400 hover:text-slate-600"
          >
            Admin login
          </Link>
        </div>
      </form>
    </AuthLayout>
  );
}
