"use client";

import { Fragment, useEffect, useMemo, useState, useTransition } from "react";
import type {
  CartaoCredito, Categoria, ContaBancaria, Entidade, Fornecedor,
  FormaPagamento, FrequenciaRecorrencia, Recorrencia, TipoTransacao, TipoValorRecorrencia,
} from "@/lib/types/database";
import { Repeat, Plus, Pencil, Trash2, TrendingDown, TrendingUp, Wallet, Banknote, PiggyBank, ChevronDown, ChevronRight, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { formatBRL } from "@/lib/formatters";
import { salvarRecorrencia, toggleRecorrenciaAtivo, deletarRecorrencia, type RecorrenciaInput } from "./actions";

type EntLite = Pick<Entidade, "id" | "nome" | "tipo" | "cor_hex" | "ativo" | "ordem">;
type CatLite = Pick<Categoria, "id" | "nome" | "tipo" | "cor_hex" | "ativo">;
type FornLite = Pick<Fornecedor, "id" | "nome" | "ativo">;
type CartLite = Pick<CartaoCredito, "id" | "nome" | "entidade_id" | "ativo">;
type ContaLite = Pick<ContaBancaria, "id" | "nome" | "banco" | "entidade_id" | "ativo">;

export type BucketRealizado = {
  recorrencia_id: string;
  gasto_real: number;
  qtd_transacoes: number;
  pct_usado: number | null;
  status: "ok" | "atencao" | "estourou" | "sem_estimativa";
};

const TIPOS_VALOR: { value: TipoValorRecorrencia; label: string; icon: typeof Wallet; desc: string }[] = [
  { value: "fixo", label: "Fixo", icon: Banknote, desc: "Valor exato, sempre igual (aluguel, Spotify, ferramentas SaaS)" },
  { value: "variavel", label: "Variável", icon: Wallet, desc: "Cadastra valor médio; ao pagar, ajusta para o real (luz, água, fornecedor c/ comissão)" },
  { value: "bucket", label: "Bucket (estimativa)", icon: PiggyBank, desc: "Teto mensal; agrega todas as transações da mesma categoria (alimentação, mercado, uber)" },
];

const FREQUENCIAS: { value: FrequenciaRecorrencia; label: string }[] = [
  { value: "semanal", label: "Semanal" },
  { value: "quinzenal", label: "Quinzenal" },
  { value: "mensal", label: "Mensal" },
  { value: "bimestral", label: "Bimestral" },
  { value: "trimestral", label: "Trimestral" },
  { value: "semestral", label: "Semestral" },
  { value: "anual", label: "Anual" },
];

const DIAS_SEMANA = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Segunda" },
  { value: 2, label: "Terça" },
  { value: 3, label: "Quarta" },
  { value: 4, label: "Quinta" },
  { value: 5, label: "Sexta" },
  { value: 6, label: "Sábado" },
];

const FORMAS: { value: FormaPagamento; label: string }[] = [
  { value: "cartao_credito", label: "Cartão de crédito" },
  { value: "pix", label: "PIX" },
  { value: "boleto", label: "Boleto" },
  { value: "cartao_debito", label: "Cartão de débito" },
  { value: "transferencia", label: "Transferência" },
  { value: "dinheiro", label: "Dinheiro" },
];

export function RecorrenciasClient({
  recorrencias,
  entidades,
  categorias,
  fornecedores,
  cartoes,
  contas,
  buckets,
}: {
  recorrencias: Recorrencia[];
  entidades: EntLite[];
  categorias: CatLite[];
  fornecedores: FornLite[];
  cartoes: CartLite[];
  contas: ContaLite[];
  buckets: BucketRealizado[];
}) {
  const bucketsByRec = useMemo(() => {
    const m = new Map<string, BucketRealizado>();
    for (const b of buckets) m.set(b.recorrencia_id, b);
    return m;
  }, [buckets]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Recorrencia | null>(null);
  const [agrupar, setAgrupar] = useState(true);
  const [colapsadas, setColapsadas] = useState<Set<string>>(new Set());

  // Agrupa recorrências por categoria_id
  const agrupadas = useMemo(() => {
    if (!agrupar) return null;
    const map = new Map<string, { categoria: CatLite | null; itens: Recorrencia[]; total: number }>();
    for (const r of recorrencias) {
      const key = r.categoria_id ?? "sem";
      if (!map.has(key)) {
        const cat = r.categoria_id ? categorias.find((c) => c.id === r.categoria_id) ?? null : null;
        map.set(key, { categoria: cat, itens: [], total: 0 });
      }
      const g = map.get(key)!;
      g.itens.push(r);
      if (r.ativo && r.frequencia === "mensal") {
        g.total += r.tipo === "despesa" ? Number(r.valor_padrao) : -Number(r.valor_padrao);
      }
    }
    return [...map.entries()].sort((a, b) => Math.abs(b[1].total) - Math.abs(a[1].total));
  }, [recorrencias, categorias, agrupar]);

  function toggleCat(catKey: string) {
    setColapsadas((s) => {
      const next = new Set(s);
      if (next.has(catKey)) next.delete(catKey);
      else next.add(catKey);
      return next;
    });
  }

  const totalDespesasMensais = useMemo(
    () =>
      recorrencias
        .filter((r) => r.ativo && r.tipo === "despesa" && r.frequencia === "mensal")
        .reduce((s, r) => s + Number(r.valor_padrao), 0),
    [recorrencias]
  );
  const totalReceitasMensais = useMemo(
    () =>
      recorrencias
        .filter((r) => r.ativo && r.tipo === "receita" && r.frequencia === "mensal")
        .reduce((s, r) => s + Number(r.valor_padrao), 0),
    [recorrencias]
  );

  return (
    <div>
      <PageHeader
        titulo="Recorrências"
        descricao="Contas fixas mensais (aluguel, ferramentas, salários). O valor padrão serve de template — você pode ajustar mês a mês sem afetar o histórico."
        acao={
          <Button onClick={() => { setEditing(null); setOpen(true); }} disabled={entidades.length === 0}>
            <Plus className="w-4 h-4" /> Nova recorrência
          </Button>
        }
      />

      {recorrencias.filter((r) => r.ativo && r.frequencia === "mensal").length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs uppercase tracking-wide text-gray-400">Despesas fixas/mês</span>
              <TrendingDown className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-2xl font-bold text-white">{formatBRL(totalDespesasMensais)}</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs uppercase tracking-wide text-gray-400">Receitas fixas/mês</span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-white">{formatBRL(totalReceitasMensais)}</div>
          </div>
        </div>
      )}

      {recorrencias.length > 0 && (
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={() => setAgrupar(true)}
            className={"px-3 py-1.5 text-xs rounded-lg transition-colors flex items-center gap-1 " + (agrupar ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700")}
          >
            <Tag className="w-3 h-3" /> Categoria
          </button>
          <button
            onClick={() => setAgrupar(false)}
            className={"px-3 py-1.5 text-xs rounded-lg transition-colors " + (!agrupar ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700")}
          >
            Lista
          </button>
          {agrupar && agrupadas && agrupadas.length > 0 && (
            <button
              onClick={() => setColapsadas(colapsadas.size === agrupadas.length ? new Set() : new Set(agrupadas.map(([k]) => k)))}
              className="px-2 py-1.5 text-[11px] rounded-lg text-gray-400 hover:text-white"
            >
              {colapsadas.size === agrupadas.length ? "Expandir tudo" : "Recolher tudo"}
            </button>
          )}
          <span className="text-xs text-gray-500 ml-auto">
            {recorrencias.length} recorrência{recorrencias.length === 1 ? "" : "s"}
          </span>
        </div>
      )}

      {recorrencias.length === 0 ? (
        <EmptyState
          icon={Repeat}
          titulo="Nenhuma recorrência cadastrada"
          descricao="Adicione contas fixas como aluguel, ferramentas SaaS, salário, etc."
          acao={
            <Button onClick={() => { setEditing(null); setOpen(true); }}>
              <Plus className="w-4 h-4" /> Criar
            </Button>
          }
        />
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-800/50 text-xs uppercase tracking-wide text-gray-400">
              <tr>
                <th className="text-left px-4 py-3">Nome</th>
                <th className="text-center px-4 py-3">Tipo</th>
                {!agrupar && <th className="text-left px-4 py-3">Categoria</th>}
                <th className="text-center px-4 py-3">Vence</th>
                <th className="text-center px-4 py-3">Freq.</th>
                <th className="text-right px-4 py-3 w-72">Valor / Realizado</th>
                <th className="text-center px-4 py-3">Ativa</th>
                <th className="text-right px-4 py-3 w-24">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {agrupar && agrupadas
                ? agrupadas.map(([key, g]) => {
                    const colapsado = colapsadas.has(key);
                    return (
                      <Fragment key={key}>
                        <tr
                          className="bg-gray-800/40 hover:bg-gray-800/60 cursor-pointer"
                          onClick={() => toggleCat(key)}
                        >
                          <td colSpan={7} className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              {colapsado ? <ChevronRight className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
                              {g.categoria ? (
                                <>
                                  <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: g.categoria.cor_hex ?? "#6b7280" }} />
                                  <span className="text-sm font-medium text-white">{g.categoria.nome}</span>
                                </>
                              ) : (
                                <span className="text-sm font-medium text-gray-400 italic">Sem categoria</span>
                              )}
                              <span className="text-[10px] text-gray-500 ml-1">({g.itens.length})</span>
                              <span className={`ml-auto text-xs font-mono ${g.total >= 0 ? "text-rose-400" : "text-emerald-400"}`}>
                                {g.total >= 0 ? "−" : "+"}{formatBRL(Math.abs(g.total))}/mês
                              </span>
                            </div>
                          </td>
                        </tr>
                        {!colapsado && g.itens.map((r) => (
                          <Row
                            key={r.id}
                            rec={r}
                            entidade={entidades.find((e) => e.id === r.entidade_id)}
                            categoria={categorias.find((c) => c.id === r.categoria_id)}
                            bucket={bucketsByRec.get(r.id)}
                            onEdit={() => { setEditing(r); setOpen(true); }}
                            hideCategoria
                          />
                        ))}
                      </Fragment>
                    );
                  })
                : recorrencias.map((r) => (
                    <Row
                      key={r.id}
                      rec={r}
                      entidade={entidades.find((e) => e.id === r.entidade_id)}
                      categoria={categorias.find((c) => c.id === r.categoria_id)}
                      bucket={bucketsByRec.get(r.id)}
                      onEdit={() => { setEditing(r); setOpen(true); }}
                    />
                  ))}
            </tbody>
          </table>
        </div>
      )}

      <RecorrenciaFormDialog
        open={open}
        onOpenChange={setOpen}
        recorrencia={editing}
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

function Row({
  rec,
  entidade,
  categoria,
  bucket,
  onEdit,
  hideCategoria,
}: {
  rec: Recorrencia;
  entidade?: EntLite;
  categoria?: CatLite;
  bucket?: BucketRealizado;
  onEdit: () => void;
  hideCategoria?: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => { await toggleRecorrenciaAtivo(rec.id, !rec.ativo); });
  }
  function deletar() {
    if (!confirm(`Excluir recorrência "${rec.nome}"?`)) return;
    startTransition(async () => {
      const res = await deletarRecorrencia(rec.id);
      if ("error" in res && res.error) alert(`Erro: ${res.error}`);
    });
  }

  const tipoValor = rec.tipo_valor ?? "fixo";
  const isBucket = tipoValor === "bucket";
  const gastoReal = Number(bucket?.gasto_real ?? 0);
  const pct = Number(bucket?.pct_usado ?? 0);
  const pctClamped = Math.min(pct, 100);
  const barColor =
    bucket?.status === "estourou" ? "bg-rose-500" :
    bucket?.status === "atencao" ? "bg-amber-500" :
    "bg-emerald-500";
  const textColor =
    bucket?.status === "estourou" ? "text-rose-400" :
    bucket?.status === "atencao" ? "text-amber-400" :
    "text-emerald-400";

  return (
    <tr className={"hover:bg-gray-800/30 " + (rec.ativo ? "" : "opacity-60")}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {rec.tipo === "receita" ? (
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          ) : (
            <TrendingDown className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          )}
          <div>
            <div className="text-sm font-medium text-white">{rec.nome}</div>
            {entidade && (
              <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: entidade.cor_hex ?? "#6b7280" }} />
                {entidade.nome}
              </div>
            )}
          </div>
        </div>
        {rec.notas && <div className="text-xs text-gray-500 mt-0.5 ml-5 line-clamp-1">{rec.notas}</div>}
      </td>
      <td className="px-4 py-3 text-center">
        <span className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wide px-2 py-1 rounded-full ${
          tipoValor === "bucket" ? "bg-purple-950/50 text-purple-300 border border-purple-800/50" :
          tipoValor === "variavel" ? "bg-amber-950/50 text-amber-300 border border-amber-800/50" :
          "bg-gray-800 text-gray-400 border border-gray-700"
        }`}>
          {tipoValor === "bucket" ? "Bucket" : tipoValor === "variavel" ? "Variável" : "Fixo"}
        </span>
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
      <td className="px-4 py-3 text-center text-sm font-mono text-gray-300">
        {isBucket ? "—" : `dia ${rec.dia_vencimento}`}
      </td>
      <td className="px-4 py-3 text-center text-xs text-gray-400">
        {isBucket ? "Mensal" : FREQUENCIAS.find((f) => f.value === rec.frequencia)?.label}
      </td>
      <td className="px-4 py-3">
        {isBucket ? (
          <div>
            <div className="flex justify-between items-center mb-1 text-xs font-mono">
              <span className={textColor}>{formatBRL(gastoReal)}</span>
              <span className="text-gray-500">/ {formatBRL(rec.valor_padrao)}</span>
            </div>
            <div className="bg-gray-800 rounded-full h-1.5 overflow-hidden">
              <div className={`h-full ${barColor} transition-all`} style={{ width: `${pctClamped}%` }} />
            </div>
            {bucket && (
              <div className="text-[10px] text-gray-500 mt-1 text-right">
                {bucket.qtd_transacoes} transaç{bucket.qtd_transacoes === 1 ? "ão" : "ões"} · {pct.toFixed(0)}%
              </div>
            )}
          </div>
        ) : (
          <div className="text-right text-sm font-mono text-white">{formatBRL(rec.valor_padrao)}</div>
        )}
      </td>
      <td className="px-4 py-3 text-center">
        <Switch checked={rec.ativo} onCheckedChange={toggle} disabled={pending} />
      </td>
      <td className="px-4 py-3">
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" onClick={onEdit} disabled={pending}><Pencil className="w-4 h-4" /></Button>
          <Button variant="ghost" size="icon" onClick={deletar} disabled={pending}><Trash2 className="w-4 h-4 text-red-400" /></Button>
        </div>
      </td>
    </tr>
  );
}

function RecorrenciaFormDialog({
  open,
  onOpenChange,
  recorrencia,
  entidades,
  categorias,
  fornecedores,
  cartoes,
  contas,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  recorrencia: Recorrencia | null;
  entidades: EntLite[];
  categorias: CatLite[];
  fornecedores: FornLite[];
  cartoes: CartLite[];
  contas: ContaLite[];
  onSaved: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<TipoTransacao>("despesa");
  const [tipoValor, setTipoValor] = useState<TipoValorRecorrencia>("fixo");
  const [valor, setValor] = useState("0");
  const [diaVenc, setDiaVenc] = useState("5");
  const [diaSemana, setDiaSemana] = useState("5"); // sexta
  const [podePular, setPodePular] = useState(false);
  const [freq, setFreq] = useState<FrequenciaRecorrencia>("mensal");
  const [entidadeId, setEntidadeId] = useState("");
  const [catId, setCatId] = useState("");
  const [fornId, setFornId] = useState("");
  const [forma, setForma] = useState<FormaPagamento | "">("");
  const [cartaoId, setCartaoId] = useState("");
  const [contaId, setContaId] = useState("");
  const [dataInicio, setDataInicio] = useState(new Date().toISOString().slice(0, 10));
  const [dataFim, setDataFim] = useState("");
  const [notas, setNotas] = useState("");

  useEffect(() => {
    if (!open) return;
    setNome(recorrencia?.nome ?? "");
    setTipo((recorrencia?.tipo as TipoTransacao) ?? "despesa");
    setTipoValor((recorrencia?.tipo_valor as TipoValorRecorrencia) ?? "fixo");
    setValor(recorrencia ? String(recorrencia.valor_padrao) : "0");
    setDiaVenc(String(recorrencia?.dia_vencimento ?? 5));
    setDiaSemana(String(recorrencia?.dia_semana ?? 5));
    setPodePular(recorrencia?.pode_pular ?? false);
    setFreq((recorrencia?.frequencia as FrequenciaRecorrencia) ?? "mensal");
    setEntidadeId(recorrencia?.entidade_id ?? entidades[0]?.id ?? "");
    setCatId(recorrencia?.categoria_id ?? "");
    setFornId(recorrencia?.fornecedor_id ?? "");
    setForma((recorrencia?.forma_pagamento as FormaPagamento) ?? "");
    setCartaoId(recorrencia?.cartao_id ?? "");
    setContaId(recorrencia?.conta_id ?? "");
    setDataInicio(recorrencia?.data_inicio ?? new Date().toISOString().slice(0, 10));
    setDataFim(recorrencia?.data_fim ?? "");
    setNotas(recorrencia?.notas ?? "");
    setErro(null);
  }, [open, recorrencia, entidades]);

  const cartoesFiltrados = cartoes.filter((c) => c.entidade_id === entidadeId);
  const contasFiltradas = contas.filter((c) => c.entidade_id === entidadeId);
  const categoriasFiltradas = categorias.filter((c) => c.tipo === tipo || c.tipo === "ambos");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    const dV = parseInt(diaVenc);
    if (dV < 1 || dV > 31) return setErro("Dia de vencimento entre 1 e 31.");
    const v = parseFloat(valor.replace(",", "."));
    if (!v || v <= 0) return setErro("Valor deve ser maior que zero.");
    if (!entidadeId) return setErro("Selecione uma entidade.");

    // Buckets exigem categoria (agregam por categoria_id)
    if (tipoValor === "bucket" && !catId) {
      return setErro("Buckets precisam de uma categoria para agregar as transações.");
    }

    const isBucket = tipoValor === "bucket";

    // Validação meio de pagamento (não aplica pra bucket — não materializa)
    if (!isBucket) {
      if (forma === "cartao_credito" && !cartaoId) return setErro("Selecione o cartão.");
      if (["pix", "boleto", "cartao_debito", "transferencia"].includes(forma) && !contaId) {
        return setErro("Selecione a conta.");
      }
    }

    const isSemanal = freq === "semanal" || freq === "quinzenal";
    const input: RecorrenciaInput = {
      id: recorrencia?.id,
      nome,
      tipo,
      tipo_valor: tipoValor,
      valor_padrao: v,
      dia_vencimento: dV,
      dia_semana: isSemanal ? parseInt(diaSemana) : null,
      pode_pular: podePular,
      frequencia: isBucket ? "mensal" : freq,
      entidade_id: entidadeId,
      categoria_id: catId || null,
      fornecedor_id: fornId || null,
      forma_pagamento: isBucket ? null : ((forma || null) as FormaPagamento | null),
      cartao_id: isBucket ? null : (forma === "cartao_credito" ? cartaoId : null),
      conta_id: isBucket ? null : (forma && forma !== "cartao_credito" && forma !== "dinheiro" ? contaId : null),
      data_inicio: dataInicio,
      data_fim: dataFim || null,
      notas,
    };

    startTransition(async () => {
      const res = await salvarRecorrencia(input);
      if ("error" in res && res.error) setErro(res.error);
      else onSaved();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{recorrencia ? "Editar recorrência" : "Nova recorrência"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label className="mb-2 block">Tipo de valor</Label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {TIPOS_VALOR.map((t) => {
                const Icon = t.icon;
                const active = tipoValor === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setTipoValor(t.value)}
                    className={`text-left p-3 rounded-lg border transition-colors ${
                      active
                        ? "bg-blue-950/50 border-blue-700 text-white"
                        : "bg-gray-950 border-gray-800 hover:bg-gray-900 text-gray-300"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className={`w-4 h-4 ${active ? "text-blue-400" : "text-gray-500"}`} />
                      <span className="text-sm font-medium">{t.label}</span>
                    </div>
                    <p className="text-[11px] text-gray-500 leading-tight">{t.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="nome">Nome</Label>
              <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} required placeholder={tipoValor === "bucket" ? "Ex: Alimentação" : "Ex: Aluguel escritório"} className="mt-1.5" />
            </div>
            <div>
              <Label>Despesa/Receita</Label>
              <Select value={tipo} onValueChange={(v) => { setTipo(v as TipoTransacao); setCatId(""); }}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="despesa">Despesa</SelectItem>
                  <SelectItem value="receita">Receita</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="valor">
                {tipoValor === "bucket" ? "Teto mensal (R$)" : tipoValor === "variavel" ? "Valor médio (R$)" : "Valor (R$)"}
              </Label>
              <Input id="valor" type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} required className="mt-1.5" />
              {tipoValor === "variavel" && (
                <p className="text-[11px] text-gray-500 mt-1">Ao pagar, o valor real substitui no histórico do mês.</p>
              )}
            </div>
            {tipoValor !== "bucket" && (
              <div>
                <Label>Frequência</Label>
                <Select value={freq} onValueChange={(v) => setFreq(v as FrequenciaRecorrencia)}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FREQUENCIAS.map((f) => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {tipoValor !== "bucket" && (
              (freq === "semanal" || freq === "quinzenal") ? (
                <div>
                  <Label>Dia da semana</Label>
                  <Select value={diaSemana} onValueChange={setDiaSemana}>
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DIAS_SEMANA.map((d) => (
                        <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div>
                  <Label htmlFor="dia">Vence dia</Label>
                  <Input id="dia" type="number" min={1} max={31} value={diaVenc} onChange={(e) => setDiaVenc(e.target.value)} required className="mt-1.5" />
                </div>
              )
            )}
          </div>

          {tipoValor !== "bucket" && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-950 border border-gray-800">
              <Switch checked={podePular} onCheckedChange={setPodePular} />
              <div>
                <Label className="cursor-pointer" onClick={() => setPodePular(!podePular)}>
                  Pode pular ocorrência
                </Label>
                <p className="text-xs text-gray-500 mt-0.5">
                  Marca quando o pagamento pode não ocorrer (ex: diarista que falta).
                  Não dispara alerta de atraso se não bater com extrato.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Entidade</Label>
              <Select value={entidadeId} onValueChange={(v) => { setEntidadeId(v); setCartaoId(""); setContaId(""); }}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {entidades.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome} ({e.tipo})</SelectItem>)}
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

          {tipoValor !== "bucket" && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Fornecedor (opcional)</Label>
                  <Select value={fornId || "__none__"} onValueChange={(v) => setFornId(v === "__none__" ? "" : v)}>
                    <SelectTrigger className="mt-1.5"><SelectValue placeholder="Sem fornecedor" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— sem fornecedor —</SelectItem>
                      {fornecedores.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
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
              </div>

              {forma === "cartao_credito" && (
                <div>
                  <Label>Cartão</Label>
                  <Select value={cartaoId} onValueChange={setCartaoId}>
                    <SelectTrigger className="mt-1.5"><SelectValue placeholder="Selecione o cartão" /></SelectTrigger>
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
                    <SelectTrigger className="mt-1.5"><SelectValue placeholder="Selecione a conta" /></SelectTrigger>
                    <SelectContent>
                      {contasFiltradas.length === 0 && <SelectItem value="__empty__" disabled>Nenhuma conta pra essa entidade</SelectItem>}
                      {contasFiltradas.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="ini">Início</Label>
              <Input id="ini" type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} required className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="fim">Fim (opcional)</Label>
              <Input id="fim" type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="mt-1.5" />
              <p className="text-xs text-gray-500 mt-1">Vazio = sem prazo (continua indefinidamente).</p>
            </div>
          </div>

          <div>
            <Label htmlFor="notas">Notas</Label>
            <Textarea id="notas" value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Opcional — observações, contrato, etc." className="mt-1.5" />
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
