-- ============================================================================
-- ACL GESTIÓN HÍDRICA — SPOKE PUCUSANA
-- Migración 0016: tabla 'model_projections' — proyecciones del modelo de
-- intrusión salina (u otros modelos futuros), con múltiples escenarios
-- por fecha. Sesión 4-A.
--
-- Diseño flexible a propósito, porque el estudio hidrogeológico que
-- alimentará esta tabla todavía no se ha hecho:
--   - 'model_name' permite versionar/tener más de un modelo en el tiempo.
--   - 'scenario' no es un enum rígido (texto libre con check de 3 valores
--     iniciales) para no bloquear si más adelante se necesita un cuarto
--     escenario.
--   - 'projection_date' es una fecha simple, sirve igual para granularidad
--     mensual, trimestral o anual — la granularidad la define Victor al
--     cargar los datos, no la estructura de la tabla.
-- ============================================================================

create table public.model_projections (
  id               uuid primary key default gen_random_uuid(),
  well_id          uuid not null references public.wells (id) on delete cascade,
  parameter_id     uuid not null references public.parameters (id) on delete cascade,
  model_name       text not null default 'intrusion_salina_v1',
  scenario         text not null check (scenario in ('optimista', 'base', 'pesimista')),
  projection_date  date not null,
  projected_value  numeric not null,
  notes            text,
  created_by       uuid references public.profiles (id),
  created_at       timestamptz not null default now(),
  unique (well_id, parameter_id, model_name, scenario, projection_date)
);

comment on table public.model_projections is 'Proyecciones de un modelo (ej. intrusión salina) por pozo, parámetro, escenario y fecha. Estructura previa al estudio hidrogeológico formal — valores se cargan cuando estén disponibles.';
comment on column public.model_projections.scenario is 'optimista/base/pesimista — la banda de incertidumbre del gráfico se calcula como el rango entre optimista y pesimista en cada fecha; "base" es la línea central proyectada.';

create index idx_model_projections_lookup
  on public.model_projections (well_id, parameter_id, model_name, projection_date);

alter table public.model_projections enable row level security;

create policy model_projections_select_authenticated
  on public.model_projections for select
  to authenticated
  using (true);

create policy model_projections_write_admin_director
  on public.model_projections for insert
  to authenticated
  with check (public.is_admin_or_director());

create policy model_projections_update_admin_director
  on public.model_projections for update
  to authenticated
  using (public.is_admin_or_director())
  with check (public.is_admin_or_director());

create policy model_projections_delete_admin_only
  on public.model_projections for delete
  to authenticated
  using (public.current_user_role() = 'admin');

-- Acceso temporal de solo lectura para 'anon', mismo patrón ya usado en
-- 0006 (esa migración no cubre esta tabla porque no existía todavía).
create policy temp_dev_model_projections_select_anon
  on public.model_projections for select
  to anon
  using (true);
