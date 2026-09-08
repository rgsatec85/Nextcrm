'use client';

import { useEffect, useRef } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Bold, Italic, Underline, Heading2, List, ListOrdered, Link as LinkIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

// Componente próprio (em vez de um array de dados percorrido com `.map` no
// corpo do ContractRichTextEditor) para o botão da barra de comandos — o
// linter de regras dos hooks (análise do React Compiler) sinaliza falso-
// positivo quando funções que leem `ref.current` são carregadas dentro de
// uma estrutura de dados construída durante a renderização, mesmo só sendo
// chamadas depois, em um evento. Um componente separado evita esse padrão.
function ToolbarButton({
  label,
  icon: Icon,
  onClick,
}: {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700"
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

// Sem plugin de tipografia do Tailwind neste projeto — estilos mínimos para
// h2/ul/ol/p ficarem legíveis tanto no editor quanto na visualização
// read-only, escritos à mão em vez de depender de `@tailwindcss/typography`.
const RICH_TEXT_CONTENT_CLASSES =
  '[&_h1]:text-lg [&_h1]:font-semibold [&_h2]:text-base [&_h2]:font-semibold [&_h3]:text-sm [&_h3]:font-semibold [&_p]:my-1.5 [&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-brand-600 [&_a]:underline';

// Editor de texto rico leve para o corpo do contrato (Fase 9, RF013) —
// decisão explícita do usuário: "editor leve, sem biblioteca pesada nova"
// (ver AskUserQuestion desta fase), então isto é um `contentEditable` com
// uma barra de comandos baseada em `document.execCommand` (API antiga e sem
// suporte oficial, mas ainda funcional em todos os browsers relevantes para
// os comandos simples usados aqui: negrito/itálico/sublinhado/título/lista/
// link) em vez de uma lib como TipTap. O HTML resultante é saneado no
// backend antes de ser persistido (ver sanitize-contract-body.ts) — o
// frontend não precisa validar/filtrar tags aqui, só oferecer os controles.
//
// Quando `readOnly` (contrato fora do estado 'rascunho' — corpo travado, ver
// ContractsService.update), renderiza o HTML salvo via
// `dangerouslySetInnerHTML` sem toolbar nem contentEditable.
export function ContractRichTextEditor({
  value,
  onChange,
  readOnly = false,
}: {
  value: string;
  onChange: (html: string) => void;
  readOnly?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Só sincroniza o HTML externo -> DOM quando o valor muda por fora (ex.:
  // ao aplicar um modelo) — nunca a cada re-render, senão o cursor pularia
  // para o início a cada tecla digitada.
  const lastExternalValue = useRef(value);

  useEffect(() => {
    if (ref.current && value !== lastExternalValue.current && value !== ref.current.innerHTML) {
      ref.current.innerHTML = value;
    }
    lastExternalValue.current = value;
  }, [value]);

  // Referenciada só dentro de handlers de evento (nunca durante o render) —
  // definida fora do corpo do JSX para o linter de regras dos hooks não
  // confundir isto com acesso a ref durante a renderização.
  function runCommand(command: string, arg?: string) {
    if (readOnly) return;
    const node = ref.current;
    if (!node) return;
    document.execCommand(command, false, arg);
    node.focus();
    lastExternalValue.current = node.innerHTML;
    onChange(node.innerHTML);
  }

  function handleBold() {
    runCommand('bold');
  }
  function handleItalic() {
    runCommand('italic');
  }
  function handleUnderline() {
    runCommand('underline');
  }
  function handleHeading() {
    runCommand('formatBlock', '<h2>');
  }
  function handleBulletList() {
    runCommand('insertUnorderedList');
  }
  function handleNumberedList() {
    runCommand('insertOrderedList');
  }
  function handleLink() {
    const url = window.prompt('URL do link (http(s):// ou mailto:)');
    if (url) runCommand('createLink', url);
  }
  function handleInput() {
    const node = ref.current;
    if (node) onChange(node.innerHTML);
  }

  if (readOnly) {
    return (
      <div
        className={cn(
          RICH_TEXT_CONTENT_CLASSES,
          'rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-slate-700 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-300',
        )}
        dangerouslySetInnerHTML={{ __html: value || '<p class="text-slate-400">Sem conteúdo.</p>' }}
      />
    );
  }

  return (
    <div className="rounded-md border border-slate-300 shadow-sm dark:border-slate-700">
      <div className="flex flex-wrap gap-1 border-b border-slate-200 bg-slate-50 p-1.5 dark:border-slate-800 dark:bg-slate-900">
        <ToolbarButton label="Negrito" icon={Bold} onClick={handleBold} />
        <ToolbarButton label="Itálico" icon={Italic} onClick={handleItalic} />
        <ToolbarButton label="Sublinhado" icon={Underline} onClick={handleUnderline} />
        <ToolbarButton label="Título" icon={Heading2} onClick={handleHeading} />
        <ToolbarButton label="Lista" icon={List} onClick={handleBulletList} />
        <ToolbarButton label="Lista numerada" icon={ListOrdered} onClick={handleNumberedList} />
        <ToolbarButton label="Link" icon={LinkIcon} onClick={handleLink} />
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        className={cn(
          RICH_TEXT_CONTENT_CLASSES,
          'min-h-[160px] px-4 py-3 text-sm text-slate-900 focus:outline-none dark:text-slate-100',
        )}
      />
    </div>
  );
}
