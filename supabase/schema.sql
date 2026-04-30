-- ════════════════════════════════════════════════════════════════════════════
-- FINANCEIRO — Schema completo
-- Projeto: financeiro.brunotropolis.com.br
-- Banco: Supabase (PostgreSQL 15+)
--
-- Como aplicar:
--   1. Criar projeto novo no Supabase (us-west-2)
--   2. Abrir SQL Editor → colar este arquivo inteiro → Run
--   3. Depois rodar seed.sql
-- ════════════════════════════════════════════════════════════════════════════

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ────────────────────────────────────────────────────────────────────────────
-- ENUMS
-- ────────────────────────────────────────────────────────────────────────────
create type tipo_entidade as enum ('PF', 'PJ');
create type tipo_conta as enum ('corrente', 'poupanca', 'digital', 'prepaga');
create type bandeira_cartao as enum ('visa', 'master', 'elo', 'amex', 'hipercard', 'outro');
create type tipo_categoria as enum ('despesa', 'receita', 'ambos');
create type tipo_transacao as enum ('despesa', 'receita');
create type forma_pagamento as enum ('dinheiro', 'pix', 'boleto', 'cartao_credito', 'cartao_debito', 'transferencia');
create type status_transacao as enum ('prevista', 'confirmada', 'paga', 'cancelada', 'atrasada');
create type origem_transacao as enum ('whatsapp', 'painel', 'importacao_csv', 'recorrencia', 'meta_api', 'greenn', 'outro');
create type origem_receita as enum ('greenn', 'amazon_aff', 'shopee_aff', 'ml_aff', 'publi', 'adsense', 'palestra', 'consultoria', 'manual', 'outro');
create type status_receita as enum ('previsto', 'confirmado', 'pendente', 'disponivel', 'antecipado', 'recebido', 'reembolsado', 'chargeback', 'cancelado', 'atrasado');
create type tipo_movimentacao as enum ('entrada', 'saida', 'transferencia');
create type origem_movimentacao as enum ('importacao_csv', 'manual', 'greenn_payout', 'meta_pagamento', 'conciliada_whatsapp', 'recorrencia', 'transacao', 'outro');
create type frequencia_recorrencia as enum ('mensal', 'bimestral', 'trimestral', 'semestral', 'anual');
create type status_fatura as enum ('aberta', 'fechada', 'paga', 'parcial', 'atrasada');
create type tipo_snapshot as enum ('real', 'projetado');
create type acao_audit as enum ('insert', 'update', 'delete');
create type role_usuario as enum ('admin', 'operator', 'viewer');

-- ────────────────────────────────────────────────────────────────────────────
-- 1. PROFILES (usuários)
-- ────────────────────────────────────────────────────────────────────────────
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  email text unique not null,
  telefone_whatsapp text,
  role role_usuario not null default 'operator',
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────────────────────
-- 2. ENTIDADES
-- ────────────────────────────────────────────────────────────────────────────
create table entidades (
  id uuid primary key default uuid_generate_v4(),
  nome text not null,
  tipo tipo_entidade not null,
  cnpj_cpf text,
  razao_social text,
  cor_hex text default '#3b82f6',
  ativo boolean not null default true,
  ordem int default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  created_by uuid references profiles(id),
  updated_by uuid references profiles(id)
);
create index idx_entidades_ativo on entidades(ativo);

-- ────────────────────────────────────────────────────────────────────────────
-- 3. CONTAS BANCÁRIAS
-- ────────────────────────────────────────────────────────────────────────────
create table contas_bancarias (
  id uuid primary key default uuid_generate_v4(),
  entidade_id uuid not null references entidades(id) on delete restrict,
  nome text not null,
  banco text not null,
  tipo tipo_conta not null default 'corrente',
  agencia text,
  numero text,
  saldo_atual numeric(14,2) not null default 0,
  saldo_atualizado_em timestamptz default now(),
  cor_hex text default '#10b981',
  conta_principal boolean not null default false,
  ativo boolean not null default true,
  ordem int default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  created_by uuid references profiles(id),
  updated_by uuid references profiles(id)
);
create index idx_contas_entidade on contas_bancarias(entidade_id);
create index idx_contas_ativo on contas_bancarias(ativo);

-- ────────────────────────────────────────────────────────────────────────────
-- 4. CARTÕES DE CRÉDITO
-- ────────────────────────────────────────────────────────────────────────────
create table cartoes_credito (
  id uuid primary key default uuid_generate_v4(),
  entidade_id uuid not null references entidades(id) on delete restrict,
  nome text not null,
  bandeira bandeira_cartao not null default 'outro',
  ultimos_4_digitos text,
  limite_total numeric(14,2) default 0,
  limite_disponivel numeric(14,2) default 0,
  dia_fechamento int not null check (dia_fechamento between 1 and 31),
  dia_vencimento int not null check (dia_vencimento between 1 and 31),
  conta_pagamento_id uuid references contas_bancarias(id),
  cor_hex text default '#8b5cf6',
  ativo boolean not null default true,
  ordem int default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  created_by uuid references profiles(id),
  updated_by uuid references profiles(id)
);
create index idx_cartoes_entidade on cartoes_credito(entidade_id);
create index idx_cartoes_ativo on cartoes_credito(ativo);

-- ────────────────────────────────────────────────────────────────────────────
-- 5. CATEGORIAS
-- ────────────────────────────────────────────────────────────────────────────
create table categorias (
  id uuid primary key default uuid_generate_v4(),
  nome text not null,
  tipo tipo_categoria not null default 'despesa',
  categoria_pai_id uuid references categorias(id) on delete set null,
  cor_hex text default '#6b7280',
  icone text,
  ativo boolean not null default true,
  ordem int default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  created_by uuid references profiles(id),
  updated_by uuid references profiles(id)
);
create index idx_categorias_pai on categorias(categoria_pai_id);
create index idx_categorias_ativo on categorias(ativo);

-- ────────────────────────────────────────────────────────────────────────────
-- 6. FORNECEDORES
-- ────────────────────────────────────────────────────────────────────────────
create table fornecedores (
  id uuid primary key default uuid_generate_v4(),
  nome text not null,
  nome_normalizado text not null unique,
  cnpj text,
  categoria_padrao_id uuid references categorias(id),
  entidade_padrao_id uuid references entidades(id),
  forma_pagamento_padrao forma_pagamento,
  cartao_padrao_id uuid references cartoes_credito(id),
  conta_padrao_id uuid references contas_bancarias(id),
  total_transacoes int not null default 0,
  valor_medio numeric(14,2) default 0,
  ultimo_pagamento_em timestamptz,
  aliases jsonb default '[]'::jsonb,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  created_by uuid references profiles(id),
  updated_by uuid references profiles(id)
);
create index idx_fornecedores_normalizado on fornecedores(nome_normalizado);
create index idx_fornecedores_aliases on fornecedores using gin(aliases);

-- ────────────────────────────────────────────────────────────────────────────
-- 7. RECORRÊNCIAS
-- ────────────────────────────────────────────────────────────────────────────
create table recorrencias (
  id uuid primary key default uuid_generate_v4(),
  nome text not null,
  tipo tipo_transacao not null default 'despesa',
  valor_padrao numeric(14,2) not null,
  dia_vencimento int not null check (dia_vencimento between 1 and 31),
  frequencia frequencia_recorrencia not null default 'mensal',
  entidade_id uuid not null references entidades(id),
  categoria_id uuid references categorias(id),
  fornecedor_id uuid references fornecedores(id),
  forma_pagamento forma_pagamento,
  cartao_id uuid references cartoes_credito(id),
  conta_id uuid references contas_bancarias(id),
  data_inicio date not null default current_date,
  data_fim date,
  proxima_data date,
  ultima_geracao_em timestamptz,
  notas text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  created_by uuid references profiles(id),
  updated_by uuid references profiles(id)
);
create index idx_recorrencias_ativo on recorrencias(ativo);
create index idx_recorrencias_proxima on recorrencias(proxima_data) where ativo = true;

-- ────────────────────────────────────────────────────────────────────────────
-- 8. FATURAS DE CARTÃO
-- ────────────────────────────────────────────────────────────────────────────
create table faturas_cartao (
  id uuid primary key default uuid_generate_v4(),
  cartao_id uuid not null references cartoes_credito(id) on delete cascade,
  mes_referencia text not null,
  data_fechamento date not null,
  data_vencimento date not null,
  valor_total numeric(14,2) not null default 0,
  valor_pago numeric(14,2) not null default 0,
  valor_minimo numeric(14,2) default 0,
  status status_fatura not null default 'aberta',
  transacao_pagamento_id uuid,
  notas text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (cartao_id, mes_referencia)
);
create index idx_faturas_cartao on faturas_cartao(cartao_id);
create index idx_faturas_status on faturas_cartao(status);

-- ────────────────────────────────────────────────────────────────────────────
-- 9. TRANSAÇÕES
-- ────────────────────────────────────────────────────────────────────────────
create table transacoes (
  id uuid primary key default uuid_generate_v4(),
  tipo tipo_transacao not null,
  descricao text not null,
  valor numeric(14,2) not null,
  data_competencia date not null,
  data_pagamento date,
  entidade_id uuid not null references entidades(id),
  categoria_id uuid references categorias(id),
  fornecedor_id uuid references fornecedores(id),
  forma_pagamento forma_pagamento,
  cartao_id uuid references cartoes_credito(id),
  conta_id uuid references contas_bancarias(id),
  parcelado boolean not null default false,
  parcela_atual int,
  parcela_total int,
  valor_parcela numeric(14,2),
  transacao_pai_id uuid references transacoes(id) on delete cascade,
  recorrencia_id uuid references recorrencias(id) on delete set null,
  fatura_id uuid references faturas_cartao(id) on delete set null,
  status status_transacao not null default 'confirmada',
  comprovante_url text,
  notas text,
  origem origem_transacao not null default 'painel',
  bruto_ia jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  created_by uuid references profiles(id),
  updated_by uuid references profiles(id),
  constraint chk_pagamento_meio check (
    (forma_pagamento = 'cartao_credito' and cartao_id is not null) or
    (forma_pagamento in ('pix', 'boleto', 'cartao_debito', 'transferencia') and conta_id is not null) or
    (forma_pagamento = 'dinheiro') or
    (forma_pagamento is null)
  ),
  constraint chk_parcelas check (
    (parcelado = false) or
    (parcelado = true and parcela_atual is not null and parcela_total is not null and parcela_atual <= parcela_total)
  )
);
create index idx_transacoes_data_comp on transacoes(data_competencia);
create index idx_transacoes_data_pag on transacoes(data_pagamento);
create index idx_transacoes_entidade on transacoes(entidade_id);
create index idx_transacoes_categoria on transacoes(categoria_id);
create index idx_transacoes_fornecedor on transacoes(fornecedor_id);
create index idx_transacoes_cartao on transacoes(cartao_id);
create index idx_transacoes_conta on transacoes(conta_id);
create index idx_transacoes_status on transacoes(status);
create index idx_transacoes_recorrencia on transacoes(recorrencia_id);
create index idx_transacoes_fatura on transacoes(fatura_id);
create index idx_transacoes_pai on transacoes(transacao_pai_id);

alter table faturas_cartao add constraint fk_faturas_pagamento
  foreign key (transacao_pagamento_id) references transacoes(id) on delete set null;

-- ────────────────────────────────────────────────────────────────────────────
-- 10. RECEITAS BRUTAS
-- ────────────────────────────────────────────────────────────────────────────
create table receitas_brutas (
  id uuid primary key default uuid_generate_v4(),
  origem origem_receita not null,
  transaction_id_externo text,
  entidade_id uuid not null references entidades(id),
  produto_nome text,
  produto_id_externo text,
  cliente_nome text,
  cliente_email text,
  cliente_telefone text,
  valor_bruto numeric(14,2) not null,
  taxas numeric(14,2) not null default 0,
  valor_liquido numeric(14,2) not null,
  metodo_pagamento text,
  parcelas int default 1,
  data_venda date not null,
  data_prevista_pagamento date,
  data_recebimento date,
  status status_receita not null default 'pendente',
  movimentacao_id uuid,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  cupom text,
  notas text,
  bruto_webhook jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  created_by uuid references profiles(id),
  updated_by uuid references profiles(id),
  unique (origem, transaction_id_externo)
);
create index idx_receitas_origem on receitas_brutas(origem);
create index idx_receitas_status on receitas_brutas(status);
create index idx_receitas_entidade on receitas_brutas(entidade_id);
create index idx_receitas_data_venda on receitas_brutas(data_venda);
create index idx_receitas_data_prev on receitas_brutas(data_prevista_pagamento);

-- ────────────────────────────────────────────────────────────────────────────
-- 11. MOVIMENTAÇÕES BANCÁRIAS
-- ────────────────────────────────────────────────────────────────────────────
create table movimentacoes_bancarias (
  id uuid primary key default uuid_generate_v4(),
  conta_id uuid not null references contas_bancarias(id) on delete restrict,
  tipo tipo_movimentacao not null,
  valor numeric(14,2) not null,
  data date not null,
  descricao text not null,
  categoria_id uuid references categorias(id),
  entidade_id uuid references entidades(id),
  transacao_id uuid references transacoes(id) on delete set null,
  receita_id uuid references receitas_brutas(id) on delete set null,
  transferencia_destino_id uuid references contas_bancarias(id),
  origem origem_movimentacao not null default 'manual',
  conciliado boolean not null default false,
  notas text,
  bruto jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  created_by uuid references profiles(id),
  updated_by uuid references profiles(id)
);
create index idx_mov_conta on movimentacoes_bancarias(conta_id);
create index idx_mov_data on movimentacoes_bancarias(data);
create index idx_mov_tipo on movimentacoes_bancarias(tipo);
create index idx_mov_transacao on movimentacoes_bancarias(transacao_id);
create index idx_mov_receita on movimentacoes_bancarias(receita_id);
create index idx_mov_conciliado on movimentacoes_bancarias(conciliado);

alter table receitas_brutas add constraint fk_receitas_movimentacao
  foreign key (movimentacao_id) references movimentacoes_bancarias(id) on delete set null;

-- ────────────────────────────────────────────────────────────────────────────
-- 12. SALDOS SNAPSHOT
-- ────────────────────────────────────────────────────────────────────────────
create table saldos_snapshot (
  id uuid primary key default uuid_generate_v4(),
  data date not null,
  conta_id uuid not null references contas_bancarias(id) on delete cascade,
  saldo numeric(14,2) not null,
  tipo tipo_snapshot not null default 'real',
  criado_em timestamptz not null default now(),
  unique (data, conta_id, tipo)
);
create index idx_snapshot_data on saldos_snapshot(data);
create index idx_snapshot_conta on saldos_snapshot(conta_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 13. AUDIT LOG
-- ────────────────────────────────────────────────────────────────────────────
create table audit_log (
  id uuid primary key default uuid_generate_v4(),
  tabela text not null,
  registro_id uuid not null,
  acao acao_audit not null,
  usuario_id uuid references profiles(id),
  usuario_email text,
  payload_antes jsonb,
  payload_depois jsonb,
  origem text default 'painel',
  ip text,
  criado_em timestamptz not null default now()
);
create index idx_audit_tabela on audit_log(tabela);
create index idx_audit_registro on audit_log(registro_id);
create index idx_audit_usuario on audit_log(usuario_id);
create index idx_audit_data on audit_log(criado_em desc);

-- ════════════════════════════════════════════════════════════════════════════
-- TRIGGERS
-- ════════════════════════════════════════════════════════════════════════════

create or replace function set_atualizado_em()
returns trigger as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$ language plpgsql;

do $$
declare t text;
begin
  for t in
    select table_name from information_schema.columns
    where table_schema = 'public' and column_name = 'atualizado_em'
  loop
    execute format('drop trigger if exists trg_set_atualizado_em on %I', t);
    execute format('create trigger trg_set_atualizado_em before update on %I
                    for each row execute function set_atualizado_em()', t);
  end loop;
end$$;

create or replace function audit_trigger()
returns trigger as $$
declare
  v_user_id uuid;
  v_user_email text;
  v_origem text;
begin
  begin
    v_user_id := (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')::uuid;
    v_user_email := current_setting('request.jwt.claims', true)::jsonb ->> 'email';
  exception when others then
    v_user_id := null;
    v_user_email := null;
  end;

  v_origem := coalesce(current_setting('app.origem', true), 'painel');

  if tg_op = 'INSERT' then
    insert into audit_log (tabela, registro_id, acao, usuario_id, usuario_email, payload_depois, origem)
    values (tg_table_name, new.id, 'insert', v_user_id, v_user_email, to_jsonb(new), v_origem);
    return new;
  elsif tg_op = 'UPDATE' then
    insert into audit_log (tabela, registro_id, acao, usuario_id, usuario_email, payload_antes, payload_depois, origem)
    values (tg_table_name, new.id, 'update', v_user_id, v_user_email, to_jsonb(old), to_jsonb(new), v_origem);
    return new;
  elsif tg_op = 'DELETE' then
    insert into audit_log (tabela, registro_id, acao, usuario_id, usuario_email, payload_antes, origem)
    values (tg_table_name, old.id, 'delete', v_user_id, v_user_email, to_jsonb(old), v_origem);
    return old;
  end if;
  return null;
end;
$$ language plpgsql security definer;

do $$
declare t text;
begin
  for t in select unnest(array[
    'entidades', 'contas_bancarias', 'cartoes_credito', 'categorias',
    'fornecedores', 'recorrencias', 'transacoes', 'receitas_brutas',
    'movimentacoes_bancarias', 'faturas_cartao', 'profiles'
  ])
  loop
    execute format('drop trigger if exists trg_audit on %I', t);
    execute format('create trigger trg_audit
                    after insert or update or delete on %I
                    for each row execute function audit_trigger()', t);
  end loop;
end$$;

create or replace function recalcular_saldo_conta()
returns trigger as $$
declare v_conta_id uuid;
begin
  if tg_op = 'DELETE' then v_conta_id := old.conta_id;
  else v_conta_id := new.conta_id; end if;

  update contas_bancarias
  set saldo_atual = coalesce((
    select sum(case
      when tipo = 'entrada' then valor
      when tipo = 'saida' then -valor
      when tipo = 'transferencia' then -valor
    end)
    from movimentacoes_bancarias
    where conta_id = v_conta_id
  ), 0),
  saldo_atualizado_em = now()
  where id = v_conta_id;

  return coalesce(new, old);
end;
$$ language plpgsql;

create trigger trg_recalc_saldo
  after insert or update or delete on movimentacoes_bancarias
  for each row execute function recalcular_saldo_conta();

-- ════════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ════════════════════════════════════════════════════════════════════════════

alter table profiles enable row level security;
alter table entidades enable row level security;
alter table contas_bancarias enable row level security;
alter table cartoes_credito enable row level security;
alter table categorias enable row level security;
alter table fornecedores enable row level security;
alter table recorrencias enable row level security;
alter table faturas_cartao enable row level security;
alter table transacoes enable row level security;
alter table receitas_brutas enable row level security;
alter table movimentacoes_bancarias enable row level security;
alter table saldos_snapshot enable row level security;
alter table audit_log enable row level security;

create or replace function user_role()
returns role_usuario as $$
  select role from profiles where id = auth.uid() and ativo = true
$$ language sql stable security definer;

create or replace function is_admin()
returns boolean as $$
  select coalesce(user_role() = 'admin', false)
$$ language sql stable security definer;

create or replace function can_write()
returns boolean as $$
  select coalesce(user_role() in ('admin', 'operator'), false)
$$ language sql stable security definer;

create or replace function is_active_user()
returns boolean as $$
  select coalesce(user_role() in ('admin', 'operator', 'viewer'), false)
$$ language sql stable security definer;

create policy "profiles select" on profiles for select using (is_active_user());
create policy "profiles update self" on profiles for update using (id = auth.uid());
create policy "profiles admin all" on profiles for all using (is_admin());

do $$
declare t text;
begin
  for t in select unnest(array[
    'entidades', 'contas_bancarias', 'cartoes_credito', 'categorias', 'fornecedores',
    'recorrencias', 'faturas_cartao', 'transacoes', 'receitas_brutas',
    'movimentacoes_bancarias', 'saldos_snapshot'
  ])
  loop
    execute format('create policy "%1$s select" on %1$s for select using (is_active_user())', t);
    execute format('create policy "%1$s insert" on %1$s for insert with check (can_write())', t);
    execute format('create policy "%1$s update" on %1$s for update using (can_write())', t);
    execute format('create policy "%1$s delete" on %1$s for delete using (is_admin())', t);
  end loop;
end$$;

create policy "audit_log select" on audit_log for select using (is_active_user());

-- ════════════════════════════════════════════════════════════════════════════
-- VIEWS
-- ════════════════════════════════════════════════════════════════════════════

create or replace view v_saldo_entidades as
select e.id, e.nome, e.tipo, e.cor_hex,
  coalesce(sum(c.saldo_atual), 0) as saldo_total,
  count(c.id) as qtd_contas
from entidades e
left join contas_bancarias c on c.entidade_id = e.id and c.ativo = true
where e.ativo = true
group by e.id, e.nome, e.tipo, e.cor_hex;

create or replace view v_gastos_mes_categoria as
select c.id as categoria_id, c.nome as categoria_nome, c.cor_hex,
  count(t.id) as qtd_transacoes, sum(t.valor) as total
from categorias c
left join transacoes t on t.categoria_id = c.id
  and t.tipo = 'despesa'
  and t.status in ('confirmada', 'paga')
  and t.data_competencia >= date_trunc('month', current_date)
  and t.data_competencia < date_trunc('month', current_date) + interval '1 month'
group by c.id, c.nome, c.cor_hex
having count(t.id) > 0
order by total desc;

create or replace view v_faturas_abertas as
select f.id, f.cartao_id, cc.nome as cartao_nome, e.nome as entidade_nome,
  f.mes_referencia, f.data_fechamento, f.data_vencimento,
  f.valor_total, f.valor_pago, f.status,
  (f.data_vencimento - current_date) as dias_para_vencer
from faturas_cartao f
join cartoes_credito cc on cc.id = f.cartao_id
join entidades e on e.id = cc.entidade_id
where f.status in ('aberta', 'fechada')
order by f.data_vencimento asc;
