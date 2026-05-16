-- ════════════════════════════════════════════════════════════════════════════
-- Migration 005 — Saldos Greenn (snapshot manual via Claude Vision)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Bruno cola print da carteira Greenn na tela /receitas → Claude Haiku Vision
-- extrai os 3 valores → salva aqui. UI mostra sempre o mais recente.

create table if not exists greenn_saldos (
  id uuid primary key default uuid_generate_v4(),
  disponivel numeric(14,2) not null,
  pendente numeric(14,2) not null,
  antecipavel numeric(14,2) not null,
  capturado_em timestamptz not null default now(),
  created_by uuid references profiles(id)
);

create index if not exists idx_greenn_saldos_capturado_em
  on greenn_saldos(capturado_em desc);

alter table greenn_saldos enable row level security;

create policy "active_users_read_greenn_saldos"
  on greenn_saldos for select
  using (is_active_user());

create policy "active_users_write_greenn_saldos"
  on greenn_saldos for insert
  with check (is_active_user());

-- View útil: pega só o mais recente
create or replace view v_greenn_saldo_atual as
select * from greenn_saldos order by capturado_em desc limit 1;

grant select on v_greenn_saldo_atual to authenticated;
