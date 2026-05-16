import { dbServer } from "@/lib/supabase/db";
import type { Entidade, ReceitaBruta } from "@/lib/types/database";
import { fetchMetaAdsResumo } from "@/lib/meta-ads";
import { ReceitasClient } from "./receitas-client";

export const dynamic = "force-dynamic";

type Periodo = "atual" | "proximos" | "anteriores";

function getRange(p: Periodo): { col: "data_venda" | "data_prevista_pagamento"; gte?: string; lte?: string; lt?: string } {
  const now = new Date();
  const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const fimMes = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

  if (p === "proximos") {
    // Próximos meses: previsões com data_prevista_pagamento > fim do mês atual
    return { col: "data_prevista_pagamento", gte: new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().slice(0, 10) };
  }
  if (p === "anteriores") {
    // Meses anteriores: data_venda antes do início do mês atual (últimos 90d)
    const limite = new Date();
    limite.setDate(limite.getDate() - 90);
    return { col: "data_venda", gte: limite.toISOString().slice(0, 10), lt: inicioMes };
  }
  // atual
  return { col: "data_venda", gte: inicioMes, lte: fimMes };
}

export default async function ReceitasPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string }>;
}) {
  const params = await searchParams;
  const periodo: Periodo = params.p === "proximos" || params.p === "anteriores" ? params.p : "atual";
  const range = getRange(periodo);

  const db = await dbServer();
  let query = db.from("receitas_brutas").select("*").order("data_venda", { ascending: false }).limit(500);
  if (range.gte) query = query.gte(range.col, range.gte);
  if (range.lte) query = query.lte(range.col, range.lte);
  if (range.lt) query = query.lt(range.col, range.lt);

  const metaPromise = fetchMetaAdsResumo("mes");

  const [recRes, entRes] = await Promise.all([
    query,
    db.from("entidades").select("id,nome,tipo,cor_hex,ativo,ordem").eq("ativo", true).order("ordem"),
  ]);

  const meta = await metaPromise;

  return (
    <ReceitasClient
      receitas={(recRes.data ?? []) as ReceitaBruta[]}
      entidades={(entRes.data ?? []) as Pick<Entidade, "id" | "nome" | "tipo" | "cor_hex" | "ativo" | "ordem">[]}
      periodo={periodo}
      metaLiquido={meta?.faturamento_liquido ?? 0}
      metaBruto={meta?.faturamento_bruto ?? 0}
      metaReembolsos={meta?.reembolsos ?? 0}
    />
  );
}
