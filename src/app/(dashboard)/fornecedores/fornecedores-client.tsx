"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type { Categoria, Entidade, Fornecedor } from "@/lib/types/database";
import { Truck, Plus, Pencil, Trash2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { formatBRL, formatDate, normalizeNome } from "@/lib/formatters";
import { salvarFornecedor, toggleFornecedorAtivo, deletarFornecedor, type FornecedorInput } from "./actions";

type CatLite = Pick<Categoria, "id" | "nome" | "tipo" | "cor_hex" | "ativo">;
type EntLite = Pick<Entidade, "id" | "nome" | "tipo" | "cor_hex" | "ativo" | "ordem">;

export function FornecedoresClient({
  fornecedores,
  categorias,
  entidades,
}: {
  fornecedores: Fornecedor[];
  categorias: CatLite[];
  entidades: EntLite[];
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Fornecedor | null>(null);
  const [busca, setBusca] = useState("");

  const filtrados = useMemo(() => {
    if (!busca.trim()) return fornecedores;
    const q = normalizeNome(busca);
    return fornecedores.filter((f) =>
      f.nome_normalizado.includes(q) || f.nome.toLowerCase().includes(busca.toLowerCase())
    );
  }, [fornecedores, busca]);

  return (
    <div>
      <PageHeader
        titulo="Fornecedores"
        descricao="Aparecem automaticamente conforme você lança despesas. Pode editar a categoria padrão pra acelerar lançamentos futuros."
        acao={
          <Button onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="w-4 h-4" /> Novo fornecedor
          </Button>
        }
      />

      {fornecedores.length > 0 && (
        <div className="relative mb-4 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar fornecedor..."
            className="pl-9"
          />
        </div>
      )}

      {fornecedores.length === 0 ? (
        <EmptyState
          icon={Truck}
          titulo="Nenhum fornecedor cadastrado"
          descricao="Os fornecedores serão aprendidos automaticamente conforme você lança despesas. Você também pode cadastrar manualmente."
          acao={<Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="w-4 h-4" /> Cadastrar manualmente</Button>}
        />
      ) : filtrados.length === 0 ? (
        <p className="text-center text-sm text-gray-500 py-12">Nenhum resultado.</p>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-800/50 text-xs uppercase tracking-wide text-gray-400">
              <tr>
                <th className="text-left px-4 py-3">Nome</th>
                <th className="text-left px-4 py-3">Categoria padrão</th>
                <th className="text-left px-4 py-3">Entidade padrão</th>
                <th className="text-right px-4 py-3">Transações</th>
                <th className="text-right px-4 py-3">Valor médio</th>
                <th className="text-center px-4 py-3">Ativo</th>
                <th className="text-right px-4 py-3 w-24">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filtrados.map((f) => (
                <Row
                  key={f.id}
                  forn={f}
                  categoria={categorias.find((c) => c.id === f.categoria_padrao_id)}
                  entidade={entidades.find((e) => e.id === f.entidade_padrao_id)}
                  onEdit={() => { setEditing(f); setOpen(true); }}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <FornecedorFormDialog
        open={open}
        onOpenChange={setOpen}
        fornecedor={editing}
        categorias={categorias}
        entidades={entidades}
        onSaved={() => setOpen(false)}
      />
    </div>
  );
}

function Row({
  forn,
  categoria,
  entidade,
  onEdit,
}: {
  forn: Fornecedor;
  categoria?: CatLite;
  entidade?: EntLite;
  onEdit: () => void;
}) {
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => { await toggleFornecedorAtivo(forn.id, !forn.ativo); });
  }
  function deletar() {
    if (!confirm(`Excluir "${forn.nome}"?`)) return;
    startTransition(async () => {
      const res = await deletarFornecedor(forn.id);
      if ("error" in res && res.error) alert(`Erro: ${res.error}`);
    });
  }

  return (
    <tr className="hover:bg-gray-800/30">
      <td className="px-4 py-3">
        <div className="text-sm font-medium text-white">{forn.nome}</div>
        {forn.cnpj && <div className="text-xs text-gray-500">{forn.cnpj}</div>}
      </td>
      <td className="px-4 py-3">
        {categoria ? (
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: categoria.cor_hex ?? "#6b7280" }} />
            <span className="text-sm text-gray-300">{categoria.nome}</span>
          </div>
        ) : (
          <span className="text-xs text-gray-600">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-gray-400">{entidade?.nome ?? "—"}</td>
      <td className="px-4 py-3 text-right text-sm font-mono text-gray-300">{forn.total_transacoes}</td>
      <td className="px-4 py-3 text-right text-sm font-mono text-gray-300">{formatBRL(forn.valor_medio)}</td>
      <td className="px-4 py-3 text-center">
        <Switch checked={forn.ativo} onCheckedChange={toggle} disabled={pending} />
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

function FornecedorFormDialog({
  open,
  onOpenChange,
  fornecedor,
  categorias,
  entidades,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  fornecedor: Fornecedor | null;
  categorias: CatLite[];
  entidades: EntLite[];
  onSaved: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [catId, setCatId] = useState("");
  const [entId, setEntId] = useState("");

  useEffect(() => {
    if (!open) return;
    setNome(fornecedor?.nome ?? "");
    setCnpj(fornecedor?.cnpj ?? "");
    setCatId(fornecedor?.categoria_padrao_id ?? "");
    setEntId(fornecedor?.entidade_padrao_id ?? "");
    setErro(null);
  }, [open, fornecedor?.id, fornecedor?.nome, fornecedor?.cnpj, fornecedor?.categoria_padrao_id, fornecedor?.entidade_padrao_id]);

  // Categorias de despesa (mais comum) ou ambos
  const categoriasUsaveis = categorias.filter((c) => c.tipo === "despesa" || c.tipo === "ambos");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const input: FornecedorInput = {
      id: fornecedor?.id,
      nome,
      cnpj,
      categoria_padrao_id: catId || null,
      entidade_padrao_id: entId || null,
    };
    startTransition(async () => {
      const res = await salvarFornecedor(input);
      if ("error" in res && res.error) setErro(res.error);
      else onSaved();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{fornecedor ? "Editar fornecedor" : "Novo fornecedor"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="nome">Nome</Label>
            <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} required placeholder="Ex: Anthropic" className="mt-1.5" />
          </div>

          <div>
            <Label htmlFor="cnpj">CNPJ</Label>
            <Input id="cnpj" value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="Opcional" className="mt-1.5" />
          </div>

          <div>
            <Label>Categoria padrão</Label>
            <Select value={catId || "__none__"} onValueChange={(v) => setCatId(v === "__none__" ? "" : v)}>
              <SelectTrigger className="mt-1.5"><SelectValue placeholder="Sem padrão" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— sem padrão —</SelectItem>
                {categoriasUsaveis.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500 mt-1">Pre-seleciona ao lançar despesa deste fornecedor.</p>
          </div>

          <div>
            <Label>Entidade padrão</Label>
            <Select value={entId || "__none__"} onValueChange={(v) => setEntId(v === "__none__" ? "" : v)}>
              <SelectTrigger className="mt-1.5"><SelectValue placeholder="Sem padrão" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— sem padrão —</SelectItem>
                {entidades.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.nome} ({e.tipo})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {fornecedor && (
            <div className="text-xs text-gray-500 space-y-0.5 pt-2 border-t border-gray-800">
              <div>Total de transações: <span className="text-gray-300">{fornecedor.total_transacoes}</span></div>
              <div>Valor médio: <span className="text-gray-300">{formatBRL(fornecedor.valor_medio)}</span></div>
              <div>Último pagamento: <span className="text-gray-300">{formatDate(fornecedor.ultimo_pagamento_em)}</span></div>
            </div>
          )}

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
