-- ============================================================================
-- ACL GESTIÓN HÍDRICA — SPOKE PUCUSANA
-- Migración 0019 — revierte la migración 0018 (escritura anon del cargador
-- web de proyecciones). Ejecutada en la Sesión 5-A.
-- ============================================================================

drop policy if exists temp_dev_model_projections_write_anon on public.model_projections;
drop policy if exists temp_dev_model_projections_update_anon on public.model_projections;
