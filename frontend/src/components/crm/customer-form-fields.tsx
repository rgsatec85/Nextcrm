'use client';

import { FormField } from '@/components/form-field';
import { formatDocument } from '@/lib/document-mask';
import {
  COMPANY_SIZE_LABELS,
  LEAD_SOURCE_LABELS,
  PERSON_TYPE_LABELS,
} from '@/lib/crm-constants';

export interface CustomerFormValues {
  name: string;
  tradeName: string;
  document: string;
  stateRegistration: string;
  municipalRegistration: string;
  personType: string;
  status: string;
  segment: string;
  subsegment: string;
  companySize: string;
  leadSource: string;
  ownerId: string;
  isStrategicAccount: boolean;
  email: string;
  phone: string;
  website: string;
  notes: string;
}

interface CustomerFormFieldsProps {
  values: CustomerFormValues;
  onChange: <K extends keyof CustomerFormValues>(field: K, value: CustomerFormValues[K]) => void;
  /**
   * Lista para o seletor de "Vendedor Responsável" — só passada (e só
   * renderizada) quando o usuário atual pode reatribuir dono (admin/gestor/
   * financeiro). Vendedor sempre vira dono do que cria/edita no backend
   * (ownership.ts), então mostrar o seletor pra ele só confundiria.
   */
  owners?: { id: string; name: string }[];
  /** Data de cadastro (só existe em edição — cliente novo ainda não tem). */
  createdAt?: string;
}

const selectClass =
  'mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';

/**
 * Campos completos do cadastro de cliente (spec: aproximar de um CRM
 * enterprise real — ver referência visual "Dados Gerais (Cadastro
 * Principal)"), reutilizados por `NewCustomerForm` e `EditCustomerForm` para
 * as duas telas nunca divergirem por acidente.
 */
export function CustomerFormFields({ values, onChange, owners, createdAt }: CustomerFormFieldsProps) {
  return (
    <div className="space-y-6">
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-slate-900 dark:text-slate-100">Identificação</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Razão Social"
            name="name"
            value={values.name}
            onChange={(v) => onChange('name', v)}
          />
          <FormField
            label="Nome Fantasia"
            name="tradeName"
            value={values.tradeName}
            onChange={(v) => onChange('tradeName', v)}
            required={false}
          />

          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            {values.personType === 'fisica' ? 'CPF' : 'CNPJ'}
            <input
              name="document"
              value={values.document}
              onChange={(e) => onChange('document', formatDocument(e.target.value, values.personType))}
              placeholder={values.personType === 'fisica' ? '000.000.000-00' : '00.000.000/0001-00'}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>

          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Tipo de Pessoa
            <select
              value={values.personType}
              onChange={(e) => onChange('personType', e.target.value)}
              className={selectClass}
            >
              {Object.entries(PERSON_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <FormField
            label="Inscrição Estadual"
            name="stateRegistration"
            value={values.stateRegistration}
            onChange={(v) => onChange('stateRegistration', v)}
            required={false}
          />
          <FormField
            label="Inscrição Municipal"
            name="municipalRegistration"
            value={values.municipalRegistration}
            onChange={(v) => onChange('municipalRegistration', v)}
            required={false}
          />

          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Status
            <select
              value={values.status}
              onChange={(e) => onChange('status', e.target.value)}
              className={selectClass}
            >
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
            </select>
          </label>

          {createdAt && (
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Data de Cadastro
              <input
                disabled
                value={new Date(createdAt).toLocaleDateString('pt-BR')}
                className="mt-1 block w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-500"
              />
            </label>
          )}
        </div>
      </fieldset>

      <fieldset className="space-y-4 border-t border-slate-200 pt-5 dark:border-slate-800">
        <legend className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Classificação Comercial
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Segmento"
            name="segment"
            value={values.segment}
            onChange={(v) => onChange('segment', v)}
            required={false}
            placeholder="Ex.: Indústria, Varejo…"
          />
          <FormField
            label="Subsegmento"
            name="subsegment"
            value={values.subsegment}
            onChange={(v) => onChange('subsegment', v)}
            required={false}
            placeholder="Ex.: Estruturas Metálicas"
          />

          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Porte
            <select
              value={values.companySize}
              onChange={(e) => onChange('companySize', e.target.value)}
              className={selectClass}
            >
              <option value="">Selecione…</option>
              {Object.entries(COMPANY_SIZE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Origem do Lead
            <select
              value={values.leadSource}
              onChange={(e) => onChange('leadSource', e.target.value)}
              className={selectClass}
            >
              <option value="">Selecione…</option>
              {Object.entries(LEAD_SOURCE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          {owners && owners.length > 0 && (
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Vendedor Responsável
              <select
                value={values.ownerId}
                onChange={(e) => onChange('ownerId', e.target.value)}
                className={selectClass}
              >
                <option value="">Sem responsável definido</option>
                {owners.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <fieldset className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            <legend>Conta Estratégica</legend>
            <div className="mt-1 flex items-center gap-4 text-sm font-normal text-slate-600 dark:text-slate-400">
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="isStrategicAccount"
                  checked={values.isStrategicAccount}
                  onChange={() => onChange('isStrategicAccount', true)}
                />
                Sim
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="isStrategicAccount"
                  checked={!values.isStrategicAccount}
                  onChange={() => onChange('isStrategicAccount', false)}
                />
                Não
              </label>
            </div>
          </fieldset>
        </div>
      </fieldset>

      <fieldset className="space-y-4 border-t border-slate-200 pt-5 dark:border-slate-800">
        <legend className="text-sm font-semibold text-slate-900 dark:text-slate-100">Contato</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Email"
            name="email"
            type="email"
            value={values.email}
            onChange={(v) => onChange('email', v)}
            required={false}
          />
          <FormField
            label="Telefone"
            name="phone"
            value={values.phone}
            onChange={(v) => onChange('phone', v)}
            required={false}
          />
          <FormField
            label="Website"
            name="website"
            value={values.website}
            onChange={(v) => onChange('website', v)}
            required={false}
          />
        </div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Notas
          <textarea
            value={values.notes}
            onChange={(e) => onChange('notes', e.target.value)}
            rows={3}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </label>
      </fieldset>
    </div>
  );
}

export const EMPTY_CUSTOMER_FORM_VALUES: CustomerFormValues = {
  name: '',
  tradeName: '',
  document: '',
  stateRegistration: '',
  municipalRegistration: '',
  personType: 'juridica',
  status: 'ativo',
  segment: '',
  subsegment: '',
  companySize: '',
  leadSource: '',
  ownerId: '',
  isStrategicAccount: false,
  email: '',
  phone: '',
  website: '',
  notes: '',
};
