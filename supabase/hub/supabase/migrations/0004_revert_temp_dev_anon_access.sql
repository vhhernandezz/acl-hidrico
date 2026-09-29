-- ============================================================================
-- ACL GESTIÓN HÍDRICA — HUB CORPORATIVO
-- Migración 0004 — revierte el acceso temporal de la migración 0003.
-- Ejecutada en la Sesión 5-A.
-- ============================================================================

drop policy if exists temp_dev_plantas_select_anon on public.plantas;
drop policy if exists temp_dev_alarmas_select_anon on public.alarmas_activas;
drop policy if exists temp_dev_alarmas_acknowledge_anon on public.alarmas_activas;
