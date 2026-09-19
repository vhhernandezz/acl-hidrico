-- ============================================================================
-- ACL GESTIÓN HÍDRICA — SPOKE PUCUSANA
-- Migración 0018 — TEMPORAL / SOLO DESARROLLO
-- Permite insertar/actualizar 'model_projections' sin sesión (rol 'anon'),
-- para poder probar el componente web de carga (Sesión 4-C) antes de que
-- exista login. El script Python usa service_role y no necesita esto.
--
-- ⚠️ Revertir con 0019 en cuanto exista Auth real.
-- ============================================================================

create policy temp_dev_model_projections_write_anon
  on public.model_projections for insert
  to anon
  with check (true);

create policy temp_dev_model_projections_update_anon
  on public.model_projections for update
  to anon
  using (true)
  with check (true);
