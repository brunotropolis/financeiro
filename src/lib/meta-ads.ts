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
    const json = (await res.json()) as MetaResposta;
    return json.resumo ?? null;
  } catch (e) {
    console.warn("Meta Ads fetch falhou:", e);
    return null;
  }
}
