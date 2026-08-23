import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

/**
 * Umbrales del semáforo, como múltiplo de expected_frequency_hours:
 *  - al_dia:   antigüedad <= 1x  la frecuencia esperada
 *  - atrasado: antigüedad <= 3x  la frecuencia esperada
 *  - critico:  antigüedad >  3x  la frecuencia esperada
 *  - sin_umbral: el parámetro no tiene expected_frequency_hours configurado
 */
const ATRASADO_MULTIPLIER = 3;

export function computeStatus(recordedAt, expectedFrequencyHours) {
  if (!expectedFrequencyHours) return 'sin_umbral';
  const ageHours = (Date.now() - new Date(recordedAt).getTime()) / (1000 * 60 * 60);
  if (ageHours <= expectedFrequencyHours) return 'al_dia';
  if (ageHours <= expectedFrequencyHours * ATRASADO_MULTIPLIER) return 'atrasado';
  return 'critico';
}

/**
 * useIngestionStatus(pollIntervalMs)
 * Trae la última lectura por pozo+parámetro desde la vista
 * 'latest_readings_status' y calcula el estado de recencia de cada una.
 * Se refresca solo cada `pollIntervalMs` (default 60s) y expone un
 * refresh() manual.
 */
export function useIngestionStatus(pollIntervalMs = 60000) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastFetchedAt, setLastFetchedAt] = useState(null);
  const timerRef = useRef(null);

  const fetchStatus = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from('latest_readings_status')
      .select('*')
      .order('well_code', { ascending: true })
      .order('parameter_code', { ascending: true });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      const withStatus = (data ?? []).map((row) => ({
        ...row,
        status: computeStatus(row.recorded_at, row.expected_frequency_hours),
      }));
      setRows(withStatus);
      setError(null);
    }
    setLastFetchedAt(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStatus();
    timerRef.current = setInterval(fetchStatus, pollIntervalMs);
    return () => clearInterval(timerRef.current);
  }, [fetchStatus, pollIntervalMs]);

  return { rows, loading, error, lastFetchedAt, refresh: fetchStatus };
}
