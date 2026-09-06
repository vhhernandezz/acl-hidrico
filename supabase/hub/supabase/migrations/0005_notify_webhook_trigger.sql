-- ============================================================================
-- ACL GESTIÓN HÍDRICA — HUB CORPORATIVO
-- Migración 0005: alternativa al Database Webhook del Dashboard (que falló
-- con "schema supabase_functions does not exist", bug conocido de Supabase).
-- Crea el mismo efecto directamente con un trigger + pg_net.http_post.
-- Sesión 3-D.
--
-- IMPORTANTE: la línea 'x-webhook-secret' de la función abajo tiene un
-- PLACEHOLDER ('REEMPLAZA_AQUI_TU_WEBHOOK_SECRET'). Al ejecutar esta
-- migración en el SQL Editor, reemplázalo por tu WEBHOOK_SECRET real
-- ANTES de correrlo — pero NO guardes esa versión con el valor real de
-- vuelta en este archivo del repo. El archivo commiteado se queda con el
-- placeholder; el valor real solo existe pegado una vez en el SQL Editor.
-- ============================================================================

create extension if not exists pg_net with schema extensions;

create or replace function public.trigger_notify_critical_alarm()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url := 'https://ujkpibiqkyddpostktyl.supabase.co/functions/v1/notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', 'REEMPLAZA_AQUI_TU_WEBHOOK_SECRET'
    ),
    body := jsonb_build_object(
      'type', tg_op,
      'table', 'alarmas_activas',
      'schema', 'public',
      'record', to_jsonb(new),
      'old_record', case when tg_op = 'UPDATE' then to_jsonb(old) else null end
    )
  );

  return new;
end;
$$;

comment on function public.trigger_notify_critical_alarm() is
  'Reemplaza al Database Webhook del Dashboard (falló por bug de Supabase). Llama a la Edge Function notify vía pg_net con el mismo formato de payload que hubiera usado el webhook nativo.';

create trigger trg_notify_critical_alarm
  after insert or update on public.alarmas_activas
  for each row execute function public.trigger_notify_critical_alarm();
