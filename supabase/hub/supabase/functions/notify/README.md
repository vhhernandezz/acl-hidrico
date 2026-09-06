# notify (Edge Function — Hub)

Envía un email vía Resend cuando una fila de `alarmas_activas` **se vuelve** crítica (no cuando ya lo era — evita spam al reconocer alarmas).

## 1. Crea tu cuenta de Resend

1. Ve a https://resend.com y crea una cuenta gratuita (3,000 emails/mes).
2. En el dashboard de Resend, ve a **API Keys** → crea una nueva → cópiala (empieza con `re_...`).
3. **Importante sobre remitentes:** sin verificar un dominio propio, Resend solo permite enviar usando `onboarding@resend.dev` como remitente, y **verifica en su documentación actual** si en tu plan puedes enviar a cualquier destinatario o solo al correo con el que te registraste — esta restricción puede variar. Si al probar el correo no llega, esa es la primera sospecha.

## 2. Configura los secrets en el proyecto Supabase del HUB

```bash
cd supabase/hub
supabase secrets set RESEND_API_KEY=re_tu_api_key --project-ref <tu-project-ref-del-hub>
supabase secrets set NOTIFY_EMAIL_TO=tu-correo@ejemplo.com --project-ref <tu-project-ref-del-hub>
supabase secrets set WEBHOOK_SECRET=$(openssl rand -hex 24) --project-ref <tu-project-ref-del-hub>
```

Guarda el valor de `WEBHOOK_SECRET` que generaste — lo vas a necesitar en el paso 4 (no se puede recuperar después, igual que los API keys de los dataloggers).

## 3. Despliega la función

```bash
supabase functions deploy notify --project-ref <tu-project-ref-del-hub>
```

Como con `datalogger-ingest`, esta función necesita `verify_jwt = false` porque el Database Webhook no envía un JWT de Supabase. Agrega en `supabase/hub/supabase/config.toml`:
```toml
[functions.notify]
verify_jwt = false
```
Y vuelve a desplegar si ya lo habías hecho antes de agregar esto.

## 4. Configura el Database Webhook (desde el Dashboard, no por SQL)

1. En tu proyecto Supabase del Hub → **Database** → **Webhooks** → **Create a new hook**.
2. Nombre: `notify_critical_alarm`.
3. Tabla: `alarmas_activas`.
4. Eventos: marca **Insert** y **Update** (ambos — la función decide internamente si corresponde enviar correo).
5. Tipo: **HTTP Request**.
6. URL: `https://<tu-project-ref-del-hub>.supabase.co/functions/v1/notify`
7. Method: `POST`.
8. HTTP Headers: agrega uno con key `x-webhook-secret` y value el mismo `WEBHOOK_SECRET` que generaste en el paso 2.
9. Guarda.

## 5. Prueba el flujo completo

En el SQL Editor del proyecto del Hub:
```sql
insert into public.alarmas_activas (
  plant_id, source_alert_id, well_code, parameter_code, severity, status, message, triggered_value, triggered_at
)
select id, gen_random_uuid(), 'IRHS-776', 'TDS', 'critica', 'abierta',
       'Prueba de notificación — TDS crítico en Pozo 1', 27500, now()
from public.plantas where code = 'PUC';
```

Deberías recibir el correo en `NOTIFY_EMAIL_TO` en unos segundos. Si no llega:
1. Revisa **Database → Webhooks → notify_critical_alarm → Logs** en el Dashboard — ahí ves si la llamada al Edge Function se hizo y qué respondió.
2. Revisa los logs de la función: **Edge Functions → notify → Logs**.
3. Confirma que el remitente/destinatario cumple las restricciones de tu cuenta Resend (paso 1).

**Prueba de que NO duplica al reconocer:** después de la prueba anterior, reconoce esa misma alarma desde el panel (`AlarmasActivasPanel`, botón "Reconocer"). Eso dispara un UPDATE con `severity` sin cambiar (`critica` → `critica`) — NO debería llegar un segundo correo. Si llega, hay un bug en `becameCritical()`.
