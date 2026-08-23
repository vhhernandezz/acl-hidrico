import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

/** Trunca una fecha a la hora exacta (minutos/segundos a 0), en hora local. */
function truncateToHour(date) {
  const d = new Date(date);
  d.setMinutes(0, 0, 0);
  return d;
}

/** Agrupa lecturas crudas en baldes por hora, devolviendo el promedio de cada balde. */
function bucketHourly(readings) {
  const buckets = new Map(); // key: ISO de la hora truncada -> { sum, count }

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
      avgCE: Number((sum / count).toFixed(1)),
      count,
    }))
    .sort((a, b) => new Date(a.hourIso) - new Date(b.hourIso));
}

/**
 * useCEHourlyData(wellId, ceParameterId, hoursWindow = 48)
 * Carga las lecturas de CE de las últimas `hoursWindow` horas para un pozo,
 * las agrega por hora, y se mantiene actualizado en vivo suscribiéndose a
 * INSERTs nuevos en 'readings' vía Supabase Realtime (sin recargar la página).
 */
export function useCEHourlyData(wellId, ceParameterId, hoursWindow = 48) {
  const [rawReadings, setRawReadings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [realtimeStatus, setRealtimeStatus] = useState('conectando'); // conectando | conectado | error

  const channelRef = useRef(null);

  // Carga inicial
  useEffect(() => {
    if (!wellId || !ceParameterId) return;
    let isMounted = true;

    async function fetchInitial() {
      setLoading(true);
      const since = new Date(Date.now() - hoursWindow * 60 * 60 * 1000).toISOString();

      const { data, error: fetchError } = await supabase
        .from('readings')
        .select('id, recorded_at, value')
        .eq('well_id', wellId)
        .eq('parameter_id', ceParameterId)
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
  }, [wellId, ceParameterId, hoursWindow]);

  // Suscripción Realtime: agrega cada nueva lectura de CE de este pozo sin recargar
  useEffect(() => {
    if (!wellId || !ceParameterId) return;

    setRealtimeStatus('conectando');

    const channel = supabase
      .channel(`readings-ce-${wellId}`)
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
          // Filtramos por parámetro en el cliente: Realtime solo soporta
          // filtrar por una columna en el servidor (well_id).
          if (row.parameter_id !== ceParameterId) return;

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

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [wellId, ceParameterId, hoursWindow]);

  const hourlyData = useMemo(() => bucketHourly(rawReadings), [rawReadings]);

  return { hourlyData, rawCount: rawReadings.length, loading, error, realtimeStatus };
}
