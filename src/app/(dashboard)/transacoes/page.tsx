import { dbServer } from "@/lib/supabase/db";
import type { CartaoCredito, Categoria, ContaBancaria, Entidade, Fornecedor, ProjetoRow, Transacao } from "@/lib/types/database";
import { TransacoesClient } from "./transacoes-client";

export const dynamic = "force-dynamic";

type Periodo = "atual" | "proximos" | "personalizado" | "todos";

function getRange(p: Periodo, inicio?: string, fim?: string): { gte?: string; lte?: string } {
  const now = new Date();
  const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const fimMes = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

  if (p === "todos") return {};
  if (p === "proximos") {
    return { gte: new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().slice(0, 10) };
  }
  if (p === "personalizado" && inicio && fim) {
    return { gte: inicio, lte: fim };
  }
  // atual (default)
  return { gte: inicioMes, lte: fimMes };
}

export default async function TransacoesPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string; inicio?: string; fim?: string }>;
}) {
  const params = await searchParams;
  const periodo: Periodo =
    params.p === "proximos" ? "proximos" :
    params.p === "personalizado" ? "personalizado" :
    params.p === "todos" ? "todos" :
    "atual";
  const range = getRange(periodo, params.inicio, params.fim);

  const db = await dbServer();
  let query = db.from("transacoes")
    .select("*")
    .order("data_competencia", { ascending: false })
    .order("criado_em", { ascending: false })
    .limit(periodo === "todos" ? 2000 : 500);
  if (range.gte) query = query.gte("data_competencia", range.gte);
  if (range.lte) query = query.lte("data_competencia", range.lte);

  const [txRes, entRes, catRes, fornRes, cartRes, contaRes, projRes] = await Promise.all([
    query,
    db.from("entidades").select("id,nome,tipo,cor_hex,ativo,ordem").eq("ativo", true).order("ordem"),
    db.from("categorias").select("id,nome,tipo,cor_hex,ativo").eq("ativo", true).order("nome"),
    db.from("fornecedores").select("id,nome,ativo,categoria_padrao_id,entidade_padrao_id").eq("ativo", true).order("nome"),
    db.from("cartoes_credito").select("id,nome,entidade_id,ativo").eq("ativo", true).order("nome"),
    db.from("contas_bancarias").select("id,nome,banco,entidade_id,ativo").eq("ativo", true).order("nome"),
    db.from("projetos").select("*").eq("ativo", true).order("ordem").order("nome"),
  ]);

  return (
    <TransacoesClient
      transacoes={(txRes.data ?? []) as Transacao[]}
      entidades={(entRes.data ?? []) as Pick<Entidade, "id" | "nome" | "tipo" | "cor_hex" | "ativo" | "ordem">[]}
      categorias={(catRes.data ?? []) as Pick<Categoria, "id" | "nome" | "tipo" | "cor_hex" | "ativo">[]}
      fornecedores={(fornRes.data ?? []) as Pick<Fornecedor, "id" | "nome" | "ativo" | "categoria_padrao_id" | "entidade_padrao_id">[]}
      cartoes={(cartRes.data ?? []) as Pick<CartaoCredito, "id" | "nome" | "entidade_id" | "ativo">[]}
      contas={(contaRes.data ?? []) as Pick<ContaBancaria, "id" | "nome" | "banco" | "entidade_id" | "ativo">[]}
      projetos={(projRes.data ?? []) as ProjetoRow[]}
      periodo={periodo}
    />
  );
}
