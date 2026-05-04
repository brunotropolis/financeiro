"use server";

import { dbServer } from "@/lib/supabase/db";
import { revalidatePath } from "next/cache";
import type { TipoCategoria } from "@/lib/types/database";

export type CategoriaInput = {
  id?: string;
  nome: string;
  tipo: TipoCategoria;
  categoria_pai_id?: string | null;
  cor_hex?: string | null;
  icone?: string | null;
  ativo?: boolean;
  ordem?: number;
};

async function userId() {
  const db = await dbServer();
  const { data } = await db.auth.getUser();
  return data.user?.id as string | undefined;
}

export async function salvarCategoria(input: CategoriaInput) {
  const db = await dbServer();
  const uid = await userId();
  if (!uid) return { error: "Não autenticado" };

  const payload = {
    nome: input.nome.trim(),
    tipo: input.tipo,
    categoria_pai_id: input.categoria_pai_id || null,
    cor_hex: input.cor_hex || "#6b7280",
    icone: input.icone?.trim() || null,
    ativo: input.ativo ?? true,
    ordem: input.ordem ?? 0,
    updated_by: uid,
  };

  if (input.id) {
    if (input.categoria_pai_id === input.id) {
      return { error: "Categoria não pode ser pai dela mesma." };
    }
    const { error } = await db.from("categorias").update(payload).eq("id", input.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await db.from("categorias").insert({ ...payload, created_by: uid });
    if (error) return { error: error.message };
  }

  revalidatePath("/categorias");
  return { ok: true as const };
}

export async function toggleCategoriaAtivo(id: string, ativo: boolean) {
  const db = await dbServer();
  const uid = await userId();
  if (!uid) return { error: "Não autenticado" };
  const { error } = await db.from("categorias").update({ ativo, updated_by: uid }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/categorias");
  return { ok: true as const };
}

export async function deletarCategoria(id: string) {
  const db = await dbServer();
  const { error } = await db.from("categorias").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/categorias");
  return { ok: true as const };
}
