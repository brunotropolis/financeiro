"use server";

import { dbServer } from "@/lib/supabase/db";
import { revalidatePath } from "next/cache";
import type { OrigemReceita, StatusReceita } from "@/lib/types/database";

export type ReceitaInput = {
  id?: string;
  origem_id: string;       // FK pra origens_receita (preferida)
  origem: OrigemReceita;   // enum slug (compat — derivado do origem_id)
  projeto_id?: string | null;
  produto_nome?: string | null;
  cliente_nome?: string | null;
  valor_bruto: number;
  taxas?: number;
  metodo_pagamento?: string | null;
  parcelas?: number;
  data_venda: string;
  data_prevista_pagamento?: string | null;
  data_recebimento?: string | null;
  status: StatusReceita;
  entidade_id: string;
  notas?: string | null;
};

async function userId() {
  const db = await dbServer();
  const { data } = await db.auth.getUser();
  return data.user?.id as string | undefined;
}

export async function salvarReceita(input: ReceitaInput) {
  const db = await dbServer();
  const uid = await userId();
  if (!uid) return { error: "Não autenticado" };

  const taxas = input.taxas ?? 0;
  const valorLiquido = input.valor_bruto - taxas;

  const payload = {
    origem: input.origem,
    origem_id: input.origem_id,
    projeto_id: input.projeto_id || null,
    produto_nome: input.produto_nome?.trim() || null,
    cliente_nome: input.cliente_nome?.trim() || null,
    valor_bruto: input.valor_bruto,
    taxas,
    valor_liquido: valorLiquido,
    metodo_pagamento: input.metodo_pagamento?.trim() || null,
    parcelas: input.parcelas ?? 1,
    data_venda: input.data_venda,
    data_prevista_pagamento: input.data_prevista_pagamento || null,
    data_recebimento: input.data_recebimento || null,
    status: input.status,
    entidade_id: input.entidade_id,
    notas: input.notas?.trim() || null,
    updated_by: uid,
  };

  if (input.id) {
    const { error } = await db.from("receitas_brutas").update(payload).eq("id", input.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await db.from("receitas_brutas").insert({ ...payload, created_by: uid });
    if (error) return { error: error.message };
  }

  revalidatePath("/receitas");
  return { ok: true as const };
}

export async function deletarReceita(id: string) {
  const db = await dbServer();
  const { error } = await db.from("receitas_brutas").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/receitas");
  return { ok: true as const };
}

export async function marcarReceitaRecebida(id: string, data: string) {
  const db = await dbServer();
  const uid = await userId();
  if (!uid) return { error: "Não autenticado" };
  const { error } = await db
    .from("receitas_brutas")
    .update({ status: "recebido", data_recebimento: data, updated_by: uid })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/receitas");
  return { ok: true as const };
}
