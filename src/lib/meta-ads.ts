/**
 * Cliente do Dashboard API de Meta Ads.
 * O endpoint n8n retorna arrays detalhadas (vendas + campanhas) — a gente agrega
 * pro período inteiro porque o `resumo` só tem hoje/ontem.
 */

const META_DASHBOARD_API = "https://n8n-n8n.xktssy.easypanel.host/webhook/meta-dashboard-api";

export type MetaResumo = {
  gasto_total: number;          // sum(campanhas[].spend) no período
  impressoes: number;
  cliques: number;
  ctr_medio: number;             // calculado: cliques/impressoes * 100
  cpc_medio: number;             // calculado: gasto/cliques
  conversoes_meta: number;       // sum(campanhas[].conversions)
  roas_meta: number;             // calculado: sum(conversion_value)/gasto
  faturamento_bruto: number;     // sum(vendas tipo=VENDA)
  reembolsos: number;            // sum(vendas tipo=REEMBOLSO)
  faturamento_liquido: number;   // bruto - reembolsos
  roas_real: number;             // liquido / gasto
  ticket_medio: number;          // liquido / numero_vendas
  num_vendas: number;
  num_campanhas: number;
};

function num(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

type VendaRaw = { tipo?: string; valor?: number | string; valor_liquido?: number | string };
type CampanhaRaw = {
  spend?: number | string;
  impressions?: number | string;
  clicks?: number | string;
  conversions?: number | string;
  conversion_value?: number | string;
};

/**
 * Busca métricas do Meta Ads para um período.
 * Cache 1h (Next.js revalidation) — collector externo atualiza a cada hora.
 */
export async function fetchMetaAdsResumo(
  periodo: "hoje" | "ontem" | "semana" | "mes" = "mes"
): Promise<MetaResumo | null> {
  try {
    const res = await fetch(`${META_DASHBOARD_API}?periodo=${periodo}`, {
      next: { revalidate: 3600 }, // 1h
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      campanhas?: CampanhaRaw[];
      vendas?: { hoje?: VendaRaw[] };
    };

    const campanhas = Array.isArray(json.campanhas) ? json.campanhas : [];
    const transacoes = Array.isArray(json.vendas?.hoje) ? json.vendas!.hoje! : [];

    // Agrega campanhas
    let gasto_total = 0;
    let impressoes = 0;
    let cliques = 0;
    let conversoes_meta = 0;
    let conversion_value = 0;
    for (const c of campanhas) {
      gasto_total += num(c.spend);
      impressoes += num(c.impressions);
      cliques += num(c.clicks);
      conversoes_meta += num(c.conversions);
      conversion_value += num(c.conversion_value);
    }

    // Agrega vendas
    let faturamento_bruto = 0;
    let reembolsos = 0;
    let num_vendas = 0;
    for (const v of transacoes) {
      const valor = num(v.valor_liquido) || num(v.valor);
      const tipo = (v.tipo ?? "").toString().toUpperCase();
      if (tipo === "REEMBOLSO") {
        reembolsos += valor;
      } else {
        faturamento_bruto += valor;
        num_vendas += 1;
      }
    }

    const faturamento_liquido = faturamento_bruto - reembolsos;
    const ctr_medio = impressoes > 0 ? (cliques / impressoes) * 100 : 0;
    const cpc_medio = cliques > 0 ? gasto_total / cliques : 0;
    const roas_meta = gasto_total > 0 ? conversion_value / gasto_total : 0;
    const roas_real = gasto_total > 0 ? faturamento_liquido / gasto_total : 0;
    const ticket_medio = num_vendas > 0 ? faturamento_bruto / num_vendas : 0;

    return {
      gasto_total: Math.round(gasto_total * 100) / 100,
      impressoes: Math.round(impressoes),
      cliques: Math.round(cliques),
      ctr_medio: Math.round(ctr_medio * 100) / 100,
      cpc_medio: Math.round(cpc_medio * 100) / 100,
      conversoes_meta: Math.round(conversoes_meta),
      roas_meta: Math.round(roas_meta * 100) / 100,
      faturamento_bruto: Math.round(faturamento_bruto * 100) / 100,
      reembolsos: Math.round(reembolsos * 100) / 100,
      faturamento_liquido: Math.round(faturamento_liquido * 100) / 100,
      roas_real: Math.round(roas_real * 100) / 100,
      ticket_medio: Math.round(ticket_medio * 100) / 100,
      num_vendas,
      num_campanhas: campanhas.length,
    };
  } catch (e) {
    console.warn("Meta Ads fetch falhou:", e);
    return null;
  }
}
