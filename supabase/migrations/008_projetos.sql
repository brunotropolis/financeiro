-- ════════════════════════════════════════════════════════════════════════════
-- Migration 008 — Projetos (iniciativas comerciais — pra calcular margem)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Entidades (PF/PJ) = quem paga/recebe fiscalmente. NÃO são projetos.
-- Projetos = iniciativas comerciais. Bruno quer entender margem de lucro
-- por projeto (receita - despesa - investimento por projeto).
--
-- Uma PJ pode tocar vários projetos. Um projeto pode ter despesas pagas por
-- entidades diferentes. Por isso projeto é ortogonal a entidade.

create table if not exists projetos (
  id uuid primary key default uuid_generate_v4(),
  slug text not null unique,
  nome text not null,
  cor_hex text,
  ativo boolean not null default true,
  ordem int not null default 100,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_projetos_ativo on projetos(ativo);
create index if not exists idx_projetos_ordem on projetos(ordem);

-- Popular com os 4 projetos do Bruno
insert into projetos (slug, nome, cor_hex, ordem) values
  ('manual_recem_nascido', 'Manual do Recém-Nascido', '#ec4899', 1),
  ('ofertas_maternas',     'As Ofertas Maternas',     '#10b981', 2),
  ('brunotropolis',        'Brunotropolis',           '#3b82f6', 3),
  ('pessoal',              'Pessoal',                 '#6b7280', 4)
on conflict (slug) do nothing;

-- Coluna projeto_id em transacoes, receitas_brutas e recorrencias (todas nullable
-- — Bruno preenche manual quando aplicável)
alter table transacoes
  add column if not exists projeto_id uuid references projetos(id);
create index if not exists idx_transacoes_projeto on transacoes(projeto_id);

alter table receitas_brutas
  add column if not exists projeto_id uuid references projetos(id);
create index if not exists idx_receitas_projeto on receitas_brutas(projeto_id);

alter table recorrencias
  add column if not exists projeto_id uuid references projetos(id);
create index if not exists idx_recorrencias_projeto on recorrencias(projeto_id);

-- RLS
alter table projetos enable row level security;

create policy "active_users_read_projetos"
  on projetos for select
  using (is_active_user());

create policy "writers_write_projetos"
  on projetos for all
  using (can_write())
  with check (can_write());

-- Trigger pra atualizar atualizado_em
create or replace function trg_projetos_updated_at()
returns trigger as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_projetos_updated_at on projetos;
create trigger trg_projetos_updated_at
  before update on projetos
  for each row execute function trg_projetos_updated_at();
