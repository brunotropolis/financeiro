-- ════════════════════════════════════════════════════════════════════════════
-- Migration 004 — tipo_valor em recorrências (fixo / variável / bucket)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Substitui o módulo de orçamento. Cada recorrência ganha um "tipo de valor":
--
--   fixo     — valor exato, sempre igual (aluguel, Spotify, etc)
--   variavel — cadastra valor médio; ao dar baixa, valor real substitui no
--              histórico. valor_padrao da recorrência fica intocado (template
--              continua para meses futuros).
--   bucket   — estimativa de teto mensal. NÃO materializa previstas; agrega
--              automaticamente todas as transações da mesma categoria_id no
--              mês (exceto as vinculadas a outras recorrências fixas/variáveis).
--
-- ════════════════════════════════════════════════════════════════════════════

-- 1. Enum tipo_valor_recorrencia
create type tipo_valor_recorrencia as enum ('fixo', 'variavel', 'bucket');

-- 2. Coluna em recorrencias
alter table recorrencias
  add column tipo_valor tipo_valor_recorrencia not null default 'fixo';

create index idx_recorrencias_tipo_valor on recorrencias(tipo_valor);

-- 3. materializar_recorrencia: pula buckets (não geram previstas)
create or replace function materializar_recorrencia(rec_id uuid, meses int default 6)
returns int as $$
declare
  rec recorrencias%rowtype;
  data_alvo date;
  data_fim date;
  contador int := 0;
begin
  select * into rec from recorrencias where id = rec_id and ativo = true;
  if not found then return 0; end if;

  -- Buckets agregam por categoria; não criam transações previstas
  if rec.tipo_valor = 'bucket' then
    return 0;
  end if;

  data_fim := current_date + (meses || ' months')::interval;
  if rec.data_fim is not null and rec.data_fim < data_fim then
    data_fim := rec.data_fim;
  end if;

  if rec.frequencia in ('semanal', 'quinzenal') then
    data_alvo := current_date;
    while extract(dow from data_alvo) <> rec.dia_semana loop
      data_alvo := data_alvo + 1;
    end loop;
  else
    data_alvo := date_trunc('month', current_date)::date + (rec.dia_vencimento - 1);
    if data_alvo < current_date then
      data_alvo := proxima_data_recorrencia(rec.frequencia, rec.dia_vencimento, rec.dia_semana, data_alvo);
    end if;
  end if;

  if rec.data_inicio > data_alvo then
    data_alvo := rec.data_inicio;
  end if;

  while data_alvo <= data_fim loop
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

  return contador;
end;
$$ language plpgsql security definer;

grant execute on function materializar_recorrencia to authenticated;

-- 4. View: agregação de buckets por mês
-- Para cada recorrência tipo='bucket' ativa, soma transações da mesma
-- categoria_id, excluindo tx vinculadas a outras recorrências (evita
-- double-count com fixas/variáveis da mesma categoria).
create or replace view v_buckets_realizados as
select
  r.id                                              as recorrencia_id,
  r.nome                                            as bucket_nome,
  r.categoria_id,
  c.nome                                            as categoria_nome,
  c.cor_hex                                         as categoria_cor,
  r.entidade_id,
  r.tipo,
  r.valor_padrao                                    as valor_estimado,
  date_trunc('month', t.data_competencia)::date     as mes_referencia,
  sum(t.valor)::numeric(14,2)                       as gasto_real,
  count(t.id)                                       as qtd_transacoes,
  case
    when r.valor_padrao > 0
      then round((sum(t.valor) / r.valor_padrao * 100)::numeric, 1)
    else null
  end                                               as pct_usado,
  case
    when r.valor_padrao > 0 and sum(t.valor) > r.valor_padrao then 'estourou'
    when r.valor_padrao > 0 and sum(t.valor) >= r.valor_padrao * 0.7 then 'atencao'
    when r.valor_padrao > 0 then 'ok'
    else 'sem_estimativa'
  end                                               as status
from recorrencias r
join categorias c       on c.id = r.categoria_id
join transacoes t       on t.categoria_id = r.categoria_id
                       and t.tipo = r.tipo
                       and t.status <> 'cancelada'
                       and t.recorrencia_id is null  -- exclui tx vinculadas a outras recorrências
where r.tipo_valor = 'bucket' and r.ativo = true
group by r.id, r.nome, r.categoria_id, c.nome, c.cor_hex,
         r.entidade_id, r.tipo, r.valor_padrao,
         date_trunc('month', t.data_competencia);

grant select on v_buckets_realizados to authenticated;

-- 5. Helper RPC: deleta transações previstas de uma recorrência (útil quando
--    muda tipo_valor de fixo/variável para bucket; previstas antigas perdem
--    sentido). Só apaga status='prevista'; histórico fica intocado.
create or replace function limpar_previstas_recorrencia(rec_id uuid)
returns int as $$
declare
  removidas int;
begin
  delete from transacoes
    where recorrencia_id = rec_id and status = 'prevista';
  get diagnostics removidas = row_count;
  return removidas;
end;
$$ language plpgsql security definer;

grant execute on function limpar_previstas_recorrencia to authenticated;
