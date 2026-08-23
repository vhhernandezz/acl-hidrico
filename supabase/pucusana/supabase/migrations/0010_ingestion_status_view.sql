-- ============================================================================
-- ACL GESTIÓN HÍDRICA — SPOKE PUCUSANA
-- Migración 0010: agrega frecuencia esperada por parámetro (para calcular
-- el semáforo de recencia) y crea la vista 'latest_readings_status' con
-- la última lectura por pozo+parámetro. Sesión 1-D.
-- ============================================================================

alter table public.parameters
  add column expected_frequency_hours integer;

comment on column public.parameters.expected_frequency_hours is
  'Cada cuántas horas se espera al menos una lectura de este parámetro. NULL = sin umbral definido (no se evalúa recencia). Ajustable con UPDATE según la operación real.';

-- Valores por defecto razonables, AJUSTABLES:
update public.parameters set expected_frequency_hours = 1   where code in ('CE', 'NIVEL_AGUA');           -- telemetría de datalogger, ~continua
update public.parameters set expected_frequency_hours = 24  where code = 'CAUDAL_EXTRACCION';               -- ingreso manual esperado a diario
update public.parameters set expected_frequency_hours = 720 where code in (
  'CLORUROS','SULFATOS','TDS','N_NITRATOS','SODIO','CALCIO','TURBIDEZ','PH','SELENIO_TOTAL',
  'NIVEL_ESTATICO','NIVEL_DINAMICO'
); -- monitoreo/laboratorio mensual (~30 días)

-- Vista: última lectura recibida por pozo + parámetro (para el panel de estado)
create or replace view public.latest_readings_status as
select distinct on (r.well_id, r.parameter_id)
  r.well_id,
  w.code as well_code,
  w.name as well_name,
  r.parameter_id,
  p.code as parameter_code,
  p.name as parameter_name,
  p.unit as parameter_unit,
  p.category as parameter_category,
  p.expected_frequency_hours,
  r.value,
  r.recorded_at,
  r.source
from public.readings r
join public.wells w on w.id = r.well_id
join public.parameters p on p.id = r.parameter_id
order by r.well_id, r.parameter_id, r.recorded_at desc;

comment on view public.latest_readings_status is
  'Última lectura recibida por combinación pozo+parámetro. Base para el semáforo de recencia del panel de ingesta (Sesión 1-D). Hereda RLS de las tablas subyacentes (readings/wells/parameters).';
