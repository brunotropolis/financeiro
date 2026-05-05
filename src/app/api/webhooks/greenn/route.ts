import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

/**
 * Webhook genérico Greenn. Configure no n8n pra fazer POST aqui adicionando ao destino atual.
 *
 * Recebe vendas (purchase.approved), reembolsos, payouts.
 * Grava em receitas_brutas com origem='greenn'.
 *
 * Auth: header `x-webhook-secret` deve match com env `GREENN_WEBHOOK_SECRET`.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.GREENN_WEBHOOK_SECRET;
  const recv = req.headers.get("x-webhook-secret");
  if (!secret || secret !== recv) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  // Cliente service-role pra bypass RLS (webhook não tem auth de usuário)
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const parsed = parseGreennPayload(body);
  if (!parsed) return NextResponse.json({ ok: true, ignored: true });

  // Determina entidade — Greenn aceita só uma entidade primária. Usa Manual RN por default.
  const { data: ent } = await sb
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from("entidades")
    .select("id")
    .eq("nome", "Manual do Recém-Nascido")
    .single() as unknown as { data: { id: string } | null };
  if (!ent) return NextResponse.json({ error: "Entidade Manual RN não encontrada" }, { status: 500 });

  // Upsert em receitas_brutas (idempotente pelo unique origem+transaction_id_externo)
  const payload = {
    origem: "greenn",
    transaction_id_externo: parsed.transactionId,
    entidade_id: ent.id,
    produto_nome: parsed.produtoNome,
    produto_id_externo: parsed.produtoId,
    cliente_nome: parsed.clienteNome,
    cliente_email: parsed.clienteEmail,
    cliente_telefone: parsed.clienteTelefone,
    valor_bruto: parsed.valorBruto,
    taxas: parsed.taxas,
    valor_liquido: parsed.valorLiquido,
    metodo_pagamento: parsed.metodoPagamento,
    parcelas: parsed.parcelas,
    data_venda: parsed.dataVenda,
    data_prevista_pagamento: parsed.dataPrevistaPagamento,
    data_recebimento: parsed.tipo === "REEMBOLSO" ? null : (parsed.status === "recebido" ? parsed.dataVenda : null),
    status: parsed.status,
    utm_source: parsed.utmSource,
    utm_medium: parsed.utmMedium,
    utm_campaign: parsed.utmCampaign,
    utm_content: parsed.utmContent,
    utm_term: parsed.utmTerm,
    cupom: parsed.cupom,
    bruto_webhook: body as object,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb.from("receitas_brutas") as any).upsert(payload, {
    onConflict: "origem,transaction_id_externo",
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, transactionId: parsed.transactionId, status: parsed.status });
}

type Parsed = {
  tipo: "VENDA" | "REEMBOLSO" | "IGNORAR";
  transactionId: string;
  produtoNome: string;
  produtoId: string;
  clienteNome: string;
  clienteEmail: string;
  clienteTelefone: string;
  valorBruto: number;
  taxas: number;
  valorLiquido: number;
  metodoPagamento: string;
  parcelas: number;
  dataVenda: string;
  dataPrevistaPagamento: string;
  status: "pendente" | "disponivel" | "recebido" | "reembolsado";
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  utmTerm: string;
  cupom: string;
};

function parseGreennPayload(body: unknown): Parsed | null {
  // Casting permissivo (body do Greenn varia)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b = body as any;
  const evento = b?.event ?? b?.type ?? "";
  const status = b?.currentStatus ?? b?.sale?.status ?? b?.status ?? "";

  let tipo: Parsed["tipo"] = "IGNORAR";
  if (evento.includes("approved") || (evento === "saleUpdated" && status === "paid")) tipo = "VENDA";
  else if (status === "refunded" || status === "chargedback" || evento.includes("refund")) tipo = "REEMBOLSO";
  else if (evento === "saleUpdated" && (status === "paid" || status === "waiting_payment")) tipo = "VENDA";

  if (tipo === "IGNORAR") return null;

  const customer = b.customer ?? b.buyer ?? b.client ?? {};
  let telefone = String(customer.phone ?? customer.cellphone ?? customer.mobile ?? "").replace(/\D/g, "");
  if (telefone.length === 10 || telefone.length === 11) telefone = "55" + telefone;

  const product = b.product ?? b.offer ?? {};
  const sale = b.sale ?? {};

  const valor = parseFloat(sale.amount ?? sale.total ?? b.amount ?? b.price ?? product.price ?? 0);
  const taxa = parseFloat(sale.platform_fee ?? b.platform_fee ?? 0);

  // UTMs
  const saleMetas: Array<{ key?: string; name?: string; meta_key?: string; value?: string; meta_value?: string }> =
    sale.saleMetas ?? b.saleMetas ?? [];
  const findUtm = (k: string) => {
    const m = saleMetas.find((x) => (x.key ?? x.name ?? x.meta_key ?? "").toLowerCase() === k);
    return m?.value ?? m?.meta_value ?? "";
  };

  const dataVenda = (sale.created_at ?? b.created_at ?? new Date().toISOString()).slice(0, 10);
  const dataPrev = new Date(dataVenda + "T00:00:00");
  dataPrev.setDate(dataPrev.getDate() + 30);

  const statusFinal: Parsed["status"] =
    tipo === "REEMBOLSO" ? "reembolsado" :
    status === "paid" ? "disponivel" : "pendente";

  return {
    tipo,
    transactionId: String(sale.id ?? b.transaction_id ?? b.id ?? ""),
    produtoNome: product.name ?? product.title ?? sale.product_name ?? "",
    produtoId: String(product.id ?? product.offer_id ?? sale.product_id ?? ""),
    clienteNome: customer.name ?? customer.full_name ?? "",
    clienteEmail: customer.email ?? "",
    clienteTelefone: telefone,
    valorBruto: valor,
    taxas: taxa,
    valorLiquido: valor - taxa,
    metodoPagamento: sale.payment_method ?? b.payment_method ?? "",
    parcelas: parseInt(String(sale.installments ?? b.installments ?? 1)),
    dataVenda,
    dataPrevistaPagamento: dataPrev.toISOString().slice(0, 10),
    status: statusFinal,
    utmSource: findUtm("utm_source") || findUtm("src") || b.utm_source || b.src || "",
    utmMedium: findUtm("utm_medium") || b.utm_medium || "",
    utmCampaign: findUtm("utm_campaign") || b.utm_campaign || "",
    utmContent: findUtm("utm_content") || b.utm_content || "",
    utmTerm: findUtm("utm_term") || b.utm_term || "",
    cupom: (sale.coupon ?? b.coupon ?? {}).code ?? "",
  };
}
