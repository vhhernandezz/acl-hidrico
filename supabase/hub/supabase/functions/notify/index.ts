// ============================================================================
// ACL GESTIÓN HÍDRICA — HUB CORPORATIVO
// Edge Function: notify
// Sesión 3-D — recibe el payload de un Database Webhook de Supabase sobre
// 'alarmas_activas' (INSERT o UPDATE) y envía un email vía Resend cuando
// una alarma SE VUELVE crítica (no cuando sigue siéndolo — evita correos
// duplicados cada vez que alguien la reconoce).
//
// Autenticación: header 'x-webhook-secret' — el Database Webhook de
// Supabase se configura para enviar este header con un valor secreto,
// verificado contra el secret WEBHOOK_SECRET de esta función. NO usa
// Supabase Auth (el webhook no tiene sesión de usuario).
//
// Deploy: supabase functions deploy notify --project-ref <ref-del-hub>
// (ejecutar desde la carpeta supabase/hub/)
//
// Secrets necesarios (supabase secrets set ... --project-ref <ref-del-hub>):
//   RESEND_API_KEY   — API key de tu cuenta Resend
//   NOTIFY_EMAIL_TO  — correo fijo que recibe las notificaciones (por ahora)
//   WEBHOOK_SECRET   — valor compartido para validar que la llamada viene
//                      del Database Webhook configurado (no de cualquiera)
//
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY se inyectan automáticamente.
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const NOTIFY_EMAIL_TO = Deno.env.get('NOTIFY_EMAIL_TO')!;
const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET')!;

// Remitente de Resend sin dominio propio verificado. Si más adelante
// verifican un dominio (ej. alertas@acl-hidrico.pe), cambiar aquí.
const FROM_ADDRESS = 'ACL Gestión Hídrica <onboarding@resend.dev>';

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** true si esta alarma ACABA de volverse crítica (no si ya lo era). */
function becameCritical(payload: any): boolean {
  const isCriticalNow = payload.record?.severity === 'critica';
  if (!isCriticalNow) return false;

  if (payload.type === 'INSERT') return true;

  if (payload.type === 'UPDATE') {
    const wasCriticalBefore = payload.old_record?.severity === 'critica';
    return !wasCriticalBefore; // solo si ANTES no era crítica
  }

  return false;
}

function formatFecha(iso: string): string {
  return new Date(iso).toLocaleString('es-PE', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Lima',
  });
}

async function sendEmail({ plantaNombre, alarma }: { plantaNombre: string; alarma: any }) {
  const subject = `🔴 Alarma crítica — ${plantaNombre} — ${alarma.parameter_code}`;
  const html = `
    <h2 style="color:#b3422f;">Alarma crítica</h2>
    <table cellpadding="6" style="border-collapse:collapse;">
      <tr><td><strong>Planta</strong></td><td>${plantaNombre}</td></tr>
      <tr><td><strong>Pozo</strong></td><td>${alarma.well_code}</td></tr>
      <tr><td><strong>Parámetro</strong></td><td>${alarma.parameter_code}</td></tr>
      <tr><td><strong>Valor</strong></td><td>${alarma.triggered_value ?? '—'}</td></tr>
      <tr><td><strong>Mensaje</strong></td><td>${alarma.message}</td></tr>
      <tr><td><strong>Momento</strong></td><td>${formatFecha(alarma.triggered_at)}</td></tr>
    </table>
    <p style="color:#5b6b6a; font-size:0.85rem;">
      Este correo se generó automáticamente desde el panel de Alarmas Activas del Hub.
    </p>
  `;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: [NOTIFY_EMAIL_TO],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Resend respondió ${res.status}: ${errBody}`);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Método no permitido. Usa POST.' }, 405);
  }

  const secretHeader = req.headers.get('x-webhook-secret');
  if (secretHeader !== WEBHOOK_SECRET) {
    return jsonResponse({ error: 'Secreto de webhook inválido.' }, 401);
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: 'Body inválido: se esperaba JSON.' }, 400);
  }

  if (!becameCritical(payload)) {
    return jsonResponse({ ok: true, skipped: true, reason: 'no es una nueva condición crítica' }, 200);
  }

  const alarma = payload.record;
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: planta } = await supabase
    .from('plantas')
    .select('name')
    .eq('id', alarma.plant_id)
    .maybeSingle();

  try {
    await sendEmail({ plantaNombre: planta?.name ?? 'Planta desconocida', alarma });
  } catch (e) {
    return jsonResponse({ error: 'No se pudo enviar el correo.', details: String(e) }, 500);
  }

  return jsonResponse({ ok: true, notified: true, to: NOTIFY_EMAIL_TO }, 200);
});
