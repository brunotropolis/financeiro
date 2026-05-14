import { dbServer } from "@/lib/supabase/db";
import type { CartaoCredito, Categoria, ContaBancaria, Entidade, Fornecedor, Recorrencia } from "@/lib/types/database";
import { RecorrenciasClient, type BucketRealizado } from "./recorrencias-client";

export const dynamic = "force-dynamic";

export default async function RecorrenciasPage() {
  const db = await dbServer();
  const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

  const [recRes, entRes, catRes, fornRes, cartRes, contaRes, bktRes] = await Promise.all([
    db.from("recorrencias").select("*").order("ativo", { ascending: false }).order("dia_vencimento"),
    db.from("entidades").select("id,nome,tipo,cor_hex,ativo,ordem").eq("ativo", true).order("ordem"),
    db.from("categorias").select("id,nome,tipo,cor_hex,ativo").eq("ativo", true).order("nome"),
    db.from("fornecedores").select("id,nome,ativo").eq("ativo", true).order("nome"),
    db.from("cartoes_credito").select("id,nome,entidade_id,ativo").eq("ativo", true).order("nome"),
    db.from("contas_bancarias").select("id,nome,banco,entidade_id,ativo").eq("ativo", true).order("nome"),
    db.from("v_buckets_realizados")
      .select("recorrencia_id,gasto_real,qtd_transacoes,pct_usado,status")
      .eq("mes_referencia", inicioMes),
  ]);

  return (
    <RecorrenciasClient
      recorrencias={(recRes.data ?? []) as Recorrencia[]}
      entidades={(entRes.data ?? []) as Pick<Entidade, "id" | "nome" | "tipo" | "cor_hex" | "ativo" | "ordem">[]}
      categorias={(catRes.data ?? []) as Pick<Categoria, "id" | "nome" | "tipo" | "cor_hex" | "ativo">[]}
      fornecedores={(fornRes.data ?? []) as Pick<Fornecedor, "id" | "nome" | "ativo">[]}
      cartoes={(cartRes.data ?? []) as Pick<CartaoCredito, "id" | "nome" | "entidade_id" | "ativo">[]}
      contas={(contaRes.data ?? []) as Pick<ContaBancaria, "id" | "nome" | "banco" | "entidade_id" | "ativo">[]}
      buckets={(bktRes.data ?? []) as BucketRealizado[]}
    />
  );
}
