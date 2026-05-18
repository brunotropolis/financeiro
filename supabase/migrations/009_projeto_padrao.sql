-- ════════════════════════════════════════════════════════════════════════════
-- Migration 009 — projeto_padrao_id em origens_receita e categorias
-- ════════════════════════════════════════════════════════════════════════════
--
-- Permite vincular um projeto "default" a uma origem ou categoria. No form,
-- quando o usuário escolhe a origem/categoria, o projeto correspondente é
-- pré-selecionado (pode sobrescrever manualmente).
--
-- Ex: origem=greenn → Manual do Recém-Nascido
--     categoria=Anúncio → Manual do Recém-Nascido

alter table origens_receita
  add column if not exists projeto_padrao_id uuid references projetos(id);

alter table categorias
  add column if not exists projeto_padrao_id uuid references projetos(id);

create index if not exists idx_origens_projeto_padrao on origens_receita(projeto_padrao_id);
create index if not exists idx_categorias_projeto_padrao on categorias(projeto_padrao_id);

-- Set default: Greenn e Anúncio → Manual do Recém-Nascido
update origens_receita
  set projeto_padrao_id = (select id from projetos where slug = 'manual_recem_nascido')
  where slug = 'greenn';

update categorias
  set projeto_padrao_id = (select id from projetos where slug = 'manual_recem_nascido')
  where nome = 'Anúncio';
