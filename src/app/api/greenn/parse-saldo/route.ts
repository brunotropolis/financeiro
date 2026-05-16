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

    // Salva no banco
    const { error: insertErr } = await supabase.from("greenn_saldos").insert({
      disponivel,
      pendente,
      antecipavel,
      created_by: userResp.user.id,
    });

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
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
