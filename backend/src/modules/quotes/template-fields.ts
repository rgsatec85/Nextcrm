/**
 * Substituição de campos dinâmicos em modelos de proposta (spec v3.1,
 * "Campos dinâmicos": {{cliente.nome}}, {{valor_total}}, {{vendedor}},
 * {{data}}). Texto livre, sem motor de template completo — troca simples de
 * `{{chave}}` por valor, chave ausente vira string vazia (nunca quebra a
 * geração do PDF por causa de um campo digitado errado no modelo).
 */
export function substituteTemplateFields(
  text: string,
  fields: Record<string, string>,
): string {
  return text.replace(
    /\{\{\s*([\w.]+)\s*\}\}/g,
    (_match, key: string) => fields[key] ?? '',
  );
}
