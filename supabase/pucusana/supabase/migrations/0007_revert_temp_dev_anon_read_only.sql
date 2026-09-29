-- ============================================================================
-- ACL GESTIÓN HÍDRICA — SPOKE PUCUSANA
-- Migración 0007 — revierte la política temporal de la migración 0006.
-- Ejecutada en la Sesión 5-A: Pucusana deja de ser legible sin autenticación.
-- ============================================================================

drop policy if exists temp_dev_wells_select_anon on public.wells;
drop policy if exists temp_dev_parameters_select_anon on public.parameters;
drop policy if exists temp_dev_well_parameters_select_anon on public.well_parameters;
drop policy if exists temp_dev_readings_select_anon on public.readings;
