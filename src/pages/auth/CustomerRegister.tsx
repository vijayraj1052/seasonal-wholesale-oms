import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { AuthLayout } from '@/components/layouts/AuthLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface FormErrors {
  full_name?: string;
  mobile_number?: string;
  shop_name?: string;
  stall_number?: string;
  stall_location?: string;
  email?: string;
  password?: string;
  confirm_password?: string;
}

export function CustomerRegister() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});

  const [form, setForm] = useState({
    full_name: '',
    mobile_number: '',
    shop_name: '',
    stall_number: '',
    stall_location: '',
    email: '',
    password: '',
    confirm_password: '',
  });

  const update = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
    setServerError(null);
  };

  const validate = (): boolean => {
    const e: FormErrors = {};
    if (!form.full_name.trim()) e.full_name = 'Full name is required';
    if (!form.mobile_number.trim()) e.mobile_number = 'Mobile number is required';
    else if (!/^[0-9+\-\s()]{7,20}$/.test(form.mobile_number.trim()))
      e.mobile_number = 'Enter a valid mobile number';
    if (!form.shop_name.trim()) e.shop_name = 'Shop/business name is required';
    if (!form.stall_number.trim()) e.stall_number = 'Stall number is required';
    if (!form.stall_location.trim())
      e.stall_location = 'Stall location is required';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = 'Enter a valid email address';
    if (!form.password) e.password = 'Password is required';
    else if (form.password.length < 6)
      e.password = 'Password must be at least 6 characters';
    if (!form.confirm_password)
      e.confirm_password = 'Please confirm your password';
    else if (form.password !== form.confirm_password)
      e.confirm_password = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: FormEvent) => {
    ev.preventDefault();
    setServerError(null);
    if (!validate()) return;

    setLoading(true);
    const syntheticEmail = `${form.mobile_number.replace(/[^0-9]/g, '')}@customer.local`;
    const { error } = await supabase.auth.signUp({
      email: syntheticEmail,
      password: form.password,
      options: {
        data: {
          full_name: form.full_name,
          mobile_number: form.mobile_number,
          shop_name: form.shop_name,
          stall_number: form.stall_number,
          stall_location: form.stall_location,
          email: form.email || undefined,
          role: 'customer',
        },
      },
    });

    if (error) {
      setServerError(
        error.message.includes('already')
          ? 'An account with this mobile number already exists. Try signing in instead.'
          : error.message
      );
      setLoading(false);
      return;
    }

    navigate('/app');
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Register to browse the catalogue and submit order requests."
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {serverError && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {serverError}
          </div>
        )}

        <Input
          label="Full Name"
          required
          value={form.full_name}
          onChange={(e) => update('full_name', e.target.value)}
          error={errors.full_name}
          autoComplete="name"
        />

        <Input
          label="Mobile Number"
          required
          type="tel"
          value={form.mobile_number}
          onChange={(e) => update('mobile_number', e.target.value)}
          error={errors.mobile_number}
          placeholder="e.g. 0412 345 678"
          autoComplete="tel"
        />

        <Input
          label="Shop / Business Name"
          required
          value={form.shop_name}
          onChange={(e) => update('shop_name', e.target.value)}
          error={errors.shop_name}
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Stall Number"
            required
            value={form.stall_number}
            onChange={(e) => update('stall_number', e.target.value)}
            error={errors.stall_number}
          />
          <Input
            label="Stall Location"
            required
            value={form.stall_location}
            onChange={(e) => update('stall_location', e.target.value)}
            error={errors.stall_location}
          />
        </div>

        <Input
          label="Email Address"
          type="email"
          value={form.email}
          onChange={(e) => update('email', e.target.value)}
          error={errors.email}
          hint="Optional — your email is stored with your profile"
          autoComplete="email"
        />

        <Input
          label="Password"
          required
          type="password"
          value={form.password}
          onChange={(e) => update('password', e.target.value)}
          error={errors.password}
          hint="Minimum 6 characters"
          autoComplete="new-password"
        />

        <Input
          label="Confirm Password"
          required
          type="password"
          value={form.confirm_password}
          onChange={(e) => update('confirm_password', e.target.value)}
          error={errors.confirm_password}
          autoComplete="new-password"
        />

        <p className="text-xs text-slate-500">
          Your Fireworks Licence/Permit Number can be added later from your
          profile or by the Admin.
        </p>

        <Button type="submit" loading={loading} fullWidth size="lg">
          Create Account
        </Button>

        <p className="text-center text-sm text-slate-600">
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-medium text-blue-600 hover:text-blue-700"
          >
            Sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
