-- ============================================================================
-- ACL GESTIÓN HÍDRICA — HUB CORPORATIVO
-- Migración 0002: seed del catálogo 'plantas' (nunca se sembró desde el
-- esquema original). Necesario para el filtro por planta del panel de
-- alarmas (Sesión 3-B).
--
-- Solo Pucusana está realmente conectada (sync_enabled=true); las otras 5
-- se registran como referencia pero sin sincronización activa todavía.
-- ============================================================================

insert into public.plantas (code, name, region, spoke_project_ref, is_active, sync_enabled) values
  ('PUC', 'Pucusana',     'Lima',   'scusoatcibtimfuheftx', true, true),
  ('ARE', 'Arequipa',     'Arequipa', null, true, false),
  ('CUS', 'Cusco',        'Cusco',    null, true, false),
  ('IQU', 'Iquitos',      'Loreto',   null, true, false),
  ('TRU', 'Trujillo',     'La Libertad', null, true, false),
  ('ZAR', 'Zárate / Lima','Lima',     null, true, false)
on conflict (code) do nothing;
