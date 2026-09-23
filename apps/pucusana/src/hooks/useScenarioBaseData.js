import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const MIN_RATE = -0.08; // -8%/año
const MAX_RATE = 0.20;  // +20%/año

/**
 * Estima la tasa de crecimiento anual con una regresión lineal simple
 * sobre ln(valor) vs. años transcurridos, usando TODO el histórico
 * disponible (no solo el primer y último punto — eso era demasiado
 * sensible a ruido en datos reales no monótonos, y causaba que la tasa
 * cayera siempre en el mismo piso mínimo sin importar el escenario).
 */
function estimateAnnualRate(readings) {
  if (readings.length < 3) return null;

  const t0 = new Date(readings[0].recorded_at).getTime();
  const points = readings
    .filter((r) => r.value > 0)
    .map((r) => ({
      x: (new Date(r.recorded_at).getTime() - t0) / (1000 * 60 * 60 * 24 * 365.25),
      y: Math.log(r.value),
    }));

  if (points.length < 3) return null;

  const n = points.length;
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const meanX = sumX / n;
  const meanY = sumY / n;

  const num = points.reduce((s, p) => s + (p.x - meanX) * (p.y - meanY), 0);
  const den = points.reduce((s, p) => s + (p.x - meanX) ** 2, 0);
  if (den === 0) return null;

  const slope = num / den; // pendiente de ln(valor) por año
  const rate = Math.exp(slope) - 1;

  return Math.min(MAX_RATE, Math.max(MIN_RATE, rate));
}

/**
 * useScenarioBaseData(wellId, parameterId)
 * Trae los insumos REALES que el constructor de escenarios necesita:
 *   - baseValue: última lectura observada de TDS para este pozo.
 *   - threshold: umbral crítico REAL configurado en well_parameters.
 *   - baseRate: tasa de crecimiento anual ESTIMADA por regresión lineal
 *     sobre todo el histórico real (no una calibración de modelo
 *     numérico — se etiqueta como estimación en la UI).
 */
export function useScenarioBaseData(wellId, parameterId) {
  const [baseValue, setBaseValue] = useState(null);
  const [baseYear, setBaseYear] = useState(new Date().getFullYear());
  const [threshold, setThreshold] = useState(null);
  const [baseRate, setBaseRate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!wellId || !parameterId) return;
    let isMounted = true;

    async function fetchAll() {
      setLoading(true);

      const [readingsRes, thresholdRes] = await Promise.all([
        supabase
          .from('readings')
          .select('value, recorded_at')
          .eq('well_id', wellId)
          .eq('parameter_id', parameterId)
          .order('recorded_at', { ascending: true }),
        supabase
          .from('well_parameters')
          .select('threshold_critical, threshold_warning')
          .eq('well_id', wellId)
          .eq('parameter_id', parameterId)
          .maybeSingle(),
      ]);

      if (!isMounted) return;

      if (readingsRes.error || thresholdRes.error) {
        setError((readingsRes.error || thresholdRes.error).message);
        setLoading(false);
        return;
      }

      const readings = readingsRes.data ?? [];
      const latest = readings[readings.length - 1];

      setBaseValue(latest?.value ?? null);
      setBaseYear(latest ? new Date(latest.recorded_at).getFullYear() : new Date().getFullYear());
      setThreshold(thresholdRes.data?.threshold_critical ?? null);
      setBaseRate(estimateAnnualRate(readings));

      setError(null);
      setLoading(false);
    }

    fetchAll();
    return () => {
      isMounted = false;
    };
  }, [wellId, parameterId]);

  return { baseValue, baseYear, threshold, baseRate, loading, error };
}
