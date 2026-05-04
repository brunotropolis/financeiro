"use client";

import { useEffect, useState, useTransition } from "react";
import type { BandeiraCartao, CartaoCredito, ContaBancaria, Entidade } from "@/lib/types/database";
import { CreditCard, Plus, Pencil, Trash2 } from "lucide-react";
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
import { salvarCartao, toggleCartaoAtivo, deletarCartao, type CartaoInput } from "./actions";

type EntLite = Pick<Entidade, "id" | "nome" | "tipo" | "cor_hex" | "ativo" | "ordem">;
type ContaLite = Pick<ContaBancaria, "id" | "nome" | "banco" | "entidade_id" | "ativo">;

const BANDEIRAS: { value: BandeiraCartao; label: string }[] = [
  { value: "visa", label: "Visa" },
  { value: "master", label: "Mastercard" },
  { value: "elo", label: "Elo" },
  { value: "amex", label: "Amex" },
  { value: "hipercard", label: "Hipercard" },
  { value: "outro", label: "Outro" },
];

export function CartoesClient({
  cartoes,
  entidades,
  contas,
}: {
  cartoes: CartaoCredito[];
  entidades: EntLite[];
  contas: ContaLite[];
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CartaoCredito | null>(null);

  return (
    <div>
      <PageHeader
        titulo="Cartões de crédito"
        descricao="Compras parceladas e fatura mensal são geradas automaticamente conforme dia de fechamento."
        acao={
          <Button onClick={() => { setEditing(null); setOpen(true); }} disabled={entidades.length === 0}>
            <Plus className="w-4 h-4" /> Novo cartão
          </Button>
        }
      />

      {cartoes.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          titulo="Nenhum cartão cadastrado"
          descricao={entidades.length === 0 ? "Cadastre uma entidade primeiro." : undefined}
          acao={entidades.length > 0 && <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="w-4 h-4" /> Criar</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cartoes.map((c) => (
            <CartaoCard
              key={c.id}
              cartao={c}
              entidade={entidades.find((e) => e.id === c.entidade_id)}
              contaPagamento={contas.find((co) => co.id === c.conta_pagamento_id)}
              onEdit={() => { setEditing(c); setOpen(true); }}
            />
          ))}
        </div>
      )}

      <CartaoFormDialog
        open={open}
        onOpenChange={setOpen}
        cartao={editing}
        entidades={entidades}
        contas={contas}
        onSaved={() => setOpen(false)}
      />
    </div>
  );
}

function CartaoCard({
  cartao,
  entidade,
  contaPagamento,
  onEdit,
}: {
  cartao: CartaoCredito;
  entidade?: EntLite;
  contaPagamento?: ContaLite;
  onEdit: () => void;
}) {
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => { await toggleCartaoAtivo(cartao.id, !cartao.ativo); });
  }
  function deletar() {
    if (!confirm(`Excluir "${cartao.nome}"?`)) return;
    startTransition(async () => {
      const res = await deletarCartao(cartao.id);
      if ("error" in res && res.error) alert(`Erro: ${res.error}`);
    });
  }

  const limUsado = (cartao.limite_total ?? 0) - (cartao.limite_disponivel ?? 0);
  const pctUsado = cartao.limite_total ? Math.round((limUsado / cartao.limite_total) * 100) : 0;

  return (
    <div
      className={`bg-gray-900 border border-gray-800 rounded-xl p-5 ${!cartao.ativo ? "opacity-60" : ""}`}
      style={{ borderLeftWidth: "3px", borderLeftColor: cartao.cor_hex ?? "#8b5cf6" }}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-base font-semibold text-white">{cartao.nome}</h3>
          <p className="text-xs text-gray-500 uppercase tracking-wide">
            {BANDEIRAS.find((b) => b.value === cartao.bandeira)?.label ?? cartao.bandeira}
            {cartao.ultimos_4_digitos && ` •••• ${cartao.ultimos_4_digitos}`}
          </p>
          {entidade && <p className="text-xs text-gray-400 mt-1">{entidade.nome}</p>}
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={onEdit} disabled={pending}><Pencil className="w-4 h-4" /></Button>
          <Button variant="ghost" size="icon" onClick={deletar} disabled={pending}><Trash2 className="w-4 h-4 text-red-400" /></Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-xs text-gray-500">Fecha dia</div>
          <div className="font-mono text-white">{cartao.dia_fechamento}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Vence dia</div>
          <div className="font-mono text-white">{cartao.dia_vencimento}</div>
        </div>
      </div>

      {cartao.limite_total && cartao.limite_total > 0 ? (
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-500">Limite usado</span>
            <span className="text-gray-400">{formatBRL(limUsado)} / {formatBRL(cartao.limite_total)}</span>
          </div>
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all"
              style={{ width: `${Math.min(100, pctUsado)}%` }}
            />
          </div>
        </div>
      ) : null}

      {contaPagamento && (
        <div className="mt-3 pt-3 border-t border-gray-800 text-xs text-gray-500">
          Paga via <span className="text-gray-300">{contaPagamento.nome}</span>
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-gray-800 flex items-center justify-between">
        <span className="text-xs text-gray-500">{cartao.ativo ? "Ativo" : "Inativo"}</span>
        <Switch checked={cartao.ativo} onCheckedChange={toggle} disabled={pending} />
      </div>
    </div>
  );
}

function CartaoFormDialog({
  open,
  onOpenChange,
  cartao,
  entidades,
  contas,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cartao: CartaoCredito | null;
  entidades: EntLite[];
  contas: ContaLite[];
  onSaved: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [bandeira, setBandeira] = useState<BandeiraCartao>("master");
  const [entidadeId, setEntidadeId] = useState("");
  const [contaPagId, setContaPagId] = useState<string>("");
  const [ultimos4, setUltimos4] = useState("");
  const [limite, setLimite] = useState("0");
  const [diaFechamento, setDiaFechamento] = useState("3");
  const [diaVencimento, setDiaVencimento] = useState("10");
  const [cor, setCor] = useState("#8b5cf6");

  useEffect(() => {
    if (!open) return;
    setNome(cartao?.nome ?? "");
    setBandeira((cartao?.bandeira as BandeiraCartao) ?? "master");
    setEntidadeId(cartao?.entidade_id ?? entidades[0]?.id ?? "");
    setContaPagId(cartao?.conta_pagamento_id ?? "");
    setUltimos4(cartao?.ultimos_4_digitos ?? "");
    setLimite(cartao ? String(cartao.limite_total ?? 0) : "0");
    setDiaFechamento(String(cartao?.dia_fechamento ?? 3));
    setDiaVencimento(String(cartao?.dia_vencimento ?? 10));
    setCor(cartao?.cor_hex ?? "#8b5cf6");
    setErro(null);
  }, [open, cartao?.id, cartao?.nome, cartao?.bandeira, cartao?.entidade_id, cartao?.conta_pagamento_id, cartao?.ultimos_4_digitos, cartao?.limite_total, cartao?.dia_fechamento, cartao?.dia_vencimento, cartao?.cor_hex, entidades]);

  const contasFiltradas = contas.filter((c) => c.entidade_id === entidadeId);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const dF = parseInt(diaFechamento);
    const dV = parseInt(diaVencimento);
    if (dF < 1 || dF > 31 || dV < 1 || dV > 31) {
      setErro("Dias devem ser entre 1 e 31.");
      return;
    }
    const input: CartaoInput = {
      id: cartao?.id,
      nome,
      bandeira,
      entidade_id: entidadeId,
      conta_pagamento_id: contaPagId || null,
      ultimos_4_digitos: ultimos4,
      limite_total: parseFloat(limite.replace(",", ".")) || 0,
      dia_fechamento: dF,
      dia_vencimento: dV,
      cor_hex: cor,
    };
    startTransition(async () => {
      const res = await salvarCartao(input);
      if ("error" in res && res.error) setErro(res.error);
      else onSaved();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{cartao ? "Editar cartão" : "Novo cartão de crédito"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Entidade</Label>
              <Select value={entidadeId} onValueChange={(v) => { setEntidadeId(v); setContaPagId(""); }}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {entidades.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.nome} ({e.tipo})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Bandeira</Label>
              <Select value={bandeira} onValueChange={(v) => setBandeira(v as BandeiraCartao)}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BANDEIRAS.map((b) => (
                    <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="nome">Nome</Label>
              <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} required placeholder="Ex: Unicred — Manual RN" className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="u4">Últimos 4 dígitos</Label>
              <Input id="u4" value={ultimos4} onChange={(e) => setUltimos4(e.target.value)} maxLength={4} placeholder="0000" className="mt-1.5" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="lim">Limite total</Label>
              <Input id="lim" type="number" step="0.01" value={limite} onChange={(e) => setLimite(e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="df">Fecha dia</Label>
              <Input id="df" type="number" min={1} max={31} value={diaFechamento} onChange={(e) => setDiaFechamento(e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="dv">Vence dia</Label>
              <Input id="dv" type="number" min={1} max={31} value={diaVencimento} onChange={(e) => setDiaVencimento(e.target.value)} className="mt-1.5" />
            </div>
          </div>

          <div>
            <Label>Conta de pagamento da fatura</Label>
            <Select value={contaPagId || "__none__"} onValueChange={(v) => setContaPagId(v === "__none__" ? "" : v)}>
              <SelectTrigger className="mt-1.5"><SelectValue placeholder="Sem conta vinculada" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— sem conta vinculada —</SelectItem>
                {contasFiltradas.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
