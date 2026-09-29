-- ============================================================================
-- ACL GESTIÓN HÍDRICA — SPOKE PUCUSANA
-- Migración 0017 — revierte la lectura temporal anon de la migración 0016.
-- Ejecutada en la Sesión 5-A.
-- ============================================================================

drop policy if exists temp_dev_model_projections_select_anon on public.model_projections;
