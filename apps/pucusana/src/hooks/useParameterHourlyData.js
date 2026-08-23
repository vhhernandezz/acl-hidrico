import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

/** Trunca una fecha a la hora exacta (minutos/segundos a 0), en hora local. */
function truncateToHour(date) {
  const d = new Date(date);
  d.setMinutes(0, 0, 0);
  return d;
}

/** Agrupa lecturas crudas en baldes por hora, devolviendo el promedio de cada balde. */
function bucketHourly(readings) {
  const buckets = new Map();

  for (const r of readings) {
    const hourKey = truncateToHour(r.recorded_at).toISOString();
    const bucket = buckets.get(hourKey) ?? { sum: 0, count: 0 };
    bucket.sum += r.value;
    bucket.count += 1;
    buckets.set(hourKey, bucket);
  }

  return Array.from(buckets.entries())
    .map(([hourIso, { sum, count }]) => ({
      hourIso,
      avgValue: Number((sum / count).toFixed(2)),
      count,
    }))
    .sort((a, b) => new Date(a.hourIso) - new Date(b.hourIso));
}

/**
 * useParameterHourlyData(wellId, parameterId, parameterCode, hoursWindow = 48)
 * Versión genérica de useCEHourlyData (Sesión 2-A): carga las lecturas de
 * CUALQUIER parámetro para un pozo en la ventana dada, las agrega por hora,
 * y se mantiene en vivo vía Realtime.
 *
 * `parameterCode` se usa solo para nombrar el canal de Realtime de forma
 * única — necesario porque puede haber varios gráficos (distintos
 * parámetros) suscritos al mismo pozo simultáneamente.
 */
export function useParameterHourlyData(wellId, parameterId, parameterCode, hoursWindow = 48) {
  const [rawReadings, setRawReadings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [realtimeStatus, setRealtimeStatus] = useState('conectando');

  useEffect(() => {
    if (!wellId || !parameterId) return;
    let isMounted = true;

    async function fetchInitial() {
      setLoading(true);
      const since = new Date(Date.now() - hoursWindow * 60 * 60 * 1000).toISOString();

      const { data, error: fetchError } = await supabase
        .from('readings')
        .select('id, recorded_at, value')
        .eq('well_id', wellId)
        .eq('parameter_id', parameterId)
        .gte('recorded_at', since)
        .order('recorded_at', { ascending: true });

      if (!isMounted) return;

      if (fetchError) {
        setError(fetchError.message);
      } else {
        setRawReadings(data ?? []);
        setError(null);
      }
      setLoading(false);
    }

    fetchInitial();
    return () => {
      isMounted = false;
    };
  }, [wellId, parameterId, hoursWindow]);

  useEffect(() => {
    if (!wellId || !parameterId) return;

    setRealtimeStatus('conectando');

    // Nombre de canal único por pozo + parámetro: evita colisiones cuando
    // hay varios gráficos del mismo pozo suscritos a la vez (Sesión 2-B).
    const channel = supabase
      .channel(`readings-${wellId}-${parameterCode}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'readings',
          filter: `well_id=eq.${wellId}`,
        },
        (payload) => {
          const row = payload.new;
          if (row.parameter_id !== parameterId) return; // filtro por parámetro en el cliente

          setRawReadings((prev) => {
            const cutoff = Date.now() - hoursWindow * 60 * 60 * 1000;
            const next = [...prev, { id: row.id, recorded_at: row.recorded_at, value: row.value }];
            return next.filter((r) => new Date(r.recorded_at).getTime() >= cutoff);
          });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setRealtimeStatus('conectado');
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setRealtimeStatus('error');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [wellId, parameterId, parameterCode, hoursWindow]);

  const hourlyData = useMemo(() => bucketHourly(rawReadings), [rawReadings]);

  return { hourlyData, rawCount: rawReadings.length, loading, error, realtimeStatus };
}
