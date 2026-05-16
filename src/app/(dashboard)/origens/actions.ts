"use server";

import { dbServer } from "@/lib/supabase/db";
import { revalidatePath } from "next/cache";

export type OrigemInput = {
  id?: string;
  nome: string;
  cor_hex?: string | null;
  ordem?: number;
  ativo?: boolean;
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 50);
}

export async function salvarOrigem(input: OrigemInput) {
  const db = await dbServer();
  const nome = input.nome.trim();
  if (!nome) return { error: "Nome obrigatório" };

  const payload: Record<string, unknown> = {
    nome,
    cor_hex: input.cor_hex || null,
    ordem: input.ordem ?? 100,
    ativo: input.ativo ?? true,
  };

  if (input.id) {
    const { error } = await db.from("origens_receita").update(payload as never).eq("id", input.id);
    if (error) return { error: error.message };
  } else {
    // Gera slug único a partir do nome
    let slug = slugify(nome);
    if (!slug) slug = `origem_${Date.now()}`;
    // Confere se já existe; se sim, adiciona sufixo
    const { data: existing } = await db.from("origens_receita").select("slug").eq("slug", slug).maybeSingle();
    if (existing) slug = `${slug}_${Date.now().toString(36).slice(-4)}`;
    payload.slug = slug;
    const { error } = await db.from("origens_receita").insert(payload as never);
    if (error) return { error: error.message };
  }

  revalidatePath("/origens");
  revalidatePath("/receitas");
  return { ok: true as const };
}

export async function toggleOrigemAtivo(id: string, ativo: boolean) {
  const db = await dbServer();
  const { error } = await db.from("origens_receita").update({ ativo } as never).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/origens");
  revalidatePath("/receitas");
  return { ok: true as const };
}

export async function deletarOrigem(id: string) {
  const db = await dbServer();
  // Verifica se tem receita usando essa origem
  const { count } = await db
    .from("receitas_brutas")
    .select("id", { count: "exact", head: true })
    .eq("origem_id", id);
  if (count && count > 0) {
    return { error: `Não pode excluir — ${count} receita${count === 1 ? "" : "s"} usando essa origem. Desative em vez de excluir.` };
  }
  const { error } = await db.from("origens_receita").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/origens");
  revalidatePath("/receitas");
  return { ok: true as const };
}
