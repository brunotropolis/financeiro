/**
 * Helper que retorna o cliente Supabase tipado como `any` pra simplificar
 * acesso enquanto os tipos do Database não são gerados via `supabase gen types`.
 *
 * Usar SOMENTE em Server Actions e Route Handlers.
 *
 * Exemplo:
 *   const db = await dbServer();
 *   const { data, error } = await db.from("entidades").select("*").order("ordem");
 */
import { createClient } from "./server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = any;

export async function dbServer(): Promise<AnyDb> {
  return (await createClient()) as AnyDb;
}
