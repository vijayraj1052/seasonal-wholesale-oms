import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import { AuthLayout } from '@/components/layouts/AuthLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export function AdminLogin() {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (ev: FormEvent) => {
    ev.preventDefault();
    setError(null);
    if (!email || !password) {
      setError('Please enter your credentials.');
      return;
    }

    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(
        signInError.message.includes('Invalid login')
          ? 'Incorrect email or password.'
          : signInError.message
      );
      setLoading(false);
      return;
    }

    await refreshProfile();

    // Verify the signed-in user is actually an admin
    const { data: profileData } = await supabase.rpc('get_my_profile');
    const role = profileData?.[0]?.role;

    if (role !== 'admin') {
      await supabase.auth.signOut();
      setError(
        'This account does not have administrator access. Use the customer login instead.'
      );
      setLoading(false);
      return;
    }

    navigate('/admin');
  };

  return (
    <AuthLayout
      title="Admin Sign In"
      subtitle="Manage products, orders, inventory, and customers."
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <Input
          label="Email Address"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          hint="Admin accounts use email for login"
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
          Sign In to Admin Panel
        </Button>

        <div className="pt-2 text-center">
          <Link
            to="/login"
            className="text-xs text-slate-400 hover:text-slate-600"
          >
            Customer login
          </Link>
        </div>
      </form>
    </AuthLayout>
  );
}
