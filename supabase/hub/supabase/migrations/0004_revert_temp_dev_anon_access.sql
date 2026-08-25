-- ============================================================================
-- ACL GESTIÓN HÍDRICA — HUB CORPORATIVO
-- Migración 0004 — revierte el acceso temporal de la migración 0003.
-- Ejecutar en cuanto el login (Supabase Auth) esté funcionando en el Hub.
-- ============================================================================

drop policy if exists temp_dev_plantas_select_anon on public.plantas;
drop policy if exists temp_dev_alarmas_select_anon on public.alarmas_activas;
drop policy if exists temp_dev_alarmas_acknowledge_anon on public.alarmas_activas;
