import { dbServer } from "@/lib/supabase/db";
import { TrendingUp, TrendingDown, Wallet, ScrollText, AlertCircle, Target, Megaphone, ExternalLink } from "lucide-react";
import { formatBRL, formatDate } from "@/lib/formatters";
import { fetchMetaAdsResumo } from "@/lib/meta-ads";
import Link from "next/link";

export const dynamic = "force-dynamic";

type ContaSlim = { id: string; nome: string; saldo_atual: number; banco: string; entidade_id: string; cor_hex: string | null };
type TxSlim = { id: string; tipo: "despesa" | "receita"; valor: number; data_competencia: string; status: string; cartao_id: string | null; descricao: string };
type RecSlim = { id: string; valor_liquido: number; data_venda: string; status: string };
type EntSlim = { id: string; nome: string; tipo: "PF" | "PJ"; cor_hex: string | null };

export default async function DashboardPage() {
  const db = await dbServer();

  // Mês corrente
  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);
  const inicioMesISO = inicioMes.toISOString().slice(0, 10);

  // Roda detecção de atrasos antes de buscar
  await db.rpc("detectar_atrasos");

  // Meta Ads do mês (live, externo — collector atualiza a cada hora)
  const metaPromise = fetchMetaAdsResumo("mes");

  const [contasRes, entRes, txRes, recRes, atrasadasRes, orcRes] = await Promise.all([
    db.from("contas_bancarias").select("id,nome,saldo_atual,banco,entidade_id,cor_hex").eq("ativo", true).order("ordem"),
    db.from("entidades").select("id,nome,tipo,cor_hex").eq("ativo", true).order("ordem"),
    db.from("transacoes")
      .select("id,tipo,valor,data_competencia,status,cartao_id,descricao")
      .gte("data_competencia", inicioMesISO),
    db.from("receitas_brutas")
      .select("id,valor_liquido,data_venda,status")
      .gte("data_venda", inicioMesISO),
    db.from("transacoes")
      .select("id,descricao,valor,data_competencia")
      .eq("status", "atrasada")
      .order("data_competencia")
      .limit(20),
    db.from("v_orcamento_realizado")
      .select("categoria_id,categoria_nome,categoria_cor,valor_previsto,gasto_real,pct_usado,status")
      .eq("mes_referencia", inicioMesISO)
      .gt("valor_previsto", 0),
  ]);

  const contas = (contasRes.data ?? []) as ContaSlim[];
  const entidades = (entRes.data ?? []) as EntSlim[];
  const transacoes = (txRes.data ?? []) as TxSlim[];
  const receitas = (recRes.data ?? []) as RecSlim[];
  const atrasadas = (atrasadasRes.data ?? []) as Array<{ id: string; descricao: string; valor: number; data_competencia: string }>;
  const orcamentos = (orcRes.data ?? []) as Array<{
    categoria_id: string;
    categoria_nome: string;
    categoria_cor: string | null;
    valor_previsto: number;
    gasto_real: number;
    pct_usado: number | null;
    status: "ok" | "atencao" | "estourou" | "sem_orcamento" | "sem_dados";
  }>;
  // Ordena por % usado desc (mais críticos no topo) e pega top 6
  const orcamentosTop = [...orcamentos]
    .sort((a, b) => (Number(b.pct_usado ?? 0)) - (Number(a.pct_usado ?? 0)))
    .slice(0, 6);
  const totalOrcado = orcamentos.reduce((s, o) => s + Number(o.valor_previsto), 0);
  const totalGastoOrc = orcamentos.reduce((s, o) => s + Number(o.gasto_real), 0);

  // Aguarda Meta (já started no Promise.all)
  const meta = await metaPromise;
  const roasReal = meta?.roas_real ?? 0;

  const saldoTotal = contas.reduce((s, c) => s + Number(c.saldo_atual), 0);

  const despesasMes = transacoes
    .filter((t) => t.tipo === "despesa" && t.status !== "cancelada")
    .reduce((s, t) => s + Number(t.valor), 0);

  const receitasTransacoesMes = transacoes
    .filter((t) => t.tipo === "receita" && t.status !== "cancelada")
    .reduce((s, t) => s + Number(t.valor), 0);

  const receitasBrutasLiqMes = receitas
    .filter((r) => !["reembolsado", "chargeback", "cancelado"].includes(r.status))
    .reduce((s, r) => s + Number(r.valor_liquido), 0);

  const totalReceitasMes = receitasTransacoesMes + receitasBrutasLiqMes;

  // Saldo por entidade
  const saldoPorEntidade = entidades.map((e) => ({
    ...e,
    saldo: contas.filter((c) => c.entidade_id === e.id).reduce((s, c) => s + Number(c.saldo_atual), 0),
    qtdContas: contas.filter((c) => c.entidade_id === e.id).length,
  }));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 text-sm mt-1">Visão geral do fluxo financeiro</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card label="Saldo total" value={formatBRL(saldoTotal)} icon={Wallet} color="text-emerald-400" href="/contas" />
        <Card label="Receitas (mês)" value={formatBRL(totalReceitasMes)} icon={TrendingUp} color="text-blue-400" href="/receitas" />
        <Card label="Despesas (mês)" value={formatBRL(despesasMes)} icon={TrendingDown} color="text-rose-400" href="/transacoes" />
        <Card
          label="Saldo do mês"
          value={formatBRL(totalReceitasMes - despesasMes)}
          icon={totalReceitasMes - despesasMes >= 0 ? TrendingUp : TrendingDown}
          color={totalReceitasMes - despesasMes >= 0 ? "text-emerald-400" : "text-rose-400"}
        />
      </div>

      {atrasadas.length > 0 && (
        <div className="bg-rose-950/30 border border-rose-900 rounded-xl p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-5 h-5 text-rose-400" />
            <h2 className="text-sm font-semibold text-rose-200">
              {atrasadas.length} pagamento{atrasadas.length === 1 ? "" : "s"} atrasado{atrasadas.length === 1 ? "" : "s"}
            </h2>
          </div>
          <div className="space-y-1.5">
            {atrasadas.slice(0, 5).map((a) => {
              const dias = Math.floor((Date.now() - new Date(a.data_competencia + "T00:00:00").getTime()) / (1000 * 60 * 60 * 24));
              return (
                <Link
                  key={a.id}
                  href="/transacoes"
                  className="flex items-center justify-between py-1.5 px-3 rounded hover:bg-rose-900/30"
                >
                  <div>
                    <span className="text-sm text-white">{a.descricao}</span>
                    <span className="text-xs text-rose-400 ml-2">{dias}d atraso · venceu {formatDate(a.data_competencia)}</span>
                  </div>
                  <span className="font-mono text-sm text-rose-300">{formatBRL(a.valor)}</span>
                </Link>
              );
            })}
            {atrasadas.length > 5 && (
              <Link href="/transacoes" className="block text-xs text-rose-400 hover:text-rose-300 mt-2 px-3">
                Ver todas ({atrasadas.length}) →
              </Link>
            )}
          </div>
        </div>
      )}

      {meta && (
        <div className="bg-gradient-to-br from-blue-950/40 to-indigo-950/30 border border-blue-900/50 rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-blue-400" /> Meta Ads — mês atual
            </h2>
            <a
              href="https://brunotropolis.github.io/meta-ads-dashboard/"
              target="_blank"
              rel="noopener"
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              Ver dashboard <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Investido</div>
              <div className="text-xl font-bold text-rose-300">{formatBRL(meta.gasto_total)}</div>
              <div className="text-[11px] text-gray-500 mt-0.5">
                {meta.impressoes.toLocaleString("pt-BR")} impressões · {meta.num_campanhas} camps
              </div>
            </div>

            <div>
              <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Faturamento líquido</div>
              <div className="text-xl font-bold text-emerald-300">{formatBRL(meta.faturamento_liquido)}</div>
              <div className="text-[11px] text-gray-500 mt-0.5">
                {meta.num_vendas} vendas · Bruto {formatBRL(meta.faturamento_bruto)}
                {meta.reembolsos > 0 && (
                  <> · <span className="text-rose-400">−{formatBRL(meta.reembolsos)}</span></>
                )}
              </div>
            </div>

            <div>
              <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">ROAS Real</div>
              <div
                className={`text-xl font-bold ${
                  roasReal >= 2 ? "text-emerald-300" : roasReal >= 1 ? "text-amber-300" : "text-rose-300"
                }`}
              >
                {roasReal > 0 ? `${roasReal.toFixed(2)}x` : "—"}
              </div>
              <div className="text-[11px] text-gray-500 mt-0.5">
                Lucro: {formatBRL(meta.faturamento_liquido - meta.gasto_total)}
              </div>
            </div>

            <div>
              <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">CPC médio</div>
              <div className="text-xl font-bold text-white">{formatBRL(meta.cpc_medio)}</div>
              <div className="text-[11px] text-gray-500 mt-0.5">
                {meta.cliques.toLocaleString("pt-BR")} cliques · CTR {meta.ctr_medio.toFixed(2)}%
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Wallet className="w-4 h-4" /> Saldo por entidade
          </h2>
          {saldoPorEntidade.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhuma entidade ativa.</p>
          ) : (
            <div className="space-y-2">
              {saldoPorEntidade.map((e) => (
                <Link
                  href={`/contas`}
                  key={e.id}
                  className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-800/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: e.cor_hex ?? "#6b7280" }} />
                    <div>
                      <div className="text-sm text-white">{e.nome}</div>
                      <div className="text-xs text-gray-500">{e.qtdContas} conta{e.qtdContas !== 1 ? "s" : ""}</div>
                    </div>
                  </div>
                  <span className="font-mono text-sm text-white">{formatBRL(e.saldo)}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Target className="w-4 h-4 text-amber-400" /> Orçamento do mês
            </h2>
            <Link href="/orcamento" className="text-xs text-amber-400 hover:text-amber-300">Ver tudo →</Link>
          </div>

          {orcamentosTop.length === 0 ? (
            <div className="text-sm text-gray-500 py-3">
              <p className="mb-2">Nenhum orçamento definido este mês.</p>
              <Link href="/orcamento" className="inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300">
                <Target className="w-3.5 h-3.5" /> Definir orçamento →
              </Link>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between text-xs text-gray-400 mb-3 pb-3 border-b border-gray-800">
                <div>
                  <div className="text-gray-500 mb-0.5">Total orçado</div>
                  <div className="font-mono text-white">{formatBRL(totalOrcado)}</div>
                </div>
                <div className="text-right">
                  <div className="text-gray-500 mb-0.5">Gasto real</div>
                  <div className={`font-mono ${totalGastoOrc > totalOrcado ? "text-rose-400" : "text-emerald-400"}`}>
                    {formatBRL(totalGastoOrc)}
                  </div>
                </div>
              </div>
              <div className="space-y-2.5">
                {orcamentosTop.map((o) => {
                  const pct = Number(o.pct_usado ?? 0);
                  const pctClamped = Math.min(pct, 100);
                  const barColor =
                    o.status === "estourou" ? "bg-rose-500" :
                    o.status === "atencao" ? "bg-amber-500" : "bg-emerald-500";
                  const textColor =
                    o.status === "estourou" ? "text-rose-400" :
                    o.status === "atencao" ? "text-amber-400" : "text-emerald-400";
                  return (
                    <Link key={o.categoria_id} href="/orcamento" className="block group">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: o.categoria_cor ?? "#6b7280" }} />
                          <span className="text-xs text-gray-300 truncate group-hover:text-white">{o.categoria_nome}</span>
                        </div>
                        <div className={`text-xs font-mono ${textColor}`}>
                          {formatBRL(o.gasto_real)} <span className="text-gray-600">/ {formatBRL(o.valor_previsto)}</span>
                        </div>
                      </div>
                      <div className="bg-gray-800 rounded-full h-1.5 overflow-hidden">
                        <div className={`h-full ${barColor} transition-all`} style={{ width: `${pctClamped}%` }} />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </>
          )}

          <div className="mt-5 pt-4 border-t border-gray-800 grid grid-cols-2 gap-2">
            <Link href="/transacoes" className="px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs text-gray-200 text-center">Nova despesa</Link>
            <Link href="/receitas" className="px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs text-gray-200 text-center">Nova receita</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function Card({
  label,
  value,
  icon: Icon,
  color,
  href,
}: {
  label: string;
  value: string;
  icon: typeof Wallet;
  color: string;
  href?: string;
}) {
  const inner = (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:bg-gray-800/50 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}
