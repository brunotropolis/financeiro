import { dbServer } from "@/lib/supabase/db";
import type { CartaoCredito, Categoria, ContaBancaria } from "@/lib/types/database";
import { ImportarClient } from "./importar-client";

export const dynamic = "force-dynamic";

export default async function ImportarPage() {
  const db = await dbServer();
  const [contasRes, cartoesRes, catRes] = await Promise.all([
    db.from("contas_bancarias").select("id,nome,banco,entidade_id,ativo").eq("ativo", true).order("nome"),
    db.from("cartoes_credito").select("id,nome,entidade_id,ativo").eq("ativo", true).order("nome"),
    db.from("categorias").select("id,nome,tipo,cor_hex,ativo").eq("ativo", true).order("nome"),
  ]);

  return (
    <ImportarClient
      contas={(contasRes.data ?? []) as Pick<ContaBancaria, "id" | "nome" | "banco" | "entidade_id" | "ativo">[]}
      cartoes={(cartoesRes.data ?? []) as Pick<CartaoCredito, "id" | "nome" | "entidade_id" | "ativo">[]}
      categorias={(catRes.data ?? []) as Pick<Categoria, "id" | "nome" | "tipo" | "cor_hex" | "ativo">[]}
    />
  );
}
