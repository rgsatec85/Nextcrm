/**
 * Sugestão de próxima ação para uma oportunidade (spec Fase 4) — regra fixa
 * sobre estágio + dias sem atividade + valor do negócio, não um modelo
 * treinado. Extraído para função pura para ser testável isoladamente.
 */

export type NextActionPriority = 'baixa' | 'media' | 'alta' | 'urgente';

export interface NextActionResult {
  suggestedAction: string;
  priority: NextActionPriority;
}

/** Negócios a partir deste valor são tratados como prioritários mesmo sem atraso. */
export const HIGH_VALUE_THRESHOLD = 50_000;

export function computeNextAction(
  stage: string,
  daysSinceLastActivity: number,
  value: number,
): NextActionResult {
  if (stage === 'fechado_ganho') {
    return {
      suggestedAction:
        'Negócio ganho — iniciar onboarding/entrega e agendar um follow-up de satisfação em 30 dias.',
      priority: 'baixa',
    };
  }
  if (stage === 'fechado_perdido') {
    return {
      suggestedAction:
        'Negócio perdido — registrar o motivo da perda e reengajar com uma nova oferta em cerca de 90 dias.',
      priority: 'baixa',
    };
  }

  const highValue = value >= HIGH_VALUE_THRESHOLD;

  if (daysSinceLastActivity > 14) {
    return {
      suggestedAction: `Sem contato registrado há ${daysSinceLastActivity} dias — ligar ou enviar mensagem imediatamente para reativar.`,
      priority: 'urgente',
    };
  }
  if (stage === 'proposta' && daysSinceLastActivity > 7) {
    return {
      suggestedAction:
        'Proposta enviada sem retorno há mais de 7 dias — cobrar posição do cliente.',
      priority: highValue ? 'urgente' : 'alta',
    };
  }
  if (stage === 'negociacao') {
    return {
      suggestedAction:
        'Em negociação — agendar reunião de fechamento e alinhar as condições finais.',
      priority: highValue ? 'alta' : 'media',
    };
  }
  if (stage === 'qualificacao') {
    return {
      suggestedAction: 'Qualificação em andamento — enviar proposta comercial.',
      priority: 'media',
    };
  }
  if (stage === 'lead') {
    return {
      suggestedAction: 'Lead novo — fazer o contato inicial de qualificação.',
      priority: 'media',
    };
  }

  return {
    suggestedAction: 'Manter acompanhamento regular.',
    priority: 'baixa',
  };
}
