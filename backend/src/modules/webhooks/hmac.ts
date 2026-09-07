import { createHmac } from 'node:crypto';

/**
 * Assina o corpo (já serializado) de uma entrega de webhook com
 * HMAC-SHA256, usando o `secret` da assinatura. O destinatário deve
 * recalcular o mesmo HMAC sobre o corpo bruto recebido e comparar com o
 * header `X-Webhook-Signature` para validar a origem/integridade — mesmo
 * padrão usado por Stripe/GitHub webhooks.
 */
export function signWebhookPayload(secret: string, rawBody: string): string {
  return createHmac('sha256', secret).update(rawBody).digest('hex');
}
