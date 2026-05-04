"use client";

import { useEffect, useState, useTransition } from "react";
import type { Entidade, TipoEntidade } from "@/lib/types/database";
import { Building2, Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ColorPicker } from "@/components/ui/color-picker";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { salvarEntidade, toggleEntidadeAtivo, deletarEntidade, type EntidadeInput } from "./actions";

export function EntidadesClient({ entidades }: { entidades: Entidade[] }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Entidade | null>(null);

  function abrirNovo() {
    setEditing(null);
    setOpen(true);
  }
  function abrirEditar(e: Entidade) {
    setEditing(e);
    setOpen(true);
  }

  return (
    <div>
      <PageHeader
        titulo="Entidades"
        descricao="PFs e PJs (CNPJs) — usadas pra agrupar contas, cartões e transações"
        acao={
          <Button onClick={abrirNovo}>
            <Plus className="w-4 h-4" /> Nova entidade
          </Button>
        }
      />

      {entidades.length === 0 ? (
        <EmptyState
          icon={Building2}
          titulo="Nenhuma entidade cadastrada"
          descricao="Crie a primeira pra começar."
          acao={<Button onClick={abrirNovo}><Plus className="w-4 h-4" /> Criar</Button>}
        />
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-800/50 text-xs uppercase tracking-wide text-gray-400">
              <tr>
                <th className="text-left px-4 py-3">Nome</th>
                <th className="text-left px-4 py-3">Tipo</th>
                <th className="text-left px-4 py-3">CPF/CNPJ</th>
                <th className="text-center px-4 py-3">Ativo</th>
                <th className="text-right px-4 py-3 w-24">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {entidades.map((e) => (
                <EntidadeRow key={e.id} entidade={e} onEdit={() => abrirEditar(e)} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <EntidadeFormDialog
        open={open}
        onOpenChange={setOpen}
        entidade={editing}
        onSaved={() => setOpen(false)}
      />
    </div>
  );
}

function EntidadeRow({ entidade, onEdit }: { entidade: Entidade; onEdit: () => void }) {
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      await toggleEntidadeAtivo(entidade.id, !entidade.ativo);
    });
  }

  function deletar() {
    if (!confirm(`Excluir "${entidade.nome}"? Essa ação não pode ser desfeita.`)) return;
    startTransition(async () => {
      const res = await deletarEntidade(entidade.id);
      if ("error" in res && res.error) {
        alert(`Erro: ${res.error}`);
      }
    });
  }

  return (
    <tr className="hover:bg-gray-800/30">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <span
            className="inline-block w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: entidade.cor_hex ?? "#6b7280" }}
          />
          <div>
            <div className="text-sm font-medium text-white">{entidade.nome}</div>
            {entidade.razao_social && entidade.razao_social !== entidade.nome && (
              <div className="text-xs text-gray-500">{entidade.razao_social}</div>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={
          "inline-block px-2 py-0.5 text-xs rounded-md font-medium " +
          (entidade.tipo === "PJ" ? "bg-blue-900/40 text-blue-300" : "bg-pink-900/40 text-pink-300")
        }>
          {entidade.tipo}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-gray-400">{entidade.cnpj_cpf ?? "—"}</td>
      <td className="px-4 py-3 text-center">
        <Switch checked={entidade.ativo} onCheckedChange={toggle} disabled={pending} />
      </td>
      <td className="px-4 py-3">
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" onClick={onEdit} disabled={pending}>
            <Pencil className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={deletar} disabled={pending}>
            <Trash2 className="w-4 h-4 text-red-400" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

function EntidadeFormDialog({
  open,
  onOpenChange,
  entidade,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  entidade: Entidade | null;
  onSaved: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  // Form state. Reset when modal abre/edita
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<TipoEntidade>("PJ");
  const [cnpjCpf, setCnpjCpf] = useState("");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [cor, setCor] = useState("#3b82f6");

  // Sincroniza form quando abre OU troca a entidade alvo
  useEffect(() => {
    if (!open) return;
    setNome(entidade?.nome ?? "");
    setTipo((entidade?.tipo as TipoEntidade) ?? "PJ");
    setCnpjCpf(entidade?.cnpj_cpf ?? "");
    setRazaoSocial(entidade?.razao_social ?? "");
    setCor(entidade?.cor_hex ?? "#3b82f6");
    setErro(null);
  }, [open, entidade?.id, entidade?.nome, entidade?.tipo, entidade?.cnpj_cpf, entidade?.razao_social, entidade?.cor_hex]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const input: EntidadeInput = {
      id: entidade?.id,
      nome,
      tipo,
      cnpj_cpf: cnpjCpf,
      razao_social: razaoSocial,
      cor_hex: cor,
    };
    startTransition(async () => {
      const res = await salvarEntidade(input);
      if ("error" in res && res.error) {
        setErro(res.error);
      } else {
        onSaved();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{entidade ? "Editar entidade" : "Nova entidade"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="nome">Nome</Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
                placeholder="Ex: Manual do Recém-Nascido"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="tipo">Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as TipoEntidade)}>
                <SelectTrigger id="tipo" className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PJ">Pessoa Jurídica</SelectItem>
                  <SelectItem value="PF">Pessoa Física</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="cnpj">CPF / CNPJ</Label>
              <Input
                id="cnpj"
                value={cnpjCpf}
                onChange={(e) => setCnpjCpf(e.target.value)}
                placeholder="Opcional"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="razao">Razão social</Label>
              <Input
                id="razao"
                value={razaoSocial}
                onChange={(e) => setRazaoSocial(e.target.value)}
                placeholder="Opcional"
                className="mt-1.5"
              />
            </div>
          </div>

          <div>
            <Label>Cor (identificação visual)</Label>
            <div className="mt-2">
              <ColorPicker value={cor} onChange={setCor} />
            </div>
          </div>

          {erro && (
            <div className="bg-red-900/30 border border-red-700 rounded-lg px-3 py-2 text-red-400 text-sm">
              {erro}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
