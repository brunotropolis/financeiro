/**
 * Tipos do banco — projeto Financeiro
 *
 * IMPORTANTE: Este é um placeholder mínimo. Após aplicar schema.sql no Supabase,
 * gere os tipos completos via:
 *   npx supabase gen types typescript --project-id <ID> > src/lib/types/database.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type TipoEntidade = "PF" | "PJ";
export type TipoConta = "corrente" | "poupanca" | "digital" | "prepaga";
export type BandeiraCartao = "visa" | "master" | "elo" | "amex" | "hipercard" | "outro";
export type TipoCategoria = "despesa" | "receita" | "ambos";
export type TipoTransacao = "despesa" | "receita";
export type FormaPagamento =
  | "dinheiro"
  | "pix"
  | "boleto"
  | "cartao_credito"
  | "cartao_debito"
  | "transferencia";
export type StatusTransacao =
  | "prevista"
  | "confirmada"
  | "paga"
  | "cancelada"
  | "atrasada";
export type OrigemTransacao =
  | "whatsapp"
  | "painel"
  | "importacao_csv"
  | "recorrencia"
  | "meta_api"
  | "greenn"
  | "outro";
export type OrigemReceita =
  | "greenn"
  | "amazon_aff"
  | "shopee_aff"
  | "ml_aff"
  | "publi"
  | "adsense"
  | "palestra"
  | "consultoria"
  | "manual"
  | "outro";
export type StatusReceita =
  | "previsto"
  | "confirmado"
  | "pendente"
  | "disponivel"
  | "antecipado"
  | "recebido"
  | "reembolsado"
  | "chargeback"
  | "cancelado"
  | "atrasado";
export type TipoMovimentacao = "entrada" | "saida" | "transferencia";
export type FrequenciaRecorrencia =
  | "semanal"
  | "quinzenal"
  | "mensal"
  | "bimestral"
  | "trimestral"
  | "semestral"
  | "anual";
export type StatusFatura = "aberta" | "fechada" | "paga" | "parcial" | "atrasada";
export type RoleUsuario = "admin" | "operator" | "viewer";

// ─── Interfaces de tabelas (alinhadas com schema.sql) ────────────────────────
export interface Entidade {
  id: string;
  nome: string;
  tipo: TipoEntidade;
  cnpj_cpf: string | null;
  razao_social: string | null;
  cor_hex: string | null;
  ativo: boolean;
  ordem: number;
  criado_em: string;
  atualizado_em: string;
}

export interface ContaBancaria {
  id: string;
  entidade_id: string;
  nome: string;
  banco: string;
  tipo: TipoConta;
  agencia: string | null;
  numero: string | null;
  saldo_atual: number;
  saldo_atualizado_em: string | null;
  cor_hex: string | null;
  conta_principal: boolean;
  ativo: boolean;
  ordem: number;
  criado_em: string;
  atualizado_em: string;
}

export interface CartaoCredito {
  id: string;
  entidade_id: string;
  nome: string;
  bandeira: BandeiraCartao;
  ultimos_4_digitos: string | null;
  limite_total: number | null;
  limite_disponivel: number | null;
  dia_fechamento: number;
  dia_vencimento: number;
  conta_pagamento_id: string | null;
  cor_hex: string | null;
  ativo: boolean;
  ordem: number;
  criado_em: string;
  atualizado_em: string;
}

export interface Categoria {
  id: string;
  nome: string;
  tipo: TipoCategoria;
  categoria_pai_id: string | null;
  cor_hex: string | null;
  icone: string | null;
  ativo: boolean;
  ordem: number;
  criado_em: string;
  atualizado_em: string;
}

export interface Fornecedor {
  id: string;
  nome: string;
  nome_normalizado: string;
  cnpj: string | null;
  categoria_padrao_id: string | null;
  entidade_padrao_id: string | null;
  forma_pagamento_padrao: FormaPagamento | null;
  cartao_padrao_id: string | null;
  conta_padrao_id: string | null;
  total_transacoes: number;
  valor_medio: number | null;
  ultimo_pagamento_em: string | null;
  aliases: Json;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
}

export interface ReceitaBruta {
  id: string;
  origem: OrigemReceita;
  transaction_id_externo: string | null;
  entidade_id: string;
  produto_nome: string | null;
  produto_id_externo: string | null;
  cliente_nome: string | null;
  cliente_email: string | null;
  cliente_telefone: string | null;
  valor_bruto: number;
  taxas: number;
  valor_liquido: number;
  metodo_pagamento: string | null;
  parcelas: number | null;
  data_venda: string;
  data_prevista_pagamento: string | null;
  data_recebimento: string | null;
  status: StatusReceita;
  movimentacao_id: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  cupom: string | null;
  notas: string | null;
  bruto_webhook: Json;
  criado_em: string;
  atualizado_em: string;
}

export interface Transacao {
  id: string;
  tipo: TipoTransacao;
  descricao: string;
  valor: number;
  data_competencia: string;
  data_pagamento: string | null;
  entidade_id: string;
  categoria_id: string | null;
  fornecedor_id: string | null;
  forma_pagamento: FormaPagamento | null;
  cartao_id: string | null;
  conta_id: string | null;
  parcelado: boolean;
  parcela_atual: number | null;
  parcela_total: number | null;
  valor_parcela: number | null;
  transacao_pai_id: string | null;
  recorrencia_id: string | null;
  fatura_id: string | null;
  status: StatusTransacao;
  comprovante_url: string | null;
  notas: string | null;
  origem: OrigemTransacao;
  bruto_ia: Json;
  criado_em: string;
  atualizado_em: string;
}

export type TipoValorRecorrencia = "fixo" | "variavel" | "bucket";

export interface Recorrencia {
  id: string;
  nome: string;
  tipo: TipoTransacao;
  tipo_valor: TipoValorRecorrencia;
  valor_padrao: number;
  dia_vencimento: number;
  frequencia: FrequenciaRecorrencia;
  entidade_id: string;
  categoria_id: string | null;
  fornecedor_id: string | null;
  forma_pagamento: FormaPagamento | null;
  cartao_id: string | null;
  conta_id: string | null;
  data_inicio: string;
  data_fim: string | null;
  proxima_data: string | null;
  ultima_geracao_em: string | null;
  notas: string | null;
  dia_semana: number | null;
  pode_pular: boolean;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
}

export interface Profile {
  id: string;
  nome: string;
  email: string;
  telefone_whatsapp: string | null;
  role: RoleUsuario;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
}

/** Schema placeholder — substituir por tipos gerados após aplicar schema.sql */
export type Database = {
  public: {
    Tables: Record<string, { Row: Json; Insert: Json; Update: Json }>;
    Views: Record<string, { Row: Json }>;
    Functions: Record<string, unknown>;
    Enums: Record<string, unknown>;
    CompositeTypes: Record<string, unknown>;
  };
};
