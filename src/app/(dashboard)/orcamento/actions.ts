"use server";

import { dbServer } from "@/lib/supabase/db";
import { revalidatePath } from "next/cache";

async function userId() {
  const db = await dbServer();
  const { data } = await db.auth.getUser();
  return data.user?.id as string | undefined;
}

/**
 * Salva (upsert) o orçamento de uma categoria para um mês.
 * Se valor_previsto = 0, deleta a linha.
 */
export async function salvarOrcamento(input: {
  mes_referencia: string; // YYYY-MM-DD (dia 1)
  categoria_id: string;
  valor_previsto: number;
  notas?: string | null;
}) {
  const db = await dbServer();
  const uid = await userId();
  if (!uid) return { error: "Não autenticado" };

  // Se zerou, deleta
  if (input.valor_previsto <= 0) {
    const { error } = await db
      .from("orcamentos")
      .delete()
      .eq("mes_referencia", input.mes_referencia)
      .eq("categoria_id", input.categoria_id);
    if (error) return { error: error.message };
    revalidatePath("/orcamento");
    revalidatePath("/dashboard");
    return { ok: true as const };
  }

  // Upsert
  const { error } = await db.from("orcamentos").upsert(
    {
      mes_referencia: input.mes_referencia,
      categoria_id: input.categoria_id,
      valor_previsto: input.valor_previsto,
      notas: input.notas?.trim() || null,
      updated_by: uid,
      created_by: uid,
    },
    { onConflict: "mes_referencia,categoria_id" }
  );
  if (error) return { error: error.message };

  revalidatePath("/orcamento");
  revalidatePath("/dashboard");
  return { ok: true as const };
}

/**
 * Copia todos os orçamentos de um mês pra outro (não sobrescreve existentes).
 */
export async function copiarOrcamentoMes(mes_origem: string, mes_destino: string) {
  const db = await dbServer();
  const uid = await userId();
  if (!uid) return { error: "Não autenticado" };

  const { data, error } = await db.rpc("copiar_orcamento", {
    p_mes_origem: mes_origem,
    p_mes_destino: mes_destino,
    p_user_id: uid,
  });

  if (error) return { error: error.message };
  revalidatePath("/orcamento");
  revalidatePath("/dashboard");
  return { ok: true as const, copiadas: data as number };
}
