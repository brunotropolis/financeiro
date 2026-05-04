import { dbServer } from "@/lib/supabase/db";
import type { ContaBancaria, Entidade } from "@/lib/types/database";
import { ContasClient } from "./contas-client";

export const dynamic = "force-dynamic";

export default async function ContasPage() {
  const db = await dbServer();
  const [contasRes, entidadesRes] = await Promise.all([
    db.from("contas_bancarias").select("*").order("ordem", { ascending: true }).order("nome", { ascending: true }),
    db.from("entidades").select("id,nome,tipo,cor_hex,ativo,ordem").eq("ativo", true).order("ordem"),
  ]);

  const contas = (contasRes.data ?? []) as ContaBancaria[];
  const entidades = (entidadesRes.data ?? []) as Pick<Entidade, "id" | "nome" | "tipo" | "cor_hex" | "ativo" | "ordem">[];

  return <ContasClient contas={contas} entidades={entidades} />;
}
