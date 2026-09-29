import { useState, type FormEvent } from 'react';
import { User as UserIcon, Save, CheckCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export function CustomerProfile() {
  const { profile, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    full_name: profile?.full_name ?? '',
    mobile_number: profile?.mobile_number ?? '',
    shop_name: profile?.shop_name ?? '',
    stall_number: profile?.stall_number ?? '',
    stall_location: profile?.stall_location ?? '',
    licence_number: profile?.licence_number ?? '',
  });

  const update = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
    setError(null);
  };

  const handleSubmit = async (ev: FormEvent) => {
    ev.preventDefault();
    setLoading(true);
    setError(null);
    setSaved(false);

    const { error: updateError } = await supabase
      .from('customer_profiles')
      .update({
        full_name: form.full_name,
        mobile_number: form.mobile_number,
        shop_name: form.shop_name,
        stall_number: form.stall_number,
        stall_location: form.stall_location,
        licence_number: form.licence_number || null,
      })
      .eq('user_id', profile!.user_id);

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    await refreshProfile();
    setSaved(true);
    setLoading(false);
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-slate-900">My Profile</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Update your business and contact information.
        </p>
      </div>

      <Card>
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <UserIcon className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {profile?.full_name}
            </p>
            <p className="text-xs text-slate-500">{profile?.email || 'No email'}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <CardBody className="space-y-4">
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
            {saved && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700 flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Profile updated successfully.
              </div>
            )}

            <Input
              label="Full Name"
              required
              value={form.full_name}
              onChange={(e) => update('full_name', e.target.value)}
            />

            <Input
              label="Mobile Number"
              required
              type="tel"
              value={form.mobile_number}
              onChange={(e) => update('mobile_number', e.target.value)}
            />

            <Input
              label="Shop / Business Name"
              required
              value={form.shop_name}
              onChange={(e) => update('shop_name', e.target.value)}
            />

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Stall Number"
                required
                value={form.stall_number}
                onChange={(e) => update('stall_number', e.target.value)}
              />
              <Input
                label="Stall Location"
                required
                value={form.stall_location}
                onChange={(e) => update('stall_location', e.target.value)}
              />
            </div>

            <Input
              label="Fireworks Licence / Permit Number"
              value={form.licence_number}
              onChange={(e) => update('licence_number', e.target.value)}
              hint="Optional — can be added or updated anytime"
            />

            <div className="pt-2">
              <Button type="submit" loading={loading}>
                <Save className="h-4 w-4" />
                Save Changes
              </Button>
            </div>
          </CardBody>
        </form>
      </Card>
    </div>
  );
}
