import { avatarColorClasses, initialsFromName } from '@/lib/chart-colors';
import { cn } from '@/lib/cn';

interface InitialsAvatarProps {
  /** Nome completo real (pessoa ou empresa) — nunca um placeholder inventado. */
  name: string;
  /** `circle` para avatar de responsável/dono; `square` para "logo chip" de empresa. */
  shape?: 'circle' | 'square';
  size?: 'sm' | 'md';
  className?: string;
  title?: string;
}

// Avatar/"logo chip" de iniciais, gerado 100% no cliente a partir de um nome
// já retornado pelo backend (dono da oportunidade, nome do cliente) — sem
// upload de foto/logo real, então não é um dado novo, só uma representação
// visual de um dado existente. Cor determinística por hash do nome (ver
// `avatarColorClasses`), então a mesma pessoa/empresa sempre aparece com a
// mesma cor em qualquer tela.
export function InitialsAvatar({ name, shape = 'circle', size = 'sm', className, title }: InitialsAvatarProps) {
  const sizeClasses = size === 'sm' ? 'h-6 w-6 text-[10px]' : 'h-9 w-9 text-xs';
  const shapeClasses = shape === 'circle' ? 'rounded-full' : 'rounded-md';
  return (
    <span
      title={title ?? name}
      className={cn(
        'inline-flex flex-none items-center justify-center font-semibold uppercase leading-none ring-2 ring-white dark:ring-slate-900',
        sizeClasses,
        shapeClasses,
        avatarColorClasses(name),
        className,
      )}
    >
      {initialsFromName(name)}
    </span>
  );
}
