import { Injectable } from '@nestjs/common';
import { AiProvider } from './ai-provider.interface';
import { AiTemplateContext, renderTemplate } from './ai-templates';

/**
 * Provider padrão (`AI_PROVIDER=deterministic`, o default) e o único
 * exercitado pelos testes automatizados deste projeto — não depende de rede,
 * GPU nem de nenhum serviço externo. Ignora `prompt` (não há um modelo de
 * linguagem por trás para "instruir") e usa só `context.kind` para escolher
 * um template de `ai-templates.ts`, interpolando os números já calculados
 * pelo `AiService`. Nunca inventa dado: se `context` não tiver o que o
 * template precisa, o TypeScript já barra isso em tempo de compilação (os
 * tipos de `AiTemplateContext` exigem os campos).
 */
@Injectable()
export class DeterministicAiProvider implements AiProvider {
  async generateText(
    _prompt: string,
    context: Record<string, unknown>,
  ): Promise<string> {
    return renderTemplate(context as unknown as AiTemplateContext);
  }
}
