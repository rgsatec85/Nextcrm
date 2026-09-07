'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
}

/**
 * Painel lateral (slide-over da direita) usado para todo formulário de novo
 * cadastro do dashboard (spec da redesign de UI — decisão confirmada: drawer
 * em vez de modal centralizado). Construído sobre o primitivo Radix Dialog
 * (acessível: foco preso, Esc fecha, overlay clicável) com estilo próprio em
 * Tailwind — sem lock-in de runtime de terceiros.
 */
export function Drawer({ open, onOpenChange, title, description, children }: DrawerProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[1px] data-[state=open]:animate-[fadeIn_150ms_ease-out] data-[state=closed]:animate-[fadeOut_150ms_ease-in]" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col bg-white shadow-2xl outline-none data-[state=open]:animate-[slideIn_200ms_ease-out] data-[state=closed]:animate-[slideOut_150ms_ease-in] dark:bg-slate-900">
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4 dark:border-slate-800">
            <div>
              <Dialog.Title className="text-base font-semibold text-slate-900 dark:text-slate-50">
                {title}
              </Dialog.Title>
              {description && (
                <Dialog.Description className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {description}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Fechar"
                className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
