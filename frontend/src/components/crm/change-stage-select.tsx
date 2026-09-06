'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { OPPORTUNITY_STAGES, STAGE_LABELS } from '@/lib/crm-constants';

// Substitui drag-and-drop nesta fase (documentado como simplificação em
// docs/) — move o card no Kanban via um <select> por oportunidade.
export function ChangeStageSelect({
  opportunityId,
  currentStage,
}: {
  opportunityId: string;
  currentStage: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const stage = e.target.value;
    setLoading(true);
    try {
      await fetch(`/api/crm/opportunities/${opportunityId}/stage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage }),
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <select
      defaultValue={currentStage}
      onChange={handleChange}
      disabled={loading}
      className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
    >
      {OPPORTUNITY_STAGES.map((s) => (
        <option key={s} value={s}>
          {STAGE_LABELS[s]}
        </option>
      ))}
    </select>
  );
}
