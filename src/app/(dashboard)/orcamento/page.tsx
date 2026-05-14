import { dbServer } from "@/lib/supabase/db";
import { OrcamentoClient, type OrcamentoLinha } from "./orcamento-client";

export const dynamic = "force-dynamic";

function mesParam(searchParam: string | string[] | undefined): string {
  // Aceita ?mes=2026-05 ou usa mês corrente
  const now = new Date();
  const padrao = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  if (!searchParam || Array.isArray(searchParam)) return padrao;
  // Formatos aceitos: YYYY-MM ou YYYY-MM-DD
  if (/^\d{4}-\d{2}$/.test(searchParam)) return `${searchParam}-01`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(searchParam)) return searchParam.slice(0, 8) + "01";
  return padrao;
}

export default async function OrcamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const params = await searchParams;
  const mesAtual = mesParam(params.mes);

  const db = await dbServer();

  // Busca orçamento realizado do mês atual
  const { data: linhas } = await db
    .from("v_orcamento_realizado")
    .select("*")
    .eq("mes_referencia", mesAtual);

  // Calcula mês anterior pra opção de copiar
  const d = new Date(mesAtual + "T00:00:00");
  d.setMonth(d.getMonth() - 1);
  const mesAnterior = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;

  // Verifica se tem orçamento no mês anterior (pra mostrar botão copiar)
  const { count: temOrcMesAnt } = await db
    .from("orcamentos")
    .select("*", { count: "exact", head: true })
    .eq("mes_referencia", mesAnterior);

  return (
    <OrcamentoClient
      linhas={(linhas ?? []) as OrcamentoLinha[]}
      mesAtual={mesAtual}
      mesAnterior={mesAnterior}
      temOrcamentoMesAnterior={(temOrcMesAnt ?? 0) > 0}
    />
  );
}
