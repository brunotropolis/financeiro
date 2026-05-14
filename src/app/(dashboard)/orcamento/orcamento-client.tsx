"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatBRL } from "@/lib/formatters";
import { Target, ChevronLeft, ChevronRight, Copy, Check, Loader2, AlertTriangle, TrendingUp } from "lucide-react";
import { salvarOrcamento, copiarOrcamentoMes } from "./actions";

export type OrcamentoLinha = {
  mes_referencia: string;
  categoria_id: string;
  categoria_nome: string;
  categoria_cor: string | null;
  valor_previsto: number;
  gasto_real: number;
  gasto_previsto: number;
  gasto_total: number;
  pct_usado: number | null;
  status: "ok" | "atencao" | "estourou" | "sem_orcamento" | "sem_dados";
  orcamento_id: string | null;
  orcamento_notas: string | null;
};

const STATUS_LABEL: Record<OrcamentoLinha["status"], string> = {
  ok: "OK",
  atencao: "Atenção",
  estourou: "Estourou",
  sem_orcamento: "Sem meta",
  sem_dados: "—",
};

const STATUS_COLOR: Record<OrcamentoLinha["status"], string> = {
  ok: "text-emerald-400 bg-emerald-950/30 border-emerald-900",
  atencao: "text-amber-400 bg-amber-950/30 border-amber-900",
  estourou: "text-rose-400 bg-rose-950/30 border-rose-900",
  sem_orcamento: "text-gray-400 bg-gray-800/50 border-gray-700",
  sem_dados: "text-gray-600 bg-gray-900 border-gray-800",
};

const BAR_COLOR: Record<OrcamentoLinha["status"], string> = {
  ok: "bg-emerald-500",
  atencao: "bg-amber-500",
  estourou: "bg-rose-500",
  sem_orcamento: "bg-gray-600",
  sem_dados: "bg-gray-700",
};

function formatMesLabel(mesISO: string): string {
  const d = new Date(mesISO + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function shiftMes(mesISO: string, delta: number): string {
  const d = new Date(mesISO + "T00:00:00");
  d.setMonth(d.getMonth() + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export function OrcamentoClient({
  linhas,
  mesAtual,
  mesAnterior,
  temOrcamentoMesAnterior,
}: {
  linhas: OrcamentoLinha[];
  mesAtual: string;
  mesAnterior: string;
  temOrcamentoMesAnterior: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editId, setEditId] = useState<string | null>(null);
  const [editValor, setEditValor] = useState<string>("");
  const [erro, setErro] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  function navegarMes(delta: number) {
    const novo = shiftMes(mesAtual, delta);
    router.push(`/orcamento?mes=${novo.slice(0, 7)}`);
  }

  function abrirEdicao(linha: OrcamentoLinha) {
    setEditId(linha.categoria_id);
    setEditValor(linha.valor_previsto > 0 ? String(linha.valor_previsto) : "");
    setErro(null);
    setOkMsg(null);
  }

  function fecharEdicao() {
    setEditId(null);
    setEditValor("");
  }

  function salvar(linha: OrcamentoLinha) {
    const valor = parseFloat(editValor.replace(",", "."));
    if (isNaN(valor) || valor < 0) {
      setErro("Valor inválido");
      return;
    }
    setErro(null);
    startTransition(async () => {
      const res = await salvarOrcamento({
        mes_referencia: mesAtual,
        categoria_id: linha.categoria_id,
        valor_previsto: valor,
      });
      if ("error" in res && res.error) {
        setErro(res.error);
        return;
      }
      setOkMsg(`✓ ${linha.categoria_nome}`);
      setTimeout(() => setOkMsg(null), 2000);
      fecharEdicao();
      router.refresh();
    });
  }

  function copiarDoMesAnterior() {
    if (!confirm(`Copiar todos os orçamentos de ${formatMesLabel(mesAnterior)} para ${formatMesLabel(mesAtual)}?`)) return;
    startTransition(async () => {
      const res = await copiarOrcamentoMes(mesAnterior, mesAtual);
      if ("error" in res && res.error) {
        setErro(res.error);
        return;
      }
      setOkMsg(`✓ ${("copiadas" in res ? res.copiadas : 0)} categoria(s) copiadas`);
      setTimeout(() => setOkMsg(null), 3000);
      router.refresh();
    });
  }

  // Ordena: primeiro categorias com gasto (real ou previsto) ou orçamento, depois alfabético
  const ordenadas = [...linhas].sort((a, b) => {
    const aTem = a.valor_previsto > 0 || a.gasto_total > 0;
    const bTem = b.valor_previsto > 0 || b.gasto_total > 0;
    if (aTem !== bTem) return aTem ? -1 : 1;
    // Se ambos têm dados: ordena por orçamento desc, depois alfabético
    if (aTem) {
      if (a.valor_previsto !== b.valor_previsto) return b.valor_previsto - a.valor_previsto;
    }
    return a.categoria_nome.localeCompare(b.categoria_nome);
  });

  // Totais
  const totalOrcado = linhas.reduce((s, l) => s + Number(l.valor_previsto), 0);
  const totalGastoReal = linhas.reduce((s, l) => s + Number(l.gasto_real), 0);
  const totalGastoPrevisto = linhas.reduce((s, l) => s + Number(l.gasto_previsto), 0);
  const pctTotal = totalOrcado > 0 ? Math.round((totalGastoReal / totalOrcado) * 100) : null;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Target className="w-6 h-6 text-amber-400" /> Orçamento mensal
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Defina o limite de gastos por categoria e acompanhe a execução
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navegarMes(-1)}
            className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300"
            disabled={isPending}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="px-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white font-medium capitalize min-w-[180px] text-center">
            {formatMesLabel(mesAtual)}
          </div>
          <button
            onClick={() => navegarMes(1)}
            className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300"
            disabled={isPending}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="text-xs text-gray-400 uppercase mb-2">Total orçado</div>
          <div className="text-xl font-bold text-white">{formatBRL(totalOrcado)}</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="text-xs text-gray-400 uppercase mb-2">Gasto real</div>
          <div className="text-xl font-bold text-rose-400">{formatBRL(totalGastoReal)}</div>
          {pctTotal !== null && (
            <div className="text-xs text-gray-500 mt-1">{pctTotal}% do orçado</div>
          )}
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="text-xs text-gray-400 uppercase mb-2">Previsto (a vir)</div>
          <div className="text-xl font-bold text-amber-400">{formatBRL(totalGastoPrevisto)}</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="text-xs text-gray-400 uppercase mb-2">Disponível</div>
          <div className={`text-xl font-bold ${totalOrcado - totalGastoReal >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {formatBRL(totalOrcado - totalGastoReal)}
          </div>
        </div>
      </div>

      {/* Ações */}
      <div className="flex items-center gap-3 mb-4">
        {totalOrcado === 0 && temOrcamentoMesAnterior && (
          <button
            onClick={copiarDoMesAnterior}
            disabled={isPending}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-950/40 hover:bg-amber-950/60 border border-amber-900 text-amber-300 text-sm disabled:opacity-50"
          >
            <Copy className="w-4 h-4" /> Copiar de {formatMesLabel(mesAnterior)}
          </button>
        )}
        {okMsg && (
          <div className="text-xs text-emerald-400 flex items-center gap-1"><Check className="w-3.5 h-3.5" /> {okMsg}</div>
        )}
        {erro && (
          <div className="text-xs text-rose-400 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> {erro}</div>
        )}
      </div>

      {/* Tabela */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-800/50 border-b border-gray-800">
            <tr className="text-left">
              <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Categoria</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide text-right">Orçado</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide text-right">Gasto real</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide text-right">Previsto</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide text-right">Restante</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide w-[200px]">% usado</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide w-[100px]">Status</th>
            </tr>
          </thead>
          <tbody>
            {ordenadas.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">Nenhuma categoria encontrada.</td></tr>
            )}
            {ordenadas.map((linha) => {
              const restante = Number(linha.valor_previsto) - Number(linha.gasto_real);
              const pct = linha.pct_usado ?? 0;
              const pctClamped = Math.min(pct, 100);
              const editando = editId === linha.categoria_id;

              return (
                <tr
                  key={linha.categoria_id}
                  className="border-b border-gray-800/50 hover:bg-gray-800/30"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: linha.categoria_cor ?? "#6b7280" }} />
                      <span className="text-sm text-white">{linha.categoria_nome}</span>
                    </div>
                  </td>

                  <td className="px-4 py-3 text-right">
                    {editando ? (
                      <div className="flex items-center justify-end gap-1">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={editValor}
                          onChange={(e) => setEditValor(e.target.value)}
                          autoFocus
                          placeholder="0,00"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") salvar(linha);
                            if (e.key === "Escape") fecharEdicao();
                          }}
                          className="w-24 px-2 py-1 text-sm font-mono bg-gray-950 border border-amber-700 rounded text-right text-white outline-none focus:border-amber-500"
                        />
                        <button
                          onClick={() => salvar(linha)}
                          disabled={isPending}
                          className="p-1 rounded text-emerald-400 hover:bg-emerald-950/40"
                        >
                          {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => abrirEdicao(linha)}
                        className={`font-mono text-sm px-2 py-1 rounded hover:bg-gray-800 transition-colors ${linha.valor_previsto > 0 ? "text-white" : "text-gray-600"}`}
                      >
                        {linha.valor_previsto > 0 ? formatBRL(linha.valor_previsto) : "+ definir"}
                      </button>
                    )}
                  </td>

                  <td className="px-4 py-3 text-right">
                    <span className={`font-mono text-sm ${linha.gasto_real > 0 ? "text-rose-300" : "text-gray-600"}`}>
                      {linha.gasto_real > 0 ? formatBRL(linha.gasto_real) : "—"}
                    </span>
                  </td>

                  <td className="px-4 py-3 text-right">
                    <span className={`font-mono text-xs ${linha.gasto_previsto > 0 ? "text-amber-400/70" : "text-gray-700"}`}>
                      {linha.gasto_previsto > 0 ? formatBRL(linha.gasto_previsto) : "—"}
                    </span>
                  </td>

                  <td className="px-4 py-3 text-right">
                    {linha.valor_previsto > 0 ? (
                      <span className={`font-mono text-sm ${restante >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {formatBRL(restante)}
                      </span>
                    ) : (
                      <span className="text-gray-700">—</span>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    {linha.valor_previsto > 0 ? (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-800 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full ${BAR_COLOR[linha.status]} transition-all`}
                            style={{ width: `${pctClamped}%` }}
                          />
                        </div>
                        <span className={`text-xs font-mono w-12 text-right ${linha.status === "estourou" ? "text-rose-400" : "text-gray-400"}`}>
                          {pct}%
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-700">—</span>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${STATUS_COLOR[linha.status]}`}>
                      {STATUS_LABEL[linha.status]}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-xs text-gray-500 flex items-start gap-2">
        <TrendingUp className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <span>
          <strong>Gasto real</strong> = transações pagas/confirmadas. <strong>Previsto</strong> = recorrências e parcelas futuras (ainda não pagas).
          Categorias sem orçamento mostram só o realizado.
        </span>
      </div>
    </div>
  );
}
