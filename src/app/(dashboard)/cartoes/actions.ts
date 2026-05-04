"use server";

import { dbServer } from "@/lib/supabase/db";
import { revalidatePath } from "next/cache";
import type { BandeiraCartao } from "@/lib/types/database";

export type CartaoInput = {
  id?: string;
  nome: string;
  bandeira: BandeiraCartao;
  entidade_id: string;
  conta_pagamento_id?: string | null;
  ultimos_4_digitos?: string | null;
  limite_total?: number | null;
  dia_fechamento: number;
  dia_vencimento: number;
  cor_hex?: string | null;
  ativo?: boolean;
  ordem?: number;
};

async function userId() {
  const db = await dbServer();
  const { data } = await db.auth.getUser();
  return data.user?.id as string | undefined;
}

export async function salvarCartao(input: CartaoInput) {
  const db = await dbServer();
  const uid = await userId();
  if (!uid) return { error: "Não autenticado" };

  const payload = {
    nome: input.nome.trim(),
    bandeira: input.bandeira,
    entidade_id: input.entidade_id,
    conta_pagamento_id: input.conta_pagamento_id || null,
    ultimos_4_digitos: input.ultimos_4_digitos?.trim() || null,
    limite_total: input.limite_total ?? 0,
    limite_disponivel: input.limite_total ?? 0,
    dia_fechamento: input.dia_fechamento,
    dia_vencimento: input.dia_vencimento,
    cor_hex: input.cor_hex || "#8b5cf6",
    ativo: input.ativo ?? true,
    ordem: input.ordem ?? 0,
    updated_by: uid,
  };

  if (input.id) {
    const { error } = await db.from("cartoes_credito").update(payload).eq("id", input.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await db.from("cartoes_credito").insert({ ...payload, created_by: uid });
    if (error) return { error: error.message };
  }

  revalidatePath("/cartoes");
  return { ok: true as const };
}

export async function toggleCartaoAtivo(id: string, ativo: boolean) {
  const db = await dbServer();
  const uid = await userId();
  if (!uid) return { error: "Não autenticado" };
  const { error } = await db.from("cartoes_credito").update({ ativo, updated_by: uid }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/cartoes");
  return { ok: true as const };
}

export async function deletarCartao(id: string) {
  const db = await dbServer();
  const { error } = await db.from("cartoes_credito").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/cartoes");
  return { ok: true as const };
}
