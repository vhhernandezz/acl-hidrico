-- ============================================================================
-- ACL GESTIÓN HÍDRICA — SPOKE PUCUSANA
-- Migración 0015 — revierte la migración 0014 (escritura anon de umbrales).
-- Ejecutada en la Sesión 5-A.
-- ============================================================================

drop policy if exists temp_dev_well_parameters_write_anon on public.well_parameters;
drop policy if exists temp_dev_well_parameters_update_anon on public.well_parameters;
