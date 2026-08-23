# datalogger-ingest (Edge Function)

Endpoint de ingesta para dataloggers físicos instalados en los pozos de Pucusana. Recibe conductividad eléctrica (CE) y nivel de agua, valida, y los registra en `readings` con `source='sensor'`.

## Contrato del endpoint

```
POST https://<tu-proyecto>.supabase.co/functions/v1/datalogger-ingest
Headers:
  x-api-key: <api key del dispositivo>
  Content-Type: application/json

Body:
{
  "timestamp": "2026-07-27T10:15:00Z",
  "ce": 12500.5,
  "nivel": 24.3
}
```

**Respuesta exitosa (200):**
```json
{ "ok": true, "well_id": "...", "device_code": "DL-POZO1-01", "inserted_readings": 2 }
```

**Errores posibles:**
- `401` — falta `x-api-key`, o el key no corresponde a ningún datalogger activo.
- `400` — validación fallida (`timestamp`/`ce`/`nivel` faltantes o fuera de rango plausible, o el nivel excede la profundidad conocida del pozo).
- `405` — método distinto de POST.
- `500` — error interno (catálogo de parámetros incompleto, error de base de datos).

## Desplegar la función

```bash
# Desde la carpeta supabase/pucusana/ de tu repo, con Supabase CLI instalado y logueado
supabase functions deploy datalogger-ingest --project-ref <tu-project-ref>
```

No necesitas configurar `SUPABASE_URL` ni `SUPABASE_SERVICE_ROLE_KEY` manualmente — Supabase las inyecta automáticamente en cada Edge Function del proyecto.

## Registrar un datalogger nuevo

El API key **nunca se guarda en texto plano** en la base — solo su hash SHA-256. Por eso el flujo es: generas el key localmente, guardas el hash en Supabase, y grabas el key en claro directo en el dispositivo (o en un lugar seguro, como un gestor de secretos).

**1. Genera el key y su hash** (Git Bash / terminal Linux / Mac):
```bash
KEY=$(openssl rand -hex 32)
echo "API key (grábalo en el datalogger, NO se puede recuperar después): $KEY"
echo -n "$KEY" | sha256sum
```
Copia el key generado (para el dispositivo) y el hash resultante (para la base de datos).

**2. Inserta el datalogger en Supabase** (SQL Editor del proyecto Pucusana):
```sql
insert into public.dataloggers (well_id, device_code, api_key_hash, notes)
select id, 'DL-POZO1-01', '<pega aquí el hash>', 'Datalogger CE + nivel, instalado en Pozo 1'
from public.wells
where code = 'IRHS-776';
```
Repite con `code = 'IRHS-777'` (Pozo 3) para el segundo dispositivo, con otro `device_code` y otro key/hash generado por separado (nunca reuses el mismo key en dos dispositivos).

**3. Configura el datalogger físico** para que haga POST a la URL del endpoint con el header `x-api-key: <el key en claro>`.

## Desactivar o rotar un datalogger

```sql
-- Desactivar (deja de aceptar datos, sin borrar el historial ya cargado)
update public.dataloggers set is_active = false where device_code = 'DL-POZO1-01';

-- Rotar el key: genera un nuevo key/hash (paso 1) y actualiza
update public.dataloggers set api_key_hash = '<nuevo hash>' where device_code = 'DL-POZO1-01';
```

## Monitoreo básico

```sql
-- Ver qué dataloggers no han reportado en las últimas 24 horas (posible falla de campo)
select device_code, well_id, last_seen_at
from public.dataloggers
where is_active = true
  and (last_seen_at is null or last_seen_at < now() - interval '24 hours');
```
