"use client";

import { useMemo, useState } from "react";
import type { Entidade } from "@/lib/types/database";
import type { ProjecaoItem } from "./page";
import { TrendingDown, TrendingUp, Calendar, ChevronDown, ChevronUp } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { formatBRL, formatDate } from "@/lib/formatters";

type EntLite = Pick<Entidade, "id" | "nome" | "tipo" | "cor_hex" | "ativo" | "ordem">;
type Modo = "semanal" | "mensal";

function inicioSemana(d: Date) {
  const dt = new Date(d);
  const dow = dt.getDay(); // 0=domingo
  // Considera semana começando segunda
  const offset = dow === 0 ? -6 : 1 - dow;
  dt.setDate(dt.getDate() + offset);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function fimSemana(d: Date) {
  const ini = inicioSemana(d);
  const fim = new Date(ini);
  fim.setDate(fim.getDate() + 6);
  return fim;
}

function chaveSemana(d: Date) {
  const i = inicioSemana(d);
  return i.toISOString().slice(0, 10);
}

function chaveMes(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatRange(ini: Date, fim: Date) {
  const sameMonth = ini.getMonth() === fim.getMonth();
  if (sameMonth) {
    return `${ini.getDate()} a ${fim.getDate()} de ${ini.toLocaleString("pt-BR", { month: "short" })}`;
  }
  return `${ini.getDate()}/${ini.getMonth() + 1} a ${fim.getDate()}/${fim.getMonth() + 1}`;
}

export function ProjecaoClient({
  items,
  entidades,
}: {
  items: ProjecaoItem[];
  entidades: EntLite[];
}) {
  const [modo, setModo] = useState<Modo>("semanal");
  const [filtroEnt, setFiltroEnt] = useState<string>("todas");
  const [expandido, setExpandido] = useState<string | null>(null);

  const filtrados = useMemo(
    () => filtroEnt === "todas" ? items : items.filter((i) => i.entidade_id === filtroEnt),
    [items, filtroEnt]
  );

  // Agrupa por semana ou mês
  const grupos = useMemo(() => {
    const map = new Map<string, { inicio: Date; fim: Date; items: ProjecaoItem[]; receitas: number; despesas: number }>();
    for (const it of filtrados) {
      const data = new Date(it.data + "T00:00:00");
      let chave: string, ini: Date, fim: Date;
      if (modo === "semanal") {
        chave = chaveSemana(data);
        ini = inicioSemana(data);
        fim = fimSemana(data);
      } else {
        chave = chaveMes(data);
        ini = new Date(data.getFullYear(), data.getMonth(), 1);
        fim = new Date(data.getFullYear(), data.getMonth() + 1, 0);
      }
      const cur = map.get(chave) ?? { inicio: ini, fim, items: [], receitas: 0, despesas: 0 };
      cur.items.push(it);
      if (it.tipo === "receita") cur.receitas += Number(it.valor);
      else cur.despesas += Number(it.valor);
      map.set(chave, cur);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([chave, dados]) => ({ chave, ...dados }));
  }, [filtrados, modo]);

  const totais = useMemo(() => {
    let r = 0, d = 0;
    for (const it of filtrados) {
      if (it.tipo === "receita") r += Number(it.valor);
      else d += Number(it.valor);
    }
    return { receitas: r, despesas: d, saldo: r - d };
  }, [filtrados]);

  return (
    <div>
      <PageHeader
        titulo="Projeção de fluxo de caixa"
        descricao="Próximos 6 meses. Despesas previstas (recorrências + parcelas) + receitas a receber (Greenn, lançamentos manuais)."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Stat label="A receber (6m)" value={formatBRL(totais.receitas)} color="emerald" icon={TrendingUp} />
        <Stat label="A pagar (6m)" value={formatBRL(totais.despesas)} color="rose" icon={TrendingDown} />
        <Stat
          label="Saldo projetado"
          value={formatBRL(totais.saldo)}
          color={totais.saldo >= 0 ? "emerald" : "rose"}
          icon={TrendingUp}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex gap-1 p-1 bg-gray-800 rounded-lg w-fit">
          <button
            onClick={() => setModo("semanal")}
            className={"px-3 py-1.5 text-xs rounded-md transition-colors " + (modo === "semanal" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white")}
          >
            Semanal
          </button>
          <button
            onClick={() => setModo("mensal")}
            className={"px-3 py-1.5 text-xs rounded-md transition-colors " + (modo === "mensal" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white")}
          >
            Mensal
          </button>
        </div>
        <select
          value={filtroEnt}
          onChange={(e) => setFiltroEnt(e.target.value)}
          className="h-8 px-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white"
        >
          <option value="todas">Todas as entidades</option>
          {entidades.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </select>
        <span className="text-xs text-gray-500 ml-auto">
          {filtrados.length} item{filtrados.length === 1 ? "" : "s"} previstos
        </span>
      </div>

      {grupos.length === 0 ? (
        <EmptyState
          icon={Calendar}
          titulo="Nada previsto"
          descricao="Cadastre recorrências em /recorrencias pra ver projeção."
        />
      ) : (
        <div className="space-y-3">
          {grupos.map((g) => {
            const aberto = expandido === g.chave;
            const saldoSemana = g.receitas - g.despesas;
            const labelPeriodo = modo === "semanal"
              ? formatRange(g.inicio, g.fim)
              : g.inicio.toLocaleString("pt-BR", { month: "long", year: "numeric" });

            return (
              <div key={g.chave} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandido(aberto ? null : g.chave)}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-800/30 transition-colors"
                >
                  <div className="flex items-center gap-4 text-left">
                    <Calendar className="w-4 h-4 text-gray-500 shrink-0" />
                    <div>
                      <div className="text-sm font-semibold text-white capitalize">{labelPeriodo}</div>
                      <div className="text-xs text-gray-500">{g.items.length} item{g.items.length === 1 ? "" : "s"}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="text-xs text-gray-500">A receber</div>
                      <div className="text-sm font-mono text-emerald-300">+{formatBRL(g.receitas)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-500">A pagar</div>
                      <div className="text-sm font-mono text-rose-300">−{formatBRL(g.despesas)}</div>
                    </div>
                    <div className="text-right min-w-[110px]">
                      <div className="text-xs text-gray-500">Saldo</div>
                      <div className={"text-base font-mono font-semibold " + (saldoSemana >= 0 ? "text-emerald-300" : "text-rose-300")}>
                        {saldoSemana >= 0 ? "+" : "−"}{formatBRL(Math.abs(saldoSemana))}
                      </div>
                    </div>
                    {aberto ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                  </div>
                </button>
                {aberto && (
                  <div className="border-t border-gray-800">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-800/30 text-xs uppercase tracking-wide text-gray-500">
                        <tr>
                          <th className="text-left px-4 py-2">Data</th>
                          <th className="text-left px-4 py-2">Descrição</th>
                          <th className="text-left px-4 py-2">Origem</th>
                          <th className="text-right px-4 py-2">Valor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800/50">
                        {g.items
                          .sort((a, b) => a.data.localeCompare(b.data))
                          .map((it) => {
                            const ent = entidades.find((e) => e.id === it.entidade_id);
                            const fonte = it.recorrencia_id ? "Recorrência" : it.origem_receita ? `${it.origem_receita}` : "Avulso";
                            return (
                              <tr key={it.id}>
                                <td className="px-4 py-2 text-gray-400 whitespace-nowrap">{formatDate(it.data)}</td>
                                <td className="px-4 py-2">
                                  <div className="flex items-center gap-2">
                                    {it.tipo === "receita" ? (
                                      <TrendingUp className="w-3 h-3 text-emerald-400 shrink-0" />
                                    ) : (
                                      <TrendingDown className="w-3 h-3 text-rose-400 shrink-0" />
                                    )}
                                    <span className="text-gray-200">{it.descricao}</span>
                                  </div>
                                  {ent && <div className="text-xs text-gray-500 ml-5">{ent.nome}</div>}
                                </td>
                                <td className="px-4 py-2 text-xs text-gray-500">{fonte}</td>
                                <td className={"px-4 py-2 text-right font-mono " + (it.tipo === "receita" ? "text-emerald-300" : "text-gray-200")}>
                                  {it.tipo === "receita" ? "+" : "−"}{formatBRL(it.valor)}
                                </td>
                              </tr>
                            );
                          })}
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

function Stat({
  label,
  value,
  color,
  icon: Icon,
}: {
  label: string;
  value: string;
  color: "emerald" | "rose";
  icon: typeof TrendingUp;
}) {
  const cls = color === "emerald" ? "text-emerald-300" : "text-rose-300";
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs uppercase tracking-wide text-gray-400">{label}</span>
        <Icon className={`w-4 h-4 ${cls}`} />
      </div>
      <div className={`text-2xl font-bold ${cls}`}>{value}</div>
    </div>
  );
}
