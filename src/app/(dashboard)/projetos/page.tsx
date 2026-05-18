import { dbServer } from "@/lib/supabase/db";
import type { ProjetoRow } from "@/lib/types/database";
import { ProjetosClient } from "./projetos-client";

export const dynamic = "force-dynamic";

export default async function ProjetosPage() {
  const db = await dbServer();
  const { data } = await db
    .from("projetos")
    .select("*")
    .order("ativo", { ascending: false })
    .order("ordem")
    .order("nome");

  return <ProjetosClient projetos={(data ?? []) as ProjetoRow[]} />;
}
