// Pequeno combinador de classNames (evita depender de `clsx`/`tailwind-merge`
// só para concatenar strings condicionalmente — uso aqui é simples o
// suficiente para não precisar de merge de utilitários conflitantes).
export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}
