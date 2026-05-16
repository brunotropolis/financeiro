-- Migration 006 — Adiciona Magalu Afiliados como origem de receita
alter type origem_receita add value if not exists 'magalu_aff';
