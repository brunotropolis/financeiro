import { dbServer } from "@/lib/supabase/db";
import type { Categoria } from "@/lib/types/database";
import { CategoriasClient } from "./categorias-client";

export const dynamic = "force-dynamic";

export default async function CategoriasPage() {
  const db = await dbServer();
  const { data } = await db
    .from("categorias")
    .select("*")
    .order("tipo")
    .order("ordem", { ascending: true })
    .order("nome");

  const categorias = (data ?? []) as Categoria[];
  return <CategoriasClient categorias={categorias} />;
}
