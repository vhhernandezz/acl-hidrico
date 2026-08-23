-- ============================================================================
-- ACL GESTIÓN HÍDRICA — SPOKE PUCUSANA
-- Migración 0009: agrega al catálogo los parámetros que envía el datalogger.
-- ============================================================================

insert into public.parameters (code, name, category, unit, description, is_active) values
  ('CE',        'Conductividad Eléctrica',        'intrusion_salina', 'µS/cm', 'Medición continua de conductividad eléctrica desde datalogger.', true),
  ('NIVEL_AGUA','Nivel de Agua (telemetría)',      'nivel',            'm',     'Nivel de agua medido continuamente por datalogger, sin distinguir si la bomba está encendida (a diferencia de NIVEL_ESTATICO/NIVEL_DINAMICO, que son medidas puntuales manuales).', true)
on conflict (code) do nothing;
