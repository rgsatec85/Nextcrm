'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';

// Só é renderizado para quem não é vendedor (a página decide isso —
// AgendaBlocksService/ActivitiesService só aceitam ?userId= de perfis
// não-vendedor; um vendedor sempre vê a própria agenda). Troca o `userId` na
// URL preservando o `month` atual.
export function AgendaUserFilter({
  users,
  currentUserId,
  selectedUserId,
}: {
  users: { id: string; name: string }[];
  currentUserId: string;
  selectedUserId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString());
    if (e.target.value === currentUserId) {
      params.delete('userId');
    } else {
      params.set('userId', e.target.value);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
      Agenda de
      <select
        value={selectedUserId}
        onChange={handleChange}
        className="rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      >
        <option value={currentUserId}>Minha agenda</option>
        {users
          .filter((u) => u.id !== currentUserId)
          .map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
      </select>
    </label>
  );
}
