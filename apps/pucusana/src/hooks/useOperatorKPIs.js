import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const KPI_PARAMETER_CODES = ['TDS', 'NIVEL_AGUA', 'CAUDAL_EXTRACCION'];

/**
 * Calcula el estado operativo de un valor contra sus umbrales.
 * - 'sin_umbral': no hay threshold_warning ni threshold_critical definidos.
 * - direction 'above': valores mayores son peores (ej. TDS, caudal).
 * - direction 'below': valores menores son peores (no usado aún, pero soportado).
 */
export function computeThresholdStatus(value, thresholdWarning, thresholdCritical, direction) {
  if (thresholdWarning == null && thresholdCritical == null) return 'sin_umbral';
  if (value == null) return 'sin_umbral';

  if (direction === 'below') {
    if (thresholdCritical != null && value <= thresholdCritical) return 'critico';
    if (thresholdWarning != null && value <= thresholdWarning) return 'atencion';
    return 'normal';
  }
  // default: 'above'
  if (thresholdCritical != null && value >= thresholdCritical) return 'critico';
  if (thresholdWarning != null && value >= thresholdWarning) return 'atencion';
  return 'normal';
}

/**
 * useOperatorKPIs(wellId)
 * Trae TDS, NIVEL_AGUA y CAUDAL_EXTRACCION más recientes de un pozo desde
 * la vista 'operator_kpi_status' (última lectura + umbrales), calcula el
 * estado de cada uno, y se refresca automáticamente cuando llega una
 * lectura nueva de ese pozo (Realtime), sin recargar la página.
 */
export function useOperatorKPIs(wellId) {
  const [kpis, setKpis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!wellId) return;
    let isMounted = true;

    async function fetchKpis() {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('operator_kpi_status')
        .select('*')
        .eq('well_id', wellId)
        .in('parameter_code', KPI_PARAMETER_CODES);

      if (!isMounted) return;

      if (fetchError) {
        setError(fetchError.message);
      } else {
        const withStatus = (data ?? []).map((row) => ({
          ...row,
          status: computeThresholdStatus(row.value, row.threshold_warning, row.threshold_critical, row.direction),
        }));
        // orden fijo y predecible en la UI, independiente del orden que devuelva la vista
        withStatus.sort(
          (a, b) => KPI_PARAMETER_CODES.indexOf(a.parameter_code) - KPI_PARAMETER_CODES.indexOf(b.parameter_code)
        );
        setKpis(withStatus);
        setError(null);
      }
      setLoading(false);
    }

    fetchKpis();

    const channel = supabase
      .channel(`kpi-readings-${wellId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'readings', filter: `well_id=eq.${wellId}` },
        () => {
          // Reconsultamos la vista completa: son solo 3 filas, no vale la
          // pena mantener lógica incremental como en los gráficos horarios.
          fetchKpis();
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [wellId]);

  return { kpis, loading, error };
}
