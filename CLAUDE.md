# Financeiro — Painel de Controle Financeiro

Painel web pra gestão financeira pessoal (PF) + 3 PJs do Bruno. Substitui planilha + WhatsApp por sistema unificado com cartões, recorrências mensais, projeção de fluxo de caixa, sincronização Greenn/Meta e (futuramente) bot WhatsApp pra lançamento via foto de comprovante.

## URLs
- **Produção (final):** https://financeiro.brunotropolis.com.br *(aguardando propagação NS — ~30min-2h após troca no registro.br)*
- **Backup (provisório):** https://financeiro.buscadorgeek.com.br *(remover após brunotropolis.com.br ativar)*
- **Repo:** https://github.com/brunotropolis/financeiro (público — necessário pro EasyPanel free clonar sem auth)
- **Pasta local:** `D:\CLAUDE\financeiro\`
- **Hub Bruno:** https://projetos.brunotropolis.com.br (tem card linkando pra cá)

## Stack
- **Framework:** Next.js 15 (App Router, TypeScript, Tailwind, output: "standalone")
- **DB + Auth:** Supabase (PostgreSQL 15 + Auth + RLS) — projeto `zageqyuwodvyxwohpugb` (us-east-1)
- **UI:** shadcn/ui + Radix UI + lucide-react (clonado do Ofertas Beta)
- **IA (futuro):** Anthropic SDK (`claude-haiku-4-5`) pra parse de comprovantes
- **WhatsApp (futuro):** Evolution API (instância dedicada `financeiro-bot`)
- **Orquestração:** n8n (webhooks Greenn/Meta)
- **Deploy:** EasyPanel `ofertas-beta/financeiro` (Dockerfile multi-stage)
- **DNS:** Cloudflare zone `brunotropolis.com.br` (zone id `b383f26694af11b33f7fbce94d66e136`)

## Credenciais e IDs

### Supabase
- **Project ID:** `zageqyuwodvyxwohpugb`
- **URL:** `https://zageqyuwodvyxwohpugb.supabase.co`
- **Region:** us-east-1 (free tier nano)
- **API keys:** salvas em `.env.local` (gitignored)
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- **2 admins criados:**
  - `contato@brunotropolis.com.br` (id `a394c482-da14-4807-a94e-c67417681dd7`) — senha provisória entregue no chat (TROCAR)
  - `day.dos.anjos.ramos@gmail.com` (id `8109dbff-2604-4bd6-ad83-412632158409`) — senha provisória entregue no chat (TROCAR)

### EasyPanel
- **URL:** `http://187.77.49.160:3000`
- **Projeto:** `ofertas-beta` (free tier limita a 3 projetos; financeiro é serviço dentro do ofertas-beta)
- **Serviço:** `financeiro`
- **Token API:** `cmolp18wl000007mg79nx2qzd` (state.token no localStorage)
- **Endpoints úteis:** `services.app.inspectService`, `updateSourceGit`, `updateBuild`, `updateEnv`, `deployService`, `domains.createDomain` (UI mais confiável que API), `domains.updateDomain`

### Cloudflare
- **Account ID:** `197d2452ceacfeaea5e901bf2e9d7f25` (`brunotropolis`)
- **Zone brunotropolis.com.br:** `b383f26694af11b33f7fbce94d66e136`
- **Zone buscadorgeek.com.br:** `31247cb2bbaff3d0ea941de435012d3a`
- **Cache token (read-only):** salvo localmente (não commitado — gitignore). Não tem permissão DNS edit.
- **DNS edits:** via dashboard logado (browser MCP) ou criar API token Zone DNS Edit

### GitHub
- **Owner:** `brunotropolis`
- **Repo:** `financeiro` (público temporariamente)
- **Token:** Git Credential Manager Windows (use `echo "url=https://github.com" | git credential fill`)

### Registro.br
- **Conta:** `BRSAM3 - Bruno Sampaio` (dono de brunotropolis.com.br + buscadorgeek.com.br + outros 8 .br)
- **brunotropolis.com.br:**
  - NS atuais: `meg.ns.cloudflare.com`, `patrick.ns.cloudflare.com` (delegado em 30/04/2026)
  - NS antigos (substituídos): `b.sec.dns.br`, `c.sec.dns.br`
  - Expiração: 03/02/2028

## Estrutura do projeto

```
financeiro/
├── supabase/
│   ├── schema.sql        # 13 tabelas + RLS + triggers + 3 views (586 linhas)
│   └── seed.sql          # 5 entidades + 10 contas + 1 cartão + 22 categorias
├── scripts/
│   ├── schema_clean.sql  # versão sem dividers UTF-8 (pra paste no SQL editor)
│   ├── seed_clean.sql
│   └── promote_admins.sql # SQL pra promover usuários do Auth a admin
├── src/
│   ├── app/
│   │   ├── (dashboard)/
│   │   │   ├── dashboard/      # cards de saldo/receitas/despesas/faturas (placeholder)
│   │   │   ├── transacoes/     # placeholder Sprint 2
│   │   │   ├── receitas/       # placeholder Sprint 2
│   │   │   ├── recorrencias/   # placeholder Sprint 1 forms
│   │   │   ├── faturas/        # placeholder Sprint 2
│   │   │   ├── entidades/      # placeholder Sprint 1 forms
│   │   │   ├── contas/         # placeholder Sprint 1 forms
│   │   │   ├── cartoes/        # placeholder Sprint 1 forms
│   │   │   ├── categorias/     # placeholder Sprint 1 forms
│   │   │   ├── fornecedores/   # placeholder Sprint 1 forms
│   │   │   ├── configuracoes/  # placeholder Sprint 6
│   │   │   ├── _placeholder.tsx # componente compartilhado de tela em construção
│   │   │   └── layout.tsx
│   │   ├── login/page.tsx     # branding "💰 Financeiro" + redirect /dashboard
│   │   ├── layout.tsx
│   │   └── page.tsx           # redirect / → /dashboard
│   ├── components/layout/
│   │   ├── sidebar.tsx        # 2 seções: Operação + Cadastros
│   │   └── header.tsx
│   ├── lib/
│   │   ├── supabase/{client,server}.ts
│   │   ├── types/database.ts  # placeholder — gerar com `supabase gen types`
│   │   └── utils.ts
│   └── middleware.ts
├── Dockerfile             # multi-stage Next.js standalone
├── README.md              # instruções de setup público
└── CLAUDE.md              # este arquivo
```

## Schema do banco (13 tabelas)

| Tabela | Função |
|---|---|
| `profiles` | Usuários (id = auth.users.id), role admin/operator/viewer, telefone WhatsApp |
| `entidades` | PFs e PJs (Bruno, Day, Manual RN, Dream Baby, MRN Serviços) |
| `contas_bancarias` | 10 contas iniciais (Unicred, Inter, C6, Conta Simples prepaga, etc) |
| `cartoes_credito` | 1 cartão inicial (Unicred MRN — fecha dia 3, vence dia 10) |
| `categorias` | 22 categorias (Pessoais, Ferramentas, Anúncio, Jurídico, +receitas) |
| `fornecedores` | Aprendido automaticamente pelo bot WhatsApp (Sprint 4); aliases JSON |
| `recorrencias` | Templates mensais — `valor_padrao` é snapshot; alterações futuras não mexem histórico |
| `faturas_cartao` | Agrupamento mensal por cartão (mes_referencia, status aberta/fechada/paga) |
| `transacoes` | Centro do sistema. Despesas + receitas pontuais. Suporta parcelado, vínculo a fatura/recorrência |
| `receitas_brutas` | Faturamento (Greenn, afiliados, publis). `valor_bruto`, `taxas`, `valor_liquido`, status pendente→disponível→recebido. Linka pra `movimentacoes_bancarias` quando cai |
| `movimentacoes_bancarias` | Caixa real. Trigger atualiza `contas_bancarias.saldo_atual` automaticamente |
| `saldos_snapshot` | Histórico diário pra gráfico de fluxo de caixa |
| `audit_log` | Trigger automático em todas as tabelas mutáveis (insert/update/delete + payload antes/depois) |

**Views úteis:**
- `v_saldo_entidades` — saldo total por PF/PJ
- `v_gastos_mes_categoria` — despesas do mês corrente agrupadas por categoria
- `v_faturas_abertas` — faturas em aberto/fechadas com dias pra vencer

**RLS:** todas as tabelas com policies via funções helper (`is_admin()`, `can_write()`, `is_active_user()`).

## Decisões de arquitetura

### Receitas em 2 camadas (Greenn ≠ caixa)
Greenn mostra `Saldo disponível R$ 3.534 / pendente R$ 5.818 / antecipação R$ 1.722` — faturamento ≠ dinheiro em conta. Por isso:
- `receitas_brutas` = faturamento bruto (uma linha por venda)
- `movimentacoes_bancarias` = entrada efetiva quando o $ cai
- Cada `receita_bruta.movimentacao_id` linka quando dinheiro entra
- Dashboard mostra **Faturamento do mês** ≠ **Recebido em caixa** ≠ **A receber**

### Recorrências com snapshot por mês
- `recorrencias.valor_padrao` é template
- Job mensal materializa em `transacoes_previstas` copiando o valor (snapshot)
- Editar mês de junho? Só junho muda. Maio/abril ficam intocados.
- Aumentou aluguel? Edita `valor_padrao` → próximos meses pegam novo valor; passados preservados.

### Cartões: dia_fechamento + dia_vencimento + conta_pagamento
- Compras parceladas geram N transações filhas (`transacao_pai_id`)
- Cada transação cai numa fatura (`fatura_id`) calculada pelo dia_fechamento
- Quando paga fatura, é uma transação tipo "pagamento" com `conta_id = conta_pagamento_id` do cartão

### Conta Simples como conta, não cartão
Bruno tem só 1 cartão (Unicred MRN). Conta Simples é pré-paga (deposita e debita) — modelada como `contas_bancarias.tipo = 'prepaga'` mesmo, não `cartoes_credito`.

### Multi-fonte de receitas
- **Greenn** ✅ (webhook genérico `META | Webhook Greenn` `gWFz6MCkY4p2mizi` recebe TODAS as vendas + reembolsos — Sprint 2 só duplica destino pra Supabase)
- **Meta tráfego** ✅ (coletor já existe `vrV6PalbJQFM0VKw` — Sprint 2 sincroniza gasto Meta como despesa categoria "Anúncio")
- **Amazon Afiliados** ⚠️ (Sprint 5 — Associates Reporting API ou scraping)
- **Shopee/ML Afiliados** ⚠️ (Sprint 5 — relatórios mensais)
- **Publis/AdSense/palestras** = manual (tela "Receitas avulsas" Sprint 2)

### Conciliação bancária (Sprint 3)
Open Finance é homologação trabalhosa. Caminhos práticos:
1. CSV/OFX export do banco + import no painel
2. Print do extrato via WhatsApp + Claude vision (Sprint 4)
3. PIX recebido captura via OCR de print

## Bugs e workarounds da sessão de criação

### 1. `clip` do Git Bash quebra UTF-8
- Comando `cat seed.sql | clip` corrompeu acentos: "Manual do Recém-Nascido" virou "Manual do Rec*m-Nascido"
- **Fix:** usar PowerShell `Set-Clipboard -Value (Get-Content -Raw -Encoding UTF8 'arquivo.sql')`

### 2. EasyPanel free limita a 3 projetos
- Não permite criar projeto novo "financeiro" (já tinha n8n, evolution, ofertas-beta)
- **Workaround:** criar serviço dentro de projeto existente. Escolhi `ofertas-beta/financeiro` (não polui semanticamente porque ofertas-beta também é admin)

### 3. EasyPanel `updateSourceGithub` precisa GitHub App autorizado pro repo
- Erro "Cannot find public repository and your Github token is missing"
- **Workaround:** usar `updateSourceGit` (URL pública do repo) em vez de `updateSourceGithub`. Repo precisa ser público pra clone anônimo.

### 4. EasyPanel `domains.createDomain` schema confuso
- API pede `id` (que parece auto-gerado) — payloads diretos via curl falharam
- **Workaround:** criar via UI. UpdateDomain via API funciona com `composeService: ""` (não null).

### 5. Cloudflare zone "initializing" não responde queries
- Recém-criada via API, NS retornam REFUSED até selecionar plano
- **Fix:** clicar "Select plan" → Free → "I updated my nameservers" no dashboard

### 6. Registro.br "Pesquisa recusada" antes de delegação efetiva
- Galinha-ovo: registro.br testa NS antes de delegar; CF só responde depois de delegado
- **Fix:** ativar plano Free na Cloudflare PRIMEIRO (faz CF responder mesmo sem delegação), depois salvar no registro.br ignorando warning vermelho

### 7. brunotropolis.com.br não estava no Cloudflare
- Apenas registrado no registro.br (NS `b/c.sec.dns.br`)
- Tinha CNAME `projetos` → GitHub Pages e MX Google que não podiam quebrar
- **Fix:** pré-popular zona Cloudflare com TODOS os records (root A, CNAME projetos, MX Google) antes da troca de NS, pra preservar serviços existentes

### 8. Login redirecionava pra /campanhas (rota antiga ofertas-beta)
- Template clonado tinha `router.push("/campanhas")` no `login/page.tsx`
- **Fix:** trocar pra `/dashboard` + branding "💰 Financeiro / Controle de fluxo"

## Como aplicar SQL no Supabase

Via browser MCP (mais rápido que API):
1. PowerShell copia arquivo: `Set-Clipboard -Value (Get-Content -Raw -Encoding UTF8 'scripts/schema_clean.sql')`
2. Browser navega: `https://supabase.com/dashboard/project/zageqyuwodvyxwohpugb/sql/new`
3. Click no Monaco editor → `ctrl+a Delete` → `ctrl+v` → `ctrl+Return`
4. Aguarda "Success. No rows returned" ou tabela com resultado

## Sprints

| Sprint | Status | Entrega |
|---|---|---|
| **0 — Setup** | ✅ | Repo, Supabase, schema, seed, scaffolding Next.js, deploy EasyPanel, DNS Cloudflare, login funcional, audit log |
| **1 — Cadastros** | ⏳ | Forms reais de Entidades, Contas, Cartões, Categorias, Fornecedores, Recorrências (com snapshot mensal). Server Actions + RLS funcionando |
| **2 — Operação** | ⬜ | Transações, Receitas (manual + integração Greenn), Faturas, Dashboard com gráficos, projeção 6 meses |
| **3 — Importação** | ⬜ | CSV/OFX de extratos bancários, conciliação automática movimentações ↔ transações |
| **4 — Bot WhatsApp** | ⬜ | Grupo privado Bruno + Day + bot. Foto de comprovante → Claude vision → JSON estruturado → match por fornecedor → confirmação. Aprendizado de fornecedor automatizado |
| **5 — Afiliados** | ⬜ | Sincronização mensal Amazon/Shopee/ML afiliados (faturamento em aberto) |
| **6 — Sync Meta + Usuários** | ⬜ | Gasto de tráfego Meta automático (categoria Anúncio), tela de gestão de usuários |

## Workflows n8n relevantes

- **`gWFz6MCkY4p2mizi` — META | Webhook Greenn** — recebe TODAS as vendas/reembolsos da Greenn → salva em planilha Meta. **Sprint 2 vai duplicar destino:** salva ALSO em `receitas_brutas` do Supabase financeiro.
- **`vrV6PalbJQFM0VKw` — Meta Campaign Collector** — coleta gastos Meta diariamente em planilha. **Sprint 2 vai espelhar:** copia gasto diário pra `transacoes` do Supabase (despesa, cartão Conta Simples, categoria Anúncio).

## Comandos úteis

```bash
# Aplicar schema/seed via clipboard PowerShell
powershell.exe -Command "Set-Clipboard -Value (Get-Content -Raw -Encoding UTF8 'D:/CLAUDE/financeiro/scripts/schema_clean.sql')"

# Gerar tipos TypeScript do Supabase
npx supabase gen types typescript --project-id zageqyuwodvyxwohpugb > src/lib/types/database.ts

# Push pro GitHub (token via Credential Manager)
git push origin main

# Inspecionar serviço EasyPanel
curl -s "http://187.77.49.160:3000/api/trpc/services.app.inspectService?input=$(python -c "import urllib.parse,json; print(urllib.parse.quote(json.dumps({'json':{'projectName':'ofertas-beta','serviceName':'financeiro'}})))")" \
  -H "Authorization: Bearer cmolp18wl000007mg79nx2qzd" | python -m json.tool

# Trigger redeploy EasyPanel
curl -X POST "http://187.77.49.160:3000/api/trpc/services.app.deployService" \
  -H "Authorization: Bearer cmolp18wl000007mg79nx2qzd" -H "Content-Type: application/json" \
  -d '{"json":{"projectName":"ofertas-beta","serviceName":"financeiro"}}'

# Test DNS direto pelo NS Cloudflare
nslookup financeiro.brunotropolis.com.br meg.ns.cloudflare.com
```

## Pendências da próxima sessão

1. **Confirmar propagação NS** — testar `nslookup financeiro.brunotropolis.com.br 1.1.1.1` retornar IP CF
2. **Confirmar SSL Let's Encrypt** ativou — `curl -I https://financeiro.brunotropolis.com.br/` retornar 200/302 sem erro de cert
3. **Remover domínio `financeiro.buscadorgeek.com.br`** do EasyPanel (cleanup)
4. **Tornar repo privado novamente?** — só funciona se autorizar EasyPanel GitHub App pro `brunotropolis/financeiro`. Por ora deixar público sem segredos.
5. **Sprint 1 forms** — implementar CRUDs de cadastros usando Server Actions + Supabase RLS
6. **Trocar senhas provisórias** — Bruno e Day devem trocar via Authentication → Users no Supabase

---

**Sessão de criação:** 30/abr/2026 — schema + seed + base + deploy + DNS + delegação NS + hub atualizado em 1 turno autônomo após Bruno autorizar "vai na fé".
