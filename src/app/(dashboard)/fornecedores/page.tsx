import { dbServer } from "@/lib/supabase/db";
import type { Categoria, Entidade, Fornecedor } from "@/lib/types/database";
import { FornecedoresClient } from "./fornecedores-client";

export const dynamic = "force-dynamic";

export default async function FornecedoresPage() {
  const db = await dbServer();
  const [fornRes, catRes, entRes] = await Promise.all([
    db.from("fornecedores").select("*").order("nome"),
    db.from("categorias").select("id,nome,tipo,cor_hex,ativo").eq("ativo", true).order("nome"),
    db.from("entidades").select("id,nome,tipo,cor_hex,ativo,ordem").eq("ativo", true).order("ordem"),
  ]);

  const fornecedores = (fornRes.data ?? []) as Fornecedor[];
  const categorias = (catRes.data ?? []) as Pick<Categoria, "id" | "nome" | "tipo" | "cor_hex" | "ativo">[];
  const entidades = (entRes.data ?? []) as Pick<Entidade, "id" | "nome" | "tipo" | "cor_hex" | "ativo" | "ordem">[];

  return <FornecedoresClient fornecedores={fornecedores} categorias={categorias} entidades={entidades} />;
}
