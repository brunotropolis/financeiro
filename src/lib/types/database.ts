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
  | "mensal"
  | "bimestral"
  | "trimestral"
  | "semestral"
  | "anual";
export type StatusFatura = "aberta" | "fechada" | "paga" | "parcial" | "atrasada";
export type RoleUsuario = "admin" | "operator" | "viewer";

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
