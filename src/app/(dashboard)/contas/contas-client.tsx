"use client";

import { useEffect, useState, useTransition } from "react";
import type { ContaBancaria, Entidade, TipoConta } from "@/lib/types/database";
import { Wallet, Plus, Pencil, Trash2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ColorPicker } from "@/components/ui/color-picker";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { formatBRL } from "@/lib/formatters";
import { salvarConta, toggleContaAtivo, deletarConta, type ContaInput } from "./actions";

type EntLite = Pick<Entidade, "id" | "nome" | "tipo" | "cor_hex" | "ativo" | "ordem">;

const TIPOS: { value: TipoConta; label: string }[] = [
  { value: "corrente", label: "Conta corrente" },
  { value: "poupanca", label: "Poupança" },
  { value: "digital", label: "Conta digital" },
  { value: "prepaga", label: "Pré-paga (Conta Simples, etc)" },
];

export function ContasClient({
  contas,
  entidades,
}: {
  contas: ContaBancaria[];
  entidades: EntLite[];
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ContaBancaria | null>(null);

  function abrirNovo() {
    setEditing(null);
    setOpen(true);
  }

  // Agrupa contas por entidade
  const grupos = entidades
    .map((ent) => ({ entidade: ent, contas: contas.filter((c) => c.entidade_id === ent.id) }))
    .filter((g) => g.contas.length > 0);

  const semEntidade = contas.filter((c) => !entidades.some((e) => e.id === c.entidade_id));

  return (
    <div>
      <PageHeader
        titulo="Contas bancárias"
        descricao="Onde o dinheiro entra e sai. Saldo atualiza sozinho conforme as movimentações."
        acao={
          <Button onClick={abrirNovo} disabled={entidades.length === 0}>
            <Plus className="w-4 h-4" /> Nova conta
          </Button>
        }
      />

      {entidades.length === 0 ? (
        <EmptyState
          icon={Wallet}
          titulo="Cadastre uma entidade primeiro"
          descricao="Cada conta bancária pertence a uma entidade (PF ou PJ)."
        />
      ) : contas.length === 0 ? (
        <EmptyState
          icon={Wallet}
          titulo="Nenhuma conta cadastrada"
          acao={<Button onClick={abrirNovo}><Plus className="w-4 h-4" /> Criar</Button>}
        />
      ) : (
        <div className="space-y-6">
          {grupos.map(({ entidade, contas }) => (
            <div key={entidade.id}>
              <div className="flex items-center gap-2 mb-2 px-1">
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{ backgroundColor: entidade.cor_hex ?? "#6b7280" }}
                />
                <h2 className="text-sm font-semibold text-gray-300">{entidade.nome}</h2>
                <span className="text-xs text-gray-500">({entidade.tipo})</span>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-800/50 text-xs uppercase tracking-wide text-gray-400">
                    <tr>
                      <th className="text-left px-4 py-3">Conta</th>
                      <th className="text-left px-4 py-3">Tipo</th>
                      <th className="text-right px-4 py-3">Saldo</th>
                      <th className="text-center px-4 py-3">Ativa</th>
                      <th className="text-right px-4 py-3 w-24">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {contas.map((c) => (
                      <ContaRow key={c.id} conta={c} onEdit={() => { setEditing(c); setOpen(true); }} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {semEntidade.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-amber-400 mb-2 px-1">Sem entidade vinculada</h2>
              <div className="bg-gray-900 border border-amber-700/40 rounded-xl overflow-hidden">
                <table className="w-full">
                  <tbody className="divide-y divide-gray-800">
                    {semEntidade.map((c) => (
                      <ContaRow key={c.id} conta={c} onEdit={() => { setEditing(c); setOpen(true); }} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      <ContaFormDialog
        open={open}
        onOpenChange={setOpen}
        conta={editing}
        entidades={entidades}
        onSaved={() => setOpen(false)}
      />
    </div>
  );
}

function ContaRow({ conta, onEdit }: { conta: ContaBancaria; onEdit: () => void }) {
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => { await toggleContaAtivo(conta.id, !conta.ativo); });
  }
  function deletar() {
    if (!confirm(`Excluir "${conta.nome}"?`)) return;
    startTransition(async () => {
      const res = await deletarConta(conta.id);
      if ("error" in res && res.error) alert(`Erro: ${res.error}`);
    });
  }

  const tipoLabel = TIPOS.find((t) => t.value === conta.tipo)?.label ?? conta.tipo;

  return (
    <tr className="hover:bg-gray-800/30">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <span
            className="inline-block w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: conta.cor_hex ?? "#10b981" }}
          />
          <div>
            <div className="text-sm font-medium text-white flex items-center gap-2">
              {conta.nome}
              {conta.conta_principal && <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />}
            </div>
            <div className="text-xs text-gray-500">{conta.banco}</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-gray-400">{tipoLabel}</td>
      <td className="px-4 py-3 text-right text-sm font-mono text-white">{formatBRL(conta.saldo_atual)}</td>
      <td className="px-4 py-3 text-center">
        <Switch checked={conta.ativo} onCheckedChange={toggle} disabled={pending} />
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

function ContaFormDialog({
  open,
  onOpenChange,
  conta,
  entidades,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  conta: ContaBancaria | null;
  entidades: EntLite[];
  onSaved: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [banco, setBanco] = useState("");
  const [tipo, setTipo] = useState<TipoConta>("corrente");
  const [entidadeId, setEntidadeId] = useState<string>("");
  const [agencia, setAgencia] = useState("");
  const [numero, setNumero] = useState("");
  const [contaPrincipal, setContaPrincipal] = useState(false);
  const [saldoInicial, setSaldoInicial] = useState("0");
  const [cor, setCor] = useState("#10b981");

  useEffect(() => {
    if (!open) return;
    setNome(conta?.nome ?? "");
    setBanco(conta?.banco ?? "");
    setTipo((conta?.tipo as TipoConta) ?? "corrente");
    setEntidadeId(conta?.entidade_id ?? entidades[0]?.id ?? "");
    setAgencia(conta?.agencia ?? "");
    setNumero(conta?.numero ?? "");
    setContaPrincipal(conta?.conta_principal ?? false);
    setSaldoInicial(conta ? String(conta.saldo_atual ?? 0) : "0");
    setCor(conta?.cor_hex ?? "#10b981");
    setErro(null);
  }, [open, conta?.id, conta?.nome, conta?.banco, conta?.tipo, conta?.entidade_id, conta?.agencia, conta?.numero, conta?.conta_principal, conta?.saldo_atual, conta?.cor_hex, entidades]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!entidadeId) {
      setErro("Selecione uma entidade.");
      return;
    }
    const input: ContaInput = {
      id: conta?.id,
      nome,
      banco,
      tipo,
      entidade_id: entidadeId,
      agencia,
      numero,
      conta_principal: contaPrincipal,
      saldo_atual: conta ? undefined : parseFloat(saldoInicial.replace(",", ".")) || 0,
      cor_hex: cor,
    };
    startTransition(async () => {
      const res = await salvarConta(input);
      if ("error" in res && res.error) setErro(res.error);
      else onSaved();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{conta ? "Editar conta" : "Nova conta bancária"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Entidade</Label>
              <Select value={entidadeId} onValueChange={setEntidadeId}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {entidades.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nome} ({e.tipo})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as TipoConta)}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="nome">Nome amigável</Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
                placeholder="Ex: Manual RN — Unicred"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="banco">Banco</Label>
              <Input
                id="banco"
                value={banco}
                onChange={(e) => setBanco(e.target.value)}
                required
                placeholder="Ex: Unicred"
                className="mt-1.5"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="ag">Agência</Label>
              <Input id="ag" value={agencia} onChange={(e) => setAgencia(e.target.value)} placeholder="Opcional" className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="num">Número da conta</Label>
              <Input id="num" value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Opcional" className="mt-1.5" />
            </div>
          </div>

          {!conta && (
            <div>
              <Label htmlFor="saldo">Saldo inicial</Label>
              <Input
                id="saldo"
                type="number"
                step="0.01"
                value={saldoInicial}
                onChange={(e) => setSaldoInicial(e.target.value)}
                className="mt-1.5"
              />
              <p className="text-xs text-gray-500 mt-1">
                Após criar, o saldo é atualizado automaticamente pelas movimentações.
              </p>
            </div>
          )}

          <div className="flex items-center gap-3">
            <Switch checked={contaPrincipal} onCheckedChange={setContaPrincipal} />
            <Label className="cursor-pointer" onClick={() => setContaPrincipal(!contaPrincipal)}>
              Conta principal desta entidade
            </Label>
          </div>

          <div>
            <Label>Cor</Label>
            <div className="mt-2"><ColorPicker value={cor} onChange={setCor} /></div>
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
