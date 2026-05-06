-- ════════════════════════════════════════════════════════════════════════════
-- Migration 002 — Fix recursão infinita no trigger de materialização
--
-- PROBLEMA: trigger trg_materializar dispara em INSERT OR UPDATE.
-- A função materializar_recorrencia faz UPDATE em recorrencias (set ultima_geracao_em),
-- que dispara o trigger de novo → loop infinito → "stack depth limit exceeded".
--
-- FIX: trigger só dispara nos casos que importam (criar, mudar ativo/valor/freq).
-- ════════════════════════════════════════════════════════════════════════════

-- 1. Reescreve a função do trigger pra detectar mudanças relevantes
create or replace function trigger_materializar_recorrencia()
returns trigger as $$
begin
  -- Só dispara em INSERT ou em UPDATEs que mudam algo material
  if TG_OP = 'INSERT' then
    if new.ativo = true then
      perform materializar_recorrencia(new.id, 6);
    end if;
  elsif TG_OP = 'UPDATE' then
    -- Se desativou: limpa transações previstas futuras
    if old.ativo = true and new.ativo = false then
      delete from transacoes
      where recorrencia_id = new.id
        and status = 'prevista'
        and data_competencia >= current_date;
      return new;
    end if;

    -- Se reativou ou se mudou algo que afeta materialização: rematerializa
    if new.ativo = true and (
      old.ativo is distinct from new.ativo
      or old.valor_padrao is distinct from new.valor_padrao
      or old.frequencia is distinct from new.frequencia
      or old.dia_vencimento is distinct from new.dia_vencimento
      or old.dia_semana is distinct from new.dia_semana
      or old.data_inicio is distinct from new.data_inicio
      or old.data_fim is distinct from new.data_fim
    ) then
      -- Apaga previstas futuras pra recriar com novo valor
      delete from transacoes
      where recorrencia_id = new.id
        and status = 'prevista'
        and data_competencia >= current_date;
      perform materializar_recorrencia(new.id, 6);
    end if;
    -- Se foi só update de ultima_geracao_em ou atualizado_em → ignora (não recursiona)
  end if;
  return new;
end;
$$ language plpgsql;

-- 2. Remove ultima_geracao_em update da função materializar_recorrencia
-- (pra evitar de disparar trigger de novo mesmo com a guard acima)
create or replace function materializar_recorrencia(rec_id uuid, meses int default 6)
returns int as $$
declare
  rec recorrencias%rowtype;
  data_alvo date;
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

  -- REMOVIDO: update de ultima_geracao_em (causava recursão).
  -- Em vez disso, usar query SQL separada se quiser tracking.

  return contador;
end;
$$ language plpgsql security definer;

grant execute on function materializar_recorrencia to authenticated;
