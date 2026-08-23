-- ============================================================================
-- ACL GESTIÓN HÍDRICA — SPOKE PUCUSANA
-- Migración 0006 — TEMPORAL / SOLO DESARROLLO
--
-- ⚠️ Este archivo abre lectura a usuarios sin sesión (rol 'anon') para poder
-- probar el frontend ANTES de tener login implementado. NO debe existir en
-- producción: cualquiera con la anon key podría leer datos operativos.
--
-- Cuando el login (Sesión de Auth) esté listo, ejecutar 0007_revert...sql
-- (o simplemente hacer DROP POLICY de cada una de estas) antes de ir a
-- producción o de compartir el proyecto más allá de pruebas locales.
-- ============================================================================

create policy temp_dev_wells_select_anon
  on public.wells for select
  to anon
  using (true);

create policy temp_dev_parameters_select_anon
  on public.parameters for select
  to anon
  using (true);

create policy temp_dev_well_parameters_select_anon
  on public.well_parameters for select
  to anon
  using (true);

create policy temp_dev_readings_select_anon
  on public.readings for select
  to anon
  using (true);
