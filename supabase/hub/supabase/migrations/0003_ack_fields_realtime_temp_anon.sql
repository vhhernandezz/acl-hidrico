-- ============================================================================
-- ACL GESTIÓN HÍDRICA — HUB CORPORATIVO
-- Migración 0003: agrega campos de reconocimiento a 'alarmas_activas',
-- habilita Realtime sobre esa tabla, y una política TEMPORAL de acceso
-- anon (lectura + reconocimiento) mientras no exista login en el Hub.
-- Sesión 3-B.
--
-- ⚠️ TEMPORAL: mismo patrón ya aceptado en Pucusana (migración 0006/0007
-- del spoke). Revertir con el bloque final de este archivo (o un archivo
-- 0004 de reversión) en cuanto exista Auth real en el Hub.
-- ============================================================================

alter table public.alarmas_activas
  add column acknowledged_at timestamptz,
  add column acknowledged_by uuid references public.profiles (id);

comment on column public.alarmas_activas.acknowledged_at is 'Momento en que se reconoció la alarma (botón "Reconocer" del panel). NULL = sin reconocer.';

alter publication supabase_realtime add table public.alarmas_activas;

-- Acceso temporal para poder probar el panel sin login todavía.
create policy temp_dev_plantas_select_anon
  on public.plantas for select
  to anon
  using (true);

create policy temp_dev_alarmas_select_anon
  on public.alarmas_activas for select
  to anon
  using (true);

-- Solo permite marcar como reconocida (no borrar ni reabrir), para acotar
-- el riesgo de esta política temporal tanto como sea razonable.
create policy temp_dev_alarmas_acknowledge_anon
  on public.alarmas_activas for update
  to anon
  using (status = 'abierta')
  with check (status = 'reconocida');
