import { dbServer } from "@/lib/supabase/db";
import type { CartaoCredito, Categoria, ContaBancaria, Entidade, Fornecedor, Transacao } from "@/lib/types/database";
import { TransacoesClient } from "./transacoes-client";

export const dynamic = "force-dynamic";

export default async function TransacoesPage() {
  const db = await dbServer();

  // Últimos 90 dias por padrão
  const limite = new Date();
  limite.setDate(limite.getDate() - 90);
  const limiteISO = limite.toISOString().slice(0, 10);

  const [txRes, entRes, catRes, fornRes, cartRes, contaRes] = await Promise.all([
    db.from("transacoes")
      .select("*")
      .gte("data_competencia", limiteISO)
      .order("data_competencia", { ascending: false })
      .order("criado_em", { ascending: false })
      .limit(500),
    db.from("entidades").select("id,nome,tipo,cor_hex,ativo,ordem").eq("ativo", true).order("ordem"),
    db.from("categorias").select("id,nome,tipo,cor_hex,ativo").eq("ativo", true).order("nome"),
    db.from("fornecedores").select("id,nome,ativo,categoria_padrao_id,entidade_padrao_id").eq("ativo", true).order("nome"),
    db.from("cartoes_credito").select("id,nome,entidade_id,ativo").eq("ativo", true).order("nome"),
    db.from("contas_bancarias").select("id,nome,banco,entidade_id,ativo").eq("ativo", true).order("nome"),
  ]);

  return (
    <TransacoesClient
      transacoes={(txRes.data ?? []) as Transacao[]}
      entidades={(entRes.data ?? []) as Pick<Entidade, "id" | "nome" | "tipo" | "cor_hex" | "ativo" | "ordem">[]}
      categorias={(catRes.data ?? []) as Pick<Categoria, "id" | "nome" | "tipo" | "cor_hex" | "ativo">[]}
      fornecedores={(fornRes.data ?? []) as Pick<Fornecedor, "id" | "nome" | "ativo" | "categoria_padrao_id" | "entidade_padrao_id">[]}
      cartoes={(cartRes.data ?? []) as Pick<CartaoCredito, "id" | "nome" | "entidade_id" | "ativo">[]}
      contas={(contaRes.data ?? []) as Pick<ContaBancaria, "id" | "nome" | "banco" | "entidade_id" | "ativo">[]}
    />
  );
}
