// apps/pucusana/src/hooks/useDireccionData.js
// Sesión 5D — datos y cálculo para la vista de Dirección técnica.
//
// Fuente del semáforo: la vista `operator_kpi_status` (la misma que usa
// OperatorKPICards), para que Dirección y el monitoreo en vivo nunca se contradigan.
// ⚠️ Supone que esa vista trae `well_id` (useOperatorKPIs filtra por pozo, así que casi seguro).

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export const PARAM = { TDS: 'TDS', CAUDAL: 'CAUDAL_EXTRACCION' };
const PAGE = 1000; // límite por defecto de PostgREST
const KNOWN_STATUS = ['normal', 'atencion', 'critico', 'sin_umbral'];

// Multiplicadores de pendiente acordados en la metodología hidrogeológica.
export const SCENARIOS = [
  { key: 'conservador', label: 'Conservador', k: 1 },
  { key: 'normal', label: 'Normal', k: 1.35 },
  { key: 'agresivo', label: 'Agresivo', k: 1.8 },
];

export const HORIZON_YEARS = 15; // años que dibuja el gráfico
export const MAX_YEARS_REPORTED = 30; // más allá se muestra "más de 30 años"
const MIN_ANNUAL_POINTS = 3; // mínimo de años con datos para proyectar
const STABLE_BAND = 0.005; // |pendiente| < 0.5 % del valor base por año = "estable" (criterio provisional)

// Alerta abierta = sin resolver. Severidad crítica: acepta las variantes probables
// hasta confirmar los valores reales de alerts.severity.
const isOpenAlert = (a) => !a.resolved_at;
const isCriticalAlert = (a) =>
  ['critical', 'critico', 'crítico'].includes(String(a.severity ?? '').toLowerCase());

/* ---------- Proyección simplificada ---------- */

export function annualMeans(rows) {
  const byYear = new Map();
  for (const r of rows) {
    const v = Number(r.value);
    if (!Number.isFinite(v)) continue;
    const y = new Date(r.recorded_at).getUTCFullYear();
    const a = byYear.get(y) ?? { sum: 0, n: 0 };
    a.sum += v;
    a.n += 1;
    byYear.set(y, a);
  }
  return [...byYear]
    .sort((a, b) => a[0] - b[0])
    .map(([year, { sum, n }]) => ({ year, value: sum / n, n }));
}

function linearFit(points) {
  const n = points.length;
  const mx = points.reduce((s, p) => s + p.x, 0) / n;
  const my = points.reduce((s, p) => s + p.y, 0) / n;
  let sxx = 0;
  let sxy = 0;
  for (const p of points) {
    sxx += (p.x - mx) ** 2;
    sxy += (p.x - mx) * (p.y - my);
  }
  if (sxx === 0) return null;
  const slope = sxy / sxx;
  return { slope, intercept: my - slope * mx };
}

export function yearFraction(date = new Date()) {
  const y = date.getUTCFullYear();
  return y + (date - Date.UTC(y, 0, 1)) / (365.25 * 864e5);
}

// Años hasta cruzar un umbral. 0 = ya superado, Infinity = no lo alcanza con esa pendiente.
function yearsTo(threshold, base, slope) {
  if (threshold == null) return null;
  if (base >= threshold) return 0;
  if (slope <= 0) return Infinity;
  return (threshold - base) / slope;
}

// Regresión lineal sobre promedios ANUALES (menos sensible al ruido y a lecturas
// irregulares). Los escenarios multiplican la pendiente; sin piso artificial:
// si la pendiente es <= 0 se informa "sin tendencia al alza" en vez de inventar un plazo.
// Supone un parámetro con dirección "above" (TDS).
export function projectTds(annual, warning, critical, nowX = yearFraction()) {
  if (annual.length < MIN_ANNUAL_POINTS) return null;
  const fit = linearFit(annual.map((a) => ({ x: a.year + 0.5, y: a.value })));
  if (!fit) return null;
  const base = Math.max(0, fit.intercept + fit.slope * nowX);
  const rel = base > 0 ? fit.slope / base : 0;
  const trend = Math.abs(rel) < STABLE_BAND ? 'estable' : fit.slope > 0 ? 'sube' : 'baja';

  const scenarios = SCENARIOS.map((s) => {
    const slope = fit.slope * s.k;
    const series = Array.from({ length: HORIZON_YEARS + 1 }, (_, h) => ({
      x: nowX + h,
      y: Math.max(0, base + slope * h),
    }));
    return {
      ...s,
      slope,
      series,
      toWarning: yearsTo(warning, base, slope),
      toCritical: yearsTo(critical, base, slope),
    };
  });
  return { slope: fit.slope, base, trend, nowX, scenarios, years: annual.length };
}

/* ---------- Carga de datos ---------- */

function toReading(row) {
  if (!row) return { value: null, at: null, warning: null, critical: null, status: 'sin_dato' };
  const value = row.value == null ? null : Number(row.value);
  const num = (v) => (v == null ? null : Number(v));
  return {
    value,
    at: row.recorded_at ?? null,
    warning: num(row.threshold_warning),
    critical: num(row.threshold_critical),
    status: value == null ? 'sin_dato' : KNOWN_STATUS.includes(row.status) ? row.status : 'sin_umbral',
  };
}

async function fetchAllTds() {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('readings')
      .select('well_id, value, recorded_at, parameters!inner(code)')
      .eq('parameters.code', PARAM.TDS)
      .order('recorded_at', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return rows;
}

export function useDireccionData() {
  const [state, setState] = useState({ loading: true, error: null, data: null });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const [wellsRes, kpiRes, alertsRes, tdsRows] = await Promise.all([
        supabase.from('wells').select('id, code, name').order('code'),
        supabase.from('operator_kpi_status').select('*'),
        supabase.from('alerts').select('id, severity, status, resolved_at'),
        fetchAllTds(),
      ]);
      for (const r of [wellsRes, kpiRes, alertsRes]) if (r.error) throw r.error;

      if (kpiRes.data.length > 0 && !('well_id' in kpiRes.data[0])) {
        throw new Error('operator_kpi_status no trae la columna well_id; hay que ajustar useDireccionData.');
      }

      const wells = wellsRes.data.map((w) => {
        const rows = kpiRes.data.filter((r) => r.well_id === w.id);
        return {
          id: w.id,
          code: w.code,
          name: w.name,
          tds: toReading(rows.find((r) => r.parameter_code === PARAM.TDS)),
          caudal: toReading(rows.find((r) => r.parameter_code === PARAM.CAUDAL)),
          annual: annualMeans(tdsRows.filter((r) => r.well_id === w.id)),
        };
      });

      const open = alertsRes.data.filter(isOpenAlert);
      setState({
        loading: false,
        error: null,
        data: {
          wells,
          alerts: { open: open.length, critical: open.filter(isCriticalAlert).length },
          loadedAt: new Date(),
        },
      });
    } catch (error) {
      setState({ loading: false, error, data: null });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, reload: load };
}
