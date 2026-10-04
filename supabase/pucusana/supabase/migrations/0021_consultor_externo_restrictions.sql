-- ============================================================================
-- ACL GESTIÓN HÍDRICA — SPOKE PUCUSANA
-- Migración 0021: ajustes de RLS para el nuevo rol 'consultor_externo'.
-- Sesión 5-C. Ejecutar DESPUÉS de la 0020.
--
-- 'consultor_externo' ya NO tiene acceso de escritura a nada (las
-- funciones is_admin_or_director() / can_write_operational_data() no lo
-- incluyen, así que las políticas de escritura existentes ya lo excluyen
-- automáticamente). Lo único que había que cerrar explícitamente es la
-- LECTURA de 'well_parameters' (umbrales de configuración), que hasta
-- ahora era legible por cualquier usuario autenticado.
--
-- 'dataloggers' ya estaba restringido a admin/director_tecnico desde el
-- esquema original — consultor_externo ya no lo veía, no requiere cambio.
-- ============================================================================

drop policy if exists well_parameters_select_authenticated on public.well_parameters;

create policy well_parameters_select_internal
  on public.well_parameters for select
  to authenticated
  using (public.current_user_role() <> 'consultor_externo');

comment on policy well_parameters_select_internal on public.well_parameters is
  'Lectura de umbrales para todo el personal interno. consultor_externo queda excluido explícitamente (Sesión 5-C): no debe ver configuración operativa.';
