import React, { useState } from 'react';
import { usePlantas } from '../hooks/usePlantas';
import { useAlarmasActivas } from '../hooks/useAlarmasActivas';
import './AlarmasActivasPanel.css';

const SEVERITY_META = {
  info:     { label: 'Info',     className: 'aa-badge--info' },
  atencion: { label: 'Atención', className: 'aa-badge--atencion' },
  critica:  { label: 'Crítica',  className: 'aa-badge--critica' },
};

const STATUS_META = {
  abierta:    { label: 'Abierta',    className: 'aa-status--abierta' },
  reconocida: { label: 'Reconocida', className: 'aa-status--reconocida' },
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

function AlarmaRow({ alarma, onAcknowledge, acknowledging }) {
  const sevMeta = SEVERITY_META[alarma.severity] ?? SEVERITY_META.info;
  const statusMeta = STATUS_META[alarma.status] ?? STATUS_META.abierta;

  return (
    <tr>
      <td>
        <span className="aa-planta-code">{alarma.plantas?.code}</span>
        <span className="aa-planta-name">{alarma.plantas?.name}</span>
      </td>
      <td>{alarma.well_code}</td>
      <td>{alarma.parameter_code}</td>
      <td><span className={`aa-badge ${sevMeta.className}`}>{sevMeta.label}</span></td>
      <td className="aa-message-cell">{alarma.message}</td>
      <td title={new Date(alarma.triggered_at).toLocaleString('es-PE')}>
        {formatRelativeTime(alarma.triggered_at)}
      </td>
      <td><span className={`aa-status ${statusMeta.className}`}>{statusMeta.label}</span></td>
      <td>
        {alarma.status === 'abierta' ? (
          <button
            type="button"
            className="aa-ack-btn"
            disabled={acknowledging}
            onClick={() => onAcknowledge(alarma.id)}
          >
            {acknowledging ? 'Reconociendo…' : 'Reconocer'}
          </button>
        ) : (
          <span className="aa-ack-done">
            {alarma.acknowledged_at ? formatRelativeTime(alarma.acknowledged_at) : '—'}
          </span>
        )}
      </td>
    </tr>
  );
}

export function AlarmasActivasPanel() {
  const { plantas, loading: loadingPlantas } = usePlantas();
  const [plantaId, setPlantaId] = useState('');
  const [severity, setSeverity] = useState('');
  const [ackingId, setAckingId] = useState(null);
  const [ackError, setAckError] = useState(null);

  const { alarmas, loading, error, acknowledge } = useAlarmasActivas({
    plantaId: plantaId || undefined,
    severity: severity || undefined,
  });

  async function handleAcknowledge(id) {
    setAckingId(id);
    setAckError(null);
    try {
      await acknowledge(id);
    } catch (e) {
      setAckError(e.message);
    } finally {
      setAckingId(null);
    }
  }

  return (
    <section className="aa-panel">
      <header className="aa-panel-header">
        <div>
          <span className="aa-eyebrow">Hub corporativo</span>
          <h2 className="aa-title">Alarmas activas</h2>
        </div>
        <span className="aa-count">{alarmas.length} activa{alarmas.length === 1 ? '' : 's'}</span>
      </header>

      <div className="aa-filters">
        <div className="aa-filter-field">
          <label htmlFor="aa-planta-filter" className="aa-filter-label">Planta</label>
          <select
            id="aa-planta-filter"
            className="aa-filter-select"
            value={plantaId}
            onChange={(e) => setPlantaId(e.target.value)}
            disabled={loadingPlantas}
          >
            <option value="">Todas</option>
            {plantas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}{!p.sync_enabled ? ' (sin sincronizar)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="aa-filter-field">
          <label htmlFor="aa-severity-filter" className="aa-filter-label">Nivel</label>
          <select
            id="aa-severity-filter"
            className="aa-filter-select"
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
          >
            <option value="">Todos</option>
            <option value="info">Info</option>
            <option value="atencion">Atención</option>
            <option value="critica">Crítica</option>
          </select>
        </div>
      </div>

      {error && (
        <p className="aa-banner aa-banner--error" role="alert">No se pudo cargar: {error}</p>
      )}
      {ackError && (
        <p className="aa-banner aa-banner--error" role="alert">No se pudo reconocer: {ackError}</p>
      )}

      {loading && <p className="aa-status-text">Cargando…</p>}

      {!loading && !error && alarmas.length === 0 && (
        <p className="aa-status-text">
          Sin alarmas activas{plantaId || severity ? ' con estos filtros' : ''}.
        </p>
      )}

      {!loading && alarmas.length > 0 && (
        <div className="aa-table-wrap">
          <table className="aa-table">
            <thead>
              <tr>
                <th>Planta</th>
                <th>Pozo</th>
                <th>Parámetro</th>
                <th>Nivel</th>
                <th>Mensaje</th>
                <th>Cuándo</th>
                <th>Estado</th>
                <th>Reconocer</th>
              </tr>
            </thead>
            <tbody>
              {alarmas.map((alarma) => (
                <AlarmaRow
                  key={alarma.id}
                  alarma={alarma}
                  onAcknowledge={handleAcknowledge}
                  acknowledging={ackingId === alarma.id}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
