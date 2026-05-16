"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";

const OPTS = [
  { value: "atual", label: "Mês atual" },
  { value: "proximos", label: "Próximos meses" },
  { value: "personalizado", label: "Personalizado" },
] as const;

export function PeriodoFilter({ current, criterio }: { current: string; criterio: "competencia" | "caixa" }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [showCustom, setShowCustom] = useState(current === "personalizado");
  const [dataInicio, setDataInicio] = useState(sp.get("inicio") ?? "");
  const [dataFim, setDataFim] = useState(sp.get("fim") ?? "");

  useEffect(() => {
    setShowCustom(current === "personalizado");
    if (current === "personalizado") {
      setDataInicio(sp.get("inicio") ?? "");
      setDataFim(sp.get("fim") ?? "");
    }
  }, [current, sp]);

  // Helper: monta URL preservando o critério atual
  function buildUrl(periodo: string, extra?: Record<string, string>): string {
    const qs = new URLSearchParams();
    if (periodo !== "atual") qs.set("p", periodo);
    if (criterio !== "competencia") qs.set("criterio", criterio);
    if (extra) for (const [k, v] of Object.entries(extra)) qs.set(k, v);
    const s = qs.toString();
    return s ? `/receitas?${s}` : "/receitas";
  }

  function handleClick(v: string) {
    if (v === "personalizado") {
      const now = new Date();
      const ini = dataInicio || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const fim = dataFim || new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
      setDataInicio(ini);
      setDataFim(fim);
      router.push(buildUrl("personalizado", { inicio: ini, fim }));
    } else {
      router.push(buildUrl(v));
    }
  }

  function aplicarPersonalizado() {
    if (!dataInicio || !dataFim) return;
    router.push(buildUrl("personalizado", { inicio: dataInicio, fim: dataFim }));
  }

  function trocarCriterio(novo: "competencia" | "caixa") {
    if (novo === criterio) return;
    const qs = new URLSearchParams();
    if (current !== "atual") qs.set("p", current);
    if (novo !== "competencia") qs.set("criterio", novo);
    if (current === "personalizado") {
      if (dataInicio) qs.set("inicio", dataInicio);
      if (dataFim) qs.set("fim", dataFim);
    }
    const s = qs.toString();
    router.push(s ? `/receitas?${s}` : "/receitas");
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-3">
        {/* Toggle critério */}
        <div className="flex items-center gap-1 bg-gray-900 border border-gray-800 rounded-lg p-1">
          <button
            onClick={() => trocarCriterio("competencia")}
            className={`px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-colors ${
              criterio === "competencia" ? "bg-blue-700 text-white" : "text-gray-400 hover:text-white"
            }`}
            title="Filtra pela data da venda (mês de faturamento)"
          >
            Competência
          </button>
          <button
            onClick={() => trocarCriterio("caixa")}
            className={`px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-colors ${
              criterio === "caixa" ? "bg-emerald-700 text-white" : "text-gray-400 hover:text-white"
            }`}
            title="Filtra pela previsão de pagamento (mês que cai)"
          >
            Caixa
          </button>
        </div>

        {/* Botões de período */}
        <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-lg p-1">
          {OPTS.map((o) => (
            <button
              key={o.value}
              onClick={() => handleClick(o.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                current === o.value
                  ? "bg-gray-700 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
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
  );
}
