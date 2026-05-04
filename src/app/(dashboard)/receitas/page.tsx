import { dbServer } from "@/lib/supabase/db";
import type { Entidade, ReceitaBruta } from "@/lib/types/database";
import { ReceitasClient } from "./receitas-client";

export const dynamic = "force-dynamic";

export default async function ReceitasPage() {
  const db = await dbServer();

  // Últimos 90 dias por padrão
  const limite = new Date();
  limite.setDate(limite.getDate() - 90);
  const limiteISO = limite.toISOString().slice(0, 10);

  const [recRes, entRes] = await Promise.all([
    db.from("receitas_brutas")
      .select("*")
      .gte("data_venda", limiteISO)
      .order("data_venda", { ascending: false })
      .limit(500),
    db.from("entidades").select("id,nome,tipo,cor_hex,ativo,ordem").eq("ativo", true).order("ordem"),
  ]);

  return (
    <ReceitasClient
      receitas={(recRes.data ?? []) as ReceitaBruta[]}
      entidades={(entRes.data ?? []) as Pick<Entidade, "id" | "nome" | "tipo" | "cor_hex" | "ativo" | "ordem">[]}
    />
  );
}
