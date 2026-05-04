"use server";

import { dbServer } from "@/lib/supabase/db";
import { revalidatePath } from "next/cache";

export type EntidadeInput = {
  id?: string;
  nome: string;
  tipo: "PF" | "PJ";
  cnpj_cpf?: string | null;
  razao_social?: string | null;
  cor_hex?: string | null;
  ativo?: boolean;
  ordem?: number;
};

async function userId() {
  const db = await dbServer();
  const { data } = await db.auth.getUser();
  return data.user?.id as string | undefined;
}

export async function salvarEntidade(input: EntidadeInput) {
  const db = await dbServer();
  const uid = await userId();
  if (!uid) return { error: "Não autenticado" };

  const payload = {
    nome: input.nome.trim(),
    tipo: input.tipo,
    cnpj_cpf: input.cnpj_cpf?.trim() || null,
    razao_social: input.razao_social?.trim() || null,
    cor_hex: input.cor_hex || "#3b82f6",
    ativo: input.ativo ?? true,
    ordem: input.ordem ?? 0,
    updated_by: uid,
  };

  if (input.id) {
    const { error } = await db.from("entidades").update(payload).eq("id", input.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await db.from("entidades").insert({ ...payload, created_by: uid });
    if (error) return { error: error.message };
  }

  revalidatePath("/entidades");
  return { ok: true as const };
}

export async function toggleEntidadeAtivo(id: string, ativo: boolean) {
  const db = await dbServer();
  const uid = await userId();
  if (!uid) return { error: "Não autenticado" };

  const { error } = await db
    .from("entidades")
    .update({ ativo, updated_by: uid })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/entidades");
  return { ok: true as const };
}

export async function deletarEntidade(id: string) {
  const db = await dbServer();
  const { error } = await db.from("entidades").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/entidades");
  return { ok: true as const };
}
