-- ============================================================================
-- ACL GESTIÓN HÍDRICA — SPOKE PUCUSANA
-- Migración 0012: siembra umbrales operativos en 'well_parameters' para
-- TDS, CAUDAL_EXTRACCION y NIVEL_AGUA, y crea la vista 'operator_kpi_status'
-- que combina la última lectura (latest_readings_status, Sesión 1-D) con
-- esos umbrales. Base de las tarjetas KPI del operador (Sesión 2-C).
-- ============================================================================

-- TDS: límite acordado temporalmente = 25,000 mg/L, alarma de atención al 75% (18,750 mg/L).
-- Se usa TDS en vez de CE por decisión de Victor: son parámetros relacionados
-- pero de unidades distintas: la conversión CE↔TDS depende de un factor
-- específico del acuífero que aún no está definido. Cuando se defina, se
-- puede migrar este umbral a CE sin tocar la lógica de la tarjeta.
insert into public.well_parameters (well_id, parameter_id, threshold_warning, threshold_critical, direction, is_monitored)
select w.id, p.id, 18750, 25000, 'above', true
from public.wells w, public.parameters p
where p.code = 'TDS'
on conflict (well_id, parameter_id) do update set
  threshold_warning = excluded.threshold_warning,
  threshold_critical = excluded.threshold_critical,
  direction = excluded.direction;

-- CAUDAL_EXTRACCION: atención al superar el caudal habitual declarado por
-- pozo; crítico al superar la capacidad nominal de la bomba (riesgo de
-- sobreextracción / daño al equipo). Umbrales específicos por pozo, tomados
-- de wells.caudal_habitual_m3h / wells.capacidad_nominal_bomba_m3h.
insert into public.well_parameters (well_id, parameter_id, threshold_warning, threshold_critical, direction, is_monitored)
select w.id, p.id, w.caudal_habitual_m3h, w.capacidad_nominal_bomba_m3h, 'above', true
from public.wells w, public.parameters p
where p.code = 'CAUDAL_EXTRACCION'
on conflict (well_id, parameter_id) do update set
  threshold_warning = excluded.threshold_warning,
  threshold_critical = excluded.threshold_critical,
  direction = excluded.direction;

-- NIVEL_AGUA: se registra como monitoreado (dirección 'above' = un valor
-- mayor, napa más profunda, es la situación de alerta), pero SIN umbrales
-- numéricos todavía — pendiente de definición técnica. La tarjeta debe
-- mostrar 'sin_umbral' hasta que se actualicen threshold_warning/critical.
insert into public.well_parameters (well_id, parameter_id, threshold_warning, threshold_critical, direction, is_monitored)
select w.id, p.id, null, null, 'above', true
from public.wells w, public.parameters p
where p.code = 'NIVEL_AGUA'
on conflict (well_id, parameter_id) do update set
  direction = excluded.direction;

-- Vista combinada: última lectura + umbrales operativos, para las tarjetas KPI.
create or replace view public.operator_kpi_status as
select
  lrs.well_id,
  lrs.well_code,
  lrs.well_name,
  lrs.parameter_id,
  lrs.parameter_code,
  lrs.parameter_name,
  lrs.parameter_unit,
  lrs.parameter_category,
  lrs.expected_frequency_hours,
  lrs.value,
  lrs.recorded_at,
  lrs.source,
  wp.threshold_warning,
  wp.threshold_critical,
  wp.direction
from public.latest_readings_status lrs
left join public.well_parameters wp
  on wp.well_id = lrs.well_id and wp.parameter_id = lrs.parameter_id;

comment on view public.operator_kpi_status is
  'Última lectura por pozo+parámetro combinada con sus umbrales operativos (well_parameters). Base de las tarjetas KPI del operador (Sesión 2-C).';
