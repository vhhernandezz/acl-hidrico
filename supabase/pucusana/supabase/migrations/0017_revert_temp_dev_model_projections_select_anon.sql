-- ============================================================================
-- ACL GESTIÓN HÍDRICA — SPOKE PUCUSANA
-- Migración 0017 — revierte la lectura temporal anon de la migración 0016.
-- Ejecutar en cuanto el login (Supabase Auth) esté funcionando en Pucusana.
-- ============================================================================

drop policy if exists temp_dev_model_projections_select_anon on public.model_projections;
