"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type { Categoria, TipoCategoria } from "@/lib/types/database";
import { Tag, Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ColorPicker } from "@/components/ui/color-picker";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { salvarCategoria, toggleCategoriaAtivo, deletarCategoria, type CategoriaInput } from "./actions";

const TIPOS: { value: TipoCategoria; label: string; cor: string }[] = [
  { value: "despesa", label: "Despesa", cor: "text-rose-300 bg-rose-900/30" },
  { value: "receita", label: "Receita", cor: "text-emerald-300 bg-emerald-900/30" },
  { value: "ambos", label: "Ambos", cor: "text-blue-300 bg-blue-900/30" },
];

export function CategoriasClient({ categorias }: { categorias: Categoria[] }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Categoria | null>(null);
  const [filtro, setFiltro] = useState<TipoCategoria | "todas">("todas");

  const visiveis = useMemo(
    () => (filtro === "todas" ? categorias : categorias.filter((c) => c.tipo === filtro)),
    [categorias, filtro]
  );

  // Agrupar pais → filhos
  const pais = visiveis.filter((c) => !c.categoria_pai_id);
  const filhosDe = (paiId: string) => visiveis.filter((c) => c.categoria_pai_id === paiId);

  return (
    <div>
      <PageHeader
        titulo="Categorias"
        descricao="Classificação de despesas e receitas. Aceita subcategorias (1 nível)."
        acao={
          <Button onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="w-4 h-4" /> Nova categoria
          </Button>
        }
      />

      <div className="flex gap-2 mb-4">
        {(["todas", "despesa", "receita", "ambos"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={
              "px-3 py-1.5 text-xs rounded-lg transition-colors " +
              (filtro === f
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-300 hover:bg-gray-700")
            }
          >
            {f === "todas" ? "Todas" : TIPOS.find((t) => t.value === f)?.label}
          </button>
        ))}
      </div>

      {pais.length === 0 ? (
        <EmptyState icon={Tag} titulo="Nenhuma categoria" />
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-800/50 text-xs uppercase tracking-wide text-gray-400">
              <tr>
                <th className="text-left px-4 py-3">Nome</th>
                <th className="text-left px-4 py-3">Tipo</th>
                <th className="text-center px-4 py-3">Ativo</th>
                <th className="text-right px-4 py-3 w-24">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {pais.map((p) => (
                <Row
                  key={p.id}
                  cat={p}
                  todas={categorias}
                  filhos={filhosDe(p.id)}
                  onEdit={(c) => { setEditing(c); setOpen(true); }}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CategoriaFormDialog
        open={open}
        onOpenChange={setOpen}
        categoria={editing}
        todas={categorias}
        onSaved={() => setOpen(false)}
      />
    </div>
  );
}

function Row({
  cat,
  filhos,
  todas,
  onEdit,
  indent = false,
}: {
  cat: Categoria;
  filhos?: Categoria[];
  todas: Categoria[];
  onEdit: (c: Categoria) => void;
  indent?: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => { await toggleCategoriaAtivo(cat.id, !cat.ativo); });
  }
  function deletar() {
    if (!confirm(`Excluir "${cat.nome}"?`)) return;
    startTransition(async () => {
      const res = await deletarCategoria(cat.id);
      if ("error" in res && res.error) alert(`Erro: ${res.error}`);
    });
  }

  const tipo = TIPOS.find((t) => t.value === cat.tipo);

  return (
    <>
      <tr className="hover:bg-gray-800/30">
        <td className="px-4 py-3">
          <div className={"flex items-center gap-3 " + (indent ? "pl-8" : "")}>
            <span className="inline-block w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.cor_hex ?? "#6b7280" }} />
            <span className="text-sm text-white">{cat.nome}</span>
          </div>
        </td>
        <td className="px-4 py-3">
          <span className={"inline-block px-2 py-0.5 text-xs rounded-md font-medium " + (tipo?.cor ?? "")}>
            {tipo?.label ?? cat.tipo}
          </span>
        </td>
        <td className="px-4 py-3 text-center">
          <Switch checked={cat.ativo} onCheckedChange={toggle} disabled={pending} />
        </td>
        <td className="px-4 py-3">
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="icon" onClick={() => onEdit(cat)} disabled={pending}><Pencil className="w-4 h-4" /></Button>
            <Button variant="ghost" size="icon" onClick={deletar} disabled={pending}><Trash2 className="w-4 h-4 text-red-400" /></Button>
          </div>
        </td>
      </tr>
      {filhos?.map((f) => (
        <Row key={f.id} cat={f} todas={todas} onEdit={onEdit} indent />
      ))}
    </>
  );
}

function CategoriaFormDialog({
  open,
  onOpenChange,
  categoria,
  todas,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  categoria: Categoria | null;
  todas: Categoria[];
  onSaved: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<TipoCategoria>("despesa");
  const [paiId, setPaiId] = useState("");
  const [cor, setCor] = useState("#6b7280");
  const [icone, setIcone] = useState("");

  useEffect(() => {
    if (!open) return;
    setNome(categoria?.nome ?? "");
    setTipo((categoria?.tipo as TipoCategoria) ?? "despesa");
    setPaiId(categoria?.categoria_pai_id ?? "");
    setCor(categoria?.cor_hex ?? "#6b7280");
    setIcone(categoria?.icone ?? "");
    setErro(null);
  }, [open, categoria?.id, categoria?.nome, categoria?.tipo, categoria?.categoria_pai_id, categoria?.cor_hex, categoria?.icone]);

  // Possíveis pais: categorias do mesmo tipo, sem ela mesma, sem subcategorias (apenas raízes)
  const possiveisPais = todas.filter(
    (c) =>
      !c.categoria_pai_id &&
      c.tipo === tipo &&
      c.id !== categoria?.id &&
      c.ativo
  );

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const input: CategoriaInput = {
      id: categoria?.id,
      nome,
      tipo,
      categoria_pai_id: paiId || null,
      cor_hex: cor,
      icone,
    };
    startTransition(async () => {
      const res = await salvarCategoria(input);
      if ("error" in res && res.error) setErro(res.error);
      else onSaved();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{categoria ? "Editar categoria" : "Nova categoria"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="nome">Nome</Label>
              <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} required placeholder="Ex: Ferramentas" className="mt-1.5" />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={(v) => { setTipo(v as TipoCategoria); setPaiId(""); }}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Categoria pai (opcional — pra criar subcategoria)</Label>
            <Select value={paiId || "__none__"} onValueChange={(v) => setPaiId(v === "__none__" ? "" : v)}>
              <SelectTrigger className="mt-1.5"><SelectValue placeholder="Nenhuma" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— nenhuma (categoria raiz) —</SelectItem>
                {possiveisPais.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="ic">Ícone (lucide)</Label>
              <Input id="ic" value={icone} onChange={(e) => setIcone(e.target.value)} placeholder="Ex: wrench" className="mt-1.5" />
            </div>
            <div>
              <Label>Cor</Label>
              <div className="mt-2"><ColorPicker value={cor} onChange={setCor} /></div>
            </div>
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
