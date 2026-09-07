'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronsLeft, ChevronsRight, LayoutGrid } from 'lucide-react';
import { NAV_ITEMS } from '@/components/layout/nav-items';
import { cn } from '@/lib/cn';

const STORAGE_KEY = 'crm.sidebar.collapsed';

function readStoredCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    // Sandbox/privacidade pode bloquear localStorage — segue expandido.
    return false;
  }
}

/**
 * Menu lateral colapsável (spec da redesign de UI): ícone + rótulo por item,
 * destaque da rota ativa, e um botão que recolhe para "só ícones" — a
 * preferência fica salva no localStorage do navegador (é só uma conveniência
 * de UI por dispositivo, não precisa ser sincronizada com o backend).
 *
 * O estado inicial é lido de forma preguiçosa (lazy useState initializer,
 * não num useEffect) para não disparar um segundo render logo após o
 * primeiro — o preço é que o HTML de SSR sempre assume "expandido"
 * (window/localStorage não existem no servidor) e o valor real só aparece
 * na hidratação; `suppressHydrationWarning` abaixo reconhece essa única
 * divergência esperada em vez de deixar o React reclamar dela no console.
 */
export function Sidebar({ companyName }: { companyName: string }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(readStoredCollapsed);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      } catch {
        // Ignora — preferência só não persiste entre sessões.
      }
      return next;
    });
  }

  return (
    <aside
      suppressHydrationWarning
      className={cn(
        'sticky top-0 flex h-screen shrink-0 flex-col border-r border-slate-200 bg-white transition-[width] duration-200 dark:border-slate-800 dark:bg-slate-900',
        collapsed ? 'w-[72px]' : 'w-64',
      )}
    >
      <div className="flex h-16 items-center gap-2.5 border-b border-slate-200 px-4 dark:border-slate-800">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white">
          <LayoutGrid className="h-4 w-4" />
        </span>
        {!collapsed && (
          <span className="truncate text-sm font-semibold text-slate-900 dark:text-slate-50">
            {companyName}
          </span>
        )}
      </div>

      <nav className="thin-scrollbar flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === '/dashboard' ? pathname === item.href : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
                collapsed && 'justify-center',
                isActive
                  ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100',
              )}
            >
              <Icon className={cn('h-[18px] w-[18px] shrink-0', isActive && 'text-brand-600 dark:text-brand-400')} />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-200 p-3 dark:border-slate-800">
        <button
          type="button"
          onClick={toggle}
          className={cn(
            'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200',
            collapsed && 'justify-center',
          )}
          title={collapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          {!collapsed && <span>Recolher menu</span>}
        </button>
      </div>
    </aside>
  );
}
