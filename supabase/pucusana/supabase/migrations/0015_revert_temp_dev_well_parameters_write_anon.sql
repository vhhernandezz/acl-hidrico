-- ============================================================================
-- ACL GESTIÓN HÍDRICA — SPOKE PUCUSANA
-- Migración 0015 — revierte la migración 0014.
-- Ejecutar en cuanto el login (Supabase Auth) esté funcionando en Pucusana.
-- ============================================================================

drop policy if exists temp_dev_well_parameters_write_anon on public.well_parameters;
drop policy if exists temp_dev_well_parameters_update_anon on public.well_parameters;
