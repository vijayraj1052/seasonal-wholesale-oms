import { useEffect, useState, type FormEvent } from 'react';
import { Settings as SettingsIcon, Save, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import type { AppSettings } from '@/types/database';

export function AdminSettings() {
  const { profile } = useAuth();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [paymentDays, setPaymentDays] = useState('5');
  const [discountPercent, setDiscountPercent] = useState('0');

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('app_settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle();

      if (fetchError) {
        setError(fetchError.message);
        setLoading(false);
        return;
      }

      if (data) {
        setSettings(data as AppSettings);
        setPaymentDays(String(data.payment_deadline_days));
        setDiscountPercent(String(data.default_discount_percent));
      } else {
        // Create the default settings row if it doesn't exist
        const { data: created, error: createError } = await supabase
          .from('app_settings')
          .insert({
            id: 1,
            payment_deadline_days: 5,
            default_discount_percent: 0,
            updated_by: profile?.user_id,
          })
          .select('*')
          .single();

        if (createError) {
          setError(createError.message);
        } else if (created) {
          setSettings(created as AppSettings);
          setPaymentDays('5');
          setDiscountPercent('0');
        }
      }
      setLoading(false);
    }
    load();
  }, [profile?.user_id]);

  const handleSave = async (ev: FormEvent) => {
    ev.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    const days = parseInt(paymentDays, 10);
    const discount = parseFloat(discountPercent);

    if (isNaN(days) || days < 0) {
      setError('Payment deadline must be a valid number of days.');
      setSaving(false);
      return;
    }
    if (isNaN(discount) || discount < 0 || discount > 100) {
      setError('Discount must be between 0 and 100.');
      setSaving(false);
      return;
    }

    const { error: updateError } = await supabase
      .from('app_settings')
      .update({
        payment_deadline_days: days,
        default_discount_percent: discount,
        updated_by: profile?.user_id,
      })
      .eq('id', 1);

    if (updateError) {
      setError(updateError.message);
    } else {
      setSaved(true);
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">
          Configure payment deadlines, discount defaults, and other
          application-wide settings.
        </p>
      </div>

      <Card>
        <CardHeader
          title="Payment & Discount Settings"
          subtitle="These apply globally to all orders."
        />
        <form onSubmit={handleSave}>
          <CardBody className="space-y-4">
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
            {saved && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700 flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Settings saved successfully.
              </div>
            )}

            <Input
              label="Payment Deadline (days after confirmation)"
              type="number"
              min="0"
              max="60"
              value={paymentDays}
              onChange={(e) => setPaymentDays(e.target.value)}
              hint="How many days the customer has to complete payment after the order is confirmed. Default: 5 days."
            />

            <Input
              label="Default Wholesale Discount (%)"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={discountPercent}
              onChange={(e) => setDiscountPercent(e.target.value)}
              hint="The default discount percentage applied to order subtotals. Can be overridden per order. Default: 0%."
            />

            <div className="pt-2">
              <Button type="submit" loading={saving}>
                <Save className="h-4 w-4" />
                Save Settings
              </Button>
            </div>
          </CardBody>
        </form>
      </Card>

      <Card>
        <CardHeader
          title="Admin Account"
          subtitle="Your administrator profile"
        />
        <CardBody>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500">
              <SettingsIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900">
                {profile?.full_name}
              </p>
              <p className="text-xs text-slate-500">
                {profile?.email || 'No email set'}
              </p>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
