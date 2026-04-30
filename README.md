# Financeiro — Painel de Controle

Painel web pra gestão financeira pessoal (PF) + 3 PJs com:
- Cartões de crédito + faturas mensais
- Recorrências mensais (com snapshot por mês — alterar valor não muda histórico)
- Receitas multi-fonte (Greenn, afiliados, publis, AdSense, palestras)
- Projeção de fluxo de caixa 6 meses
- Bot WhatsApp pra lançamento via foto/texto (Sprint 4)
- Audit log de todas as mutações (quem fez o quê)

## Stack
- Next.js 15 (App Router, TypeScript, Tailwind, output standalone)
- Supabase (PostgreSQL 15 + Auth + RLS)
- shadcn/ui + lucide-react
- Anthropic SDK (Claude Haiku 4.5 para parse de comprovantes)
- Evolution API (WhatsApp bot)
- n8n (orquestração de webhooks Greenn/Meta)

## Estrutura
- `supabase/schema.sql` — schema completo (13 tabelas, RLS, triggers de audit, views)
- `supabase/seed.sql` — seed: 5 entidades, 10 contas, 1 cartão, 22 categorias
- `src/app/(dashboard)/` — rotas autenticadas
- `src/lib/supabase/` — clientes (browser/server/middleware)
- `src/lib/types/database.ts` — tipos do banco

## Setup inicial

### 1. Criar projeto Supabase
1. Acessar https://supabase.com/dashboard → New project
2. Nome: `Financeiro`
3. Region: `us-west-2` (mesma do Buscador Geek)
4. Senha: gerar e guardar
5. Aguardar provisioning (~2min)

### 2. Aplicar schema + seed
1. SQL Editor → New query
2. Colar `supabase/schema.sql` inteiro → Run
3. Nova query → Colar `supabase/seed.sql` → Run
4. Verificar query final: deve mostrar 5 entidades, 10 contas, 1 cartão, 22 categorias

### 3. Criar usuários iniciais
No painel Authentication → Users:
1. Criar `bruno@brunotropolis.com.br` (ou email do Bruno)
2. Criar email da Day
3. Em SQL Editor:
```sql
insert into profiles (id, nome, email, role) values
  ('<UUID-BRUNO>', 'Bruno Sampaio', 'bruno@...',  'admin'),
  ('<UUID-DAY>',   'Dayane dos Anjos', 'day@...', 'admin');
```

### 4. Configurar `.env.local`
Copiar `.env.example` → `.env.local` e preencher:
- `NEXT_PUBLIC_SUPABASE_URL` — Settings → API → URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Settings → API → anon public
- `SUPABASE_SERVICE_ROLE_KEY` — Settings → API → service_role (secret)

### 5. Gerar tipos TypeScript
```bash
npx supabase gen types typescript --project-id <ID> > src/lib/types/database.ts
```

### 6. Rodar local
```bash
npm install
npm run dev
# http://localhost:3000
```

### 7. Deploy EasyPanel
1. Push pro repo `brunotropolis/financeiro`
2. EasyPanel → New service → App → from GitHub
3. Adicionar mesmas env vars do `.env.local`
4. Domínio: `financeiro.brunotropolis.com.br`
5. Cloudflare DNS: A record `financeiro` → IP do EasyPanel (`187.77.49.160`)

## Sprints

| Sprint | Status | Entrega |
|---|---|---|
| **1** | 🔧 em andamento | Schema, seed, scaffolding, telas de cadastro (entidades/contas/cartões/categorias/fornecedores/recorrências), audit log |
| **2** | ⬜ | Transações, receitas (manual + Greenn webhook), faturas, dashboard com gráficos, projeção 6 meses |
| **3** | ⬜ | Importação CSV/OFX de extratos bancários, conciliação automática |
| **4** | ⬜ | Bot WhatsApp (Evolution + Claude vision) com aprendizado de fornecedor |
| **5** | ⬜ | Integrações Amazon/Shopee/ML afiliados (faturamento em aberto) |
| **6** | ⬜ | Sincronização Meta (gasto de tráfego), gestão de usuários |
