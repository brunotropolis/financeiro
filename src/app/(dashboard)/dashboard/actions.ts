"use server";

import { dbServer } from "@/lib/supabase/db";
import { fetchMetaAdsResumo } from "@/lib/meta-ads";

export async function syncMetaSpend(): Promise<{ ok: boolean; message: string }> {
  const meta = await fetchMetaAdsResumo("mes");
  if (!meta || meta.gasto_total <= 0) {
    return { ok: false, message: "Meta Ads sem dados de gasto para o mês atual" };
  }

  const db = await dbServer();

  // Categoria "Anúncio" e Conta Simples (prepaga)
  const [catRes, contaRes] = await Promise.all([
    db.from("categorias").select("id").eq("nome", "Anúncio").single(),
    db.from("contas_bancarias").select("id,entidade_id").eq("tipo", "prepaga").eq("ativo", true).single(),
  ]);

  if (!catRes.data) return { ok: false, message: "Categoria 'Anúncio' não encontrada no banco" };
  if (!contaRes.data) return { ok: false, message: "Conta Simples (prepaga) não encontrada no banco" };

  const now = new Date();
  const mesRef = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const dataCompetencia = now.toISOString().slice(0, 10);
  const descricao = `Meta Ads — ${mesRef}`;

  // Verifica se já existe transação deste mês
  const { data: existing } = await db
    .from("transacoes")
    .select("id")
    .eq("descricao", descricao)
    .gte("data_competencia", `${mesRef}-01`)
    .lte("data_competencia", `${mesRef}-31`)
    .maybeSingle();

  if (existing) {
    await db.from("transacoes").update({ valor: meta.gasto_total, data_competencia: dataCompetencia }).eq("id", existing.id);
    return { ok: true, message: `Despesa Meta atualizada: R$ ${meta.gasto_total.toFixed(2)}` };
  }

  await db.from("transacoes").insert({
    tipo: "despesa",
    descricao,
    valor: meta.gasto_total,
    data_competencia: dataCompetencia,
    status: "paga",
    categoria_id: catRes.data.id,
    conta_id: contaRes.data.id,
    entidade_id: contaRes.data.entidade_id,
  });

  return { ok: true, message: `Despesa Meta lançada: R$ ${meta.gasto_total.toFixed(2)}` };
}
