import { cookies } from 'next/headers';
import { backend } from '@/lib/backend';
import { SESSION_COOKIE } from '@/lib/session';

function formatMoney(value: string | number) {
  return Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}

const STATUS_LABELS: Record<string, string> = {
  aberto: 'Aberto',
  parcial: 'Parcial',
  pago: 'Pago',
  cancelado: 'Cancelado',
};

// Financeiro do Portal (spec Fase 3): faturas/boletos/Pix e histórico —
// meios de pagamento continuam sendo só rótulos (sem gateway real, mesma
// simplificação da Fase 2). Extrato/2ª via de boleto ficam fora do escopo
// mínimo — ver docs/fase3-portal-atendimento.md.
export default async function PortalFinanceiroPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)!.value;
  const invoices = await backend.portalInvoices(token);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-900">Financeiro</h1>
      <section className="rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Parcela</th>
              <th className="px-4 py-2 font-medium">Vencimento</th>
              <th className="px-4 py-2 font-medium">Valor</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id} className="border-t border-slate-100">
                <td className="px-4 py-2">
                  {inv.installmentNumber}/{inv.totalInstallments}
                </td>
                <td className="px-4 py-2">{new Date(inv.dueDate).toLocaleDateString('pt-BR')}</td>
                <td className="px-4 py-2">R$ {formatMoney(inv.amount)}</td>
                <td className="px-4 py-2">
                  <span
                    className={
                      inv.isOverdue
                        ? 'rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700'
                        : 'rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600'
                    }
                  >
                    {inv.isOverdue ? 'Vencido' : (STATUS_LABELS[inv.status] ?? inv.status)}
                  </span>
                </td>
              </tr>
            ))}
            {invoices.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                  Nenhuma fatura ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
