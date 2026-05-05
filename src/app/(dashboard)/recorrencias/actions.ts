"use server";

import { dbServer } from "@/lib/supabase/db";
import { revalidatePath } from "next/cache";
import type { FormaPagamento, FrequenciaRecorrencia, TipoTransacao } from "@/lib/types/database";

export type RecorrenciaInput = {
  id?: string;
  nome: string;
  tipo: TipoTransacao;
  valor_padrao: number;
  dia_vencimento: number;
  dia_semana?: number | null;
  pode_pular?: boolean;
  frequencia: FrequenciaRecorrencia;
  entidade_id: string;
  categoria_id?: string | null;
  fornecedor_id?: string | null;
  forma_pagamento?: FormaPagamento | null;
  cartao_id?: string | null;
  conta_id?: string | null;
  data_inicio: string; // YYYY-MM-DD
  data_fim?: string | null;
  notas?: string | null;
  ativo?: boolean;
};

async function userId() {
  const db = await dbServer();
  const { data } = await db.auth.getUser();
  return data.user?.id as string | undefined;
}

export async function salvarRecorrencia(input: RecorrenciaInput) {
  const db = await dbServer();
  const uid = await userId();
  if (!uid) return { error: "Não autenticado" };

  const payload = {
    nome: input.nome.trim(),
    tipo: input.tipo,
    valor_padrao: input.valor_padrao,
    dia_vencimento: input.dia_vencimento,
    dia_semana: input.dia_semana ?? null,
    pode_pular: input.pode_pular ?? false,
    frequencia: input.frequencia,
    entidade_id: input.entidade_id,
    categoria_id: input.categoria_id || null,
    fornecedor_id: input.fornecedor_id || null,
    forma_pagamento: input.forma_pagamento || null,
    cartao_id: input.cartao_id || null,
    conta_id: input.conta_id || null,
    data_inicio: input.data_inicio,
    data_fim: input.data_fim || null,
    notas: input.notas?.trim() || null,
    ativo: input.ativo ?? true,
    updated_by: uid,
  };

  if (input.id) {
    const { error } = await db.from("recorrencias").update(payload).eq("id", input.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await db.from("recorrencias").insert({ ...payload, created_by: uid });
    if (error) return { error: error.message };
  }

  revalidatePath("/recorrencias");
  return { ok: true as const };
}

export async function toggleRecorrenciaAtivo(id: string, ativo: boolean) {
  const db = await dbServer();
  const uid = await userId();
  if (!uid) return { error: "Não autenticado" };
  const { error } = await db.from("recorrencias").update({ ativo, updated_by: uid }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/recorrencias");
  return { ok: true as const };
}

export async function deletarRecorrencia(id: string) {
  const db = await dbServer();
  const { error } = await db.from("recorrencias").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/recorrencias");
  return { ok: true as const };
}

/**
 * Força regeneração das transações previstas dos próximos N meses.
 * Idempotente: não duplica.
 */
export async function rematerializarTodas(meses = 6) {
  const db = await dbServer();
  const { data, error } = await db.rpc("materializar_todas_recorrencias", { meses });
  if (error) return { error: error.message };
  revalidatePath("/recorrencias");
  revalidatePath("/projecao");
  return { ok: true as const, criadas: data as number };
}
