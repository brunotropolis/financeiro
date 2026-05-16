import { dbServer } from "@/lib/supabase/db";
import { TrendingUp, TrendingDown, Wallet, Target, Megaphone, ExternalLink } from "lucide-react";
import { formatBRL } from "@/lib/formatters";
import { fetchMetaAdsResumo } from "@/lib/meta-ads";
import Link from "next/link";
import { PeriodoFilter } from "./periodo-filter";

export const dynamic = "force-dynamic";

type ContaSlim = { saldo_atual: number };
type TxSlim = { tipo: "despesa" | "receita"; valor: number; status: string };
type RecSlim = { valor_liquido: number; status: string };

function getPeriodRange(p: string): { inicio: string; fim: string } {
  const now = new Date();
  const fim = now.toISOString().slice(0, 10);
  if (p === "3m") {
    const d = new Date(now);
    d.setMonth(d.getMonth() - 3);
    return { inicio: d.toISOString().slice(0, 10), fim };
  }
  if (p === "6m") {
    const d = new Date(now);
    d.setMonth(d.getMonth() - 6);
    return { inicio: d.toISOString().slice(0, 10), fim };
  }
  const inicio = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  return { inicio, fim };
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string }>;
}) {
  const params = await searchParams;
  const periodo = params.p === "3m" || params.p === "6m" ? params.p : "1m";
  const { inicio, fim } = getPeriodRange(periodo);
  const inicioMesAtual = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .slice(0, 10);

  const db = await dbServer();

  const metaPeriodo = periodo === "1m" ? "mes" : "personalizado";
  const metaPromise = fetchMetaAdsResumo(
    metaPeriodo,
    metaPeriodo === "personalizado" ? inicio : undefined,
    metaPeriodo === "personalizado" ? fim : undefined,
  );

  const [contasRes, txRes, recRes, orcRes, saldoGreennRes] = await Promise.all([
    db.from("contas_bancarias").select("saldo_atual").eq("ativo", true),
    db
      .from("transacoes")
      .select("tipo,valor,status")
      .gte("data_competencia", inicio)
      .lte("data_competencia", fim)
      .neq("status", "cancelada")
      .not("descricao", "ilike", "Meta Ads%"),
    db
      .from("receitas_brutas")
      .select("valor_liquido,status")
      .gte("data_venda", inicio)
      .lte("data_venda", fim),
    db
      .from("v_buckets_realizados")
      .select("recorrencia_id,bucket_nome,categoria_cor,valor_estimado,gasto_real,qtd_transacoes,pct_usado,status")
      .eq("mes_referencia", inicioMesAtual),
    db.from("greenn_saldos").select("pendente").order("capturado_em", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const contas = (contasRes.data ?? []) as ContaSlim[];
  const transacoes = (txRes.data ?? []) as TxSlim[];
  const receitas = (recRes.data ?? []) as RecSlim[];
  const buckets = (orcRes.data ?? []) as Array<{
    recorrencia_id: string;
    bucket_nome: string;
    categoria_cor: string | null;
    valor_estimado: number;
    gasto_real: number;
    qtd_transacoes: number;
    pct_usado: number | null;
    status: "ok" | "atencao" | "estourou" | "sem_estimativa";
  }>;

  const meta = await metaPromise;

  // Saldo atual das contas (sempre atual, não filtra por período)
  const saldoTotal = contas.reduce((s, c) => s + Number(c.saldo_atual), 0);

  // Receitas EFETIVAS (já em caixa) — só status=recebido. Não inclui "a receber" (que é
  // Greenn pendente, ainda não caiu) nem Meta API (que é faturamento bruto Greenn,
  // double count com receitas_brutas).
  const receitasRecebidas = receitas
    .filter((r) => r.status === "recebido")
    .reduce((s, r) => s + Number(r.valor_liquido), 0);
  const receitasTransacoes = transacoes
    .filter((t) => t.tipo === "receita")
    .reduce((s, t) => s + Number(t.valor), 0);
  const totalReceita = receitasRecebidas + receitasTransacoes;

  // A receber (vai cair no caixa) = pendentes em receitas_brutas + saldo Greenn pendente
  const greennPendente = Number(((saldoGreennRes.data ?? null) as { pendente?: number } | null)?.pendente ?? 0);
  const receitasAReceber = receitas
    .filter((r) => !["recebido", "reembolsado", "chargeback", "cancelado"].includes(r.status))
    .reduce((s, r) => s + Number(r.valor_liquido), 0);
  const totalAReceber = receitasAReceber + greennPendente;

  // Despesas: transações + gasto Meta Ads (puxado automaticamente, igual à receita)
  const metaGasto = meta?.gasto_total ?? 0;
  const despesasPrevistas = transacoes
    .filter((t) => t.tipo === "despesa")
    .reduce((s, t) => s + Number(t.valor), 0) + metaGasto;
  const despesasRealizadas = transacoes
    .filter((t) => t.tipo === "despesa" && t.status === "paga")
    .reduce((s, t) => s + Number(t.valor), 0) + metaGasto;

  const resultado = totalReceita - despesasRealizadas;

  const bucketsTop = [...buckets]
    .sort((a, b) => Number(b.pct_usado ?? 0) - Number(a.pct_usado ?? 0))
    .slice(0, 6);
  const totalBucketEstimado = buckets.reduce((s, o) => s + Number(o.valor_estimado), 0);
  const totalBucketReal = buckets.reduce((s, o) => s + Number(o.gasto_real), 0);

  const periodoLabel = periodo === "3m" ? "3 meses" : periodo === "6m" ? "6 meses" : "mês";

  return (
    <div>
      <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">Visão geral do fluxo financeiro</p>
        </div>
        <PeriodoFilter current={periodo} />
      </div>

      {/* Cards principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Saldo atual — sempre reflete o momento presente */}
        <Link
          href="/contas"
          className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:bg-gray-800/50 transition-colors"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-gray-400 uppercase tracking-wide">Saldo atual</span>
            <Wallet className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white">{formatBRL(saldoTotal)}</div>
          <div className="text-xs text-gray-500 mt-1">Total em contas</div>
        </Link>

        {/* Receita do período */}
        <Link
          href="/receitas"
          className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:bg-gray-800/50 transition-colors"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-gray-400 uppercase tracking-wide">
              Receita ({periodoLabel})
            </span>
            <TrendingUp className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-white">{formatBRL(totalReceita)}</div>
          <div className="text-xs text-gray-500 mt-1">
            Já em caixa
            {totalAReceber > 0 && <> · <span className="text-amber-400">{formatBRL(totalAReceber)} a receber</span></>}
          </div>
        </Link>

        {/* Despesas: realizado vs previsto */}
        <Link
          href="/transacoes"
          className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:bg-gray-800/50 transition-colors"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-gray-400 uppercase tracking-wide">
              Despesas ({periodoLabel})
            </span>
            <TrendingDown className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-rose-300">{formatBRL(despesasRealizadas)}</div>
          <div className="text-xs text-gray-500 mt-1">
            Pago · Previsto {formatBRL(despesasPrevistas)}
            {metaGasto > 0 && <> · Meta {formatBRL(metaGasto)}</>}
          </div>
          {despesasPrevistas > despesasRealizadas && (
            <div className="text-xs text-amber-400 mt-1">
              {formatBRL(despesasPrevistas - despesasRealizadas)} a pagar
            </div>
          )}
        </Link>

        {/* Resultado */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-gray-400 uppercase tracking-wide">
              Resultado ({periodoLabel})
            </span>
            {resultado >= 0 ? (
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            ) : (
              <TrendingDown className="w-4 h-4 text-rose-400" />
            )}
          </div>
          <div
            className={`text-2xl font-bold ${resultado >= 0 ? "text-emerald-300" : "text-rose-300"}`}
          >
            {formatBRL(resultado)}
          </div>
          <div className="text-xs text-gray-500 mt-1">Receita − despesas pagas</div>
        </div>
      </div>

      {/* Meta Ads — detalhamento (receita líq. + gasto já incluídos nos cards acima) */}
      {meta && (meta.faturamento_liquido > 0 || meta.gasto_total > 0) && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Megaphone className="w-4 h-4 text-blue-400 shrink-0" />
            <div>
              <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">
                Meta Ads ({periodoLabel})
              </div>
              <div className="flex gap-4 text-sm">
                <span>
                  <span className="text-gray-500 text-[11px]">Receita líq. </span>
                  <span className="font-semibold text-emerald-300">{formatBRL(meta.faturamento_liquido)}</span>
                </span>
                <span>
                  <span className="text-gray-500 text-[11px]">Investido </span>
                  <span className="font-semibold text-rose-300">{formatBRL(meta.gasto_total)}</span>
                </span>
                {meta.reembolsos > 0 && (
                  <span>
                    <span className="text-gray-500 text-[11px]">Reembolsos </span>
                    <span className="font-semibold text-amber-300">{formatBRL(meta.reembolsos)}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
          <a
            href="https://brunotropolis.github.io/meta-ads-dashboard/"
            target="_blank"
            rel="noopener"
            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 shrink-0"
          >
            Ver dashboard <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}

      {/* Buckets do mês (sempre mês atual) */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Target className="w-4 h-4 text-amber-400" /> Buckets do mês
          </h2>
          <Link href="/recorrencias" className="text-xs text-amber-400 hover:text-amber-300">
            Ver tudo →
          </Link>
        </div>

        {bucketsTop.length === 0 ? (
          <div className="text-sm text-gray-500 py-3">
            <p className="mb-2">Nenhum bucket cadastrado.</p>
            <Link
              href="/recorrencias"
              className="inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300"
            >
              <Target className="w-3.5 h-3.5" /> Criar recorrência tipo bucket →
            </Link>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between text-xs text-gray-400 mb-3 pb-3 border-b border-gray-800">
              <div>
                <div className="text-gray-500 mb-0.5">Total estimado</div>
                <div className="font-mono text-white">{formatBRL(totalBucketEstimado)}</div>
              </div>
              <div className="text-right">
                <div className="text-gray-500 mb-0.5">Gasto real</div>
                <div
                  className={`font-mono ${totalBucketReal > totalBucketEstimado ? "text-rose-400" : "text-emerald-400"}`}
                >
                  {formatBRL(totalBucketReal)}
                </div>
              </div>
            </div>
            <div className="space-y-2.5">
              {bucketsTop.map((o) => {
                const pct = Number(o.pct_usado ?? 0);
                const pctClamped = Math.min(pct, 100);
                const barColor =
                  o.status === "estourou"
                    ? "bg-rose-500"
                    : o.status === "atencao"
                      ? "bg-amber-500"
                      : "bg-emerald-500";
                const textColor =
                  o.status === "estourou"
                    ? "text-rose-400"
                    : o.status === "atencao"
                      ? "text-amber-400"
                      : "text-emerald-400";
                return (
                  <Link key={o.recorrencia_id} href="/recorrencias" className="block group">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="inline-block w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: o.categoria_cor ?? "#6b7280" }}
                        />
                        <span className="text-xs text-gray-300 truncate group-hover:text-white">
                          {o.bucket_nome}
                        </span>
                        <span className="text-[10px] text-gray-600">
                          ({o.qtd_transacoes} tx)
                        </span>
                      </div>
                      <div className={`text-xs font-mono ${textColor}`}>
                        {formatBRL(o.gasto_real)}{" "}
                        <span className="text-gray-600">/ {formatBRL(o.valor_estimado)}</span>
                      </div>
                    </div>
                    <div className="bg-gray-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full ${barColor} transition-all`}
                        style={{ width: `${pctClamped}%` }}
                      />
                    </div>
                  </Link>
                );
              })}
            </div>
          </>
        )}

        <div className="mt-5 pt-4 border-t border-gray-800 grid grid-cols-2 gap-2">
          <Link
            href="/transacoes"
            className="px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs text-gray-200 text-center"
          >
            Nova despesa
          </Link>
          <Link
            href="/receitas"
            className="px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs text-gray-200 text-center"
          >
            Nova receita
          </Link>
        </div>
      </div>
    </div>
  );
}
