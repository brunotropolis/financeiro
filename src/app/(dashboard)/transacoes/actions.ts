"use server";

import { dbServer } from "@/lib/supabase/db";
import { revalidatePath } from "next/cache";
import type { FormaPagamento, StatusTransacao, TipoTransacao } from "@/lib/types/database";

export type TransacaoInput = {
  id?: string;
  tipo: TipoTransacao;
  descricao: string;
  valor: number;
  data_competencia: string;
  data_pagamento?: string | null;
  entidade_id: string;
  categoria_id?: string | null;
  fornecedor_id?: string | null;
  forma_pagamento?: FormaPagamento | null;
  cartao_id?: string | null;
  conta_id?: string | null;
  parcelado?: boolean;
  parcela_total?: number | null;
  status?: StatusTransacao;
  notas?: string | null;
};

async function userId() {
  const db = await dbServer();
  const { data } = await db.auth.getUser();
  return data.user?.id as string | undefined;
}

export async function salvarTransacao(input: TransacaoInput) {
  const db = await dbServer();
  const uid = await userId();
  if (!uid) return { error: "Não autenticado" };

  // Edit simples (sem reparcelamento)
  if (input.id) {
    const payload = {
      tipo: input.tipo,
      descricao: input.descricao.trim(),
      valor: input.valor,
      data_competencia: input.data_competencia,
      data_pagamento: input.data_pagamento || null,
      entidade_id: input.entidade_id,
      categoria_id: input.categoria_id || null,
      fornecedor_id: input.fornecedor_id || null,
      forma_pagamento: input.forma_pagamento || null,
      cartao_id: input.cartao_id || null,
      conta_id: input.conta_id || null,
      status: input.status ?? "confirmada",
      notas: input.notas?.trim() || null,
      updated_by: uid,
    };
    const { error } = await db.from("transacoes").update(payload).eq("id", input.id);
    if (error) return { error: error.message };
    revalidatePath("/transacoes");
    return { ok: true as const };
  }

  // Create — pode ser único ou parcelado
  if (input.parcelado && input.parcela_total && input.parcela_total > 1) {
    const total = input.parcela_total;
    const valorParcela = Math.round((input.valor / total) * 100) / 100;
    const dataBase = new Date(input.data_competencia + "T00:00:00");

    // Cria transação pai (parcela 1) e filhas (2..N)
    const parcelas = Array.from({ length: total }, (_, i) => {
      const dt = new Date(dataBase);
      dt.setMonth(dt.getMonth() + i);
      return {
        tipo: input.tipo,
        descricao: `${input.descricao.trim()} (${i + 1}/${total})`,
        valor: valorParcela,
        data_competencia: dt.toISOString().slice(0, 10),
        data_pagamento: i === 0 ? input.data_pagamento || null : null,
        entidade_id: input.entidade_id,
        categoria_id: input.categoria_id || null,
        fornecedor_id: input.fornecedor_id || null,
        forma_pagamento: input.forma_pagamento || null,
        cartao_id: input.cartao_id || null,
        conta_id: input.conta_id || null,
        parcelado: true,
        parcela_atual: i + 1,
        parcela_total: total,
        valor_parcela: valorParcela,
        status: i === 0 ? input.status ?? "confirmada" : "prevista",
        notas: input.notas?.trim() || null,
        origem: "painel" as const,
        created_by: uid,
        updated_by: uid,
      };
    });

    // Insere a primeira (pai) e pega o ID
    const { data: paiResult, error: paiErr } = await db
      .from("transacoes")
      .insert(parcelas[0])
      .select("id")
      .single();
    if (paiErr) return { error: paiErr.message };

    if (parcelas.length > 1) {
      const filhasComPai = parcelas.slice(1).map((p) => ({ ...p, transacao_pai_id: paiResult.id }));
      const { error: filhaErr } = await db.from("transacoes").insert(filhasComPai);
      if (filhaErr) return { error: filhaErr.message };
    }
  } else {
    const payload = {
      tipo: input.tipo,
      descricao: input.descricao.trim(),
      valor: input.valor,
      data_competencia: input.data_competencia,
      data_pagamento: input.data_pagamento || null,
      entidade_id: input.entidade_id,
      categoria_id: input.categoria_id || null,
      fornecedor_id: input.fornecedor_id || null,
      forma_pagamento: input.forma_pagamento || null,
      cartao_id: input.cartao_id || null,
      conta_id: input.conta_id || null,
      parcelado: false,
      status: input.status ?? "confirmada",
      notas: input.notas?.trim() || null,
      origem: "painel",
      created_by: uid,
      updated_by: uid,
    };
    const { error } = await db.from("transacoes").insert(payload);
    if (error) return { error: error.message };
  }

  revalidatePath("/transacoes");
  return { ok: true as const };
}

export async function deletarTransacao(id: string, deletarParcelasFuturas = false) {
  const db = await dbServer();
  if (deletarParcelasFuturas) {
    // Pega a transação pra ver se é parcela
    const { data } = await db.from("transacoes").select("transacao_pai_id, parcela_atual").eq("id", id).single();
    if (data?.transacao_pai_id) {
      // Deletar todas as parcelas filhas com parcela_atual >= esta + a própria
      await db
        .from("transacoes")
        .delete()
        .eq("transacao_pai_id", data.transacao_pai_id)
        .gte("parcela_atual", data.parcela_atual);
    }
  }
  const { error } = await db.from("transacoes").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/transacoes");
  return { ok: true as const };
}

export async function marcarPaga(id: string, dataPagamento: string) {
  const db = await dbServer();
  const uid = await userId();
  if (!uid) return { error: "Não autenticado" };
  const { error } = await db
    .from("transacoes")
    .update({ status: "paga", data_pagamento: dataPagamento, updated_by: uid })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/transacoes");
  return { ok: true as const };
}
