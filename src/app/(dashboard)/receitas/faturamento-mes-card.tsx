"use client";

import { TrendingUp } from "lucide-react";
import { formatBRL } from "@/lib/formatters";

type Receita = {
  origem: string;
  valor_liquido: number;
  status: string;
};

const ORIGEM_LABELS: Record<string, { label: string; cor: string }> = {
  greenn: { label: "Greenn", cor: "bg-emerald-500" },
  amazon_aff: { label: "Amazon Afiliados", cor: "bg-orange-500" },
  shopee_aff: { label: "Shopee Afiliados", cor: "bg-rose-500" },
  ml_aff: { label: "ML Afiliados", cor: "bg-yellow-500" },
  publi: { label: "Publi", cor: "bg-purple-500" },
  adsense: { label: "AdSense", cor: "bg-blue-500" },
  palestra: { label: "Palestra", cor: "bg-cyan-500" },
  consultoria: { label: "Consultoria", cor: "bg-teal-500" },
  manual: { label: "Manual", cor: "bg-gray-500" },
  outro: { label: "Outro", cor: "bg-gray-600" },
};

export function FaturamentoMesCard({ receitas }: { receitas: Receita[] }) {
  // Agrega por origem
  const porOrigem = new Map<string, { faturado: number; recebido: number; aReceber: number }>();
  let totalFaturado = 0;
  let totalRecebido = 0;
  let totalAReceber = 0;

  for (const r of receitas) {
    const o = r.origem || "outro";
    const v = Number(r.valor_liquido);
    if (!porOrigem.has(o)) porOrigem.set(o, { faturado: 0, recebido: 0, aReceber: 0 });
    const bucket = porOrigem.get(o)!;
    bucket.faturado += v;
    totalFaturado += v;
    if (r.status === "recebido") {
      bucket.recebido += v;
      totalRecebido += v;
    } else if (!["reembolsado", "chargeback", "cancelado"].includes(r.status)) {
      bucket.aReceber += v;
      totalAReceber += v;
    }
  }

  const linhas = [...porOrigem.entries()]
    .sort((a, b) => b[1].faturado - a[1].faturado);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-400" /> Faturamento do mês
        </h2>
        <div className="text-[11px] text-gray-500">por origem</div>
      </div>

      {linhas.length === 0 ? (
        <p className="text-sm text-gray-500 py-3">
          Nenhuma receita lançada este mês. Use o botão <em>Lançar receita</em> abaixo para Amazon/Shopee/ML afiliados, ou atualize o saldo Greenn no card acima.
        </p>
      ) : (
        <>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-gray-500 border-b border-gray-800">
                <th className="text-left py-2 font-medium">Origem</th>
                <th className="text-right py-2 font-medium">Faturado</th>
                <th className="text-right py-2 font-medium">Recebido</th>
                <th className="text-right py-2 font-medium">A receber</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {linhas.map(([origem, b]) => {
                const meta = ORIGEM_LABELS[origem] || { label: origem, cor: "bg-gray-500" };
                return (
                  <tr key={origem}>
                    <td className="py-2.5">
                      <div className="flex items-center gap-2">
                        <span className={`inline-block w-2 h-2 rounded-full ${meta.cor}`} />
                        <span className="text-gray-200">{meta.label}</span>
                      </div>
                    </td>
                    <td className="py-2.5 text-right font-mono text-white">{formatBRL(b.faturado)}</td>
                    <td className="py-2.5 text-right font-mono text-emerald-300">{formatBRL(b.recebido)}</td>
                    <td className="py-2.5 text-right font-mono text-amber-300">{formatBRL(b.aReceber)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-700 text-sm">
                <td className="py-3 font-semibold text-white">Total</td>
                <td className="py-3 text-right font-mono font-semibold text-white">{formatBRL(totalFaturado)}</td>
                <td className="py-3 text-right font-mono font-semibold text-emerald-300">{formatBRL(totalRecebido)}</td>
                <td className="py-3 text-right font-mono font-semibold text-amber-300">{formatBRL(totalAReceber)}</td>
              </tr>
            </tfoot>
          </table>
        </>
      )}
    </div>
  );
}
