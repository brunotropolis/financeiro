import { dbServer } from "@/lib/supabase/db";
import { TrendingUp, TrendingDown, Wallet, ScrollText, AlertCircle } from "lucide-react";
import { formatBRL, formatDate } from "@/lib/formatters";
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

  const [contasRes, entRes, txRes, recRes, atrasadasRes] = await Promise.all([
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
  ]);

  const contas = (contasRes.data ?? []) as ContaSlim[];
  const entidades = (entRes.data ?? []) as EntSlim[];
  const transacoes = (txRes.data ?? []) as TxSlim[];
  const receitas = (recRes.data ?? []) as RecSlim[];
  const atrasadas = (atrasadasRes.data ?? []) as Array<{ id: string; descricao: string; valor: number; data_competencia: string }>;

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
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <ScrollText className="w-4 h-4" /> Atalhos
          </h2>
          <div className="grid grid-cols-2 gap-2">
            <Link href="/transacoes" className="px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-200 text-center">Nova despesa</Link>
            <Link href="/receitas" className="px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-200 text-center">Nova receita</Link>
            <Link href="/recorrencias" className="px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-200 text-center">Recorrências</Link>
            <Link href="/faturas" className="px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-200 text-center">Faturas</Link>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-800 text-xs text-gray-500">
            <p className="mb-1">Sprint 2 trará:</p>
            <ul className="list-disc list-inside space-y-0.5 text-gray-600">
              <li>Gráfico de fluxo de caixa 6 meses</li>
              <li>Sincronização Greenn → receitas</li>
              <li>Importação CSV de extrato bancário</li>
            </ul>
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
