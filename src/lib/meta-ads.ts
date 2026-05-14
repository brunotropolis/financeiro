/**
 * Cliente do Dashboard API de Meta Ads.
 * O dashboard externo (n8n) já agrega Meta spend + vendas Greenn,
 * a gente só consome esse endpoint que roda live (collector atualiza hourly).
 */

const META_DASHBOARD_API = "https://n8n-n8n.xktssy.easypanel.host/webhook/meta-dashboard-api";

export type MetaResumo = {
  gasto_total: number;
  impressoes: number;
  cliques: number;
  ctr_medio: number;
  cpc_medio: number;
  conversoes_meta: number;
  roas_meta: number;
  faturamento_greenn: number;
  roas_real: number;
  ticket_medio: number;
};

export type MetaResposta = {
  periodo: string;
  data_inicio: string;
  data_fim: string;
  resumo: MetaResumo;
  last_sync: string;
};

function num(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/**
 * Busca métricas do Meta Ads para um período.
 * Cache 1h (Next.js revalidation) — collector externo atualiza a cada hora.
 * Faz coerce de string→number porque a API n8n às vezes retorna strings.
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
    const json = (await res.json()) as Partial<MetaResposta>;
    const r = json.resumo;
    if (!r) return null;
    return {
      gasto_total: num(r.gasto_total),
      impressoes: num(r.impressoes),
      cliques: num(r.cliques),
      ctr_medio: num(r.ctr_medio),
      cpc_medio: num(r.cpc_medio),
      conversoes_meta: num(r.conversoes_meta),
      roas_meta: num(r.roas_meta),
      faturamento_greenn: num(r.faturamento_greenn),
      roas_real: num(r.roas_real),
      ticket_medio: num(r.ticket_medio),
    };
  } catch (e) {
    console.warn("Meta Ads fetch falhou:", e);
    return null;
  }
}
