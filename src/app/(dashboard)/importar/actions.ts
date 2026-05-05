"use server";

import { dbServer } from "@/lib/supabase/db";
import { revalidatePath } from "next/cache";

export type LinhaParseada = {
  data: string;
  descricao: string;
  fornecedor: string | null;
  valor: number;
  tipo: "entrada" | "saida" | "transferencia";
  categoria_sugerida: string | null;
  eh_transferencia_interna: boolean;
  eh_estorno_par: boolean;
  origem_externa: string | null;
};

export type ImportarInput = {
  conta_id: string;
  cartao_id?: string | null;
  linhas: Array<LinhaParseada & { acao: "criar" | "vincular" | "ignorar"; transacao_prevista_id?: string | null; categoria_id?: string | null }>;
};

async function userId() {
  const db = await dbServer();
  const { data } = await db.auth.getUser();
  return data.user?.id as string | undefined;
}

/**
 * Busca transações previstas que match com cada linha (±R$2 / ±3 dias).
 * Retorna mapa: idx_da_linha → array de candidatos.
 */
export async function buscarMatchesPrevistos(
  contaId: string | null,
  cartaoId: string | null,
  linhas: LinhaParseada[]
) {
  const db = await dbServer();
  const result: Record<number, Array<{ id: string; descricao: string; valor: number; data_competencia: string }>> = {};

  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i];
    if (l.eh_estorno_par || l.eh_transferencia_interna) continue;
    if (l.tipo !== "saida" && l.tipo !== "entrada") continue;

    const data = new Date(l.data + "T00:00:00");
    const dataMin = new Date(data); dataMin.setDate(data.getDate() - 3);
    const dataMax = new Date(data); dataMax.setDate(data.getDate() + 3);
    const valorMin = l.valor - 2;
    const valorMax = l.valor + 2;

    let q = db
      .from("transacoes")
      .select("id,descricao,valor,data_competencia")
      .eq("status", "prevista")
      .eq("tipo", l.tipo === "entrada" ? "receita" : "despesa")
      .gte("data_competencia", dataMin.toISOString().slice(0, 10))
      .lte("data_competencia", dataMax.toISOString().slice(0, 10))
      .gte("valor", valorMin)
      .lte("valor", valorMax);

    if (cartaoId) q = q.eq("cartao_id", cartaoId);
    else if (contaId) q = q.eq("conta_id", contaId);

    const { data: cand } = await q;
    if (cand && cand.length > 0) result[i] = cand;
  }
  return result;
}

/**
 * Salva todas as linhas importadas:
 * - "vincular" → marca transação prevista como paga + cria movimentação
 * - "criar" → cria transação nova + movimentação
 * - "ignorar" → não faz nada
 */
export async function importarLinhas(input: ImportarInput) {
  const db = await dbServer();
  const uid = await userId();
  if (!uid) return { error: "Não autenticado" };

  let criadas = 0, vinculadas = 0, ignoradas = 0;

  for (const linha of input.linhas) {
    if (linha.acao === "ignorar" || linha.eh_estorno_par) {
      ignoradas++;
      continue;
    }

    const isReceita = linha.tipo === "entrada";
    const isTransferencia = linha.eh_transferencia_interna || linha.tipo === "transferencia";

    if (linha.acao === "vincular" && linha.transacao_prevista_id) {
      // Atualiza transação prevista → paga
      const { error: updErr } = await db
        .from("transacoes")
        .update({
          status: "paga",
          data_pagamento: linha.data,
          updated_by: uid,
        })
        .eq("id", linha.transacao_prevista_id);
      if (updErr) return { error: `Vincular falhou: ${updErr.message}` };

      // Cria movimentacao_bancaria correspondente
      await db.from("movimentacoes_bancarias").insert({
        conta_id: input.conta_id,
        tipo: isReceita ? "entrada" : "saida",
        valor: linha.valor,
        data: linha.data,
        descricao: linha.descricao,
        transacao_id: linha.transacao_prevista_id,
        origem: "importacao_csv",
        conciliado: true,
        created_by: uid,
        updated_by: uid,
      });
      vinculadas++;
      continue;
    }

    // criar — cria movimentação + opcionalmente transação
    if (isTransferencia) {
      // Só registra movimentação como transferencia, não cria transação (despesa/receita)
      await db.from("movimentacoes_bancarias").insert({
        conta_id: input.conta_id,
        tipo: "transferencia",
        valor: linha.valor,
        data: linha.data,
        descricao: linha.descricao,
        origem: "importacao_csv",
        conciliado: true,
        created_by: uid,
        updated_by: uid,
      });
      criadas++;
      continue;
    }

    // Cria transação despesa/receita
    const { data: txInsert, error: txErr } = await db
      .from("transacoes")
      .insert({
        tipo: isReceita ? "receita" : "despesa",
        descricao: linha.descricao,
        valor: linha.valor,
        data_competencia: linha.data,
        data_pagamento: linha.data,
        entidade_id: await primeiraEntidadeAtiva(),
        categoria_id: linha.categoria_id || null,
        cartao_id: input.cartao_id || null,
        conta_id: input.cartao_id ? null : input.conta_id,
        status: "paga",
        origem: "importacao_csv",
        created_by: uid,
        updated_by: uid,
      })
      .select("id")
      .single();
    if (txErr) return { error: `Criar transacao falhou: ${txErr.message}` };

    await db.from("movimentacoes_bancarias").insert({
      conta_id: input.conta_id,
      tipo: isReceita ? "entrada" : "saida",
      valor: linha.valor,
      data: linha.data,
      descricao: linha.descricao,
      transacao_id: txInsert.id,
      origem: "importacao_csv",
      conciliado: true,
      created_by: uid,
      updated_by: uid,
    });
    criadas++;
  }

  revalidatePath("/transacoes");
  revalidatePath("/projecao");
  revalidatePath("/contas");
  revalidatePath("/dashboard");

  return { ok: true as const, criadas, vinculadas, ignoradas };
}

async function primeiraEntidadeAtiva(): Promise<string> {
  const db = await dbServer();
  const { data } = await db.from("entidades").select("id").eq("ativo", true).order("ordem").limit(1).single();
  return data?.id ?? "";
}
