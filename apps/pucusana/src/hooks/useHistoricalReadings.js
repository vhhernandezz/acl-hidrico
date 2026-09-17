import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

/**
 * useHistoricalReadings(wellId, parameterId, { from, to })
 * Trae lecturas crudas (sin agregar por hora, a diferencia de los hooks de
 * la Fase 2) entre dos fechas — pensado para series largas de cadencia
 * mensual/histórica, no telemetría de alta frecuencia.
 */
export function useHistoricalReadings(wellId, parameterId, { from, to } = {}) {
  const [readings, setReadings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!wellId || !parameterId) return;
    let isMounted = true;

    async function fetchReadings() {
      setLoading(true);
      let query = supabase
        .from('readings')
        .select('id, recorded_at, value, source')
        .eq('well_id', wellId)
        .eq('parameter_id', parameterId)
        .order('recorded_at', { ascending: true });

      if (from) query = query.gte('recorded_at', from);
      if (to) query = query.lte('recorded_at', to);

      const { data, error: fetchError } = await query;

      if (!isMounted) return;

      if (fetchError) {
        setError(fetchError.message);
      } else {
        setReadings(data ?? []);
        setError(null);
      }
      setLoading(false);
    }

    fetchReadings();
    return () => {
      isMounted = false;
    };
  }, [wellId, parameterId, from, to]);

  return { readings, loading, error };
}

/**
 * useWellParameterThreshold(wellId, parameterId)
 * Trae solo los umbrales configurados (well_parameters) para dibujar
 * líneas de referencia en el gráfico histórico.
 */
export function useWellParameterThreshold(wellId, parameterId) {
  const [threshold, setThreshold] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!wellId || !parameterId) return;
    let isMounted = true;

    async function fetchThreshold() {
      setLoading(true);
      const { data } = await supabase
        .from('well_parameters')
        .select('threshold_warning, threshold_critical, direction, is_monitored')
        .eq('well_id', wellId)
        .eq('parameter_id', parameterId)
        .maybeSingle();

      if (!isMounted) return;
      setThreshold(data ?? null);
      setLoading(false);
    }

    fetchThreshold();
    return () => {
      isMounted = false;
    };
  }, [wellId, parameterId]);

  return { threshold, loading };
}
