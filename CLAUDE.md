# Financeiro — Painel de Controle Financeiro

Painel web pra gestão financeira pessoal (PF) + 3 PJs do Bruno. Substitui planilha + WhatsApp por sistema unificado com cartões, recorrências mensais, projeção de fluxo de caixa, sincronização Greenn/Meta e (futuramente) bot WhatsApp pra lançamento via foto de comprovante.

## URLs
- **Produção:** https://financeiro.brunotropolis.com.br ✅ ONLINE (SSL Let's Encrypt via Cloudflare)
- **Backup:** https://financeiro.buscadorgeek.com.br ✅ ainda ativo (remover quando validar tudo)
- **Repo:** https://github.com/brunotropolis/financeiro (público temporariamente — EasyPanel free clona sem auth)
- **Pasta local:** `D:\CLAUDE\financeiro\`
- **Hub Bruno:** https://projetos.brunotropolis.com.br (tem card linkando pra cá)

## Login
- **URL:** https://financeiro.brunotropolis.com.br/login
- **Admins:** `contato@brunotropolis.com.br` e `day.dos.anjos.ramos@gmail.com`
- **Senha provisória:** `Musha003` (trocar via Authentication → Users no Supabase)

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
| **0 — Setup** | ✅ | Repo, Supabase, schema, seed, scaffolding Next.js, deploy EasyPanel, DNS Cloudflare (brunotropolis.com.br migrado), login funcional, audit log, flow "esqueci senha" |
| **1 — Cadastros** | ✅ | Forms reais de Entidades, Contas, Cartões, Categorias, Fornecedores + base UI shadcn-like (button, dialog, input, select, switch, color-picker) |
| **2 — Operação** | ✅ | Transações (com parcelamento automático), Receitas (form simplificado: valor+imposto+3 status+2 datas), Recorrências, Faturas (agrupadas por mês de fechamento do cartão), Dashboard com dados reais |
| **3 — Projeção + Importação** | ✅ | Recorrências semanais/quinzenais + dia_semana + pode_pular; Tela `/projecao` 6 meses; Tela `/importar` (PDF → Claude Haiku 4.5 → JSON → match automático ±R$2/3d); API webhook Greenn; Detecção de atrasos no dashboard |
| **3.5 — Orçamento + Meta Ads card** | ✅ | Tela `/orcamento` (meta mensal por categoria com barra de progresso + cores semáforo), card no `/dashboard` com top 6 orçamentos críticos, card "Meta Ads — mês atual" puxando do Dashboard API n8n (gasto + faturamento líquido + ROAS Real) |
| **3.6 — Refator amplo (mai/26)** | ✅ | Dashboard com filtro 1m/3m/6m; recorrências `tipo_valor` (fixo/variável/bucket) substitui orçamento; receitas com filtro período + critério Competência/Caixa + campo Competência explícito; Saldo Greenn linha fixa da tabela; origens viram tabela CRUD; máscara monetária BR; transações/recorrências agrupadas por categoria colapsável |
| **4 — Bot WhatsApp** | ⬜ | Grupo privado Bruno + Day + bot. Notificações de atraso. Foto de comprovante → Claude vision → JSON → match por fornecedor → confirmação. Aprendizado automatizado. **Aguardando:** número WhatsApp dedicado |
| **5 — Afiliados** | ⬜ | Sincronização mensal Amazon/Shopee/ML afiliados (faturamento em aberto) |
| **6 — Sync Meta + Usuários** | ⬜ | Gasto de tráfego Meta automático na tabela `transacoes` (categoria Anúncio), tela de gestão de usuários |
| **7 — Materialização retroativa** | ⬜ | Função SQL pra gerar transações previstas dos últimos 90 dias (pra casar com extratos passados na importação) |

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

## Estado atual em produção (com data desta atualização)

**URL produção:** https://financeiro.brunotropolis.com.br ✅ Online com SSL Let's Encrypt
**Senha dos admins:** `Musha003` (Bruno e Day — trocar via Authentication → Users)
**Último commit em prod:** `5dcdd99` (form receitas simplificado + migration 002)

### Telas funcionais
| Rota | Status | Função |
|---|---|---|
| `/login` `/esqueci-senha` `/redefinir-senha` | ✅ | Auth flow completo |
| `/dashboard` | ✅ | Filtro de período (1m/3m/6m) + cards (Saldo atual · Receita · Despesas pago×previsto · Resultado) + card Meta Ads informativo + card Buckets do mês (top 6 críticos). Receita = só `status=recebido` (já em caixa); nota mostra "a receber" |
| `/receitas` | ✅ | Stats Faturamento/Recebido/A receber + linha fixa Saldo Greenn no topo da tabela + Filtros: critério **Competência/Caixa** + período (Mês atual/Próximos/Personalizado/Todos). Tabela com colunas Competência, Faturamento, Recebido, A receber, Quando cai. Form com campo Competência (month) + máscara monetária BR |
| `/transacoes` | ✅ | CRUD com parcelamento. Filtros: período (Mês atual/Próximos/Personalizado/Todos) e tipo/entidade. Toggle **Categoria \| Lista**: agrupa por categoria com headers colapsáveis + totais por grupo |
| `/recorrencias` | ✅ | 3 tipos: **Fixo** (valor exato), **Variável** (estimado, ajusta ao pagar), **Bucket** (teto mensal agregando categoria). Toggle Categoria \| Lista pra agrupar. Semanal/quinzenal/mensal + dia_semana + pode_pular |
| `/origens` | ✅ | CRUD de origens de receita (Magalu, Amazon, Shopee, ML, Hotmart, etc). Slug gerado do nome. Bruno adiciona via UI sem precisar de migration |
| `/faturas` | ✅ | Agrupa transações de cartão por mês de fatura |
| `/importar` | ✅ | Upload PDF → Claude Haiku → revisão → match automático |
| `/projecao` | 🔒 | Escondido do menu (será reformulado) |
| `/orcamento` | 🔒 | Escondido do menu (substituído pelos buckets em /recorrencias) |
| `/entidades` `/contas` `/cartoes` `/categorias` `/fornecedores` | ✅ | CRUDs |

### Migrations aplicadas
1. `001_recorrencias_semanais.sql` — frequência semanal/quinzenal, funções materializar, view v_projecao, detectar_atrasos
2. `002_fix_recursao_trigger.sql` — fix recursão infinita no trigger (stack depth limit exceeded)
3. `003_orcamentos.sql` — tabela `orcamentos` (mes_referencia + categoria_id + valor_previsto), view `v_orcamento_realizado` (cruza orçado × gasto real, status semáforo), função `copiar_orcamento(mes_origem, mes_destino, user)`
4. `004_recorrencias_tipo_valor.sql` — enum `tipo_valor_recorrencia` (fixo/variavel/bucket) + view `v_buckets_realizados` que agrega tx por categoria_id dos buckets ativos. `materializar_recorrencia` ignora buckets (não criam previstas). RPC `limpar_previstas_recorrencia(rec_id)`
5. `005_greenn_saldos.sql` — tabela `greenn_saldos` (snapshot histórico do print: disponivel/pendente/antecipavel/capturado_em) + view `v_greenn_saldo_atual` (último snapshot)
6. `006_add_magalu_origem.sql` — adiciona `magalu_aff` ao enum origem_receita (legacy, agora a tabela `origens_receita` é a fonte de verdade)
7. `007_origens_receita_tabela.sql` — tabela `origens_receita` (slug/nome/cor/ordem/ativo) populada com valores do enum + Magalu + Bruno adiciona novos pela UI. Coluna `receitas_brutas.origem_id` FK com backfill pelo slug. Trigger updated_at + policies RLS

### Política permanente
- **SEMPRE disparar deploy manual no EasyPanel após push** — auto-deploy não confiável
- Tokens EasyPanel/Cloudflare têm TTL curto, refazer via browser quando expira
- Nunca commitar secrets (.env.local gitignored, CLAUDE.md sem chaves cruas — GitHub secret scanning push protection ativo)

## Pendências próximas sessões

### Curto prazo
1. **[Bruno cadastrar]** As ~15 recorrências mapeadas no `docs/analise-extratos-2026-04.md` (aluguel, copel, sanepar, etc) com `data_inicio = 2026-04-01`
2. **Materialização retroativa** — alterar função `materializar_recorrencia` pra também gerar previstas dos últimos 90 dias (necessário pra match no /importar com extratos passados)
3. **Importar extratos abr/mai 2026** — validar fluxo end-to-end com dados reais

### Médio prazo
4. **Conectar webhook Greenn** — adicionar nó HTTP no workflow n8n `gWFz6MCkY4p2mizi` pra POST em `/api/webhooks/greenn` (header `x-webhook-secret`)
5. **Bot WhatsApp** — Bruno fornecer número dedicado pra criar grupo Bruno+Day+bot
6. **Cleanup buscadorgeek** — remover domínio `financeiro.buscadorgeek.com.br` do EasyPanel após validar tudo

## Bugs corrigidos nesta jornada

| # | Bug | Fix |
|---|---|---|
| 1 | `clip` do Git Bash quebra UTF-8 nos acentos | Usar `Set-Clipboard -Value (Get-Content -Raw -Encoding UTF8 ...)` via PowerShell |
| 2 | EasyPanel free limita a 3 projetos | Criar serviço financeiro dentro do projeto `ofertas-beta` existente |
| 3 | EasyPanel `updateSourceGithub` requer GitHub App autorizado | Usar `updateSourceGit` com URL pública (`https://github.com/brunotropolis/financeiro.git`) + repo público |
| 4 | EasyPanel `domains.createDomain` schema confuso | Criar via UI; updateDomain via API com `composeService: ""` (não null) |
| 5 | Cloudflare zone "initializing" não responde queries | Selecionar plano Free pelo dashboard antes da delegação |
| 6 | Registro.br "Pesquisa recusada" galinha-ovo | Ativar plano CF primeiro, salvar no registro.br ignorando warning |
| 7 | brunotropolis.com.br perdeu projetos/CNAME ao migrar | Pré-popular zona Cloudflare com TODOS os records antes da troca NS |
| 8 | Login redirecionava pra /campanhas (ofertas-beta) | Trocar pra `/dashboard` + branding "💰 Financeiro" |
| 9 | GitHub secret scanning bloqueou push (Cloudflare token no CLAUDE.md) | `git commit --amend` removendo o secret antes do push |
| 10 | git credential fill travava (sem GUI prompt) | Usar PAT (`ghp_*`) via `git remote set-url origin https://x-access-token:<token>@github.com/...` |
| 11 | EasyPanel auto-deploy não acionou | Trigger manual via UI ou API após cada push — adotado como política |
| 12 | Middleware crash em cookie inválido (`Cannot create property 'user' on string 'invalid'`) | Wrap `auth.getUser()` em try/catch + limpa cookies `sb-*` corrompidos |
| 13 | Página redirecionava pra `/login` em rotas públicas (`/esqueci-senha`, `/redefinir-senha`) | Adicionar à lista `PUBLIC_AUTH_PAGES` no middleware |
| 14 | Cloudflare 421 Misdirected Request no buscadorgeek.com.br root | Page Rule de redirect 301 → app.buscadorgeek.com.br |
| 15 | projetos.buscadorgeek.com.br e projetos.brunotropolis.com.br caíram após migração NS | Forçar re-check DNS no GitHub Pages settings → cert SSL re-emitido |
| 16 | `/importar` retornava "Expected ',' or ']' in JSON at position 20726" | max_tokens de 8000 → 16000 + parser resiliente que reconstrói até último `}` válido |
| 17 | "stack depth limit exceeded" ao salvar recorrência | Migration 002 — função do trigger detecta mudanças materiais antes de re-materializar; removido UPDATE de `ultima_geracao_em` que disparava trigger em loop |
| 18 | Categoria "Anuidade cartão" ficou null ao criar recorrências de ferramentas | Bruno editou manualmente via /recorrencias após cadastro inicial |
| 19 | Google Workspace cadastrado em duplicidade (R$ 114,32 e R$ 194,18) | Mesma conta — preço varia mensalmente conforme usuários/cupons. Deletado o duplicado, único renomeado pra "Google Workspace" com `pode_pular=true` (notas: "valor pode variar") |
| 20 | Dashboard 500 — `R.toFixed is not a function` no `/dashboard` | Endpoint n8n Meta Ads retorna números como string (`"15.99"`). Adicionado helper `num()` em `src/lib/meta-ads.ts` que coerce string→number com fallback 0 |
| 21 | Card Meta Ads zerado (gasto R$0 mas ROAS 2.59x) | Estrutura do JSON Meta API: `resumo` só tem hoje/ontem. Total do mês fica nas arrays `campanhas[].spend` e `vendas.hoje[]` (que apesar do nome contém TODAS as transações do período com `tipo: VENDA / REEMBOLSO`). Refatorado o helper pra agregar: `gasto_total = sum(campanhas.spend)`, `faturamento_bruto = sum(vendas.VENDA.valor)`, `reembolsos = sum(vendas.REEMBOLSO.valor)`, `líquido = bruto - reembolsos`, `ROAS Real = líquido / gasto` |

## Análise dos extratos reais (abr/mai 2026)

Documentação completa em `docs/analise-extratos-2026-04.md`. Resumo:
- **6 PDFs analisados:** Conta Simples Cartões + Corrente, BB Manual RN (Mai + Abr), Unicred Manual RN + Dream Baby
- **Fluxo do dinheiro:** Greenn → Dream Baby → Manual RN → Conta Simples Corrente → Cartões CS
- **15 recorrências sugeridas** + 1 semanal (Maria diarista R$ 249 com pode_pular ON)
- **Padrões de categorização** automática mapeados (Facebook→Anúncio, Uber→Transporte, etc)
- **Transferências internas dominam volume** — sistema flagra automaticamente (entidades Manual RN, Dream Baby, MRN Serviços, Bruno, Dayane)

### Fatura Unicred Visa Signature Business (mai/2026)

Bruno enviou fatura com vencimento 11/mai/2026 (R$ 4.380,47, fechamento dia 6). Cartão Unicred do Manual RN — dia_fechamento=6, dia_vencimento=11.

**13 recorrências cadastradas** no cartão Unicred via `scripts/seed_unicred_fatura.sql`:
- Anuidade cartão (R$ 21,50/mês — dia 2)
- Apple iCloud (Unicred) (R$ 66,90/mês — dia 18)
- Contabilidade (R$ 1.860 até 20/07/2026, depois R$ 900 a partir de 20/08)
- Mercadolivre*MercadoLi (R$ 69,99/mês parcelado)
- Spotify (R$ 40,90/mês — dia 5)
- YouTube Premium (R$ 53,90/mês — dia 12)
- Claude.ai Subscription (USD ~109/mês — dia 10, conversão dinâmica)
- Contabo (USD 17,25/mês — dia 6)
- WhapiCloud Funnelly (USD 17,98/mês — dia 19)
- Adobe (R$ 104/mês — dia 14)
- Apple.com/Bill (R$ 66,90/mês — dia 18)
- Google One (R$ 49,99 plano principal + R$ 9,99 plano secundário)
- Uber One Membership (R$ 19,90/mês — dia 21)

**Detecção de duplicatas (`scripts/verify_recorrencias.sql`):**
- ✅ Google Workspace duplicado → deletado (era a mesma conta com preço variável)
- ⚠️ Falsos positivos detectados: Unicred Anuidade × Apple iCloud (Unicred), Google Workspace × Google One (match só na 1ª palavra)
- ⚠️ 3 contas Apple iCloud — verificar se são IDs diferentes ou se "Apple iCloud (Unicred)" duplica uma das outras

### Alimentação + Mercado abr/2026 (validado com Bruno)

**Total mês: R$ 4.816,07** (cartão Visa Signature + PIX Unicred MRN + PIX Unicred Dream Baby — BB e Conta Simples não tiveram gastos da categoria)

| Categoria | Total | Top estabelecimentos |
|---|---|---|
| 🛒 Mercado | R$ 3.756,23 | CONDOR SUPER CENTER (R$ 2.420), MERCADO BELLA VILLA (R$ 305), CIA BEAL ALIMENTOS (R$ 597), COMERCIO DE FRIOS STRAPASSON, J BATTISTI, IRMAOS MUFFATO, PAULIN COMERCIO DE FRIOS, FPEP, MAURECI FLASMO (pescados) |
| 🍴 Alimentação | R$ 755,21 | PASCAL RESTAURANTE, IFOODCOM, TORO RESTAURANTES, PANIFICADORA PANICIELLO, SUB BRIGADEIRO, HELIO FERREIRA (massas), PAIVA MASSAS, GISLEI SAVIO |
| ⚠️ PIX p/ PF (alimentação confirmada) | R$ 304,63 | GEBON JARDIM SCHAFFER, LUCAS OLIVEIRA KOLLER, Erison Vieira Oshiro, ENDREW DA LUZ DALPRA, Celso Dubiella, PAULO ANTONIO BIERNASKI |

## Módulo de Orçamento (Sprint 3.5 — mai/2026)

Bruno solicitou: "lançar média mensal por categoria (ex: R$ 5k alimentação) e ir baixando conforme gasta".

### Arquitetura
- **Tabela `orcamentos`** — uma linha por (mes_referencia, categoria_id). Sem entidade — orçamento global por categoria. Transações pagas de qualquer entidade (PF/PJs) baixam do mesmo orçamento.
- **View `v_orcamento_realizado`** — cartesian de (últimos 6 meses + próximos 6) × (categorias de despesa ativas), left join com orcamentos e gastos. Retorna `status: ok | atencao | estourou | sem_orcamento | sem_dados`.
- **Função `copiar_orcamento(origem, destino, user)`** — usa upsert `on conflict do nothing` pra não sobrescrever destino.

### Decisões de design
- **Orçamento por Bruno PF** (entidade única, independente de qual CNPJ paga) — quando gasta no cartão Unicred do Manual RN, ainda baixa do orçamento PF de Alimentação. Implementado como orçamento global por categoria.
- **Recorrências semanais automáticas** (Maria diarista) — `materializar_recorrencia` já soma 7 dias no loop até `data_fim` (6 meses), gerando 4 ou 5 ocorrências/mês conforme o calendário. Sem mudança necessária.
- **Valor manual, não média móvel** — Bruno define o teto manualmente. Botão "copiar do mês anterior" facilita rotina.
- **Mix de visualização** — tabela completa em `/orcamento` + card top 6 críticos no `/dashboard` (ordenado por % usado desc).

### Status cores
- **ok** (verde) — gasto real < 70% do orçado
- **atencao** (amarelo) — 70-100%
- **estourou** (vermelho) — > 100%
- **sem_orcamento** (cinza) — categoria sem meta mas com gasto
- **sem_dados** (cinza escuro) — categoria sem meta nem gasto

## Card Meta Ads no Dashboard (Sprint 3.5)

Reaproveita o **Dashboard API existente** do projeto Meta Ads (`https://n8n-n8n.xktssy.easypanel.host/webhook/meta-dashboard-api?periodo=mes`). Zero duplicação de coleta — o Collector externo já roda a cada hora 8h-22h e atualiza a planilha Meta.

### Implementação (`src/lib/meta-ads.ts`)
- Server Component faz `fetch(...)` no SSR com `next: { revalidate: 3600 }` (cache 1h)
- Faz coerce `string→number` em todos os campos (API retorna alguns como string)
- Agrega `gasto_total = sum(campanhas[].spend)` e separa vendas por `tipo`: VENDA × REEMBOLSO
- Retorna: `gasto_total`, `faturamento_bruto`, `reembolsos`, `faturamento_liquido`, `roas_real`, `cpc_medio`, `ctr_medio`, `num_vendas`, `num_campanhas`, etc.

### Card exibe
- 💸 **Investido** (gasto total + impressões + nº campanhas)
- 💰 **Faturamento líquido** (bruto − reembolsos, com badge de reembolso em vermelho se > 0)
- 📈 **ROAS Real** (verde ≥2x, amarelo 1-2x, vermelho <1x) + lucro líquido (faturamento − gasto)
- 🖱️ **CPC médio** + cliques + CTR

Link "Ver dashboard ↗" abre o dashboard Meta Ads completo (https://brunotropolis.github.io/meta-ads-dashboard/).

## Integrações bancárias automáticas — análise (mai/2026)

Bruno perguntou se dá pra automatizar puxar de Unicred/Conta Simples.

| Opção | Custo | Viabilidade |
|---|---|---|
| **Pluggy** (Open Finance + scraping unificado) | ❌ R$ 2.500/mês (plano básico) | Inviável pra uso interno |
| **Belvo** | Similar | Idem |
| **Open Finance direto BCB** | Grátis | Burocrático — requer cadastro como receptor de dados regulado |
| **Email parser via Gmail** | Grátis | ⚠️ Unicred NÃO manda email — só push no celular (descartado) |
| **Push do Android → webhook** | Grátis | Possível mas frágil (depende de hábito + iPhone limitado) |
| **`/importar` PDF semanal** | Grátis | ✅ Já funcionando — solução atual |
| **`/importar` XLSX** | 30min dev | Conta Simples Cartões exporta Excel — TODO |
| **Bot WhatsApp Sprint 4** | Sprint planejado | Foto de comprovante → Claude Vision → JSON → match |

**Decisão:** "vamos subindo na mão mesmo" + verificar futuro do Open Finance BCB. Mantém `/importar` + foca em Sprint 4 (bot WhatsApp).

## Scripts SQL/seed criados

| Script | Função |
|---|---|
| `scripts/seed_ferramentas_recorrencias.sql` | 8 recorrências de SaaS no cartão Conta Simples (ManyChat, Unnichat, Hostinger, Lovable, Cademi, Panda Video, VTurb, GPTMaker) |
| `scripts/seed_fornecedores_ferramentas.sql` | 13 fornecedores com aliases JSON + linka às recorrências existentes |
| `scripts/seed_unicred_fatura.sql` | 13 recorrências do cartão Unicred Visa Signature + 10 fornecedores novos + ajuste dia_fechamento/vencimento do cartão (6/11) |
| `scripts/verify_recorrencias.sql` | Delete Google Workspace duplicado + rename do principal + queries de detecção de duplicatas (por dia+fornecedor, por similaridade de nome) |
| `supabase/migrations/003_orcamentos.sql` | Migration do módulo de orçamento (tabela + view + função copiar) |

---

**Sessão de criação:** 30/abr/2026 — schema + seed + base + deploy + DNS + delegação NS + hub atualizado em 1 turno autônomo após Bruno autorizar "vai na fé".

**Sessão mai/2026 (Sprint 3.5):** seed_ferramentas + seed_unicred_fatura + módulo orçamento + card Meta Ads no dashboard + análise alimentação abr/2026 (R$ 4.816,07) + investigação Pluggy/Open Finance (inviável por enquanto).

---

## Sessão mai/2026 (Sprint 3.6 — Refator amplo)

Refator profundo do modelo conceitual e UX inteiro de receitas/transações/dashboard. Cronologia + decisões:

### 1. Dashboard — filtro + double-count fix

**Filtro 1m/3m/6m** via URL `?p=` (`/dashboard?p=3m`). Server Component lê `searchParams` e calcula `inicio/fim` apropriados; Meta API só é chamada com `periodo=mes` (1m) ou `personalizado` (3m/6m). Componente cliente `periodo-filter.tsx` faz routing.

**Cards reformulados:**
- Saldo atual (sempre presente) · Receita (período) · Despesas (pago vs previsto) · Resultado
- Card "Buckets do mês" substitui o card Orçamento

**Fix de double-count Meta:**
- Receita do mês = **só** `status=recebido` (em caixa) + transações tipo=receita
- "A receber" = pendentes + saldo Greenn (`pendente + disponivel`)
- Card Meta Ads vira informativo (não soma na receita) — antes contava + faturamento Greenn = dobrava
- Despesas: + `meta.gasto_total` automático (puxado da API; transações `descricao LIKE 'Meta Ads%'` são excluídas pra não duplicar)

### 2. Recorrências — `tipo_valor` substitui Orçamento

Migration 004 introduz 3 tipos de recorrência:

| Tipo | Comportamento | Uso |
|---|---|---|
| **Fixo** | Materializa 1 prevista por ciclo com `valor_padrao` exato | Aluguel, Spotify, ferramentas SaaS |
| **Variável** | Materializa prevista com `valor_padrao` (médio); ao pagar, valor real substitui no histórico do mês. `valor_padrao` da recorrência fica intocado (template) | Luz, água, contas variáveis |
| **Bucket** | NÃO materializa. Agrega todas as transações da mesma `categoria_id` do mês via view `v_buckets_realizados`. `valor_padrao` vira o **teto mensal** | Alimentação (R$ 5k), Uber/Transporte, Mercado |

**View `v_buckets_realizados`** faz `SUM(transacoes.valor)` por `categoria_id` × mês, com filtro `recorrencia_id IS NULL` (exclui tx de recorrências fixas/variáveis pra não duplicar). Status semáforo (`ok/atencao/estourou/sem_estimativa`) baseado em pct usado.

**UI `/recorrencias`:** form abre com 3 cards clicáveis (Fixo/Variável/Bucket) no topo. Buckets exigem categoria, escondem campos de pagamento/frequência. Lista mostra barra de progresso `realizado / estimado` pra buckets. Toggle `Categoria | Lista` agrupa por categoria com headers colapsáveis + total mensal.

**Tela `/orcamento` foi escondida do menu** (modelo legacy, mantida no banco pra refatoração futura).

### 3. Receitas — Competência vs Caixa + Saldo Greenn como linha

#### Filtros
Topo direito: **Critério (Competência/Caixa)** + **Período (Mês atual/Próximos/Personalizado/Todos)**.
- **Competência** (default): filtra por `data_venda` (mês da venda)
- **Caixa**: filtra por `data_prevista_pagamento` (mês que cai)

URL: `/receitas?p=personalizado&criterio=caixa&inicio=2026-05-01&fim=2026-05-31`

#### Tabela
Colunas: Origem | Produto/Cliente | **Competência** (Mai/26) | Faturamento | Recebido | A receber | **Quando cai** (Mai/26) | Ações.

- **Faturamento**: `valor_liquido` sempre
- **Recebido**: preenchido só se `status=recebido` (verde)
- **A receber**: preenchido se `status≠recebido` (âmbar)
- **Quando cai**: verde com `data_recebimento` se caiu, âmbar com `data_prevista_pagamento` se previsto
- Cada linha mostra a relação Competência ↔ Caixa explicitamente

**Primeira linha sempre fixa**: Saldo Greenn (badge "Fixo", fundo emerald). Mostra:
- Faturamento = `meta.faturamento_liquido` (vendas Greenn do mês via Meta API)
- A receber = `pendente + disponivel` (ainda na plataforma)
- Recebido = Faturamento − A receber (parte já transferida pra conta)
- Botão refresh abre modal de paste pra atualizar saldo

#### Form de receita
- Campo **Competência (mês)** dedicado — `<input type="month">` que vira `data_venda` (primeiro dia do mês)
- Campo **Faturamento (R$)** com máscara monetária BR (`parseBRL` aceita `1234,56`, `1.234,56`, `1234.56`)
- Campos Imposto/Líquido removidos (taxas=0; aba dedicada de impostos será criada depois)
- Origem agora vem da tabela `origens_receita` (Bruno adiciona pela UI)

### 4. Saldo Greenn via Claude Vision

Tela em destaque substituída por **linha fixa no topo da tabela de receitas**. Botão refresh abre modal:

1. Bruno tira print da seção "Minha carteira" no Greenn (`adm.greenn.com.br/extrato`)
2. Cola no modal (Ctrl+V ou file upload)
3. POST `/api/greenn/parse-saldo` → Claude Haiku 4.5 Vision extrai os 3 valores
4. Snapshot histórico salvo em `greenn_saldos`; UI atualiza
5. **NÃO** cria receita_bruta automática (evita double-count com faturamento Meta)

**Modelo conceitual descoberto na sessão:**
- `pendente` = vendas em hold (vão liberar)
- `antecipavel` = SUBSET do pendente (parte que pode ser antecipada com taxa)
- `disponivel` = liberado pra saque imediato
- A receber = `pendente + disponivel` (ambos ainda na plataforma)

### 5. Origens de receita CRUD

Migration 007 cria tabela `origens_receita` (slug, nome, cor_hex, ativo, ordem). Bruno cadastra Magalu/Casas Bahia/Hotmart/etc pela UI `/origens` sem precisar de migration. Form de receita puxa lista da tabela. Compat: `receitas_brutas.origem` (enum legacy) mantida; `origem_id` (FK) é a fonte de verdade nova.

### 6. Investigação Greenn API (sem conclusão de saldo)

Endpoints documentados em `apiadm.greenn.com.br`:
- `GET /api/balance` — **histórico** paginado de saldos (admin global, valores muito altos = soma todos sub-users, não serve)
- `GET /api/sale-total?...` — totalizadores
- `GET /api/antecipation/request/info` — info da última antecipação

Não conseguimos isolar o endpoint que retorna saldo do user (R$ 37 / R$ 8.475 / R$ 3.989 mostrados na UI). XHR/fetch hooks não capturaram durante refresh. Fallback: paste de print + Claude Vision (UX manual, 100% confiável).

### 7. Transações — filtro + agrupamento

**Bug do "Despesas (mês)"**: stats filtrava por mês mas tabela mostrava 90 dias. Fix:
- Server filtra por período via `?p=` (mês atual default / próximos / personalizado / todos)
- Stats e tabela usam o mesmo conjunto filtrado

**Agrupamento por categoria**: toggle `Categoria | Lista` no topo. Quando agrupado, cada categoria vira um header colapsável com:
- Bolinha da cor + nome + nº de itens
- Total agregado (despesa/receita) à direita
- Click expande/recolhe
- Botão "Expandir tudo / Recolher tudo"

Mesmo padrão em `/recorrencias`. Estado de colapsadas só no client (não persiste — refresh expande tudo).

### Bugs corrigidos nesta sprint

| # | Bug | Fix |
|---|---|---|
| 22 | Dashboard `R.toFixed is not a function` (Meta API retorna string) | Helper `num()` em `meta-ads.ts` que faz coerce string→number |
| 23 | Card Meta Ads zerado mas ROAS 2.59x | Refatorar agregação: `gasto = sum(campanhas.spend)`, vendas pelo array `vendas.hoje` (que tem TODO o período, não só hoje) |
| 24 | Dashboard somava Greenn pendente como receita realizada | Receita do mês = só `status=recebido`. Pendente vai em "a receber" como nota |
| 25 | Receita guarda-chuva Greenn double-contava com faturamento Meta | Removida (paste de print não cria mais receita_bruta — só `greenn_saldos` snapshot) |
| 26 | Saldo Greenn somava `pendente + antecipavel` (antecipável é SUBSET) | Corrigido: `valorAReceber = pendente` apenas. UI explica que "X é antecipável" |
| 27 | Build TS quebrou em `parse-saldo`: `Database` placeholder resolve `Insert` como `never` | Cast `as never` no insert; lookup de entidade reescrito pra evitar inference confusa |
| 28 | `<input type="number">` em pt-BR não aceita vírgula | Trocar pra `<input type="text" inputMode="decimal">` + helper `parseBRL` aceita 1234,56 / 1.234,56 / 1234.56 |
| 29 | Transações "Despesas (mês)" pegava 90d | Server filtra por período via `?p=` (mesmo padrão de /receitas) |

### Arquivos novos criados na sprint

| Arquivo | Função |
|---|---|
| `supabase/migrations/004_recorrencias_tipo_valor.sql` | tipo_valor + v_buckets_realizados + limpar_previstas_recorrencia |
| `supabase/migrations/005_greenn_saldos.sql` | tabela greenn_saldos + view v_greenn_saldo_atual |
| `supabase/migrations/006_add_magalu_origem.sql` | enum magalu_aff (legacy compat) |
| `supabase/migrations/007_origens_receita_tabela.sql` | tabela origens_receita + backfill |
| `src/app/api/greenn/parse-saldo/route.ts` | Claude Vision Haiku 4.5 parseia print → upsert snapshot |
| `src/app/(dashboard)/dashboard/periodo-filter.tsx` | Filtro 1m/3m/6m do dashboard |
| `src/app/(dashboard)/receitas/periodo-filter.tsx` | Filtro Mês/Próximos/Personalizado/Todos + toggle Competência/Caixa |
| `src/app/(dashboard)/receitas/greenn-saldo-card.tsx` | Modal de paste de print (`SaldoModal` exportada pra reuso) |
| `src/app/(dashboard)/origens/{page,actions,origens-client}.tsx` | CRUD de origens |
| `src/app/(dashboard)/transacoes/periodo-filter.tsx` | Filtro Mês/Próximos/Personalizado/Todos |
| `src/app/icon.svg` | Favicon emoji 💰 (Next.js detecta automaticamente) |
| `src/lib/formatters.ts` (adições) | `parseBRL`, `formatBRLEditable`, `maskBRLInput` |

### Ajustes finos no fim da sprint

- **Categorias colapsadas por padrão** em `/transacoes` e `/recorrencias` (invertido state pra `expandidas: Set<string>` que começa vazio). Botão "Expandir tudo / Recolher tudo" troca de label conforme o estado.
- **Rebrand**: `metadata.title` virou "Gerenciador Financeiro" (sem "Bruno Tropolis"). Sidebar mostra "💰 Gerenciador / Financeiro". Telas de auth mostram "💰 Gerenciador Financeiro". Favicon 💰 via SVG inline (Next.js detecta `src/app/icon.svg`).

### Pendências da próxima sessão

1. **Aba Impostos** — Bruno quer gerir impostos separadamente (taxas removidas do form de receita)
2. **Importar extratos abr/mai 2026** — validar fluxo end-to-end de conciliação
3. **Bot WhatsApp Sprint 4** — Bruno fornecer número dedicado
4. **Webhook Greenn → receitas_brutas** — conectar n8n pra criar receitas individuais Greenn (hoje só Meta API agregado)
5. **Materialização retroativa** — gerar previstas dos últimos 90d pra casar com extratos passados
