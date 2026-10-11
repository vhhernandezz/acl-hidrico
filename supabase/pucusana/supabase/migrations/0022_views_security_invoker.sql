-- ============================================================================
-- ACL GESTIÓN HÍDRICA — SPOKE PUCUSANA
-- Migración 0022: las vistas respetan el RLS de quien consulta.
-- Sesión 5-C. Ejecutar DESPUÉS de la 0021.
--
-- Problema: por defecto, una vista en Postgres se ejecuta con los permisos
-- de su DUEÑO, no del usuario que la consulta — así que ignora el RLS de
-- las tablas subyacentes. 'operator_kpi_status' hace LEFT JOIN a
-- 'well_parameters' (umbrales), por lo que podía devolverle los umbrales a
-- un consultor_externo aunque la tabla directa se los bloquee (0021).
-- Los comentarios de las migraciones 0010 y 0012 decían que estas vistas
-- "heredan RLS de las tablas subyacentes": eso era incorrecto sin esta
-- opción.
--
-- security_invoker = true hace que la vista use los permisos y el RLS del
-- usuario que la consulta. Requiere PostgreSQL 15 o superior. Si este
-- comando da error de sintaxis, tu versión es anterior: avisar antes de
-- seguir, no ejecutar nada más a ciegas.
-- ============================================================================

alter view public.latest_readings_status set (security_invoker = true);
alter view public.operator_kpi_status set (security_invoker = true);
