-- Molde v1 — Missões Tech / Agendamento de espaços
-- Migration 20260816000001: extensions_and_private_schema
-- Extraído de docs/arquitetura-agendamento.md (backend-master, 2026-08-15)
-- Aprovação de stack: docs/decisoes.md, 2026-08-16 (Thiago)

create schema if not exists private;
revoke all on schema private from anon, authenticated, public;
grant usage on schema private to authenticated;   -- necessário para EXECUTE nas policies

create extension if not exists btree_gist with schema extensions;

