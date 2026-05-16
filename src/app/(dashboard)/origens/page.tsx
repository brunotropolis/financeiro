import { dbServer } from "@/lib/supabase/db";
import type { OrigemReceitaRow } from "@/lib/types/database";
import { OrigensClient } from "./origens-client";

export const dynamic = "force-dynamic";

export default async function OrigensPage() {
  const db = await dbServer();
  const { data } = await db
    .from("origens_receita")
    .select("*")
    .order("ativo", { ascending: false })
    .order("ordem")
    .order("nome");

  return <OrigensClient origens={(data ?? []) as OrigemReceitaRow[]} />;
}
