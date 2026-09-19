-- ============================================================================
-- ACL GESTIÓN HÍDRICA — SPOKE PUCUSANA
-- Migración 0019 — revierte la migración 0018.
-- Ejecutar en cuanto el login (Supabase Auth) esté funcionando en Pucusana.
-- ============================================================================

drop policy if exists temp_dev_model_projections_write_anon on public.model_projections;
drop policy if exists temp_dev_model_projections_update_anon on public.model_projections;
