import { dbServer } from "@/lib/supabase/db";
import type { Entidade } from "@/lib/types/database";
import { ProjecaoClient } from "./projecao-client";

export const dynamic = "force-dynamic";

export type ProjecaoItem = {
  id: string;
  tipo: "despesa" | "receita";
  descricao: string;
  valor: number;
  data: string;
  status: string;
  entidade_id: string | null;
  categoria_id: string | null;
  cartao_id: string | null;
  conta_id: string | null;
  recorrencia_id: string | null;
  origem_receita: string | null;
};

export default async function ProjecaoPage() {
  const db = await dbServer();
  const [projRes, entRes] = await Promise.all([
    db.from("v_projecao").select("*").order("data"),
    db.from("entidades").select("id,nome,tipo,cor_hex,ativo,ordem").eq("ativo", true).order("ordem"),
  ]);

  const items = (projRes.data ?? []) as ProjecaoItem[];
  const entidades = (entRes.data ?? []) as Pick<Entidade, "id" | "nome" | "tipo" | "cor_hex" | "ativo" | "ordem">[];

  return <ProjecaoClient items={items} entidades={entidades} />;
}
