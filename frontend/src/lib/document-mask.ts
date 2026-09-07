// Máscara de CNPJ/CPF aplicada no cliente, só para digitação (o backend
// continua guardando `document` como texto livre — ver
// CreateCustomerDto.document — então isso é puramente cosmético/UX, nunca
// bloqueia o envio caso o usuário cole um valor já formatado ou de outro
// país). Sem dependência nova: é só formatação de dígitos.

function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

function formatCpf(digits: string): string {
  const d = digits.slice(0, 11);
  if (d.length > 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  if (d.length > 6) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  if (d.length > 3) return `${d.slice(0, 3)}.${d.slice(3)}`;
  return d;
}

function formatCnpj(digits: string): string {
  const d = digits.slice(0, 14);
  if (d.length > 12) {
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  }
  if (d.length > 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  if (d.length > 5) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length > 2) return `${d.slice(0, 2)}.${d.slice(2)}`;
  return d;
}

/** Reformata `rawValue` como CPF (personType 'fisica') ou CNPJ (padrão). */
export function formatDocument(rawValue: string, personType: string): string {
  const digits = onlyDigits(rawValue);
  return personType === 'fisica' ? formatCpf(digits) : formatCnpj(digits);
}
