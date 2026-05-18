import { dbServer } from "@/lib/supabase/db";
import { DespesasTabs } from "@/components/layout/despesas-tabs";
import { DespesasResumoClient } from "./despesas-resumo-client";

export const dynamic = "force-dynamic";

type Periodo = "atual" | "proximo" | "proximos3" | "personalizado";

function getRange(p: Periodo, inicio?: string, fim?: string): { gte: string; lte: string; meses: number; label: string } {
  const now = new Date();
  const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const fimMes = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

  if (p === "proximo") {
    const ini = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().slice(0, 10);
    const f = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString().slice(0, 10);
    return { gte: ini, lte: f, meses: 1, label: "próximo mês" };
  }
  if (p === "proximos3") {
    const ini = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().slice(0, 10);
    const f = new Date(now.getFullYear(), now.getMonth() + 4, 0).toISOString().slice(0, 10);
    return { gte: ini, lte: f, meses: 3, label: "próximos 3 meses" };
  }
  if (p === "personalizado" && inicio && fim) {
    // Estima nº de meses pelo range
    const d1 = new Date(inicio + "T00:00:00");
    const d2 = new Date(fim + "T00:00:00");
    const meses = Math.max(1, Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24 * 30)));
    return { gte: inicio, lte: fim, meses, label: "período" };
  }
  return { gte: inicioMes, lte: fimMes, meses: 1, label: "mês atual" };
}

export default async function DespesasResumoPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string; inicio?: string; fim?: string }>;
}) {
  const params = await searchParams;
  const periodo: Periodo =
    params.p === "proximo" ? "proximo" :
    params.p === "proximos3" ? "proximos3" :
    params.p === "personalizado" ? "personalizado" :
    "atual";
  const range = getRange(periodo, params.inicio, params.fim);

  const db = await dbServer();

  // 1. Transações de despesa no período
  const { data: txData } = await db
    .from("transacoes")
    .select("valor, categoria_id, recorrencia_id, status")
    .eq("tipo", "despesa")
    .gte("data_competencia", range.gte)
    .lte("data_competencia", range.lte)
    .neq("status", "cancelada")
    .limit(2000);

  // 2. Recorrências ativas mensais (despesa) — tipo fixo ou variavel (bucket não materializa)
  const { data: recData } = await db
    .from("recorrencias")
    .select("id, valor_padrao, categoria_id, frequencia, tipo_valor")
    .eq("ativo", true)
    .eq("tipo", "despesa")
    .in("tipo_valor", ["fixo", "variavel"])
    .eq("frequencia", "mensal");

  // 3. Categorias (pra nome/cor)
  const { data: catData } = await db
    .from("categorias")
    .select("id, nome, cor_hex");

  const transacoes = txData ?? [];
  const recorrencias = recData ?? [];
  const categorias = catData ?? [];
  const catMap = new Map(categorias.map((c) => [c.id, c]));

  // Set de recorrências que JÁ geraram transação no período (pra evitar double-count)
  const recsMaterializadas = new Set(
    transacoes.filter((t) => t.recorrencia_id).map((t) => t.recorrencia_id),
  );

  // Agrega por categoria
  type Linha = {
    categoria_id: string | null;
    categoria_nome: string;
    categoria_cor: string | null;
    transacoes_total: number;
    recorrencias_estimadas: number;
    total: number;
  };
  const map = new Map<string, Linha>();

  function getOrInit(catId: string | null): Linha {
    const key = catId ?? "sem";
    if (!map.has(key)) {
      const cat = catId ? catMap.get(catId) : null;
      map.set(key, {
        categoria_id: catId,
        categoria_nome: cat?.nome ?? "Sem categoria",
        categoria_cor: cat?.cor_hex ?? null,
        transacoes_total: 0,
        recorrencias_estimadas: 0,
        total: 0,
      });
    }
    return map.get(key)!;
  }

  for (const t of transacoes) {
    const linha = getOrInit(t.categoria_id);
    linha.transacoes_total += Number(t.valor);
  }

  // Recorrências: estima total mensal × meses do período, descontando as que já materializaram
  let totalRecorrencias = 0;
  let qtdRecorrenciasAtivas = 0;
  for (const r of recorrencias) {
    if (recsMaterializadas.has(r.id)) continue; // já tá na transação
    const estimadoNoPeriodo = Number(r.valor_padrao) * range.meses;
    const linha = getOrInit(r.categoria_id);
    linha.recorrencias_estimadas += estimadoNoPeriodo;
    totalRecorrencias += estimadoNoPeriodo;
    qtdRecorrenciasAtivas += 1;
  }

  // Finaliza total por linha
  for (const linha of map.values()) {
    linha.total = linha.transacoes_total + linha.recorrencias_estimadas;
  }

  const totalTransacoes = transacoes.reduce((s, t) => s + Number(t.valor), 0);

  return (
    <div>
      <DespesasTabs />
      <DespesasResumoClient
        porCategoria={[...map.values()]}
        totalTransacoes={totalTransacoes}
        totalRecorrencias={totalRecorrencias}
        qtdTransacoes={transacoes.length}
        qtdRecorrencias={qtdRecorrenciasAtivas}
        periodo={periodo}
        periodoLabel={range.label}
        numeroMeses={range.meses}
      />
    </div>
  );
}
