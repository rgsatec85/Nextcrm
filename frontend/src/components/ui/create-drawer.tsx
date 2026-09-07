'use client';

import { useState, type ReactNode } from 'react';
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
   * Render-prop: recebe `close` para o formulário chamar ao terminar com
   * sucesso (o formulário em si preserva sua própria lógica/validação — só
   * passamos o callback que fecha o drawer, ver docs/fase-ui-modernizacao.md).
   */
  children: (close: () => void) => ReactNode;
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
        {children(() => setOpen(false))}
      </Drawer>
    </>
  );
}
