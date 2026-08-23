import React, { useMemo } from 'react';
import { useIngestionStatus } from '../hooks/useIngestionStatus';
import './IngestionStatusPanel.css';

const STATUS_META = {
  al_dia:      { label: 'Al día',        dotClass: 'dot--verde' },
  atrasado:    { label: 'Atrasado',      dotClass: 'dot--amarillo' },
  critico:     { label: 'Crítico',       dotClass: 'dot--rojo' },
  sin_umbral:  { label: 'Sin umbral',    dotClass: 'dot--gris' },
};

function formatRelativeTime(dateIso) {
  const diffMs = Date.now() - new Date(dateIso).getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return 'hace instantes';
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `hace ${diffH} h`;
  const diffD = Math.round(diffH / 24);
  return `hace ${diffD} d`;
}

function formatAbsoluteTime(dateIso) {
  return new Date(dateIso).toLocaleString('es-PE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function StatusDot({ status }) {
  const meta = STATUS_META[status] ?? STATUS_META.sin_umbral;
  return (
    <span className="ingestion-status-cell">
      <span className={`ingestion-dot ${meta.dotClass}`} aria-hidden="true" />
      <span>{meta.label}</span>
    </span>
  );
}

export function IngestionStatusPanel() {
  const { rows, loading, error, lastFetchedAt, refresh } = useIngestionStatus();

  const groupedByWell = useMemo(() => {
    const groups = new Map();
    for (const row of rows) {
      if (!groups.has(row.well_code)) {
        groups.set(row.well_code, { well_code: row.well_code, well_name: row.well_name, items: [] });
      }
      groups.get(row.well_code).items.push(row);
    }
    return Array.from(groups.values());
  }, [rows]);

  return (
    <section className="ingestion-panel-card">
      <header className="ingestion-panel-header">
        <div>
          <span className="ingestion-panel-eyebrow">Monitoreo de ingesta</span>
          <h2 className="ingestion-panel-title">Estado de últimas lecturas</h2>
        </div>
        <button
          type="button"
          className="ingestion-refresh-btn"
          onClick={refresh}
          disabled={loading}
        >
          {loading ? 'Actualizando…' : 'Actualizar'}
        </button>
      </header>

      {error && (
        <p className="ingestion-panel-banner ingestion-panel-banner--error" role="alert">
          No se pudo cargar el estado de ingesta: {error}
        </p>
      )}

      {loading && rows.length === 0 && !error && (
        <p className="ingestion-panel-status-text">Cargando…</p>
      )}

      {!loading && !error && rows.length === 0 && (
        <p className="ingestion-panel-status-text">
          Aún no hay lecturas registradas en ningún pozo.
        </p>
      )}

      {groupedByWell.map((group) => (
        <div key={group.well_code} className="ingestion-well-group">
          <h3 className="ingestion-well-title">{group.well_code} — {group.well_name}</h3>
          <table className="ingestion-table">
            <thead>
              <tr>
                <th>Parámetro</th>
                <th>Último valor</th>
                <th>Cuándo</th>
                <th>Fuente</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {group.items.map((row) => (
                <tr key={row.parameter_code}>
                  <td>{row.parameter_name}</td>
                  <td className="ingestion-value-cell">
                    {row.value} <span className="ingestion-unit">{row.parameter_unit}</span>
                  </td>
                  <td>
                    <span title={formatAbsoluteTime(row.recorded_at)}>
                      {formatRelativeTime(row.recorded_at)}
                    </span>
                  </td>
                  <td className="ingestion-source-cell">{row.source}</td>
                  <td><StatusDot status={row.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      <footer className="ingestion-panel-footer">
        <span className="ingestion-legend">
          <span className="ingestion-dot dot--verde" /> Al día
          <span className="ingestion-dot dot--amarillo" /> Atrasado
          <span className="ingestion-dot dot--rojo" /> Crítico
          <span className="ingestion-dot dot--gris" /> Sin umbral definido
        </span>
        {lastFetchedAt && (
          <span className="ingestion-last-fetched">
            Actualizado {formatRelativeTime(lastFetchedAt.toISOString())}
          </span>
        )}
      </footer>
    </section>
  );
}
