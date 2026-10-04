import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const PAGE_SIZE = 50;
const EXPORT_BATCH_SIZE = 1000; // límite por defecto de PostgREST (max_rows)

function buildQuery({ wellId, parameterId, from, to }) {
  let query = supabase
    .from('readings')
    .select('recorded_at, value, source, wells(code, name), parameters(code, name, unit)', { count: 'exact' })
    .order('recorded_at', { ascending: false });

  if (wellId) query = query.eq('well_id', wellId);
  if (parameterId) query = query.eq('parameter_id', parameterId);
  if (from) query = query.gte('recorded_at', from);
  if (to) query = query.lte('recorded_at', to);

  return query;
}

/**
 * useConsultorReadings(filters)
 * Trae lecturas paginadas (50 por página) para la tabla de datos crudos
 * del consultor externo, con filtros de pozo/parámetro/rango de fechas.
 */
export function useConsultorReadings(filters) {
  const [rows, setRows] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setPage(0);
  }, [filters.wellId, filters.parameterId, filters.from, filters.to]);

  useEffect(() => {
    let isMounted = true;

    async function fetchPage() {
      setLoading(true);
      const { data, error: fetchError, count } = await buildQuery(filters)
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

      if (!isMounted) return;

      if (fetchError) {
        setError(fetchError.message);
      } else {
        setRows(data ?? []);
        setTotalCount(count ?? 0);
        setError(null);
      }
      setLoading(false);
    }

    fetchPage();
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.wellId, filters.parameterId, filters.from, filters.to, page]);

  /**
   * Trae TODAS las filas que coinciden con los filtros (sin paginar), para
   * exportación. Pagina internamente en bloques de 1000 (límite de
   * PostgREST) hasta agotar los resultados.
   */
  const fetchAllForExport = useCallback(async () => {
    const all = [];
    let offset = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data, error: fetchError } = await buildQuery(filters)
        .range(offset, offset + EXPORT_BATCH_SIZE - 1);
      if (fetchError) throw fetchError;
      all.push(...(data ?? []));
      if (!data || data.length < EXPORT_BATCH_SIZE) break;
      offset += EXPORT_BATCH_SIZE;
    }
    return all;
  }, [filters]);

  return {
    rows,
    totalCount,
    page,
    setPage,
    pageCount: Math.max(1, Math.ceil(totalCount / PAGE_SIZE)),
    pageSize: PAGE_SIZE,
    loading,
    error,
    fetchAllForExport,
  };
}
