import { dbServer } from "@/lib/supabase/db";
import type { CartaoCredito, Transacao } from "@/lib/types/database";
import { FaturasClient } from "./faturas-client";

export const dynamic = "force-dynamic";

export default async function FaturasPage() {
  const db = await dbServer();

  const [cartRes, txRes] = await Promise.all([
    db.from("cartoes_credito").select("*").eq("ativo", true).order("nome"),
    // Pega transações dos últimos 6 meses + futuras (parcelas)
    db.from("transacoes")
      .select("*")
      .not("cartao_id", "is", null)
      .order("data_competencia", { ascending: false })
      .limit(2000),
  ]);

  return (
    <FaturasClient
      cartoes={(cartRes.data ?? []) as CartaoCredito[]}
      transacoes={(txRes.data ?? []) as Transacao[]}
    />
  );
}
