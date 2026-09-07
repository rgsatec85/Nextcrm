import Link from 'next/link';
import { cookies } from 'next/headers';
import { backend, type Activity, type AgendaBlock } from '@/lib/backend';
import { SESSION_COOKIE } from '@/lib/session';
import { NewActivityForm } from '@/components/crm/new-activity-form';
import { NewAgendaBlockForm } from '@/components/crm/new-agenda-block-form';
import { RemoveAgendaBlockButton } from '@/components/crm/remove-agenda-block-button';
import { CompleteActivityButton } from '@/components/crm/complete-activity-button';
import { AgendaUserFilter } from '@/components/crm/agenda-user-filter';
import { CreateDrawer } from '@/components/ui/create-drawer';
import { Card, CardHeader } from '@/components/ui/card';
import { Badge, TagBadge } from '@/components/ui/badge';
import { KpiCard } from '@/components/ui/kpi-card';
import { EmptyState } from '@/components/ui/empty-state';
import { ACTIVITY_TYPE_LABELS } from '@/lib/crm-constants';
import { tagColorClasses } from '@/lib/chart-colors';
import { CalendarClock, CalendarCheck2, ChevronLeft, ChevronRight, Lock } from 'lucide-react';

// Grade de semanas do mês (domingo-sábado), incluindo os dias de borda dos
// meses vizinhos que completam a primeira/última semana — cálculo simples
// em JS puro (sem lib de datas nova só para isso, e sem risco de
// hidratação: isto roda só no servidor, Server Component).
function getMonthGrid(year: number, month: number): Date[][] {
  const startWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;
  const cursor = new Date(year, month, 1 - startWeekday);
  const weeks: Date[][] = [];
  let week: Date[] = [];
  for (let i = 0; i < totalCells; i++) {
    week.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  return weeks;
}

function ymd(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function monthParamOf(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// Agenda (Fase 8, RF016) — calendário mensal com o que já existia como log
// de Atividade (Cliente 360°) mais os dois tipos novos de propósito geral
// (tarefa/evento) e os bloqueios pessoais de período. Sem tela de detalhe
// por dia (mesma decisão de escopo das Fases 6/7 para propostas/pedidos) —
// a grade + as duas listas abaixo dela já cobrem o necessário por ora.
export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; userId?: string }>;
}) {
  const { month: monthParam, userId: userIdParam } = await searchParams;
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)!.value;

  const today = new Date();
  const [yearStr, monthStr] = (monthParam ?? '').split('-');
  const year = Number(yearStr) || today.getFullYear();
  const month = monthStr ? Number(monthStr) - 1 : today.getMonth();

  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);
  const prevMonth = new Date(year, month - 1, 1);
  const nextMonth = new Date(year, month + 1, 1);
  const suffix = userIdParam ? `&userId=${userIdParam}` : '';

  const me = (await backend.me(token)) as {
    id: string;
    name: string;
    role: { slug: string };
  };
  // Vendedor sempre vê a própria agenda — o backend força isso de qualquer
  // forma (ActivitiesService/AgendaBlocksService), o filtro aqui só evita
  // oferecer o seletor de "agenda de" para quem não pode usá-lo.
  const canViewOthers = me.role.slug !== 'vendedor';
  const selectedUserId = canViewOthers && userIdParam ? userIdParam : me.id;

  const [activities, blocks, users] = await Promise.all([
    backend.activities(token, {
      from: monthStart.toISOString(),
      to: monthEnd.toISOString(),
      userId: selectedUserId,
    }),
    backend.agendaBlocks(token, {
      from: monthStart.toISOString(),
      to: monthEnd.toISOString(),
      userId: selectedUserId,
    }),
    canViewOthers
      ? (backend.users(token).catch(() => []) as Promise<{ id: string; name: string }[]>)
      : Promise.resolve([]),
  ]);

  const activitiesByDay = new Map<string, Activity[]>();
  for (const a of activities) {
    if (!a.scheduledAt) continue;
    const key = ymd(new Date(a.scheduledAt));
    if (!activitiesByDay.has(key)) activitiesByDay.set(key, []);
    activitiesByDay.get(key)!.push(a);
  }

  // Um bloqueio pode abranger vários dias — marca cada dia do intervalo.
  const blocksByDay = new Map<string, boolean>();
  for (const b of blocks) {
    const start = new Date(b.startsAt);
    const end = new Date(b.endsAt);
    const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    while (cursor <= last) {
      blocksByDay.set(ymd(cursor), true);
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  const weeks = getMonthGrid(year, month);
  const pendingCount = activities.filter((a) => !a.doneAt).length;
  const doneCount = activities.filter((a) => a.doneAt).length;
  const todayKey = ymd(today);
  const sortedActivities = activities
    .slice()
    .sort((a, b) => (a.scheduledAt ?? '').localeCompare(b.scheduledAt ?? ''));

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Agenda</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Atividades, tarefas e eventos com data marcada, mais os períodos bloqueados. Registrar
            um novo compromisso com horário conflitante é rejeitado automaticamente.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CreateDrawer
            triggerLabel="Bloquear período"
            title="Bloquear período na agenda"
            description="Impede registrar uma atividade, tarefa ou evento com conflito de horário nesse período."
            size="sm"
            variant="secondary"
          >
            <NewAgendaBlockForm />
          </CreateDrawer>
          <CreateDrawer triggerLabel="Nova atividade" title="Nova atividade">
            <NewActivityForm />
          </CreateDrawer>
        </div>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/agenda?month=${monthParamOf(prevMonth)}${suffix}`}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <span className="w-40 text-center text-sm font-medium capitalize text-slate-900 dark:text-slate-50">
            {monthStart.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
          </span>
          <Link
            href={`/dashboard/agenda?month=${monthParamOf(nextMonth)}${suffix}`}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
        {canViewOthers && (
          <AgendaUserFilter users={users} currentUserId={me.id} selectedUserId={selectedUserId} />
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Pendentes no mês" value={String(pendingCount)} icon={CalendarClock} tone="warning" />
        <KpiCard label="Concluídas no mês" value={String(doneCount)} icon={CalendarCheck2} tone="success" />
        <KpiCard label="Bloqueios no mês" value={String(blocks.length)} icon={Lock} tone="info" />
      </section>

      <Card>
        <div className="grid grid-cols-7 border-b border-slate-200 text-center text-xs font-medium uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
          {WEEKDAY_LABELS.map((d) => (
            <div key={d} className="px-2 py-2">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {weeks.flatMap((week) =>
            week.map((day) => {
              const key = ymd(day);
              const dayActivities = activitiesByDay.get(key) ?? [];
              const isBlocked = blocksByDay.has(key);
              const inMonth = day.getMonth() === month;
              return (
                <div
                  key={key}
                  className={`min-h-[104px] border-b border-r border-slate-100 p-1.5 text-xs dark:border-slate-800 ${
                    inMonth ? '' : 'bg-slate-50 dark:bg-slate-900/40'
                  } ${key === todayKey ? 'bg-brand-50 dark:bg-brand-500/10' : ''}`}
                >
                  <p
                    className={`mb-1 text-right text-xs font-medium ${
                      inMonth ? 'text-slate-600 dark:text-slate-300' : 'text-slate-300 dark:text-slate-700'
                    }`}
                  >
                    {day.getDate()}
                  </p>
                  <div className="space-y-1">
                    {isBlocked && (
                      <div className="flex items-center gap-1 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                        <Lock className="h-2.5 w-2.5" /> Bloqueado
                      </div>
                    )}
                    {dayActivities.slice(0, 3).map((a) => (
                      <div
                        key={a.id}
                        title={`${ACTIVITY_TYPE_LABELS[a.type] ?? a.type}${a.notes ? ` · ${a.notes}` : ''}`}
                        className={`truncate rounded px-1.5 py-0.5 text-[10px] font-medium ${tagColorClasses(a.type)} ${
                          a.doneAt ? 'opacity-50 line-through' : ''
                        }`}
                      >
                        {a.scheduledAt &&
                          new Date(a.scheduledAt).toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}{' '}
                        {ACTIVITY_TYPE_LABELS[a.type] ?? a.type}
                      </div>
                    ))}
                    {dayActivities.length > 3 && (
                      <p className="text-[10px] text-slate-400">+{dayActivities.length - 3} mais</p>
                    )}
                  </div>
                </div>
              );
            }),
          )}
        </div>
      </Card>

      <Card>
        <CardHeader
          icon={<CalendarClock className="h-4 w-4" />}
          title={`Compromissos do mês (${activities.length})`}
        />
        {sortedActivities.length === 0 ? (
          <EmptyState icon={CalendarClock} title="Nenhum compromisso neste mês" />
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {sortedActivities.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <TagBadge label={ACTIVITY_TYPE_LABELS[a.type] ?? a.type} />
                  {a.notes && <span className="text-slate-500 dark:text-slate-400">{a.notes}</span>}
                  {a.scheduledAt && (
                    <span className="text-slate-400">
                      {new Date(a.scheduledAt).toLocaleString('pt-BR')}
                      {a.endAt &&
                        ` – ${new Date(a.endAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
                    </span>
                  )}
                </div>
                {a.doneAt ? (
                  <Badge tone="success">concluída</Badge>
                ) : (
                  <CompleteActivityButton activityId={a.id} />
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader icon={<Lock className="h-4 w-4" />} title={`Bloqueios de agenda (${blocks.length})`} />
        {blocks.length === 0 ? (
          <EmptyState icon={Lock} title="Nenhum período bloqueado neste mês" />
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {blocks.map((b) => (
              <div key={b.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                <div>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {new Date(b.startsAt).toLocaleString('pt-BR')} –{' '}
                    {new Date(b.endsAt).toLocaleString('pt-BR')}
                  </span>
                  {b.reason && <span className="ml-2 text-slate-500 dark:text-slate-400">{b.reason}</span>}
                </div>
                <RemoveAgendaBlockButton blockId={b.id} />
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
