"use server";

import { dbServer } from "@/lib/supabase/db";
import { revalidatePath } from "next/cache";
import type { TipoConta } from "@/lib/types/database";

export type ContaInput = {
  id?: string;
  nome: string;
  banco: string;
  tipo: TipoConta;
  entidade_id: string;
  agencia?: string | null;
  numero?: string | null;
  cor_hex?: string | null;
  conta_principal?: boolean;
  saldo_atual?: number;
  ativo?: boolean;
  ordem?: number;
};

async function userId() {
  const db = await dbServer();
  const { data } = await db.auth.getUser();
  return data.user?.id as string | undefined;
}

export async function salvarConta(input: ContaInput) {
  const db = await dbServer();
  const uid = await userId();
  if (!uid) return { error: "Não autenticado" };

  const payload = {
    nome: input.nome.trim(),
    banco: input.banco.trim(),
    tipo: input.tipo,
    entidade_id: input.entidade_id,
    agencia: input.agencia?.trim() || null,
    numero: input.numero?.trim() || null,
    cor_hex: input.cor_hex || "#10b981",
    conta_principal: input.conta_principal ?? false,
    ativo: input.ativo ?? true,
    ordem: input.ordem ?? 0,
    updated_by: uid,
  };

  if (input.id) {
    const { error } = await db.from("contas_bancarias").update(payload).eq("id", input.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await db.from("contas_bancarias").insert({
      ...payload,
      saldo_atual: input.saldo_atual ?? 0,
      created_by: uid,
    });
    if (error) return { error: error.message };
  }

  revalidatePath("/contas");
  return { ok: true as const };
}

export async function toggleContaAtivo(id: string, ativo: boolean) {
  const db = await dbServer();
  const uid = await userId();
  if (!uid) return { error: "Não autenticado" };
  const { error } = await db.from("contas_bancarias").update({ ativo, updated_by: uid }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/contas");
  return { ok: true as const };
}

export async function deletarConta(id: string) {
  const db = await dbServer();
  const { error } = await db.from("contas_bancarias").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/contas");
  return { ok: true as const };
}

export async function ajustarSaldoConta(id: string, novoSaldo: number) {
  const db = await dbServer();
  const uid = await userId();
  if (!uid) return { error: "Não autenticado" };
  const { error } = await db
    .from("contas_bancarias")
    .update({ saldo_atual: novoSaldo, saldo_atualizado_em: new Date().toISOString(), updated_by: uid })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/contas");
  return { ok: true as const };
}
