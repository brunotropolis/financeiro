"use client";

import { useEffect, useState, useTransition } from "react";
import type { OrigemReceitaRow } from "@/lib/types/database";
import { Tag, Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { salvarOrigem, toggleOrigemAtivo, deletarOrigem, type OrigemInput } from "./actions";

export function OrigensClient({ origens }: { origens: OrigemReceitaRow[] }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<OrigemReceitaRow | null>(null);

  return (
    <div>
      <PageHeader
        titulo="Origens de receita"
        descricao="Categorias de onde vem suas receitas: marketplaces (Amazon, Shopee, Magalu...), publis, palestras, etc. Use no campo Origem ao lançar uma receita."
        acao={
          <Button onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="w-4 h-4" /> Nova origem
          </Button>
        }
      />

      {origens.length === 0 ? (
        <EmptyState
          icon={Tag}
          titulo="Nenhuma origem cadastrada"
          descricao="Crie a primeira origem (ex: Casas Bahia, AliExpress, Hotmart)."
          acao={<Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="w-4 h-4" /> Criar</Button>}
        />
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-800/50 text-xs uppercase tracking-wide text-gray-400">
              <tr>
                <th className="text-left px-4 py-3">Nome</th>
                <th className="text-left px-4 py-3">Slug</th>
                <th className="text-center px-4 py-3 w-20">Ordem</th>
                <th className="text-center px-4 py-3 w-20">Ativa</th>
                <th className="text-right px-4 py-3 w-24">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {origens.map((o) => (
                <Row key={o.id} o={o} onEdit={() => { setEditing(o); setOpen(true); }} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <OrigemDialog
        open={open}
        onOpenChange={setOpen}
        origem={editing}
        onSaved={() => setOpen(false)}
      />
    </div>
  );
}

function Row({ o, onEdit }: { o: OrigemReceitaRow; onEdit: () => void }) {
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => { await toggleOrigemAtivo(o.id, !o.ativo); });
  }
  function deletar() {
    if (!confirm(`Excluir origem "${o.nome}"?`)) return;
    startTransition(async () => {
      const res = await deletarOrigem(o.id);
      if ("error" in res && res.error) alert(`Erro: ${res.error}`);
    });
  }

  return (
    <tr className={"hover:bg-gray-800/30 " + (o.ativo ? "" : "opacity-50")}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: o.cor_hex ?? "#6b7280" }} />
          <span className="text-sm font-medium text-white">{o.nome}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-xs font-mono text-gray-500">{o.slug}</td>
      <td className="px-4 py-3 text-center text-sm text-gray-400">{o.ordem}</td>
      <td className="px-4 py-3 text-center">
        <Switch checked={o.ativo} onCheckedChange={toggle} disabled={pending} />
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

function OrigemDialog({
  open,
  onOpenChange,
  origem,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  origem: OrigemReceitaRow | null;
  onSaved: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [corHex, setCorHex] = useState("#6b7280");
  const [ordem, setOrdem] = useState("100");
  const [ativo, setAtivo] = useState(true);

  useEffect(() => {
    if (!open) return;
    setNome(origem?.nome ?? "");
    setCorHex(origem?.cor_hex ?? "#6b7280");
    setOrdem(String(origem?.ordem ?? 100));
    setAtivo(origem?.ativo ?? true);
    setErro(null);
  }, [open, origem]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!nome.trim()) return setErro("Nome obrigatório.");
    const input: OrigemInput = {
      id: origem?.id,
      nome: nome.trim(),
      cor_hex: corHex,
      ordem: parseInt(ordem) || 100,
      ativo,
    };
    startTransition(async () => {
      const res = await salvarOrigem(input);
      if ("error" in res && res.error) setErro(res.error);
      else onSaved();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{origem ? "Editar origem" : "Nova origem"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="nome">Nome</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
              placeholder="Ex: Casas Bahia Afiliados"
              className="mt-1.5"
            />
            {!origem && (
              <p className="text-[11px] text-gray-500 mt-1">
                Slug será gerado automaticamente do nome.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="cor">Cor</Label>
              <div className="flex items-center gap-2 mt-1.5">
                <input
                  id="cor"
                  type="color"
                  value={corHex}
                  onChange={(e) => setCorHex(e.target.value)}
                  className="w-12 h-10 rounded-lg border border-gray-700 bg-gray-900 cursor-pointer"
                />
                <Input
                  value={corHex}
                  onChange={(e) => setCorHex(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="ordem">Ordem (menor = primeiro)</Label>
              <Input
                id="ordem"
                type="number"
                value={ordem}
                onChange={(e) => setOrdem(e.target.value)}
                className="mt-1.5"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-950 border border-gray-800">
            <Switch checked={ativo} onCheckedChange={setAtivo} />
            <Label className="cursor-pointer" onClick={() => setAtivo(!ativo)}>
              Ativa (aparece no form de receita)
            </Label>
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
