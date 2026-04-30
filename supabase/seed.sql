-- ════════════════════════════════════════════════════════════════════════════
-- FINANCEIRO — Seed inicial
-- Roda APÓS schema.sql
--
-- Inclui:
--   • 5 entidades (PF Bruno, PF Day, Manual RN, Dream Baby, MRN Serviços)
--   • 10 contas bancárias
--   • 1 cartão de crédito (Unicred MRN)
--   • 20 categorias iniciais
-- ════════════════════════════════════════════════════════════════════════════

-- ─── ENTIDADES ──────────────────────────────────────────────────────────────
insert into entidades (id, nome, tipo, razao_social, cor_hex, ordem) values
  (uuid_generate_v4(), 'Bruno Sampaio',                   'PF', 'Bruno Sampaio de Souza Dias',          '#3b82f6', 1),
  (uuid_generate_v4(), 'Dayane dos Anjos',                'PF', 'Dayane dos Anjos',                     '#ec4899', 2),
  (uuid_generate_v4(), 'Manual do Recém-Nascido',         'PJ', 'Manual do Recém-Nascido LTDA',         '#10b981', 3),
  (uuid_generate_v4(), 'Dream Baby',                      'PJ', 'Dream Baby LTDA',                      '#f59e0b', 4),
  (uuid_generate_v4(), 'MRN Serviços Digitais',           'PJ', 'MRN Serviços Digitais',                '#8b5cf6', 5);

-- ─── CONTAS BANCÁRIAS ───────────────────────────────────────────────────────
insert into contas_bancarias (entidade_id, nome, banco, tipo, conta_principal, cor_hex, ordem) values
  -- Manual do Recém-Nascido
  ((select id from entidades where nome = 'Manual do Recém-Nascido'), 'Manual RN — Unicred',          'Unicred',         'corrente', true,  '#10b981', 1),
  ((select id from entidades where nome = 'Manual do Recém-Nascido'), 'Manual RN — PayPal',           'PayPal',          'digital',  false, '#0070ba', 2),
  ((select id from entidades where nome = 'Manual do Recém-Nascido'), 'Manual RN — Banco do Brasil',  'Banco do Brasil', 'corrente', false, '#fbbf24', 3),
  ((select id from entidades where nome = 'Manual do Recém-Nascido'), 'Manual RN — Mercado Pago',     'Mercado Pago',    'digital',  false, '#00b1ea', 4),
  -- Dream Baby
  ((select id from entidades where nome = 'Dream Baby'),              'Dream Baby — Unicred',         'Unicred',         'corrente', true,  '#f59e0b', 5),
  ((select id from entidades where nome = 'Dream Baby'),              'Dream Baby — Inter',           'Banco Inter',     'digital',  false, '#ff7a00', 6),
  -- MRN Serviços Digitais
  ((select id from entidades where nome = 'MRN Serviços Digitais'),   'MRN Serviços — Inter',         'Banco Inter',     'digital',  true,  '#ff7a00', 7),
  ((select id from entidades where nome = 'MRN Serviços Digitais'),   'MRN Serviços — Conta Simples', 'Conta Simples',   'prepaga',  false, '#a855f7', 8),
  -- PF Bruno
  ((select id from entidades where nome = 'Bruno Sampaio'),           'Bruno — C6',                   'C6 Bank',         'digital',  true,  '#1f2937', 9),
  -- PF Day
  ((select id from entidades where nome = 'Dayane dos Anjos'),        'Day — C6',                     'C6 Bank',         'digital',  true,  '#1f2937', 10);

-- ─── CARTÃO DE CRÉDITO (1) ──────────────────────────────────────────────────
insert into cartoes_credito (entidade_id, nome, bandeira, dia_fechamento, dia_vencimento, conta_pagamento_id, cor_hex, ordem) values
  ((select id from entidades where nome = 'Manual do Recém-Nascido'),
   'Unicred — Manual RN',
   'master',
   3,
   10,
   (select id from contas_bancarias where nome = 'Manual RN — Unicred'),
   '#10b981',
   1);

-- ─── CATEGORIAS ─────────────────────────────────────────────────────────────
-- Despesas (raiz)
insert into categorias (nome, tipo, cor_hex, icone, ordem) values
  ('Pessoais',            'despesa', '#ec4899', 'user',           1),
  ('Ferramentas',         'despesa', '#3b82f6', 'wrench',         2),
  ('Anúncio',             'despesa', '#8b5cf6', 'megaphone',      3),
  ('Jurídico',            'despesa', '#dc2626', 'scale',          4),
  ('Salários',            'despesa', '#f59e0b', 'users',          5),
  ('Impostos',            'despesa', '#991b1b', 'landmark',       6),
  ('Aluguel/Infra',       'despesa', '#06b6d4', 'building',       7),
  ('Contador',            'despesa', '#0891b2', 'calculator',     8),
  ('Marketing',           'despesa', '#a855f7', 'sparkles',       9),
  ('Educação',            'despesa', '#10b981', 'graduation-cap', 10),
  ('Saúde',               'despesa', '#ef4444', 'heart-pulse',    11),
  ('Mercado',             'despesa', '#84cc16', 'shopping-cart',  12),
  ('Transporte',          'despesa', '#0ea5e9', 'car',            13),
  ('Lazer',               'despesa', '#f97316', 'gamepad-2',      14),
  ('Outros',              'despesa', '#6b7280', 'circle',         99);

-- Receitas (raiz)
insert into categorias (nome, tipo, cor_hex, icone, ordem) values
  ('Receita — Vendas',       'receita', '#10b981', 'shopping-bag',  101),
  ('Receita — Afiliados',    'receita', '#06b6d4', 'link',          102),
  ('Receita — Publis',       'receita', '#a855f7', 'megaphone',     103),
  ('Receita — AdSense',      'receita', '#f59e0b', 'youtube',       104),
  ('Receita — Palestras',    'receita', '#ec4899', 'mic',           105),
  ('Receita — Consultorias', 'receita', '#3b82f6', 'briefcase',     106),
  ('Receita — Outros',       'receita', '#6b7280', 'circle',        199);

-- ════════════════════════════════════════════════════════════════════════════
-- FIM DO SEED
-- ════════════════════════════════════════════════════════════════════════════

-- Conferência rápida
select 'Entidades:' as resumo, count(*) as total from entidades
union all select 'Contas:',  count(*) from contas_bancarias
union all select 'Cartões:', count(*) from cartoes_credito
union all select 'Categorias:', count(*) from categorias;
