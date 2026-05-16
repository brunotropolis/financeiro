"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type { Entidade, OrigemReceita, OrigemReceitaRow, ReceitaBruta, StatusReceita } from "@/lib/types/database";
import { TrendingUp, Plus, Pencil, Trash2, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { PeriodoFilter } from "./periodo-filter";
import { GreennSaldoCard } from "./greenn-saldo-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { formatBRL, formatDate, parseBRL, formatBRLEditable, maskBRLInput } from "@/lib/formatters";
import { salvarReceita, deletarReceita, marcarReceitaRecebida, type ReceitaInput } from "./actions";

type EntLite = Pick<Entidade, "id" | "nome" | "tipo" | "cor_hex" | "ativo" | "ordem">;

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
  origens,
  periodo,
  saldoGreenn,
  metaFatLiquido,
  greennPendente,
}: {
  receitas: ReceitaBruta[];
  entidades: EntLite[];
  origens: OrigemReceitaRow[];
  periodo: "atual" | "proximos" | "anteriores";
  saldoGreenn: { disponivel: number; pendente: number; antecipavel: number; capturado_em: string } | null;
  metaFatLiquido: number;
  greennPendente: number;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ReceitaBruta | null>(null);
  const [filtroOrigem, setFiltroOrigem] = useState<string>("todas");

  // Mapa slug → row (pra renderizar nome/cor das receitas existentes pelo slug)
  const origemBySlug = useMemo(() => {
    const m = new Map<string, OrigemReceitaRow>();
    for (const o of origens) m.set(o.slug, o);
    return m;
  }, [origens]);

  const filtradas = useMemo(
    () => filtroOrigem === "todas" ? receitas : receitas.filter((r) => r.origem === filtroOrigem),
    [receitas, filtroOrigem]
  );

  const stats = useMemo(() => {
    let manualLiquido = 0, manualRecebido = 0, manualAReceber = 0;
    for (const r of receitas) {
      manualLiquido += Number(r.valor_liquido);
      if (r.status === "recebido") manualRecebido += Number(r.valor_liquido);
      else if (!["reembolsado", "chargeback", "cancelado"].includes(r.status)) {
        manualAReceber += Number(r.valor_liquido);
      }
    }
    // Faturamento total = lançamentos manuais + Meta líquido (vendas Greenn auto)
    const faturamento = manualLiquido + metaFatLiquido;
    // A receber = lançamentos pendentes (Amazon/Shopee/ML/etc) + saldo Greenn pendente
    const aReceber = manualAReceber + greennPendente;
    // Recebido = (Faturamento - A receber) — quanto já caiu efetivamente em caixa
    // Para Greenn: faturado_meta - pendente = parte que já saiu pra conta
    // Para outras origens: lançamentos com status=recebido
    const recebido = Math.max(0, faturamento - aReceber);
    return { faturamento, recebido, aReceber, manualRecebido, manualAReceber };
  }, [receitas, metaFatLiquido, greennPendente]);

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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <Stat
          label={`Faturamento do ${periodoLabel}`}
          value={formatBRL(stats.faturamento)}
          hint={metaFatLiquido > 0 ? `inclui R$ ${metaFatLiquido.toFixed(2).replace(".", ",")} do Meta Ads` : undefined}
        />
        <Stat
          label="Recebido (em caixa)"
          value={formatBRL(stats.recebido)}
          highlight="emerald"
          hint="faturamento − a receber"
        />
        <Stat
          label="A receber"
          value={formatBRL(stats.aReceber)}
          highlight="amber"
          hint={greennPendente > 0 ? `inclui R$ ${greennPendente.toFixed(2).replace(".", ",")} pendente no Greenn` : undefined}
        />
      </div>

      {/* Saldo Greenn (cole print → Claude Vision extrai) */}
      <GreennSaldoCard saldo={saldoGreenn} />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Select value={filtroOrigem} onValueChange={setFiltroOrigem}>
          <SelectTrigger className="w-56 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as origens</SelectItem>
            {origens.map((o) => <SelectItem key={o.id} value={o.slug}>{o.nome}</SelectItem>)}
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
                <th className="text-left px-4 py-3">Origem</th>
                <th className="text-left px-4 py-3">Produto/Cliente</th>
                <th className="text-right px-4 py-3">Faturamento</th>
                <th className="text-right px-4 py-3">Recebido</th>
                <th className="text-right px-4 py-3">A receber</th>
                <th className="text-left px-4 py-3">Prev. pgto</th>
                <th className="text-right px-4 py-3 w-24">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filtradas.map((r) => (
                <Row
                  key={r.id}
                  rec={r}
                  entidade={entidades.find((e) => e.id === r.entidade_id)}
                  origem={origemBySlug.get(r.origem)}
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
        origens={origens}
        onSaved={() => setOpen(false)}
      />
    </div>
  );
}

function Stat({ label, value, highlight, hint }: { label: string; value: string; highlight?: "emerald" | "amber"; hint?: string }) {
  const cls =
    highlight === "emerald" ? "text-emerald-300" :
    highlight === "amber" ? "text-amber-300" : "text-white";
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="text-xs uppercase tracking-wide text-gray-400 mb-1">{label}</div>
      <div className={`text-xl font-bold ${cls}`}>{value}</div>
      {hint && <div className="text-[10px] text-gray-500 mt-1">{hint}</div>}
    </div>
  );
}

function Row({ rec, entidade, origem, onEdit }: { rec: ReceitaBruta; entidade?: EntLite; origem?: OrigemReceitaRow; onEdit: () => void }) {
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

  const isRecebido = rec.status === "recebido";
  const isCancelado = ["reembolsado", "chargeback", "cancelado"].includes(rec.status);
  const valor = Number(rec.valor_liquido);
  const StatusIcon = isRecebido ? CheckCircle2 : isCancelado ? AlertCircle : Clock;
  const statusInfo = STATUS.find((s) => s.value === rec.status);

  return (
    <tr className={`hover:bg-gray-800/30 ${isCancelado ? "opacity-50" : ""}`}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: origem?.cor_hex ?? "#6b7280" }} />
          <span className="text-sm text-gray-300">{origem?.nome ?? rec.origem}</span>
        </div>
        <div className="text-[10px] text-gray-500 mt-0.5 ml-4">
          {formatDate(rec.data_venda)}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <StatusIcon className={`w-3 h-3 shrink-0 ${isRecebido ? "text-emerald-400" : isCancelado ? "text-rose-400" : "text-amber-400"}`} />
          <span className="text-sm font-medium text-white truncate" title={statusInfo?.label}>{rec.produto_nome ?? "—"}</span>
        </div>
        <div className="text-xs text-gray-500 ml-4.5">
          {rec.cliente_nome ?? entidade?.nome ?? ""}
        </div>
      </td>
      <td className="px-4 py-3 text-right text-sm font-mono text-white whitespace-nowrap">{formatBRL(valor)}</td>
      <td className="px-4 py-3 text-right text-sm font-mono whitespace-nowrap">
        {isRecebido ? <span className="text-emerald-300">{formatBRL(valor)}</span> : <span className="text-gray-700">—</span>}
      </td>
      <td className="px-4 py-3 text-right text-sm font-mono whitespace-nowrap">
        {!isRecebido && !isCancelado ? <span className="text-amber-300">{formatBRL(valor)}</span> : <span className="text-gray-700">—</span>}
      </td>
      <td className="px-4 py-3 text-sm text-gray-400 whitespace-nowrap">
        {isRecebido && rec.data_recebimento ? (
          <span title="Recebido em">{formatDate(rec.data_recebimento)}</span>
        ) : rec.data_prevista_pagamento ? (
          <span title="Previsão">{formatDate(rec.data_prevista_pagamento)}</span>
        ) : (
          <span className="text-gray-600">—</span>
        )}
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
  origens,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  receita: ReceitaBruta | null;
  entidades: EntLite[];
  origens: OrigemReceitaRow[];
  onSaved: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  const [origemId, setOrigemId] = useState("");
  const [produto, setProduto] = useState("");
  const [cliente, setCliente] = useState("");
  const [valor, setValor] = useState("");
  const [dataPrev, setDataPrev] = useState("");
  const [dataReceb, setDataReceb] = useState("");
  const [status, setStatus] = useState<StatusReceita>("previsto");
  const [entidadeId, setEntidadeId] = useState("");
  const [notas, setNotas] = useState("");

  useEffect(() => {
    if (!open) return;
    // Encontra origem da receita atual pelo slug, ou primeira ativa como default
    const slugAtual = receita?.origem as string | undefined;
    const matched = slugAtual ? origens.find((o) => o.slug === slugAtual) : null;
    setOrigemId(matched?.id ?? origens.find((o) => o.slug === "publi")?.id ?? origens[0]?.id ?? "");
    setProduto(receita?.produto_nome ?? "");
    setCliente(receita?.cliente_nome ?? "");
    setValor(receita ? formatBRLEditable(receita.valor_bruto) : "");
    setDataPrev(receita?.data_prevista_pagamento ?? "");
    setDataReceb(receita?.data_recebimento ?? "");
    setStatus((receita?.status as StatusReceita) ?? "previsto");
    setEntidadeId(receita?.entidade_id ?? entidades[0]?.id ?? "");
    setNotas(receita?.notas ?? "");
    setErro(null);
  }, [open, receita, entidades, origens]);

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
    const v = parseBRL(valor);
    if (!v || v <= 0) return setErro("Valor deve ser maior que zero.");
    if (!entidadeId) return setErro("Selecione uma entidade.");
    if (!origemId) return setErro("Selecione uma origem.");

    const origemSel = origens.find((o) => o.id === origemId);
    if (!origemSel) return setErro("Origem inválida.");

    // Slug ↔ enum: se o slug não for um dos valores válidos do enum legado,
    // grava 'outro' na coluna enum (mas mantém origem_id como referência real)
    const ENUM_SLUGS = new Set(["greenn","amazon_aff","shopee_aff","ml_aff","magalu_aff","publi","adsense","palestra","consultoria","manual","outro"]);
    const origemEnum = (ENUM_SLUGS.has(origemSel.slug) ? origemSel.slug : "outro") as OrigemReceita;

    const input: ReceitaInput = {
      id: receita?.id,
      origem: origemEnum,
      origem_id: origemId,
      produto_nome: produto,
      cliente_nome: cliente,
      valor_bruto: v,
      taxas: 0, // impostos serão geridos em aba separada
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
              <Select value={origemId} onValueChange={setOrigemId}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {origens.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      <span className="inline-flex items-center gap-2">
                        <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: o.cor_hex ?? "#6b7280" }} />
                        {o.nome}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-gray-500 mt-1">
                <a href="/origens" target="_blank" className="text-blue-400 hover:text-blue-300">+ Gerenciar origens</a>
              </p>
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

          <div>
            <Label htmlFor="valor">Valor (R$)</Label>
            <Input
              id="valor"
              type="text"
              inputMode="decimal"
              value={valor}
              onChange={(e) => setValor(maskBRLInput(e.target.value))}
              onBlur={() => {
                const n = parseBRL(valor);
                if (n > 0) setValor(formatBRLEditable(n));
              }}
              required
              placeholder="0,00"
              className="mt-1.5 font-mono"
            />
            <p className="text-[11px] text-gray-500 mt-1">
              Aceita 1234,56 ou 1.234,56 ou 1234.56. {valor && parseBRL(valor) > 0 && <>= <span className="text-emerald-400 font-mono">{formatBRL(parseBRL(valor))}</span></>}
            </p>
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
