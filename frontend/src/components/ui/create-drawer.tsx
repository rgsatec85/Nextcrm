'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { Drawer } from '@/components/ui/drawer';
import { Button, type ButtonVariant, type ButtonSize } from '@/components/ui/button';

interface CreateDrawerProps {
  /** Texto do botão que abre o drawer, ex.: "Novo cliente". */
  triggerLabel: string;
  /** Título mostrado no cabeçalho do drawer (default: mesmo texto do trigger). */
  title?: string;
  description?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  /**
   * Conteúdo do drawer — normalmente o formulário de cadastro (ex.:
   * `<NewCustomerForm />`). Um elemento React comum, não uma função: as
   * páginas que usam este componente são Server Components (RSC), e o
   * Next.js/React não permite passar uma função como prop de um Server
   * Component para um Client Component como este ("Functions cannot be
   * passed directly to Client Components..."). Por isso o `close()` do
   * drawer é entregue ao formulário via Context (`useDrawerClose`) em vez de
   * como argumento de um render-prop — ver nota em
   * docs/fase-ui-modernizacao.md.
   */
  children: ReactNode;
}

const DrawerCloseContext = createContext<() => void>(() => {});

/**
 * Formulários renderizados dentro de um `CreateDrawer` chamam isso após
 * salvar com sucesso para fechar o drawer. Fora de um `CreateDrawer` (ex.:
 * formulário usado inline em outra tela) o hook retorna um no-op seguro.
 */
export function useDrawerClose() {
  return useContext(DrawerCloseContext);
}

/**
 * Combina o botão "Novo X" com o Drawer que abre ao clicar — o padrão usado
 * em toda lista/grid do dashboard para cadastro (spec: dados de cadastro só
 * aparecem depois de clicar em "novo cadastro", nunca expostos na grid).
 */
export function CreateDrawer({
  triggerLabel,
  title,
  description,
  variant = 'primary',
  size = 'md',
  className,
  children,
}: CreateDrawerProps) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        icon={<Plus className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />}
        onClick={() => setOpen(true)}
      >
        {triggerLabel}
      </Button>
      <Drawer open={open} onOpenChange={setOpen} title={title ?? triggerLabel} description={description}>
        <DrawerCloseContext.Provider value={close}>{children}</DrawerCloseContext.Provider>
      </Drawer>
    </>
  );
}
