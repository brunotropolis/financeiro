-- Migration 007 — Origens de receita viram tabela (CRUD)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Antes: origem era enum fixo (precisa de migration pra cada nova marketplace).
-- Agora: tabela origens_receita gerenciada via tela /origens. Slug mantém compat
-- com enum antigo. Coluna receitas_brutas.origem_id passa a referenciar a tabela.

create table if not exists origens_receita (
  id uuid primary key default uuid_generate_v4(),
  slug text not null unique,
  nome text not null,
  cor_hex text,
  ativo boolean not null default true,
  ordem int not null default 100,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_origens_receita_ativo on origens_receita(ativo);
create index if not exists idx_origens_receita_ordem on origens_receita(ordem);

-- Popular com valores existentes do enum + Magalu
insert into origens_receita (slug, nome, cor_hex, ordem) values
  ('manual',       'Manual',              '#6b7280', 1),
  ('publi',        'Publi',               '#8b5cf6', 2),
  ('adsense',      'AdSense',             '#3b82f6', 3),
  ('palestra',     'Palestra',            '#06b6d4', 4),
  ('consultoria',  'Consultoria',         '#14b8a6', 5),
  ('greenn',       'Greenn (auto)',       '#10b981', 10),
  ('amazon_aff',   'Amazon Afiliados',    '#f97316', 20),
  ('shopee_aff',   'Shopee Afiliados',    '#f43f5e', 21),
  ('ml_aff',       'Mercado Livre Afiliados', '#eab308', 22),
  ('magalu_aff',   'Magalu Afiliados',    '#0ea5e9', 23),
  ('outro',        'Outro',               '#9ca3af', 99)
on conflict (slug) do nothing;

-- Coluna nova: origem_id (compatível com origem enum legado)
alter table receitas_brutas
  add column if not exists origem_id uuid references origens_receita(id);

create index if not exists idx_receitas_origem_id on receitas_brutas(origem_id);

-- Backfill: liga receitas existentes à nova tabela pelo slug
update receitas_brutas r
set origem_id = o.id
from origens_receita o
where r.origem_id is null
  and o.slug = r.origem::text;

-- RLS
alter table origens_receita enable row level security;

create policy "active_users_read_origens"
  on origens_receita for select
  using (is_active_user());

create policy "writers_write_origens"
  on origens_receita for all
  using (can_write())
  with check (can_write());

-- Trigger pra atualizar atualizado_em
create or replace function trg_origens_receita_updated_at()
returns trigger as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_origens_receita_updated_at on origens_receita;
create trigger trg_origens_receita_updated_at
  before update on origens_receita
  for each row execute function trg_origens_receita_updated_at();
