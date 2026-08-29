-- ============================================================================
-- ACL GESTIÓN HÍDRICA — SPOKE PUCUSANA
-- Migración 0014 — TEMPORAL / SOLO DESARROLLO
-- Permite insertar/actualizar 'well_parameters' sin sesión (rol 'anon'),
-- para poder probar el Configurador de Umbrales (Sesión 3-C) antes de que
-- exista login. Mismo patrón ya aceptado en Pucusana (0006) y Hub (0003).
--
-- ⚠️ Revertir con 0015 en cuanto exista Auth real y los roles
-- admin/director_tecnico se puedan verificar de verdad.
-- ============================================================================

create policy temp_dev_well_parameters_write_anon
  on public.well_parameters for insert
  to anon
  with check (true);

create policy temp_dev_well_parameters_update_anon
  on public.well_parameters for update
  to anon
  using (true)
  with check (true);
