// Perfis padrão criados para todo novo tenant (spec §19 — modelo híbrido
// RBAC + ABAC). `permissions` é um ponto de extensão para regras ABAC finas
// nas fases seguintes; por ora carrega só um resumo do escopo do perfil.
export const DEFAULT_ROLES = [
  { slug: 'admin', name: 'Admin Empresa', permissions: { scope: 'all' } },
  {
    slug: 'financeiro',
    name: 'Financeiro',
    permissions: { scope: 'financeiro' },
  },
  {
    slug: 'vendedor',
    name: 'Vendedor',
    permissions: { scope: 'clientes_proprios' },
  },
  { slug: 'gestor', name: 'Gestor', permissions: { scope: 'equipe' } },
  {
    slug: 'cliente_portal',
    name: 'Cliente Portal',
    permissions: { scope: 'somente_proprios_dados' },
  },
] as const;

export const ADMIN_ROLE_SLUG = 'admin';
