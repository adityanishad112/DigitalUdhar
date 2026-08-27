import { useState } from 'react';
import { Store } from 'lucide-react';
import { useRegisterShop } from '@/services/hooks';
import { useUi } from '@/store/ui';
import { ApiError } from '@/lib/api';
import { TopBar } from '@/components/layout/TopBar';
import { PageBody } from '@/components/layout/PageBody';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Field, Input, Textarea } from '@/components/ui/Input';

/** Shown to a merchant who hasn't registered a shop yet. */
export function RegisterShop() {
  const register = useRegisterShop();
  const pushToast = useUi((s) => s.pushToast);

  const [form, setForm] = useState({
    shopName: '',
    category: '',
    city: '',
    upiId: '',
    description: '',
  });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    if (form.shopName.trim().length < 2) return;
    try {
      await register.mutateAsync({
        shopName: form.shopName.trim(),
        category: form.category.trim() || undefined,
        city: form.city.trim() || undefined,
        upiId: form.upiId.trim() || undefined,
        description: form.description.trim() || undefined,
      });
      pushToast({ kind: 'success', message: 'Shop registered 🎉' });
    } catch (e) {
      pushToast({ kind: 'error', message: e instanceof ApiError ? e.message : 'Could not register shop' });
    }
  };

  return (
    <>
      <TopBar title="Set up your shop" subtitle="A few details to open your counter" />
      <PageBody>
        <Card className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <Store className="h-6 w-6" />
          </div>
          <p className="text-sm text-ink-600">
            Register your shop to start accepting udhaar and QR payments from your customers.
          </p>
        </Card>

        <Card>
          <Field label="Shop name">
            <Input autoFocus value={form.shopName} onChange={set('shopName')} placeholder="e.g. Sharma General Store" />
          </Field>
          <Field label="Category (optional)">
            <Input value={form.category} onChange={set('category')} placeholder="Grocery, Kirana, Medical…" />
          </Field>
          <Field label="City (optional)">
            <Input value={form.city} onChange={set('city')} placeholder="City" />
          </Field>
          <Field label="UPI ID (optional)">
            <Input value={form.upiId} onChange={set('upiId')} placeholder="shop@upi" />
          </Field>
          <Field label="About (optional)">
            <Textarea value={form.description} onChange={set('description')} placeholder="Short description of your shop" />
          </Field>
          <Button fullWidth size="lg" loading={register.isPending} disabled={form.shopName.trim().length < 2} onClick={submit}>
            Open my shop
          </Button>
        </Card>
      </PageBody>
    </>
  );
}
