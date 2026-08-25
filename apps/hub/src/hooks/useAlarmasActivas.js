import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const ACTIVE_STATUSES = ['abierta', 'reconocida'];

/**
 * useAlarmasActivas({ plantaId, severity })
 * Trae las alarmas activas (status = abierta | reconocida) del Hub, con
 * filtros opcionales por planta y por nivel de severidad. Incluye el
 * nombre/código de la planta vía el join con 'plantas'. Se refresca solo
 * cuando llega un cambio por Realtime (nueva alarma, reconocimiento, etc.)
 * y expone acknowledge(id) para el botón "Reconocer".
 */
export function useAlarmasActivas({ plantaId, severity } = {}) {
  const [alarmas, setAlarmas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAlarmas = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('alarmas_activas')
      .select('*, plantas(code, name)')
      .in('status', ACTIVE_STATUSES)
      .order('triggered_at', { ascending: false });

    if (plantaId) query = query.eq('plant_id', plantaId);
    if (severity) query = query.eq('severity', severity);

    const { data, error: fetchError } = await query;

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setAlarmas(data ?? []);
      setError(null);
    }
    setLoading(false);
  }, [plantaId, severity]);

  useEffect(() => {
    fetchAlarmas();

    const channel = supabase
      .channel('alarmas-activas-panel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'alarmas_activas' },
        () => fetchAlarmas()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAlarmas]);

  const acknowledge = useCallback(async (alarmaId) => {
    const { error: ackError } = await supabase
      .from('alarmas_activas')
      .update({ status: 'reconocida', acknowledged_at: new Date().toISOString() })
      .eq('id', alarmaId);

    if (ackError) throw ackError;
    // El propio Realtime va a disparar el refetch; no hace falta actualizar el estado a mano.
  }, []);

  return { alarmas, loading, error, acknowledge, refresh: fetchAlarmas };
}
