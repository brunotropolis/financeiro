"use server";

import { dbServer } from "@/lib/supabase/db";
import { revalidatePath } from "next/cache";

export type ProjetoInput = {
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

export async function salvarProjeto(input: ProjetoInput) {
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
    const { error } = await db.from("projetos").update(payload as never).eq("id", input.id);
    if (error) return { error: error.message };
  } else {
    let slug = slugify(nome);
    if (!slug) slug = `projeto_${Date.now()}`;
    const { data: existing } = await db.from("projetos").select("slug").eq("slug", slug).maybeSingle();
    if (existing) slug = `${slug}_${Date.now().toString(36).slice(-4)}`;
    payload.slug = slug;
    const { error } = await db.from("projetos").insert(payload as never);
    if (error) return { error: error.message };
  }

  revalidatePath("/projetos");
  revalidatePath("/receitas");
  revalidatePath("/transacoes");
  revalidatePath("/recorrencias");
  return { ok: true as const };
}

export async function toggleProjetoAtivo(id: string, ativo: boolean) {
  const db = await dbServer();
  const { error } = await db.from("projetos").update({ ativo } as never).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/projetos");
  return { ok: true as const };
}

export async function deletarProjeto(id: string) {
  const db = await dbServer();
  // Conta vínculos em cada tabela
  const [txRes, recRes, recoRes] = await Promise.all([
    db.from("transacoes").select("id", { count: "exact", head: true }).eq("projeto_id", id),
    db.from("receitas_brutas").select("id", { count: "exact", head: true }).eq("projeto_id", id),
    db.from("recorrencias").select("id", { count: "exact", head: true }).eq("projeto_id", id),
  ]);
  const totalVinculados = (txRes.count ?? 0) + (recRes.count ?? 0) + (recoRes.count ?? 0);
  if (totalVinculados > 0) {
    return { error: `Não pode excluir — ${totalVinculados} item${totalVinculados === 1 ? "" : "s"} vinculado${totalVinculados === 1 ? "" : "s"} (transações, receitas, recorrências). Desative em vez de excluir.` };
  }
  const { error } = await db.from("projetos").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/projetos");
  return { ok: true as const };
}
