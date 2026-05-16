import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const PROMPT = `Você está analisando um print do painel admin da Greenn (plataforma de vendas).
Procure pela seção "Minha carteira" / "Extrato" / "Carteira" que mostra 3 valores em BRL:

1. **Saldo disponível** — valor liberado pra saque imediato (ex: "R$ 37,44")
2. **Saldo pendente** — valor provisionado/em aberto (vendas que ainda vão liberar) (ex: "R$ 8.475,45")
3. **Antecipável** ou **Antecipação** — valor que pode ser antecipado mediante taxa (ex: "R$ 3.989,45")

Regras:
- Valores SEMPRE em BRL positivos
- Use ponto decimal (37.44 e não 37,44)
- Se algum valor não estiver visível na imagem, retorne 0 nele
- Ignore "Total de transações" — não é nenhum dos três

Responda APENAS com JSON válido neste formato exato:
{
  "disponivel": 37.44,
  "pendente": 8475.45,
  "antecipavel": 3989.45
}`;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: userResp } = await supabase.auth.getUser();
    if (!userResp.user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const body = (await req.json()) as { image?: string; media_type?: string };
    if (!body.image) {
      return NextResponse.json({ error: "Imagem ausente" }, { status: 400 });
    }

    const mediaType = (body.media_type || "image/png") as "image/png" | "image/jpeg" | "image/webp" | "image/gif";

    // Strip data URL prefix se presente
    const base64 = body.image.replace(/^data:image\/\w+;base64,/, "");

    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: base64 },
            },
            { type: "text", text: PROMPT },
          ],
        },
      ],
    });

    const text = response.content
      .filter((c): c is Anthropic.TextBlock => c.type === "text")
      .map((c) => c.text)
      .join("");

    // Extrai JSON da resposta (pode vir com markdown)
    const cleaned = text.replace(/^[\s\S]*?(\{[\s\S]*\})[\s\S]*$/, "$1");
    let parsed: { disponivel: number; pendente: number; antecipavel: number };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json(
        { error: "IA não retornou JSON válido", raw: text.slice(0, 300) },
        { status: 500 },
      );
    }

    const disponivel = Number(parsed.disponivel) || 0;
    const pendente = Number(parsed.pendente) || 0;
    const antecipavel = Number(parsed.antecipavel) || 0;

    if (disponivel === 0 && pendente === 0 && antecipavel === 0) {
      return NextResponse.json(
        { error: "Não consegui identificar os valores na imagem. Tem certeza que é o print da carteira Greenn?" },
        { status: 400 },
      );
    }

    // Salva snapshot histórico
    const { error: insertErr } = await supabase.from("greenn_saldos").insert({
      disponivel,
      pendente,
      antecipavel,
      created_by: userResp.user.id,
    } as never);

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    // Cria/atualiza receita "guarda-chuva" Greenn em aberto (a receber)
    // pendente = total a receber (antecipável é um SUBSET do pendente — fração que
    // pode ser antecipada mediante taxa, então NÃO soma). Disponível já pode ser sacado.
    const valorAReceber = pendente;
    const hoje = new Date().toISOString().slice(0, 10);

    // Acha entidade Dream Baby (recebe Greenn) — fallback: primeira entidade ativa
    const { data: entDream } = await supabase
      .from("entidades")
      .select("id")
      .eq("nome", "Dream Baby")
      .eq("ativo", true)
      .maybeSingle();

    let entId: string | null = (entDream as { id?: string } | null)?.id ?? null;
    if (!entId) {
      const { data: entFirst } = await supabase
        .from("entidades")
        .select("id")
        .eq("ativo", true)
        .order("ordem")
        .limit(1)
        .maybeSingle();
      entId = (entFirst as { id?: string } | null)?.id ?? null;
    }

    if (entId) {
      // Procura "guarda-chuva" existente (não recebida ainda) via transaction_id_externo fixo
      const TX_ID = "GREENN_SALDO_ABERTO";
      const { data: existing } = await supabase
        .from("receitas_brutas")
        .select("id")
        .eq("origem", "greenn")
        .eq("transaction_id_externo", TX_ID)
        .maybeSingle();

      const notas = `Atualizado via print Greenn. Pendente (a receber) R$ ${pendente.toFixed(2)}, dos quais R$ ${antecipavel.toFixed(2)} são antecipáveis. Disponível pra saque imediato: R$ ${disponivel.toFixed(2)}.`;

      if (existing) {
        await supabase
          .from("receitas_brutas")
          .update({
            valor_bruto: valorAReceber,
            valor_liquido: valorAReceber,
            notas,
            status: valorAReceber > 0 ? "previsto" : "recebido",
            updated_by: userResp.user.id,
          } as never)
          .eq("id", (existing as { id: string } | null)?.id ?? "");
      } else if (valorAReceber > 0) {
        await supabase.from("receitas_brutas").insert({
          origem: "greenn",
          transaction_id_externo: TX_ID,
          produto_nome: "Saldo Greenn em aberto",
          valor_bruto: valorAReceber,
          taxas: 0,
          valor_liquido: valorAReceber,
          metodo_pagamento: "PIX",
          parcelas: 1,
          data_venda: hoje,
          status: "previsto",
          entidade_id: entId,
          notas,
          created_by: userResp.user.id,
        } as never);
      }
    }

    return NextResponse.json({
      ok: true,
      disponivel,
      pendente,
      antecipavel,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
