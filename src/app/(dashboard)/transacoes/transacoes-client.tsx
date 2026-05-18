"use client";

import { Fragment, useEffect, useMemo, useState, useTransition } from "react";
import type {
  CartaoCredito, Categoria, ContaBancaria, Entidade, Fornecedor,
  FormaPagamento, ProjetoRow, Transacao, TipoTransacao,
} from "@/lib/types/database";
import { TrendingDown, TrendingUp, Plus, Pencil, Trash2, CheckCircle2, AlertCircle, Clock, ChevronDown, ChevronRight, Tag } from "lucide-react";
import { PeriodoFilter } from "./periodo-filter";
import { DespesasTabs } from "@/components/layout/despesas-tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { formatBRL, formatDate } from "@/lib/formatters";
import { salvarTransacao, deletarTransacao, marcarPaga, type TransacaoInput } from "./actions";

type EntLite = Pick<Entidade, "id" | "nome" | "tipo" | "cor_hex" | "ativo" | "ordem">;
type CatLite = Pick<Categoria, "id" | "nome" | "tipo" | "cor_hex" | "ativo" | "projeto_padrao_id">;
type FornLite = Pick<Fornecedor, "id" | "nome" | "ativo" | "categoria_padrao_id" | "entidade_padrao_id">;
type CartLite = Pick<CartaoCredito, "id" | "nome" | "entidade_id" | "ativo">;
type ContaLite = Pick<ContaBancaria, "id" | "nome" | "banco" | "entidade_id" | "ativo">;

const FORMAS: { value: FormaPagamento; label: string }[] = [
  { value: "cartao_credito", label: "Cartão de crédito" },
  { value: "pix", label: "PIX" },
  { value: "boleto", label: "Boleto" },
  { value: "cartao_debito", label: "Cartão de débito" },
  { value: "transferencia", label: "Transferência" },
  { value: "dinheiro", label: "Dinheiro" },
];

export function TransacoesClient({
  transacoes,
  entidades,
  categorias,
  fornecedores,
  cartoes,
  contas,
  projetos,
  periodo,
}: {
  transacoes: Transacao[];
  entidades: EntLite[];
  categorias: CatLite[];
  fornecedores: FornLite[];
  cartoes: CartLite[];
  contas: ContaLite[];
  projetos: ProjetoRow[];
  periodo: "atual" | "proximos" | "personalizado" | "todos";
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Transacao | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<"todos" | TipoTransacao>("todos");
  const [filtroEntidade, setFiltroEntidade] = useState<string>("todas");
  const [filtroProjeto, setFiltroProjeto] = useState<string>("todos");
  const [agrupar, setAgrupar] = useState(true);
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set()); // categorias abertas (default = todas fechadas)

  const projetoById = useMemo(() => {
    const m = new Map<string, ProjetoRow>();
    for (const p of projetos) m.set(p.id, p);
    return m;
  }, [projetos]);

  // transacoes JÁ vem filtrada por período pelo server. Aqui só filtra por tipo/entidade/projeto.
  const filtradas = useMemo(() => {
    return transacoes.filter((t) => {
      if (filtroTipo !== "todos" && t.tipo !== filtroTipo) return false;
      if (filtroEntidade !== "todas" && t.entidade_id !== filtroEntidade) return false;
      if (filtroProjeto !== "todos") {
        if (filtroProjeto === "__sem__" && t.projeto_id) return false;
        if (filtroProjeto !== "__sem__" && t.projeto_id !== filtroProjeto) return false;
      }
      return true;
    });
  }, [transacoes, filtroTipo, filtroEntidade, filtroProjeto]);

  const totais = useMemo(() => {
    let despesas = 0, receitas = 0;
    for (const t of filtradas) {
      if (t.status === "cancelada") continue;
      if (t.tipo === "despesa") despesas += Number(t.valor);
      else receitas += Number(t.valor);
    }
    return { despesas, receitas, saldo: receitas - despesas };
  }, [filtradas]);

  // Agrupa por categoria_id (com 'sem' pra transações sem categoria)
  const agrupadas = useMemo(() => {
    if (!agrupar) return null;
    const map = new Map<string, { categoria: CatLite | null; itens: Transacao[]; total: number; despesa: number; receita: number }>();
    for (const t of filtradas) {
      const key = t.categoria_id ?? "sem";
      if (!map.has(key)) {
        const cat = t.categoria_id ? categorias.find((c) => c.id === t.categoria_id) ?? null : null;
        map.set(key, { categoria: cat, itens: [], total: 0, despesa: 0, receita: 0 });
      }
      const g = map.get(key)!;
      g.itens.push(t);
      if (t.status !== "cancelada") {
        if (t.tipo === "despesa") g.despesa += Number(t.valor);
        else g.receita += Number(t.valor);
      }
      g.total = g.despesa + g.receita;
    }
    return [...map.entries()].sort((a, b) => b[1].total - a[1].total);
  }, [filtradas, categorias, agrupar]);

  function toggleCat(catKey: string) {
    setExpandidas((s) => {
      const next = new Set(s);
      if (next.has(catKey)) next.delete(catKey);
      else next.add(catKey);
      return next;
    });
  }

  const periodoLabel =
    periodo === "proximos" ? "próximos meses" :
    periodo === "personalizado" ? "período" :
    periodo === "todos" ? "histórico" :
    "mês";

  return (
    <div>
      <DespesasTabs />
      <PageHeader
        titulo="Lançamentos"
        descricao="Lançamentos pontuais (sem ser recorrência). Suporta parcelamento e vínculo com cartão ou conta."
        acao={
          <div className="flex items-center gap-3">
            <PeriodoFilter current={periodo} />
            <Button onClick={() => { setEditing(null); setOpen(true); }} disabled={entidades.length === 0}>
              <Plus className="w-4 h-4" /> Nova transação
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Stat label={`Despesas (${periodoLabel})`} value={formatBRL(totais.despesas)} icon={TrendingDown} color="text-rose-400" />
        <Stat label={`Total lançamentos`} value={String(filtradas.length)} icon={TrendingUp} color="text-blue-400" />
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex gap-1">
          {(["todos", "despesa", "receita"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFiltroTipo(t)}
              className={"px-3 py-1.5 text-xs rounded-lg transition-colors " + (filtroTipo === t ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700")}
            >
              {t === "todos" ? "Todos" : t === "despesa" ? "Despesas" : "Receitas"}
            </button>
          ))}
        </div>
        <Select value={filtroEntidade} onValueChange={setFiltroEntidade}>
          <SelectTrigger className="w-44 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as entidades</SelectItem>
            {entidades.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroProjeto} onValueChange={setFiltroProjeto}>
          <SelectTrigger className="w-44 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os projetos</SelectItem>
            {projetos.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
            <SelectItem value="__sem__">— sem projeto —</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex gap-1">
          <button
            onClick={() => setAgrupar(true)}
            className={"px-3 py-1.5 text-xs rounded-lg transition-colors flex items-center gap-1 " + (agrupar ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700")}
            title="Agrupar por categoria"
          >
            <Tag className="w-3 h-3" /> Categoria
          </button>
          <button
            onClick={() => setAgrupar(false)}
            className={"px-3 py-1.5 text-xs rounded-lg transition-colors " + (!agrupar ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700")}
            title="Lista contínua"
          >
            Lista
          </button>
        </div>
        {agrupar && agrupadas && agrupadas.length > 0 && (
          <button
            onClick={() => setExpandidas(expandidas.size === agrupadas.length ? new Set() : new Set(agrupadas.map(([k]) => k)))}
            className="px-2 py-1.5 text-[11px] rounded-lg text-gray-400 hover:text-white"
          >
            {expandidas.size === agrupadas.length ? "Recolher tudo" : "Expandir tudo"}
          </button>
        )}
        <span className="text-xs text-gray-500 ml-auto">
          {filtradas.length} transação{filtradas.length === 1 ? "" : "ões"}
        </span>
      </div>

      {filtradas.length === 0 ? (
        <EmptyState
          icon={TrendingDown}
          titulo="Nenhuma transação neste período"
          descricao="Tenta outro filtro ou cadastra uma nova transação."
          acao={entidades.length > 0 && <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="w-4 h-4" /> Criar</Button>}
        />
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-800/50 text-xs uppercase tracking-wide text-gray-400">
              <tr>
                <th className="text-left px-4 py-3 w-24">Data</th>
                <th className="text-left px-4 py-3">Descrição</th>
                {!agrupar && <th className="text-left px-4 py-3">Categoria</th>}
                <th className="text-left px-4 py-3">Pagamento</th>
                <th className="text-right px-4 py-3">Valor</th>
                <th className="text-center px-4 py-3">Status</th>
                <th className="text-right px-4 py-3 w-24">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {agrupar && agrupadas
                ? agrupadas.map(([key, g]) => {
                    const aberto = expandidas.has(key);
                    const colSpan = 6;
                    return (
                      <Fragment key={key}>
                        <tr
                          className="bg-gray-800/40 hover:bg-gray-800/60 cursor-pointer"
                          onClick={() => toggleCat(key)}
                        >
                          <td colSpan={colSpan} className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              {aberto ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
                              {g.categoria ? (
                                <>
                                  <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: g.categoria.cor_hex ?? "#6b7280" }} />
                                  <span className="text-sm font-medium text-white">{g.categoria.nome}</span>
                                </>
                              ) : (
                                <span className="text-sm font-medium text-gray-400 italic">Sem categoria</span>
                              )}
                              <span className="text-[10px] text-gray-500 ml-1">({g.itens.length})</span>
                              <div className="ml-auto flex items-center gap-3 text-xs font-mono">
                                {g.despesa > 0 && <span className="text-rose-400">−{formatBRL(g.despesa)}</span>}
                                {g.receita > 0 && <span className="text-emerald-400">+{formatBRL(g.receita)}</span>}
                              </div>
                            </div>
                          </td>
                          <td></td>
                        </tr>
                        {aberto && g.itens.map((t) => (
                          <Row
                            key={t.id}
                            tx={t}
                            categoria={categorias.find((c) => c.id === t.categoria_id)}
                            entidade={entidades.find((e) => e.id === t.entidade_id)}
                            cartao={cartoes.find((c) => c.id === t.cartao_id)}
                            conta={contas.find((c) => c.id === t.conta_id)}
                            onEdit={() => { setEditing(t); setOpen(true); }}
                            hideCategoria
                          />
                        ))}
                      </Fragment>
                    );
                  })
                : filtradas.map((t) => (
                    <Row
                      key={t.id}
                      tx={t}
                      categoria={categorias.find((c) => c.id === t.categoria_id)}
                      entidade={entidades.find((e) => e.id === t.entidade_id)}
                      cartao={cartoes.find((c) => c.id === t.cartao_id)}
                      conta={contas.find((c) => c.id === t.conta_id)}
                      onEdit={() => { setEditing(t); setOpen(true); }}
                    />
                  ))}
            </tbody>
          </table>
        </div>
      )}

      <TransacaoFormDialog
        open={open}
        onOpenChange={setOpen}
        transacao={editing}
        entidades={entidades}
        categorias={categorias}
        fornecedores={fornecedores}
        cartoes={cartoes}
        contas={contas}
        projetos={projetos}
        onSaved={() => setOpen(false)}
      />
    </div>
  );
}

function Stat({ label, value, icon: Icon, color }: { label: string; value: string; icon: typeof TrendingUp; color: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs uppercase tracking-wide text-gray-400">{label}</span>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
    </div>
  );
}

function Row({
  tx,
  categoria,
  entidade,
  cartao,
  conta,
  onEdit,
  hideCategoria,
}: {
  tx: Transacao;
  categoria?: CatLite;
  entidade?: EntLite;
  cartao?: CartLite;
  conta?: ContaLite;
  onEdit: () => void;
  hideCategoria?: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function deletar() {
    const isFilha = tx.parcelado && (tx.parcela_atual ?? 1) > 1;
    const msgBase = `Excluir "${tx.descricao}"?`;
    let opt = false;
    if (tx.parcelado && !isFilha) {
      const r = confirm(`${msgBase}\n\nEssa transação tem parcelas — todas as parcelas serão excluídas.`);
      if (!r) return;
      opt = true;
    } else if (isFilha) {
      if (!confirm(msgBase)) return;
    } else {
      if (!confirm(msgBase)) return;
    }
    startTransition(async () => {
      const res = await deletarTransacao(tx.id, opt);
      if ("error" in res && res.error) alert(`Erro: ${res.error}`);
    });
  }

  function pagar() {
    const dt = new Date().toISOString().slice(0, 10);
    startTransition(async () => {
      const res = await marcarPaga(tx.id, dt);
      if ("error" in res && res.error) alert(`Erro: ${res.error}`);
    });
  }

  const status = tx.status;
  const statusBadge =
    status === "paga"
      ? { label: "Paga", cls: "bg-emerald-900/40 text-emerald-300", Icon: CheckCircle2 }
      : status === "atrasada"
      ? { label: "Atrasada", cls: "bg-rose-900/40 text-rose-300", Icon: AlertCircle }
      : status === "cancelada"
      ? { label: "Cancelada", cls: "bg-gray-800 text-gray-400", Icon: AlertCircle }
      : status === "prevista"
      ? { label: "Prevista", cls: "bg-blue-900/40 text-blue-300", Icon: Clock }
      : { label: "Confirmada", cls: "bg-gray-800 text-gray-300", Icon: Clock };

  const meioPag = cartao
    ? `${cartao.nome}`
    : conta
    ? conta.nome
    : tx.forma_pagamento === "dinheiro"
    ? "Dinheiro"
    : "—";

  return (
    <tr className="hover:bg-gray-800/30">
      <td className="px-4 py-3 text-sm text-gray-300 whitespace-nowrap">{formatDate(tx.data_competencia)}</td>
      <td className="px-4 py-3">
        <div className="flex items-start gap-2">
          {tx.tipo === "receita" ? (
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <TrendingDown className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
          )}
          <div>
            <div className="text-sm font-medium text-white">{tx.descricao}</div>
            <div className="text-xs text-gray-500">{entidade?.nome ?? "—"}</div>
          </div>
        </div>
      </td>
      {!hideCategoria && (
        <td className="px-4 py-3">
          {categoria ? (
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: categoria.cor_hex ?? "#6b7280" }} />
              <span className="text-sm text-gray-300">{categoria.nome}</span>
            </div>
          ) : <span className="text-xs text-gray-600">—</span>}
        </td>
      )}
      <td className="px-4 py-3 text-sm text-gray-400">{meioPag}</td>
      <td className="px-4 py-3 text-right text-sm font-mono text-white whitespace-nowrap">
        {tx.tipo === "despesa" ? "−" : "+"} {formatBRL(tx.valor)}
      </td>
      <td className="px-4 py-3 text-center">
        <span className={"inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-md font-medium " + statusBadge.cls}>
          <statusBadge.Icon className="w-3 h-3" />
          {statusBadge.label}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex justify-end gap-1">
          {status !== "paga" && status !== "cancelada" && (
            <Button variant="ghost" size="icon" onClick={pagar} disabled={pending} title="Marcar como paga">
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

function TransacaoFormDialog({
  open,
  onOpenChange,
  transacao,
  entidades,
  categorias,
  fornecedores,
  cartoes,
  contas,
  projetos,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  transacao: Transacao | null;
  entidades: EntLite[];
  categorias: CatLite[];
  fornecedores: FornLite[];
  cartoes: CartLite[];
  contas: ContaLite[];
  projetos: ProjetoRow[];
  onSaved: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  const [tipo, setTipo] = useState<TipoTransacao>("despesa");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("0");
  const [dataComp, setDataComp] = useState(new Date().toISOString().slice(0, 10));
  const [entidadeId, setEntidadeId] = useState("");
  const [projetoId, setProjetoId] = useState("");
  const [catId, setCatId] = useState("");
  const [fornId, setFornId] = useState("");
  const [forma, setForma] = useState<FormaPagamento | "">("");
  const [cartaoId, setCartaoId] = useState("");
  const [contaId, setContaId] = useState("");
  const [parcelado, setParcelado] = useState(false);
  const [parcelaTotal, setParcelaTotal] = useState("2");
  const [notas, setNotas] = useState("");

  useEffect(() => {
    if (!open) return;
    setTipo((transacao?.tipo as TipoTransacao) ?? "despesa");
    setDescricao(transacao?.descricao ?? "");
    setValor(transacao ? String(transacao.valor) : "0");
    setDataComp(transacao?.data_competencia ?? new Date().toISOString().slice(0, 10));
    setEntidadeId(transacao?.entidade_id ?? entidades[0]?.id ?? "");
    setProjetoId(transacao?.projeto_id ?? "");
    setCatId(transacao?.categoria_id ?? "");
    setFornId(transacao?.fornecedor_id ?? "");
    setForma((transacao?.forma_pagamento as FormaPagamento) ?? "");
    setCartaoId(transacao?.cartao_id ?? "");
    setContaId(transacao?.conta_id ?? "");
    setParcelado(transacao?.parcelado ?? false);
    setParcelaTotal(String(transacao?.parcela_total ?? 2));
    setNotas(transacao?.notas ?? "");
    setErro(null);
  }, [open, transacao, entidades]);

  // Quando seleciona fornecedor, pré-seleciona categoria/entidade padrão
  useEffect(() => {
    if (!fornId || transacao) return;
    const f = fornecedores.find((fi) => fi.id === fornId);
    if (f) {
      if (f.categoria_padrao_id && !catId) setCatId(f.categoria_padrao_id);
      if (f.entidade_padrao_id && !entidadeId) setEntidadeId(f.entidade_padrao_id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fornId]);

  const cartoesFiltrados = cartoes.filter((c) => c.entidade_id === entidadeId);
  const contasFiltradas = contas.filter((c) => c.entidade_id === entidadeId);
  const categoriasFiltradas = categorias.filter((c) => c.tipo === tipo || c.tipo === "ambos");
  const isEdit = !!transacao;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    const v = parseFloat(valor.replace(",", "."));
    if (!v || v <= 0) return setErro("Valor deve ser maior que zero.");
    if (!entidadeId) return setErro("Selecione uma entidade.");

    if (forma === "cartao_credito" && !cartaoId) return setErro("Selecione o cartão.");
    if (forma && !["cartao_credito", "dinheiro"].includes(forma) && !contaId) return setErro("Selecione a conta.");

    const pT = parcelado ? parseInt(parcelaTotal) : 1;
    if (parcelado && (pT < 2 || pT > 60)) return setErro("Parcelas entre 2 e 60.");

    const input: TransacaoInput = {
      id: transacao?.id,
      tipo,
      descricao,
      valor: v,
      data_competencia: dataComp,
      entidade_id: entidadeId,
      projeto_id: projetoId || null,
      categoria_id: catId || null,
      fornecedor_id: fornId || null,
      forma_pagamento: (forma || null) as FormaPagamento | null,
      cartao_id: forma === "cartao_credito" ? cartaoId : null,
      conta_id: forma && forma !== "cartao_credito" && forma !== "dinheiro" ? contaId : null,
      parcelado,
      parcela_total: parcelado ? pT : null,
      notas,
    };

    startTransition(async () => {
      const res = await salvarTransacao(input);
      if ("error" in res && res.error) setErro(res.error);
      else onSaved();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar transação" : tipo === "despesa" ? "Nova despesa" : "Nova receita"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          {!isEdit && (
            <div className="flex gap-1 p-1 bg-gray-800 rounded-lg w-fit">
              <button
                type="button"
                onClick={() => { setTipo("despesa"); setCatId(""); }}
                className={"px-3 py-1.5 text-xs rounded-md transition-colors " + (tipo === "despesa" ? "bg-rose-600 text-white" : "text-gray-400 hover:text-white")}
              >
                Despesa
              </button>
              <button
                type="button"
                onClick={() => { setTipo("receita"); setCatId(""); }}
                className={"px-3 py-1.5 text-xs rounded-md transition-colors " + (tipo === "receita" ? "bg-emerald-600 text-white" : "text-gray-400 hover:text-white")}
              >
                Receita
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="desc">Descrição</Label>
              <Input id="desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} required placeholder="Ex: Mercado, Anthropic, etc" className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="valor">Valor (R$)</Label>
              <Input id="valor" type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} required className="mt-1.5" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="data">Data de competência</Label>
              <Input id="data" type="date" value={dataComp} onChange={(e) => setDataComp(e.target.value)} required className="mt-1.5" />
            </div>
            <div>
              <Label>Entidade</Label>
              <Select value={entidadeId} onValueChange={(v) => { setEntidadeId(v); setCartaoId(""); setContaId(""); }}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {entidades.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome} ({e.tipo})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Projeto</Label>
            <Select value={projetoId || "__none__"} onValueChange={(v) => setProjetoId(v === "__none__" ? "" : v)}>
              <SelectTrigger className="mt-1.5"><SelectValue placeholder="Sem projeto" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— sem projeto —</SelectItem>
                {projetos.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="inline-flex items-center gap-2">
                      <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: p.cor_hex ?? "#6b7280" }} />
                      {p.nome}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-gray-500 mt-1">
              Qual iniciativa comercial gerou esta despesa/receita. <a href="/projetos" target="_blank" className="text-blue-400 hover:text-blue-300">+ Gerenciar projetos</a>
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Fornecedor (opcional)</Label>
              <Select value={fornId || "__none__"} onValueChange={(v) => setFornId(v === "__none__" ? "" : v)}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— nenhum —</SelectItem>
                  {fornecedores.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={catId || "__none__"} onValueChange={(v) => {
                const newCat = v === "__none__" ? "" : v;
                setCatId(newCat);
                // Auto-sugest projeto: se categoria tem projeto_padrao e user ainda não escolheu
                if (newCat && !projetoId) {
                  const cat = categorias.find((c) => c.id === newCat);
                  if (cat?.projeto_padrao_id) setProjetoId(cat.projeto_padrao_id);
                }
              }}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Sem categoria" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— sem categoria —</SelectItem>
                  {categoriasFiltradas.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Forma de pagamento</Label>
            <Select value={forma || "__none__"} onValueChange={(v) => { setForma(v === "__none__" ? "" : (v as FormaPagamento)); setCartaoId(""); setContaId(""); }}>
              <SelectTrigger className="mt-1.5"><SelectValue placeholder="Não definida" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— não definida —</SelectItem>
                {FORMAS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {forma === "cartao_credito" && (
            <div>
              <Label>Cartão</Label>
              <Select value={cartaoId} onValueChange={setCartaoId}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {cartoesFiltrados.length === 0 && <SelectItem value="__empty__" disabled>Nenhum cartão pra essa entidade</SelectItem>}
                  {cartoesFiltrados.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {forma && forma !== "cartao_credito" && forma !== "dinheiro" && (
            <div>
              <Label>Conta</Label>
              <Select value={contaId} onValueChange={setContaId}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {contasFiltradas.length === 0 && <SelectItem value="__empty__" disabled>Nenhuma conta pra essa entidade</SelectItem>}
                  {contasFiltradas.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {!isEdit && tipo === "despesa" && (
            <div className="border border-gray-800 rounded-lg p-4 bg-gray-950">
              <div className="flex items-center justify-between mb-2">
                <Label className="cursor-pointer" onClick={() => setParcelado(!parcelado)}>
                  Parcelado em mais de 1x
                </Label>
                <Switch checked={parcelado} onCheckedChange={setParcelado} />
              </div>
              {parcelado && (
                <div>
                  <Label htmlFor="pt">Quantidade de parcelas</Label>
                  <Input id="pt" type="number" min={2} max={60} value={parcelaTotal} onChange={(e) => setParcelaTotal(e.target.value)} className="mt-1.5" />
                  <p className="text-xs text-gray-500 mt-1">
                    Vai criar {parcelaTotal} transações de R$ {(parseFloat(valor.replace(",", ".")) / parseInt(parcelaTotal || "1") || 0).toFixed(2)} cada, uma por mês.
                  </p>
                </div>
              )}
            </div>
          )}

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
