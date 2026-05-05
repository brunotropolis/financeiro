-- ════════════════════════════════════════════════════════════════════════════
-- Migration 001 — Recorrências semanais + materialização + atrasos
--
-- Aplicar via Supabase SQL Editor após schema.sql + seed.sql.
-- ════════════════════════════════════════════════════════════════════════════

-- 1. Adicionar valores 'semanal' e 'quinzenal' ao enum frequencia_recorrencia
alter type frequencia_recorrencia add value if not exists 'semanal' before 'mensal';
alter type frequencia_recorrencia add value if not exists 'quinzenal' before 'mensal';

-- 2. Adicionar campos novos em recorrencias
alter table recorrencias
  add column if not exists dia_semana int check (dia_semana between 0 and 6),
  add column if not exists pode_pular boolean not null default false;

comment on column recorrencias.dia_semana is '0=domingo, 6=sábado. Usado quando frequencia=semanal/quinzenal.';
comment on column recorrencias.pode_pular is 'Se true, ocorrências sem match no extrato são silenciadas (ex: diarista que pode faltar).';

-- 3. View de projeção: transações previstas + recebimentos pendentes (próximos 6 meses)
create or replace view v_projecao as
with despesas_previstas as (
  select
    t.id,
    'despesa'::text as tipo,
    t.descricao,
    t.valor,
    t.data_competencia as data,
    t.status,
    t.entidade_id,
    t.categoria_id,
    t.cartao_id,
    t.conta_id,
    t.recorrencia_id,
    null::text as origem_receita,
    t.atualizado_em
  from transacoes t
  where t.tipo = 'despesa'
    and t.status in ('prevista', 'atrasada', 'confirmada')
    and t.data_competencia >= current_date
    and t.data_competencia <= current_date + interval '6 months'
),
receitas_previstas as (
  select
    t.id,
    'receita'::text as tipo,
    t.descricao,
    t.valor,
    t.data_competencia as data,
    t.status,
    t.entidade_id,
    t.categoria_id,
    t.cartao_id,
    t.conta_id,
    t.recorrencia_id,
    null::text as origem_receita,
    t.atualizado_em
  from transacoes t
  where t.tipo = 'receita'
    and t.status in ('prevista', 'atrasada', 'confirmada')
    and t.data_competencia >= current_date
    and t.data_competencia <= current_date + interval '6 months'
),
greenn_a_receber as (
  select
    r.id,
    'receita'::text as tipo,
    coalesce(r.produto_nome, 'Receita ' || r.origem::text) as descricao,
    r.valor_liquido as valor,
    coalesce(r.data_prevista_pagamento, r.data_venda + interval '30 days')::date as data,
    'prevista'::status_transacao as status,
    r.entidade_id,
    null::uuid as categoria_id,
    null::uuid as cartao_id,
    null::uuid as conta_id,
    null::uuid as recorrencia_id,
    r.origem::text as origem_receita,
    r.atualizado_em
  from receitas_brutas r
  where r.status in ('previsto', 'confirmado', 'pendente', 'disponivel', 'antecipado')
    and r.data_recebimento is null
    and coalesce(r.data_prevista_pagamento, r.data_venda + interval '30 days')::date >= current_date
    and coalesce(r.data_prevista_pagamento, r.data_venda + interval '30 days')::date <= current_date + interval '6 months'
)
select * from despesas_previstas
union all
select * from receitas_previstas
union all
select * from greenn_a_receber;

-- 4. Função: detecta transações previstas com data passada → marca como atrasada
create or replace function detectar_atrasos()
returns table(id uuid, descricao text, valor numeric, data_competencia date, dias_atraso int) as $$
  with marcadas as (
    update transacoes t
    set status = 'atrasada', updated_by = auth.uid()
    where t.status = 'prevista'
      and t.data_competencia < current_date
      and (
        t.recorrencia_id is null
        or (select pode_pular from recorrencias r where r.id = t.recorrencia_id) = false
      )
    returning t.id, t.descricao, t.valor, t.data_competencia
  )
  select id, descricao, valor, data_competencia,
         (current_date - data_competencia)::int as dias_atraso
  from marcadas;
$$ language sql security definer;

-- Permite usuários autenticados executarem a função
grant execute on function detectar_atrasos to authenticated;

-- 5. Função: gera próxima data de uma recorrência baseada na frequência
create or replace function proxima_data_recorrencia(
  freq frequencia_recorrencia,
  dia_mes int,
  dia_semana int,
  ultima_data date
) returns date as $$
declare
  proxima date;
begin
  case freq
    when 'semanal' then
      proxima := ultima_data + interval '7 days';
    when 'quinzenal' then
      proxima := ultima_data + interval '14 days';
    when 'mensal' then
      proxima := (date_trunc('month', ultima_data) + interval '1 month')::date + (dia_mes - 1);
    when 'bimestral' then
      proxima := (date_trunc('month', ultima_data) + interval '2 months')::date + (dia_mes - 1);
    when 'trimestral' then
      proxima := (date_trunc('month', ultima_data) + interval '3 months')::date + (dia_mes - 1);
    when 'semestral' then
      proxima := (date_trunc('month', ultima_data) + interval '6 months')::date + (dia_mes - 1);
    when 'anual' then
      proxima := (ultima_data + interval '1 year')::date;
  end case;
  return proxima;
end;
$$ language plpgsql immutable;

-- 6. Função principal: materializa próximos N meses de uma recorrência específica
-- Idempotente: só cria transações que ainda não existem
create or replace function materializar_recorrencia(rec_id uuid, meses int default 6)
returns int as $$
declare
  rec recorrencias%rowtype;
  data_alvo date;
  data_inicio date;
  data_fim date;
  contador int := 0;
begin
  select * into rec from recorrencias where id = rec_id and ativo = true;
  if not found then
    return 0;
  end if;

  data_fim := current_date + (meses || ' months')::interval;
  if rec.data_fim is not null and rec.data_fim < data_fim then
    data_fim := rec.data_fim;
  end if;

  -- Determina ponto de partida
  if rec.frequencia in ('semanal', 'quinzenal') then
    -- Para semanal/quinzenal: começa do próximo dia da semana
    data_alvo := current_date;
    while extract(dow from data_alvo) <> rec.dia_semana loop
      data_alvo := data_alvo + 1;
    end loop;
  else
    -- Para mensal e maiores: usa dia_vencimento do mês corrente ou próximo
    data_alvo := date_trunc('month', current_date)::date + (rec.dia_vencimento - 1);
    if data_alvo < current_date then
      data_alvo := proxima_data_recorrencia(rec.frequencia, rec.dia_vencimento, rec.dia_semana, data_alvo);
    end if;
  end if;

  -- Limita ao data_inicio da recorrência
  if rec.data_inicio > data_alvo then
    data_alvo := rec.data_inicio;
  end if;

  while data_alvo <= data_fim loop
    -- Só cria se não existir transação prevista pra mesma recorrência+data
    insert into transacoes (
      tipo, descricao, valor, data_competencia,
      entidade_id, categoria_id, fornecedor_id,
      forma_pagamento, cartao_id, conta_id,
      recorrencia_id, status, origem,
      created_by, updated_by
    )
    select
      rec.tipo, rec.nome, rec.valor_padrao, data_alvo,
      rec.entidade_id, rec.categoria_id, rec.fornecedor_id,
      rec.forma_pagamento, rec.cartao_id, rec.conta_id,
      rec.id, 'prevista', 'recorrencia',
      rec.created_by, rec.updated_by
    where not exists (
      select 1 from transacoes
      where recorrencia_id = rec.id
        and data_competencia = data_alvo
    );

    if found then contador := contador + 1; end if;

    data_alvo := proxima_data_recorrencia(rec.frequencia, rec.dia_vencimento, rec.dia_semana, data_alvo);
  end loop;

  -- Atualiza ultima_geracao_em
  update recorrencias set ultima_geracao_em = now() where id = rec_id;

  return contador;
end;
$$ language plpgsql security definer;

grant execute on function materializar_recorrencia to authenticated;

-- 7. Função: materializa todas as recorrências ativas
create or replace function materializar_todas_recorrencias(meses int default 6)
returns int as $$
declare
  total int := 0;
  parcial int;
  r record;
begin
  for r in select id from recorrencias where ativo = true loop
    parcial := materializar_recorrencia(r.id, meses);
    total := total + parcial;
  end loop;
  return total;
end;
$$ language plpgsql security definer;

grant execute on function materializar_todas_recorrencias to authenticated;

-- 8. Trigger: ao criar/atualizar recorrência ativa, materializa automaticamente
create or replace function trigger_materializar_recorrencia()
returns trigger as $$
begin
  if new.ativo = true then
    perform materializar_recorrencia(new.id, 6);
  elsif old.ativo = true and new.ativo = false then
    -- Desativou: deleta transações previstas futuras
    delete from transacoes
    where recorrencia_id = new.id
      and status = 'prevista'
      and data_competencia >= current_date;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_materializar on recorrencias;
create trigger trg_materializar
  after insert or update on recorrencias
  for each row execute function trigger_materializar_recorrencia();

-- ════════════════════════════════════════════════════════════════════════════
-- Como usar:
--
-- 1. Aplicar este SQL no Supabase SQL Editor
-- 2. Toda vez que criar/editar uma recorrência ativa, o trigger gera as
--    transações previstas dos próximos 6 meses automaticamente.
-- 3. Pra forçar regeneração de tudo:
--      select materializar_todas_recorrencias(6);
-- 4. Pra detectar atrasos (cron diário):
--      select * from detectar_atrasos();
-- ════════════════════════════════════════════════════════════════════════════
