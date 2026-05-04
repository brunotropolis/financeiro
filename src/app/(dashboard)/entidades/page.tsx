import { dbServer } from "@/lib/supabase/db";
import { EntidadesClient } from "./entidades-client";
import type { Entidade } from "@/lib/types/database";

export const dynamic = "force-dynamic";

export default async function EntidadesPage() {
  const db = await dbServer();
  const { data } = await db
    .from("entidades")
    .select("*")
    .order("ordem", { ascending: true })
    .order("nome", { ascending: true });

  const entidades = (data ?? []) as Entidade[];
  return <EntidadesClient entidades={entidades} />;
}
