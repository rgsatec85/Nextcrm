import type { LucideIcon } from 'lucide-react';
import {
  BookOpen,
  Bot,
  Building2,
  FileText,
  LayoutDashboard,
  LifeBuoy,
  Receipt,
  Webhook,
  Workflow,
  FileSignature,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

// Itens do menu principal — mesma lista de rotas do header antigo, agora
// com ícone (spec da redesign: "utilize ícones para deixar a aparência mais
// moderna"). Nenhuma visibilidade por role era aplicada aqui antes (cada
// página trata seu próprio 403/restrição), então mantemos assim.
export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/clientes', label: 'Clientes', icon: Building2 },
  { href: '/dashboard/pipeline', label: 'Pipeline', icon: Workflow },
  { href: '/dashboard/propostas', label: 'Propostas', icon: FileText },
  { href: '/dashboard/financeiro', label: 'Financeiro', icon: Receipt },
  { href: '/dashboard/contratos', label: 'Contratos', icon: FileSignature },
  { href: '/dashboard/chamados', label: 'Chamados', icon: LifeBuoy },
  { href: '/dashboard/base-de-conhecimento', label: 'Base de conhecimento', icon: BookOpen },
  { href: '/dashboard/webhooks', label: 'Webhooks', icon: Webhook },
  { href: '/dashboard/assistente', label: 'Assistente IA', icon: Bot },
];
