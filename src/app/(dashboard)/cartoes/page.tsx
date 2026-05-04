import { dbServer } from "@/lib/supabase/db";
import type { CartaoCredito, ContaBancaria, Entidade } from "@/lib/types/database";
import { CartoesClient } from "./cartoes-client";

export const dynamic = "force-dynamic";

export default async function CartoesPage() {
  const db = await dbServer();
  const [cartoesRes, entidadesRes, contasRes] = await Promise.all([
    db.from("cartoes_credito").select("*").order("ordem", { ascending: true }).order("nome"),
    db.from("entidades").select("id,nome,tipo,cor_hex,ativo,ordem").eq("ativo", true).order("ordem"),
    db.from("contas_bancarias").select("id,nome,banco,entidade_id,ativo").eq("ativo", true).order("nome"),
  ]);

  const cartoes = (cartoesRes.data ?? []) as CartaoCredito[];
  const entidades = (entidadesRes.data ?? []) as Pick<Entidade, "id" | "nome" | "tipo" | "cor_hex" | "ativo" | "ordem">[];
  const contas = (contasRes.data ?? []) as Pick<ContaBancaria, "id" | "nome" | "banco" | "entidade_id" | "ativo">[];

  return <CartoesClient cartoes={cartoes} entidades={entidades} contas={contas} />;
}
