"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type {
  CartaoCredito, Categoria, ContaBancaria, Entidade, Fornecedor,
  FormaPagamento, Transacao, TipoTransacao,
} from "@/lib/types/database";
import { TrendingDown, TrendingUp, Plus, Pencil, Trash2, CheckCircle2, AlertCircle, Clock } from "lucide-react";
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
type CatLite = Pick<Categoria, "id" | "nome" | "tipo" | "cor_hex" | "ativo">;
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
}: {
  transacoes: Transacao[];
  entidades: EntLite[];
  categorias: CatLite[];
  fornecedores: FornLite[];
  cartoes: CartLite[];
  contas: ContaLite[];
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Transacao | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<"todos" | TipoTransacao>("todos");
  const [filtroEntidade, setFiltroEntidade] = useState<string>("todas");

  const filtradas = useMemo(() => {
    return transacoes.filter((t) => {
      if (filtroTipo !== "todos" && t.tipo !== filtroTipo) return false;
      if (filtroEntidade !== "todas" && t.entidade_id !== filtroEntidade) return false;
      return true;
    });
  }, [transacoes, filtroTipo, filtroEntidade]);

  const totaisMes = useMemo(() => {
    const inicio = new Date();
    inicio.setDate(1);
    inicio.setHours(0, 0, 0, 0);
    const inicioISO = inicio.toISOString().slice(0, 10);
    let despesas = 0, receitas = 0;
    for (const t of transacoes) {
      if (t.data_competencia < inicioISO) continue;
      if (t.status === "cancelada") continue;
      if (t.tipo === "despesa") despesas += Number(t.valor);
      else receitas += Number(t.valor);
    }
    return { despesas, receitas, saldo: receitas - despesas };
  }, [transacoes]);

  return (
    <div>
      <PageHeader
        titulo="Transações"
        descricao="Lançamentos pontuais (sem ser recorrência). Suporta parcelamento e vínculo com cartão ou conta."
        acao={
          <Button onClick={() => { setEditing(null); setOpen(true); }} disabled={entidades.length === 0}>
            <Plus className="w-4 h-4" /> Nova transação
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Stat label="Receitas (mês)" value={formatBRL(totaisMes.receitas)} icon={TrendingUp} color="text-emerald-400" />
        <Stat label="Despesas (mês)" value={formatBRL(totaisMes.despesas)} icon={TrendingDown} color="text-rose-400" />
        <Stat label="Saldo (mês)" value={formatBRL(totaisMes.saldo)} icon={TrendingUp} color={totaisMes.saldo >= 0 ? "text-emerald-400" : "text-rose-400"} />
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
          <SelectTrigger className="w-56 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as entidades</SelectItem>
            {entidades.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-gray-500 ml-auto">
          {filtradas.length} transação{filtradas.length === 1 ? "" : "ões"} (últimos 90 dias)
        </span>
      </div>

      {filtradas.length === 0 ? (
        <EmptyState
          icon={TrendingDown}
          titulo="Nenhuma transação"
          descricao="Começa cadastrando uma despesa ou receita."
          acao={entidades.length > 0 && <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="w-4 h-4" /> Criar</Button>}
        />
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-800/50 text-xs uppercase tracking-wide text-gray-400">
              <tr>
                <th className="text-left px-4 py-3">Data</th>
                <th className="text-left px-4 py-3">Descrição</th>
                <th className="text-left px-4 py-3">Categoria</th>
                <th className="text-left px-4 py-3">Pagamento</th>
                <th className="text-right px-4 py-3">Valor</th>
                <th className="text-center px-4 py-3">Status</th>
                <th className="text-right px-4 py-3 w-24">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filtradas.map((t) => (
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
}: {
  tx: Transacao;
  categoria?: CatLite;
  entidade?: EntLite;
  cartao?: CartLite;
  conta?: ContaLite;
  onEdit: () => void;
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
      <td className="px-4 py-3">
        {categoria ? (
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: categoria.cor_hex ?? "#6b7280" }} />
            <span className="text-sm text-gray-300">{categoria.nome}</span>
          </div>
        ) : <span className="text-xs text-gray-600">—</span>}
      </td>
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
  onSaved: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  const [tipo, setTipo] = useState<TipoTransacao>("despesa");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("0");
  const [dataComp, setDataComp] = useState(new Date().toISOString().slice(0, 10));
  const [entidadeId, setEntidadeId] = useState("");
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
              <Select value={catId || "__none__"} onValueChange={(v) => setCatId(v === "__none__" ? "" : v)}>
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
