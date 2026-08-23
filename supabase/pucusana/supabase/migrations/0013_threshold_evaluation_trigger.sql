-- ============================================================================
-- ACL GESTIÓN HÍDRICA — SPOKE PUCUSANA
-- Migración 0013: función + trigger que evalúa cada lectura nueva contra
-- los umbrales de 'well_parameters' y gestiona el ciclo de vida en 'alerts'.
-- Sesión 3-A.
--
-- Comportamiento:
--  - Si el pozo+parámetro no tiene umbrales definidos (well_parameters
--    ausente, no monitoreado, o ambos thresholds NULL) → no hace nada.
--  - Si el valor NO cruza ningún umbral (normal) → si había una alerta
--    abierta para ese pozo+parámetro, la resuelve automáticamente
--    (status='resuelta'), porque el valor volvió a la normalidad.
--  - Si el valor SÍ cruza un umbral (atencion/critica):
--      - Si no hay alerta abierta → crea una nueva.
--      - Si ya hay una abierta con la MISMA severidad → no duplica
--        (evita spam: una lectura crítica cada minuto no crea 60 alertas).
--      - Si ya hay una abierta con OTRA severidad (escaló o bajó entre
--        atención/crítica) → actualiza esa misma alerta en vez de crear
--        una nueva (una alerta activa por pozo+parámetro, no varias).
-- ============================================================================

create or replace function public.evaluate_reading_threshold()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  wp record;
  new_severity public.alert_severity;
  existing record;
  v_well_code text;
  v_param_name text;
  v_param_unit text;
  v_threshold_ref numeric;
  v_message text;
begin
  select threshold_warning, threshold_critical, direction
  into wp
  from well_parameters
  where well_id = new.well_id
    and parameter_id = new.parameter_id
    and is_monitored = true;

  if not found then
    return new; -- no está configurado como monitoreado con umbrales
  end if;

  if wp.threshold_warning is null and wp.threshold_critical is null then
    return new; -- monitoreado, pero sin umbrales numéricos aún (ej. NIVEL_AGUA hoy)
  end if;

  -- Severidad del valor actual, según dirección del umbral
  if wp.direction = 'below' then
    if wp.threshold_critical is not null and new.value <= wp.threshold_critical then
      new_severity := 'critica';
    elsif wp.threshold_warning is not null and new.value <= wp.threshold_warning then
      new_severity := 'atencion';
    else
      new_severity := null;
    end if;
  else -- 'above' (default)
    if wp.threshold_critical is not null and new.value >= wp.threshold_critical then
      new_severity := 'critica';
    elsif wp.threshold_warning is not null and new.value >= wp.threshold_warning then
      new_severity := 'atencion';
    else
      new_severity := null;
    end if;
  end if;

  -- Alerta abierta más reciente para este pozo+parámetro (si existe)
  select * into existing
  from alerts
  where well_id = new.well_id
    and parameter_id = new.parameter_id
    and status in ('abierta', 'reconocida')
  order by created_at desc
  limit 1;

  -- Caso: valor normal → resolver alerta abierta si la había
  if new_severity is null then
    if existing.id is not null then
      update alerts
      set status = 'resuelta', resolved_at = now()
      where id = existing.id;
    end if;
    return new;
  end if;

  -- Caso: hay condición de alerta → arma el mensaje
  select w.code, p.name, p.unit
  into v_well_code, v_param_name, v_param_unit
  from wells w, parameters p
  where w.id = new.well_id and p.id = new.parameter_id;

  v_threshold_ref := case when new_severity = 'critica' then wp.threshold_critical else wp.threshold_warning end;
  v_message := format('%s en %s: %s %s (umbral %s: %s %s)',
                       v_param_name, v_well_code, new.value, v_param_unit,
                       new_severity, v_threshold_ref, v_param_unit);

  if existing.id is null then
    -- No había alerta abierta: crear una nueva
    insert into alerts (well_id, parameter_id, reading_id, severity, status, message, triggered_value)
    values (new.well_id, new.parameter_id, new.id, new_severity, 'abierta', v_message, new.value);

  elsif existing.severity <> new_severity then
    -- Ya había una abierta pero cambió de severidad (escaló o bajó): actualizarla
    update alerts
    set severity = new_severity,
        reading_id = new.id,
        triggered_value = new.value,
        message = v_message
    where id = existing.id;

  end if;
  -- si existing.severity = new_severity: no se hace nada (evita duplicados)

  return new;
end;
$$;

comment on function public.evaluate_reading_threshold() is
  'Evalúa cada lectura nueva contra los umbrales de well_parameters y gestiona el ciclo de vida (crear/actualizar/resolver) en alerts. Sesión 3-A.';

create trigger trg_evaluate_reading_threshold
  after insert on public.readings
  for each row execute function public.evaluate_reading_threshold();
