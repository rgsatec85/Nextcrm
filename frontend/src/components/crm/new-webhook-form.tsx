'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FormField } from '@/components/form-field';
import { WEBHOOK_EVENT_LABELS } from '@/lib/crm-constants';

export function NewWebhookForm() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);

  function toggleEvent(event: string) {
    setEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreatedSecret(null);

    if (events.length === 0) {
      setError('Selecione ao menos um evento');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/crm/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, events }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        const message = Array.isArray(b.message) ? b.message.join(', ') : (b.message ?? 'Não foi possível criar o webhook');
        throw new Error(message);
      }
      const created = await res.json();
      setCreatedSecret(created.secret);
      setUrl('');
      setEvents([]);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="URL do endpoint"
          name="webhookUrl"
          value={url}
          onChange={setUrl}
          placeholder="https://exemplo.com/webhooks/crm"
        />

        <fieldset className="sm:col-span-2">
          <legend className="text-sm font-medium text-slate-700">Eventos</legend>
          <div className="mt-1 flex flex-wrap gap-3">
            {Object.entries(WEBHOOK_EVENT_LABELS).map(([value, label]) => (
              <label key={value} className="flex items-center gap-1.5 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={events.includes(value)}
                  onChange={() => toggleEvent(value)}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {loading ? 'Criando…' : 'Criar webhook'}
          </button>
        </div>
      </form>

      {createdSecret && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Secret gerado (guarde agora — não será mostrado de novo):{' '}
          <code className="font-mono">{createdSecret}</code>
        </p>
      )}
    </div>
  );
}
