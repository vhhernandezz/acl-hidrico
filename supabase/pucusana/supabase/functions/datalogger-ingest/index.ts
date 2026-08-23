// ============================================================================
// ACL GESTIÓN HÍDRICA — SPOKE PUCUSANA
// Edge Function: datalogger-ingest
// Sesión 1-B — recibe POST { timestamp, ce, nivel } de un datalogger físico,
// valida, y registra dos lecturas en 'readings' (CE y NIVEL_AGUA).
//
// Autenticación: header 'x-api-key' con el key propio del dispositivo
// (ver tabla 'dataloggers', migración 0008). NO usa Supabase Auth.
//
// Deploy: supabase functions deploy datalogger-ingest --project-ref <ref>
// (ejecutar desde la carpeta supabase/pucusana/)
//
// Variables de entorno usadas (inyectadas automáticamente por Supabase en
// todo Edge Function, no requieren configuración manual):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const CE_PARAMETER_CODE = 'CE';
const NIVEL_PARAMETER_CODE = 'NIVEL_AGUA';

const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000; // 5 minutos de tolerancia de reloj
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 días: más viejo que eso, se rechaza (evita backfills accidentales)

const CE_MIN = 0;
const CE_MAX = 150000; // µS/cm — generoso sobre agua de mar (~50,000 µS/cm)
const NIVEL_MIN = 0;
const NIVEL_MAX_DEFAULT = 300; // m — tope de seguridad si no se conoce la profundidad del pozo
const NIVEL_TOLERANCIA_SOBRE_PROFUNDIDAD_M = 5; // margen sobre depth_m del pozo

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Método no permitido. Usa POST.' }, 405);
  }

  // ---- 1. Autenticación del dispositivo ----
  const apiKey = req.headers.get('x-api-key');
  if (!apiKey) {
    return jsonResponse({ error: "Falta el header 'x-api-key'." }, 401);
  }

  // ---- 2. Parseo del body ----
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Body inválido: se esperaba JSON.' }, 400);
  }

  const { timestamp, ce, nivel } = body ?? {};
  const errors: string[] = [];

  if (!timestamp || typeof timestamp !== 'string') {
    errors.push("El campo 'timestamp' es obligatorio (string ISO 8601, ej. '2026-07-27T10:15:00Z').");
  }
  if (typeof ce !== 'number' || Number.isNaN(ce)) {
    errors.push("El campo 'ce' es obligatorio y debe ser numérico (µS/cm).");
  }
  if (typeof nivel !== 'number' || Number.isNaN(nivel)) {
    errors.push("El campo 'nivel' es obligatorio y debe ser numérico (m).");
  }

  // ---- 3. Validación de timestamp ----
  let recordedAt: Date | null = null;
  if (typeof timestamp === 'string') {
    recordedAt = new Date(timestamp);
    if (Number.isNaN(recordedAt.getTime())) {
      errors.push("El campo 'timestamp' no es una fecha válida.");
      recordedAt = null;
    } else {
      const now = Date.now();
      const ts = recordedAt.getTime();
      if (ts > now + MAX_FUTURE_SKEW_MS) {
        errors.push('El timestamp está en el futuro más allá del margen de tolerancia (5 min).');
      }
      if (ts < now - MAX_AGE_MS) {
        errors.push('El timestamp es demasiado antiguo (más de 30 días). Revisa el reloj del dispositivo.');
      }
    }
  }

  // ---- 4. Validación de rangos plausibles ----
  if (typeof ce === 'number' && (ce < CE_MIN || ce > CE_MAX)) {
    errors.push(`El valor de 'ce' está fuera de rango plausible (${CE_MIN}-${CE_MAX} µS/cm).`);
  }
  if (typeof nivel === 'number' && (nivel < NIVEL_MIN || nivel > NIVEL_MAX_DEFAULT)) {
    errors.push(`El valor de 'nivel' está fuera de rango plausible (${NIVEL_MIN}-${NIVEL_MAX_DEFAULT} m).`);
  }

  if (errors.length > 0) {
    return jsonResponse({ error: 'Validación fallida', details: errors }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // ---- 5. Resolver el datalogger a partir del API key ----
  const apiKeyHash = await sha256Hex(apiKey);
  const { data: datalogger, error: dlError } = await supabase
    .from('dataloggers')
    .select('id, well_id, device_code, is_active, wells(depth_m)')
    .eq('api_key_hash', apiKeyHash)
    .maybeSingle();

  if (dlError) {
    return jsonResponse({ error: 'Error interno validando el datalogger.' }, 500);
  }
  if (!datalogger || !datalogger.is_active) {
    return jsonResponse({ error: 'API key inválida o datalogger inactivo.' }, 401);
  }

  // ---- 6. Validación de dominio: nivel vs. profundidad conocida del pozo ----
  // deno-lint-ignore no-explicit-any
  const wellDepth = (datalogger as any).wells?.depth_m as number | undefined;
  if (typeof wellDepth === 'number' && (nivel as number) > wellDepth + NIVEL_TOLERANCIA_SOBRE_PROFUNDIDAD_M) {
    return jsonResponse(
      {
        error: 'Validación fallida',
        details: [
          `El nivel (${nivel} m) excede la profundidad conocida del pozo (${wellDepth} m) + tolerancia (${NIVEL_TOLERANCIA_SOBRE_PROFUNDIDAD_M} m).`,
        ],
      },
      400
    );
  }

  // ---- 7. Resolver parámetros del catálogo ----
  const { data: parameters, error: paramError } = await supabase
    .from('parameters')
    .select('id, code')
    .in('code', [CE_PARAMETER_CODE, NIVEL_PARAMETER_CODE]);

  if (paramError || !parameters || parameters.length < 2) {
    return jsonResponse(
      { error: "Catálogo incompleto: faltan los parámetros 'CE' y/o 'NIVEL_AGUA'. Corre la migración 0009." },
      500
    );
  }

  const ceParam = parameters.find((p) => p.code === CE_PARAMETER_CODE)!;
  const nivelParam = parameters.find((p) => p.code === NIVEL_PARAMETER_CODE)!;

  // ---- 8. Insertar lecturas ----
  const rowsToInsert = [
    {
      well_id: datalogger.well_id,
      parameter_id: ceParam.id,
      recorded_at: recordedAt!.toISOString(),
      value: ce,
      source: 'sensor',
      notes: `datalogger:${datalogger.device_code}`,
    },
    {
      well_id: datalogger.well_id,
      parameter_id: nivelParam.id,
      recorded_at: recordedAt!.toISOString(),
      value: nivel,
      source: 'sensor',
      notes: `datalogger:${datalogger.device_code}`,
    },
  ];

  const { data: inserted, error: insertError } = await supabase
    .from('readings')
    .insert(rowsToInsert)
    .select('id, parameter_id');

  if (insertError) {
    return jsonResponse({ error: 'No se pudo insertar la lectura.', details: insertError.message }, 500);
  }

  // ---- 9. Actualizar last_seen_at (best-effort, no bloquea la respuesta si falla) ----
  await supabase
    .from('dataloggers')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', datalogger.id);

  return jsonResponse(
    {
      ok: true,
      well_id: datalogger.well_id,
      device_code: datalogger.device_code,
      inserted_readings: inserted?.length ?? 0,
    },
    200
  );
});
