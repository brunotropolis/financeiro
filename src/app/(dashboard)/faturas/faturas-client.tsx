"use client";

import { useMemo, useState } from "react";
import type { CartaoCredito, Transacao } from "@/lib/types/database";
import { ScrollText, ChevronDown, ChevronUp } from "lucide-react";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { formatBRL, formatDate } from "@/lib/formatters";

/**
 * Calcula a competência de fatura de uma transação:
 * Se a data da compra é DEPOIS do dia de fechamento do cartão,
 * a transação cai na fatura do mês seguinte.
 */
function competenciaFatura(dataStr: string, diaFechamento: number): { ano: number; mes: number } {
  const data = new Date(dataStr + "T00:00:00");
  const dia = data.getDate();
  let mes = data.getMonth(); // 0-11
  let ano = data.getFullYear();
  if (dia > diaFechamento) {
    mes++;
    if (mes > 11) { mes = 0; ano++; }
  }
  return { ano, mes };
}

function nomeMes(mes: number) {
  return ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][mes];
}

function vencimentoFatura(ano: number, mes: number, diaVencimento: number) {
  return new Date(ano, mes, diaVencimento);
}

type Fatura = {
  cartaoId: string;
  ano: number;
  mes: number;
  vencimento: Date;
  total: number;
  transacoes: Transacao[];
};

export function FaturasClient({
  cartoes,
  transacoes,
}: {
  cartoes: CartaoCredito[];
  transacoes: Transacao[];
}) {
  const [cartaoFiltro, setCartaoFiltro] = useState<string>(cartoes[0]?.id ?? "");
  const [expandida, setExpandida] = useState<string | null>(null);

  const cartaoAtivo = cartoes.find((c) => c.id === cartaoFiltro);

  const faturas = useMemo<Fatura[]>(() => {
    if (!cartaoAtivo) return [];
    const txs = transacoes.filter((t) => t.cartao_id === cartaoAtivo.id);
    const map = new Map<string, Fatura>();
    for (const tx of txs) {
      const { ano, mes } = competenciaFatura(tx.data_competencia, cartaoAtivo.dia_fechamento);
      const key = `${ano}-${String(mes).padStart(2, "0")}`;
      const cur = map.get(key) ?? {
        cartaoId: cartaoAtivo.id,
        ano,
        mes,
        vencimento: vencimentoFatura(ano, mes, cartaoAtivo.dia_vencimento),
        total: 0,
        transacoes: [],
      };
      cur.total += Number(tx.valor);
      cur.transacoes.push(tx);
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.vencimento.getTime() - a.vencimento.getTime());
  }, [cartaoAtivo, transacoes]);

  if (cartoes.length === 0) {
    return (
      <div>
        <PageHeader titulo="Faturas" descricao="Faturas mensais por cartão de crédito" />
        <EmptyState
          icon={ScrollText}
          titulo="Nenhum cartão cadastrado"
          descricao="Cadastre um cartão pra ver faturas aparecerem aqui."
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        titulo="Faturas"
        descricao="Compras agrupadas por mês de fatura conforme dia de fechamento do cartão."
      />

      <div className="mb-4 max-w-md">
        <Select value={cartaoFiltro} onValueChange={setCartaoFiltro}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {cartoes.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {cartaoAtivo && (
        <div className="mb-6 text-xs text-gray-500 px-1">
          Fecha dia <span className="text-gray-300">{cartaoAtivo.dia_fechamento}</span>,
          vence dia <span className="text-gray-300">{cartaoAtivo.dia_vencimento}</span>
        </div>
      )}

      {faturas.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          titulo="Nenhuma compra neste cartão"
          descricao="Lança uma despesa em Transações pra começar."
        />
      ) : (
        <div className="space-y-3">
          {faturas.map((f) => {
            const key = `${f.ano}-${f.mes}`;
            const aberta = expandida === key;
            const hoje = new Date();
            const dias = Math.floor((f.vencimento.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
            const status =
              dias < 0 ? { label: "Vencida", cls: "text-rose-300" } :
              dias === 0 ? { label: "Vence hoje", cls: "text-amber-300" } :
              dias <= 7 ? { label: `Vence em ${dias}d`, cls: "text-amber-300" } :
              { label: `Vence em ${dias}d`, cls: "text-gray-400" };

            return (
              <div key={key} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandida(aberta ? null : key)}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-800/30 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-left">
                      <div className="text-base font-semibold text-white">
                        {nomeMes(f.mes)}/{f.ano}
                      </div>
                      <div className="text-xs text-gray-500">
                        Vencimento: {formatDate(f.vencimento.toISOString())} ·{" "}
                        <span className={status.cls}>{status.label}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-xs text-gray-500">{f.transacoes.length} compra{f.transacoes.length === 1 ? "" : "s"}</div>
                      <div className="text-lg font-mono text-white">{formatBRL(f.total)}</div>
                    </div>
                    {aberta ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                  </div>
                </button>
                {aberta && (
                  <div className="border-t border-gray-800">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-800/30 text-xs uppercase tracking-wide text-gray-500">
                        <tr>
                          <th className="text-left px-4 py-2">Data</th>
                          <th className="text-left px-4 py-2">Descrição</th>
                          <th className="text-right px-4 py-2">Valor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800/50">
                        {f.transacoes
                          .sort((a, b) => a.data_competencia.localeCompare(b.data_competencia))
                          .map((tx) => (
                            <tr key={tx.id}>
                              <td className="px-4 py-2 text-gray-400 whitespace-nowrap">{formatDate(tx.data_competencia)}</td>
                              <td className="px-4 py-2 text-gray-200">
                                {tx.descricao}
                                {tx.parcelado && tx.parcela_atual && tx.parcela_total && (
                                  <span className="text-xs text-gray-500 ml-1">({tx.parcela_atual}/{tx.parcela_total})</span>
                                )}
                              </td>
                              <td className="px-4 py-2 text-right font-mono text-gray-200">{formatBRL(tx.valor)}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
