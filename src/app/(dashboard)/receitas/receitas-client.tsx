"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type { Entidade, OrigemReceita, ReceitaBruta, StatusReceita } from "@/lib/types/database";
import { TrendingUp, Plus, Pencil, Trash2, CheckCircle2, Clock, AlertCircle, Megaphone, ExternalLink } from "lucide-react";
import { PeriodoFilter } from "./periodo-filter";
import { GreennSaldoCard } from "./greenn-saldo-card";
import { FaturamentoMesCard } from "./faturamento-mes-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { formatBRL, formatDate } from "@/lib/formatters";
import { salvarReceita, deletarReceita, marcarReceitaRecebida, type ReceitaInput } from "./actions";

type EntLite = Pick<Entidade, "id" | "nome" | "tipo" | "cor_hex" | "ativo" | "ordem">;

const ORIGENS: { value: OrigemReceita; label: string }[] = [
  { value: "manual", label: "Manual" },
  { value: "publi", label: "Publi" },
  { value: "adsense", label: "AdSense" },
  { value: "palestra", label: "Palestra" },
  { value: "consultoria", label: "Consultoria" },
  { value: "greenn", label: "Greenn (auto)" },
  { value: "amazon_aff", label: "Amazon afiliados" },
  { value: "shopee_aff", label: "Shopee afiliados" },
  { value: "ml_aff", label: "ML afiliados" },
  { value: "outro", label: "Outro" },
];

/**
 * Lista completa de status (DB suporta todos — Greenn webhook usa).
 * Usado pra renderizar badge na listagem.
 */
const STATUS: { value: StatusReceita; label: string; cls: string }[] = [
  { value: "previsto", label: "Previsto", cls: "bg-blue-900/40 text-blue-300" },
  { value: "confirmado", label: "Confirmado", cls: "bg-blue-900/40 text-blue-300" },
  { value: "pendente", label: "Pendente", cls: "bg-amber-900/40 text-amber-300" },
  { value: "disponivel", label: "Disponível", cls: "bg-cyan-900/40 text-cyan-300" },
  { value: "antecipado", label: "Antecipado", cls: "bg-purple-900/40 text-purple-300" },
  { value: "recebido", label: "Recebido", cls: "bg-emerald-900/40 text-emerald-300" },
  { value: "reembolsado", label: "Reembolsado", cls: "bg-rose-900/40 text-rose-300" },
  { value: "chargeback", label: "Chargeback", cls: "bg-rose-900/40 text-rose-300" },
  { value: "cancelado", label: "Cancelado", cls: "bg-gray-800 text-gray-400" },
  { value: "atrasado", label: "Atrasado", cls: "bg-rose-900/40 text-rose-300" },
];

/**
 * Status simplificados pro form de cadastro manual (apenas 3 opções).
 * Greenn webhook continua usando o set completo no DB.
 */
const STATUS_MANUAIS: { value: StatusReceita; label: string }[] = [
  { value: "previsto", label: "Previsto" },
  { value: "confirmado", label: "Confirmado" },
  { value: "atrasado", label: "Atrasado" },
];

export function ReceitasClient({
  receitas,
  entidades,
  periodo,
  metaLiquido,
  saldoGreenn,
  receitasDoMes,
}: {
  receitas: ReceitaBruta[];
  entidades: EntLite[];
  periodo: "atual" | "proximos" | "anteriores";
  metaLiquido: number;
  saldoGreenn: { disponivel: number; pendente: number; antecipavel: number; capturado_em: string } | null;
  receitasDoMes: Array<{ origem: string; valor_liquido: number; status: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ReceitaBruta | null>(null);
  const [filtroOrigem, setFiltroOrigem] = useState<"todas" | OrigemReceita>("todas");

  const filtradas = useMemo(
    () => filtroOrigem === "todas" ? receitas : receitas.filter((r) => r.origem === filtroOrigem),
    [receitas, filtroOrigem]
  );

  const stats = useMemo(() => {
    let bruto = 0, liquido = 0, recebido = 0, aReceber = 0;
    for (const r of receitas) {
      bruto += Number(r.valor_bruto);
      liquido += Number(r.valor_liquido);
      if (r.status === "recebido") recebido += Number(r.valor_liquido);
      else if (!["reembolsado", "chargeback", "cancelado"].includes(r.status)) {
        aReceber += Number(r.valor_liquido);
      }
    }
    return { bruto, liquido, recebido, aReceber };
  }, [receitas]);

  const periodoLabel = periodo === "proximos" ? "próximos" : periodo === "anteriores" ? "anteriores" : "mês";
  const labelLista =
    periodo === "atual" ? "mês atual" :
    periodo === "proximos" ? "previstas para os próximos meses" :
    "últimos 90 dias (antes deste mês)";

  return (
    <div>
      <PageHeader
        titulo="Receitas"
        descricao="Faturamento bruto (Greenn, afiliados, publis, AdSense, palestras). Diferente do dinheiro em conta — esse fica em Movimentações."
        acao={
          <div className="flex items-center gap-3">
            <PeriodoFilter current={periodo} />
            <Button onClick={() => { setEditing(null); setOpen(true); }} disabled={entidades.length === 0}>
              <Plus className="w-4 h-4" /> Lançar receita
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        <Stat label={`Bruto (${periodoLabel})`} value={formatBRL(stats.bruto)} />
        <Stat label={`Líquido (${periodoLabel})`} value={formatBRL(stats.liquido)} />
        <Stat label="Recebido" value={formatBRL(stats.recebido)} highlight="emerald" />
        <Stat label="A receber" value={formatBRL(stats.aReceber)} highlight="amber" />
      </div>

      {/* Saldo Greenn (cole print → Claude Vision extrai) */}
      <GreennSaldoCard saldo={saldoGreenn} />

      {/* Faturamento do mês — agregado por origem */}
      <FaturamentoMesCard receitas={receitasDoMes} />

      {/* Card fixo: Meta Ads líquido do mês corrente (só o valor que importa pro caixa) */}
      {metaLiquido > 0 && (
        <div className="bg-gradient-to-br from-blue-950/40 to-indigo-950/30 border border-blue-900/50 rounded-xl p-4 mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Megaphone className="w-5 h-5 text-blue-400 shrink-0" />
            <div>
              <div className="text-[10px] text-gray-400 uppercase tracking-wide">
                Meta Ads — faturamento líquido (mês atual)
              </div>
              <div className="text-2xl font-bold text-emerald-300 mt-0.5">{formatBRL(metaLiquido)}</div>
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

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Select value={filtroOrigem} onValueChange={(v) => setFiltroOrigem(v as typeof filtroOrigem)}>
          <SelectTrigger className="w-56 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as origens</SelectItem>
            {ORIGENS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-gray-500 ml-auto">
          {filtradas.length} receita{filtradas.length === 1 ? "" : "s"} ({labelLista})
        </span>
      </div>

      {filtradas.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          titulo="Nenhuma receita"
          descricao="Lança publi, palestra ou recebimento manual. Greenn alimenta automaticamente quando integrarmos o webhook."
          acao={entidades.length > 0 && <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="w-4 h-4" /> Criar</Button>}
        />
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-800/50 text-xs uppercase tracking-wide text-gray-400">
              <tr>
                <th className="text-left px-4 py-3">Previsão</th>
                <th className="text-left px-4 py-3">Recebimento</th>
                <th className="text-left px-4 py-3">Produto/Cliente</th>
                <th className="text-left px-4 py-3">Origem</th>
                <th className="text-right px-4 py-3">Valor</th>
                <th className="text-right px-4 py-3">Líquido</th>
                <th className="text-center px-4 py-3">Status</th>
                <th className="text-right px-4 py-3 w-24">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filtradas.map((r) => (
                <Row
                  key={r.id}
                  rec={r}
                  entidade={entidades.find((e) => e.id === r.entidade_id)}
                  onEdit={() => { setEditing(r); setOpen(true); }}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ReceitaFormDialog
        open={open}
        onOpenChange={setOpen}
        receita={editing}
        entidades={entidades}
        onSaved={() => setOpen(false)}
      />
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: "emerald" | "amber" }) {
  const cls =
    highlight === "emerald" ? "text-emerald-300" :
    highlight === "amber" ? "text-amber-300" : "text-white";
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="text-xs uppercase tracking-wide text-gray-400 mb-1">{label}</div>
      <div className={`text-xl font-bold ${cls}`}>{value}</div>
    </div>
  );
}

function Row({ rec, entidade, onEdit }: { rec: ReceitaBruta; entidade?: EntLite; onEdit: () => void }) {
  const [pending, startTransition] = useTransition();

  function deletar() {
    if (!confirm("Excluir esta receita?")) return;
    startTransition(async () => {
      const res = await deletarReceita(rec.id);
      if ("error" in res && res.error) alert(`Erro: ${res.error}`);
    });
  }
  function receber() {
    const dt = new Date().toISOString().slice(0, 10);
    startTransition(async () => {
      const res = await marcarReceitaRecebida(rec.id, dt);
      if ("error" in res && res.error) alert(`Erro: ${res.error}`);
    });
  }

  const status = STATUS.find((s) => s.value === rec.status);
  const StatusIcon = rec.status === "recebido" ? CheckCircle2 : rec.status === "atrasado" || rec.status === "chargeback" || rec.status === "reembolsado" ? AlertCircle : Clock;

  return (
    <tr className="hover:bg-gray-800/30">
      <td className="px-4 py-3 text-sm text-gray-300 whitespace-nowrap">{rec.data_prevista_pagamento ? formatDate(rec.data_prevista_pagamento) : <span className="text-gray-600">—</span>}</td>
      <td className="px-4 py-3 text-sm text-gray-300 whitespace-nowrap">{rec.data_recebimento ? formatDate(rec.data_recebimento) : <span className="text-gray-600">—</span>}</td>
      <td className="px-4 py-3">
        <div className="text-sm font-medium text-white">{rec.produto_nome ?? "—"}</div>
        <div className="text-xs text-gray-500">
          {rec.cliente_nome ?? entidade?.nome ?? ""}
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-gray-400">
        {ORIGENS.find((o) => o.value === rec.origem)?.label ?? rec.origem}
      </td>
      <td className="px-4 py-3 text-right text-sm font-mono text-gray-300 whitespace-nowrap">{formatBRL(rec.valor_bruto)}</td>
      <td className="px-4 py-3 text-right text-sm font-mono text-white whitespace-nowrap">{formatBRL(rec.valor_liquido)}</td>
      <td className="px-4 py-3 text-center">
        <span className={"inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-md font-medium " + (status?.cls ?? "")}>
          <StatusIcon className="w-3 h-3" />
          {status?.label ?? rec.status}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex justify-end gap-1">
          {rec.status !== "recebido" && rec.status !== "reembolsado" && rec.status !== "cancelado" && (
            <Button variant="ghost" size="icon" onClick={receber} disabled={pending} title="Marcar recebido">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={onEdit} disabled={pending}><Pencil className="w-4 h-4" /></Button>
          <Button variant="ghost" size="icon" onClick={deletar} disabled={pending}><Trash2 className="w-4 h-4 text-red-400" /></Button>
        </div>
      </td>
    </tr>
  );
}

function ReceitaFormDialog({
  open,
  onOpenChange,
  receita,
  entidades,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  receita: ReceitaBruta | null;
  entidades: EntLite[];
  onSaved: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  const [origem, setOrigem] = useState<OrigemReceita>("publi");
  const [produto, setProduto] = useState("");
  const [cliente, setCliente] = useState("");
  const [valor, setValor] = useState("0");
  const [imposto, setImposto] = useState("0");
  const [dataPrev, setDataPrev] = useState("");
  const [dataReceb, setDataReceb] = useState("");
  const [status, setStatus] = useState<StatusReceita>("previsto");
  const [entidadeId, setEntidadeId] = useState("");
  const [notas, setNotas] = useState("");

  useEffect(() => {
    if (!open) return;
    setOrigem((receita?.origem as OrigemReceita) ?? "publi");
    setProduto(receita?.produto_nome ?? "");
    setCliente(receita?.cliente_nome ?? "");
    setValor(receita ? String(receita.valor_bruto) : "0");
    setImposto(receita ? String(receita.taxas) : "0");
    setDataPrev(receita?.data_prevista_pagamento ?? "");
    setDataReceb(receita?.data_recebimento ?? "");
    setStatus((receita?.status as StatusReceita) ?? "previsto");
    setEntidadeId(receita?.entidade_id ?? entidades[0]?.id ?? "");
    setNotas(receita?.notas ?? "");
    setErro(null);
  }, [open, receita, entidades]);

  // Auto-detecta status baseado em datas
  useEffect(() => {
    if (dataReceb) {
      setStatus("confirmado");
    } else if (dataPrev && dataPrev < new Date().toISOString().slice(0, 10)) {
      // Se o status atual não foi mudado manualmente pelo usuário recente, sugere atrasado
      setStatus((prev) => (prev === "previsto" || prev === "atrasado") ? "atrasado" : prev);
    }
  }, [dataReceb, dataPrev]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const v = parseFloat(valor.replace(",", "."));
    const t = parseFloat(imposto.replace(",", ".")) || 0;
    if (!v || v <= 0) return setErro("Valor deve ser maior que zero.");
    if (!entidadeId) return setErro("Selecione uma entidade.");

    const input: ReceitaInput = {
      id: receita?.id,
      origem,
      produto_nome: produto,
      cliente_nome: cliente,
      valor_bruto: v,
      taxas: t,
      metodo_pagamento: "PIX",
      parcelas: 1,
      // data_venda preenchida automaticamente: usa data_recebimento se houve, senão hoje
      data_venda: dataReceb || receita?.data_venda || new Date().toISOString().slice(0, 10),
      data_prevista_pagamento: dataPrev || null,
      data_recebimento: dataReceb || null,
      status,
      entidade_id: entidadeId,
      notas,
    };

    startTransition(async () => {
      const res = await salvarReceita(input);
      if ("error" in res && res.error) setErro(res.error);
      else onSaved();
    });
  }

  const valorNum = parseFloat(valor.replace(",", ".")) || 0;
  const impostoNum = parseFloat(imposto.replace(",", ".")) || 0;
  const liquidoCalc = valorNum - impostoNum;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{receita ? "Editar receita" : "Nova receita"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Origem</Label>
              <Select value={origem} onValueChange={(v) => setOrigem(v as OrigemReceita)}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ORIGENS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Entidade que recebe</Label>
              <Select value={entidadeId} onValueChange={setEntidadeId}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {entidades.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome} ({e.tipo})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="prod">Produto / Descrição</Label>
              <Input id="prod" value={produto} onChange={(e) => setProduto(e.target.value)} placeholder="Ex: Publi Cremer abril/26" className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="cli">Cliente / Pagador</Label>
              <Input id="cli" value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Opcional" className="mt-1.5" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="valor">Valor (R$)</Label>
              <Input id="valor" type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} required className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="imposto">Imposto (R$)</Label>
              <Input id="imposto" type="number" step="0.01" value={imposto} onChange={(e) => setImposto(e.target.value)} className="mt-1.5" />
              <p className="text-xs text-gray-500 mt-1">Opcional — IR retido na nota.</p>
            </div>
            <div>
              <Label>Líquido</Label>
              <div className="mt-1.5 h-10 px-3 flex items-center font-mono text-emerald-300 bg-gray-800 rounded-lg border border-gray-700">
                {formatBRL(liquidoCalc)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="dp">Previsão de pagamento</Label>
              <Input id="dp" type="date" value={dataPrev} onChange={(e) => setDataPrev(e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="dr">Data de recebimento</Label>
              <Input id="dr" type="date" value={dataReceb} onChange={(e) => setDataReceb(e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as StatusReceita)}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_MANUAIS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">Auto: vira "Confirmado" se preencher recebimento.</p>
            </div>
          </div>

          <div>
            <Label htmlFor="notas">Notas</Label>
            <Textarea id="notas" value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Opcional" className="mt-1.5" />
          </div>

          {erro && (
            <div className="bg-red-900/30 border border-red-700 rounded-lg px-3 py-2 text-red-400 text-sm">
              {erro}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>Cancelar</Button>
            <Button type="submit" disabled={pending}>{pending ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
