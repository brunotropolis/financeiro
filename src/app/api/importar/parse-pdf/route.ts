import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const PROMPT = `Você está analisando um extrato bancário brasileiro (PDF). Extraia TODAS as transações em JSON estruturado.

Regras:
1. Datas em formato YYYY-MM-DD (ano 2026 se omitido).
2. Valores SEMPRE positivos. Use "tipo": "saida" pra débito/saída, "entrada" pra crédito.
3. IGNORAR linhas que sejam:
   - Saldo do dia / Saldo Anterior / SALDO / Saldo final (linhas informativas, não transações)
   - "PAGTO CARTAO + Estorno mesmo dia mesmo valor" (par que se cancela — marca ambos como "ignorar":true)
4. Pra cada transação extraia:
   - data: YYYY-MM-DD
   - descricao: descrição original limpa
   - fornecedor: nome do estabelecimento/pessoa principal (sem CNPJ, prefixos PG*/HTM*/FACEBK*/PIX/etc)
   - valor: número positivo
   - tipo: "entrada" | "saida" | "transferencia"
   - categoria_sugerida: uma das categorias abaixo
   - eh_transferencia_interna: true se descrição mencionar "MANUAL DO RECEM-NASCIDO", "MANUAL RECEM NASCIDO", "DREAM BABY", "MRN SERVICOS", "BRUNO SAMPAIO", "DAYANE", "DAY ANJOS"
   - eh_estorno_par: true se for parte de par estorno (BB)
   - origem_externa: se for "GREENN" (PIX recebido), "AMAZON SERVICOS DE V" (TED Amazon), "PAYPAL", "ORPAG ORIGEM EXTERIOR" — colocar nome aqui

Categorias válidas:
- "Anúncio" (Facebook, Google Ads)
- "Ferramentas" (SaaS: Anthropic, ManyChat, Apple, Google Workspace, Hostinger, Lovable, Cademi, ManyChat, VTurb, GPTMaker, Unnichat, Panda Video, Turbo Cloud)
- "Mercado" (mercados, supermercados, alimentação)
- "Transporte" (Uber, 99)
- "Lazer" (restaurantes, iFood, refeição)
- "Saúde" (farmácia, clínica, podologia)
- "Aluguel/Infra" (aluguel, copel, sanepar, telefônica, internet)
- "Educação" (escola, faculdade, curso)
- "Pessoais" (gastos pessoais Bruno/Day)
- "Tributos" (IOF, impostos)
- "Despesa bancária" (tarifas, juros, IOF banco)
- "Despesa Financeira" (empréstimo, parcela, financiamento)
- "Salários" (funcionários, prestadores recorrentes)
- "Receita — Vendas" (Greenn vendas)
- "Receita — Afiliados" (Amazon, Shopee, ML, PayPal)
- "Receita — Outros" (default receita)
- "Outros" (default despesa)

Responda APENAS com JSON válido, no formato:
{
  "banco": "Conta Simples - Cartões | Conta Simples - Corrente | Banco do Brasil | Unicred",
  "conta_identificada": {
    "agencia": "...",
    "numero": "...",
    "titular": "..."
  },
  "saldo_anterior": 0.00,
  "saldo_final": 0.00,
  "transacoes": [
    {
      "data": "2026-04-22",
      "descricao": "...",
      "fornecedor": "...",
      "valor": 100.00,
      "tipo": "saida",
      "categoria_sugerida": "Ferramentas",
      "eh_transferencia_interna": false,
      "eh_estorno_par": false,
      "origem_externa": null
    }
  ]
}`;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: userResp } = await supabase.auth.getUser();
    if (!userResp.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "Arquivo ausente" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString("base64");

    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 8000,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: base64,
              },
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

    // Extrai JSON da resposta (Claude às vezes prefixa com markdown)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "Não consegui extrair JSON da resposta", raw: text }, { status: 500 });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ ok: true, ...parsed });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
