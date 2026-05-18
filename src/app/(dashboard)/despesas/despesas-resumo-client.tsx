"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { TrendingDown, Calendar, Wallet, Receipt, Repeat } from "lucide-react";
import { formatBRL } from "@/lib/formatters";

type LinhaCategoria = {
  categoria_id: string | null;
  categoria_nome: string;
  categoria_cor: string | null;
  transacoes_total: number;
  recorrencias_estimadas: number;
  total: number;
};

const PERIODOS = [
  { value: "atual", label: "Mês atual" },
  { value: "proximo", label: "Próximo mês" },
  { value: "proximos3", label: "Próximos 3 meses" },
  { value: "personalizado", label: "Personalizado" },
] as const;

export function DespesasResumoClient({
  porCategoria,
  totalTransacoes,
  totalRecorrencias,
  qtdTransacoes,
  qtdRecorrencias,
  periodo,
  periodoLabel,
  numeroMeses,
}: {
  porCategoria: LinhaCategoria[];
  totalTransacoes: number;
  totalRecorrencias: number;
  qtdTransacoes: number;
  qtdRecorrencias: number;
  periodo: string;
  periodoLabel: string;
  numeroMeses: number;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [showCustom, setShowCustom] = useState(periodo === "personalizado");
  const [dataInicio, setDataInicio] = useState(sp.get("inicio") ?? "");
  const [dataFim, setDataFim] = useState(sp.get("fim") ?? "");

  useEffect(() => {
    setShowCustom(periodo === "personalizado");
  }, [periodo]);

  function handleClick(v: string) {
    if (v === "personalizado") {
      const now = new Date();
      const ini = dataInicio || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const fim = dataFim || new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
      setDataInicio(ini);
      setDataFim(fim);
      router.push(`/despesas?p=personalizado&inicio=${ini}&fim=${fim}`);
    } else if (v === "atual") {
      router.push("/despesas");
    } else {
      router.push(`/despesas?p=${v}`);
    }
  }

  function aplicarPersonalizado() {
    if (!dataInicio || !dataFim) return;
    router.push(`/despesas?p=personalizado&inicio=${dataInicio}&fim=${dataFim}`);
  }

  const totalGeral = totalTransacoes + totalRecorrencias;
  const linhasOrdenadas = useMemo(
    () => [...porCategoria].sort((a, b) => b.total - a.total),
    [porCategoria],
  );

  return (
    <div>
      <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Despesas — Resumo</h1>
          <p className="text-gray-400 text-sm mt-1">Total previsto somando lançamentos + recorrências mensais</p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-lg p-1">
            {PERIODOS.map((o) => (
              <button
                key={o.value}
                onClick={() => handleClick(o.value)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  periodo === o.value ? "bg-gray-700 text-white" : "text-gray-400 hover:text-white"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>

          {showCustom && (
            <div className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2">
              <span className="text-[11px] text-gray-500">De</span>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white"
              />
              <span className="text-[11px] text-gray-500">Até</span>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white"
              />
              <button
                onClick={aplicarPersonalizado}
                disabled={!dataInicio || !dataFim}
                className="px-3 py-1 rounded bg-blue-700 hover:bg-blue-600 text-xs text-white disabled:opacity-50"
              >
                Aplicar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card
          icon={TrendingDown}
          color="text-rose-400"
          label={`Total previsto (${periodoLabel})`}
          value={formatBRL(totalGeral)}
          hint={numeroMeses > 1 ? `média ${formatBRL(totalGeral / numeroMeses)}/mês` : undefined}
        />
        <Card
          icon={Receipt}
          color="text-blue-400"
          label="Lançamentos pontuais"
          value={formatBRL(totalTransacoes)}
          hint={`${qtdTransacoes} transaç${qtdTransacoes === 1 ? "ão" : "ões"}`}
          href="/transacoes"
        />
        <Card
          icon={Repeat}
          color="text-amber-400"
          label="Recorrências mensais"
          value={formatBRL(totalRecorrencias)}
          hint={`${qtdRecorrencias} ativa${qtdRecorrencias === 1 ? "" : "s"}${numeroMeses > 1 ? ` × ${numeroMeses} meses` : ""}`}
          href="/recorrencias"
        />
      </div>

      {/* Quebra por categoria */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Wallet className="w-4 h-4" /> Despesas por categoria
          </h2>
          <span className="text-xs text-gray-500">{linhasOrdenadas.length} categoria{linhasOrdenadas.length === 1 ? "" : "s"}</span>
        </div>

        {linhasOrdenadas.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-gray-500">
            Sem despesas no período. <Link href="/transacoes" className="text-blue-400 hover:text-blue-300">Lançar transação</Link> ou <Link href="/recorrencias" className="text-blue-400 hover:text-blue-300">cadastrar recorrência</Link>.
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-800/30 text-xs uppercase tracking-wide text-gray-400">
              <tr>
                <th className="text-left px-5 py-2.5">Categoria</th>
                <th className="text-right px-5 py-2.5">Lançamentos</th>
                <th className="text-right px-5 py-2.5">Recorrências</th>
                <th className="text-right px-5 py-2.5">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {linhasOrdenadas.map((l) => (
                <tr key={l.categoria_id ?? "sem"} className="hover:bg-gray-800/30">
                  <td className="px-5 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: l.categoria_cor ?? "#6b7280" }} />
                      <span className="text-sm text-gray-200">{l.categoria_nome}</span>
                    </div>
                  </td>
                  <td className="px-5 py-2.5 text-right text-sm font-mono text-blue-300">
                    {l.transacoes_total > 0 ? formatBRL(l.transacoes_total) : <span className="text-gray-700">—</span>}
                  </td>
                  <td className="px-5 py-2.5 text-right text-sm font-mono text-amber-300">
                    {l.recorrencias_estimadas > 0 ? formatBRL(l.recorrencias_estimadas) : <span className="text-gray-700">—</span>}
                  </td>
                  <td className="px-5 py-2.5 text-right text-sm font-mono font-semibold text-white">
                    {formatBRL(l.total)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-800/30">
              <tr>
                <td className="px-5 py-2.5 text-sm font-semibold text-white">Total</td>
                <td className="px-5 py-2.5 text-right text-sm font-mono font-semibold text-blue-300">{formatBRL(totalTransacoes)}</td>
                <td className="px-5 py-2.5 text-right text-sm font-mono font-semibold text-amber-300">{formatBRL(totalRecorrencias)}</td>
                <td className="px-5 py-2.5 text-right text-sm font-mono font-semibold text-white">{formatBRL(totalGeral)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      <p className="text-xs text-gray-500 mt-3">
        <Calendar className="w-3 h-3 inline mr-1" />
        Lançamentos = transações com <code>data_competencia</code> no período. Recorrências = soma mensal × nº de meses do período (estimativa). Esses valores podem se sobrepor se uma recorrência já gerou transação prevista — a estimativa exclui as que já viraram lançamento.
      </p>
    </div>
  );
}

function Card({
  icon: Icon,
  color,
  label,
  value,
  hint,
  href,
}: {
  icon: typeof TrendingDown;
  color: string;
  label: string;
  value: string;
  hint?: string;
  href?: string;
}) {
  const inner = (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:bg-gray-800/30 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {hint && <div className="text-[11px] text-gray-500 mt-1">{hint}</div>}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}
