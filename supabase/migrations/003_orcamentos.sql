-- ════════════════════════════════════════════════════════════════════════════
-- Migration 003 — Orçamento mensal por categoria
--
-- Permite Bruno definir uma meta de gastos por categoria/mês (ex: R$ 5.000 em
-- Alimentação) e o sistema vai abatendo conforme transações pagas/efetivadas
-- caem nessa categoria, independente da entidade que pagou.
--
-- Aplicar via Supabase SQL Editor.
-- ════════════════════════════════════════════════════════════════════════════

-- 1. Tabela orcamentos
create table if not exists orcamentos (
  id uuid primary key default gen_random_uuid(),
  mes_referencia date not null,           -- sempre dia 1 do mês (ex: 2026-05-01)
  categoria_id uuid not null references categorias(id) on delete cascade,
  valor_previsto numeric(14,2) not null check (valor_previsto >= 0),
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references profiles(id),
  updated_by uuid references profiles(id),
  unique (mes_referencia, categoria_id)
);

comment on table orcamentos is 'Meta mensal de gastos por categoria. Cruza com transações pagas para mostrar % executado.';
comment on column orcamentos.mes_referencia is 'Dia 1 do mês — ex: 2026-05-01 representa orçamento de maio/2026';
comment on column orcamentos.valor_previsto is 'Valor planejado para o mês (R$). Bruno define manualmente.';

create index if not exists idx_orcamentos_mes on orcamentos(mes_referencia);
create index if not exists idx_orcamentos_categoria on orcamentos(categoria_id);

-- Trigger updated_at
create or replace function set_orcamento_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_orcamento_updated_at on orcamentos;
create trigger trg_orcamento_updated_at before update on orcamentos
  for each row execute function set_orcamento_updated_at();

-- 2. RLS — admin/operator pode escrever, todos autenticados leem
alter table orcamentos enable row level security;

drop policy if exists "orcamentos_select" on orcamentos;
create policy "orcamentos_select" on orcamentos for select using (is_active_user());

drop policy if exists "orcamentos_insert" on orcamentos;
create policy "orcamentos_insert" on orcamentos for insert with check (can_write());

drop policy if exists "orcamentos_update" on orcamentos;
create policy "orcamentos_update" on orcamentos for update using (can_write());

drop policy if exists "orcamentos_delete" on orcamentos;
create policy "orcamentos_delete" on orcamentos for delete using (is_admin());

-- 3. View v_orcamento_realizado — cruza orcamentos com transações pagas no mês
-- Inclui TODAS as categorias que aparecem em transações do mês (mesmo sem orçamento)
-- pra Bruno ver gastos extras não previstos.
create or replace view v_orcamento_realizado as
with meses as (
  -- Gera lista de meses dos últimos 6 + próximos 6 meses
  select generate_series(
    date_trunc('month', current_date - interval '6 months'),
    date_trunc('month', current_date + interval '6 months'),
    interval '1 month'
  )::date as mes_referencia
),
categorias_ativas as (
  select id, nome, tipo, cor_hex, categoria_pai_id
  from categorias
  where ativo = true and tipo = 'despesa'
),
mes_x_cat as (
  -- Cartesian: cada mês x cada categoria de despesa
  select m.mes_referencia, c.id as categoria_id, c.nome as categoria_nome,
         c.cor_hex as categoria_cor
  from meses m
  cross join categorias_ativas c
),
realizado as (
  -- Soma despesas pagas/efetivadas por categoria/mês
  select
    date_trunc('month', t.data_competencia)::date as mes_referencia,
    t.categoria_id,
    sum(t.valor) filter (where t.status in ('paga', 'confirmada')) as gasto_real,
    sum(t.valor) filter (where t.status in ('prevista', 'atrasada')) as gasto_previsto
  from transacoes t
  where t.tipo = 'despesa'
    and t.categoria_id is not null
    and t.status != 'cancelada'
  group by 1, 2
)
select
  mxc.mes_referencia,
  mxc.categoria_id,
  mxc.categoria_nome,
  mxc.categoria_cor,
  coalesce(o.valor_previsto, 0) as valor_previsto,
  coalesce(r.gasto_real, 0) as gasto_real,
  coalesce(r.gasto_previsto, 0) as gasto_previsto,
  coalesce(r.gasto_real, 0) + coalesce(r.gasto_previsto, 0) as gasto_total,
  case
    when coalesce(o.valor_previsto, 0) = 0 then null
    else round((coalesce(r.gasto_real, 0) / o.valor_previsto * 100)::numeric, 1)
  end as pct_usado,
  case
    when coalesce(o.valor_previsto, 0) = 0 and coalesce(r.gasto_real, 0) > 0 then 'sem_orcamento'
    when coalesce(o.valor_previsto, 0) = 0 then 'sem_dados'
    when coalesce(r.gasto_real, 0) > o.valor_previsto then 'estourou'
    when coalesce(r.gasto_real, 0) > o.valor_previsto * 0.7 then 'atencao'
    else 'ok'
  end as status,
  o.id as orcamento_id,
  o.notas as orcamento_notas
from mes_x_cat mxc
left join orcamentos o on o.mes_referencia = mxc.mes_referencia and o.categoria_id = mxc.categoria_id
left join realizado r on r.mes_referencia = mxc.mes_referencia and r.categoria_id = mxc.categoria_id;

comment on view v_orcamento_realizado is 'Cruza orçamentos com gastos reais por categoria/mês. Status: ok (<70%), atencao (70-100%), estourou (>100%), sem_orcamento, sem_dados.';

-- 4. Função pra copiar orçamento de um mês pra outro (acelera setup mensal)
create or replace function copiar_orcamento(
  p_mes_origem date,
  p_mes_destino date,
  p_user_id uuid
) returns int
language plpgsql security definer as $$
declare
  v_count int := 0;
begin
  -- Normaliza pra dia 1
  p_mes_origem := date_trunc('month', p_mes_origem)::date;
  p_mes_destino := date_trunc('month', p_mes_destino)::date;

  insert into orcamentos (mes_referencia, categoria_id, valor_previsto, notas, created_by, updated_by)
  select p_mes_destino, o.categoria_id, o.valor_previsto, o.notas, p_user_id, p_user_id
  from orcamentos o
  where o.mes_referencia = p_mes_origem
  on conflict (mes_referencia, categoria_id) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function copiar_orcamento is 'Copia todos os orçamentos de um mês pra outro (ignora os que já existem no destino).';
