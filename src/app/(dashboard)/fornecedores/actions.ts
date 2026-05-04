"use server";

import { dbServer } from "@/lib/supabase/db";
import { revalidatePath } from "next/cache";
import { normalizeNome } from "@/lib/formatters";

export type FornecedorInput = {
  id?: string;
  nome: string;
  cnpj?: string | null;
  categoria_padrao_id?: string | null;
  entidade_padrao_id?: string | null;
  ativo?: boolean;
};

async function userId() {
  const db = await dbServer();
  const { data } = await db.auth.getUser();
  return data.user?.id as string | undefined;
}

export async function salvarFornecedor(input: FornecedorInput) {
  const db = await dbServer();
  const uid = await userId();
  if (!uid) return { error: "Não autenticado" };

  const payload = {
    nome: input.nome.trim(),
    nome_normalizado: normalizeNome(input.nome),
    cnpj: input.cnpj?.trim() || null,
    categoria_padrao_id: input.categoria_padrao_id || null,
    entidade_padrao_id: input.entidade_padrao_id || null,
    ativo: input.ativo ?? true,
    updated_by: uid,
  };

  if (input.id) {
    const { error } = await db.from("fornecedores").update(payload).eq("id", input.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await db.from("fornecedores").insert({ ...payload, created_by: uid });
    if (error) return { error: error.message };
  }

  revalidatePath("/fornecedores");
  return { ok: true as const };
}

export async function toggleFornecedorAtivo(id: string, ativo: boolean) {
  const db = await dbServer();
  const uid = await userId();
  if (!uid) return { error: "Não autenticado" };
  const { error } = await db.from("fornecedores").update({ ativo, updated_by: uid }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/fornecedores");
  return { ok: true as const };
}

export async function deletarFornecedor(id: string) {
  const db = await dbServer();
  const { error } = await db.from("fornecedores").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/fornecedores");
  return { ok: true as const };
}
